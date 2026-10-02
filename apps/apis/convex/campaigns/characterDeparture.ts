import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { retainCharacterEquipmentRules } from '../characters/acquiredEquipment'
import { readCharacterRecord, readCharacterDraft } from '../characters/documents'
import { readCharacterRow } from '../characters/stateDocuments'
import { readCharacterCampaign } from '../characters/context'
import { readCharacterSourceAccessLoss } from '../characters/sourceAccessLoss'
import { writeCharacterRecord } from '../characters/characterWrites'
import { reconcileCharacterSourceLoss } from '../characters/sourceLoss'
import { readCampaignCharacterState } from './characterState'
import { returnDepartingCharacterCurrency } from './currencyDeparture'
import { freezeEncounterCharacterStates } from '@artificer-toolkit/encounter-persistence/characterStates'
import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { endCharacterRunEffects } from '@artificer-toolkit/encounter-persistence/characterRunEffects'
import { isRoomHeldRun, readCharacterLiveHold } from '../liveSessions/authorityGuard'
import { encounterWriteTransaction } from '../encounters/encounterPorts'

/**
 * D81: each listed Character no longer assigned to the Campaign loses what the Campaign put on its
 * play: the effects its Runs applied, slots and maximums its settings or adjustments granted. A
 * room-held Run keeps its maintained states for the room to settle. Called once Convex owns the
 * Character's play: at departure, or when the room's hold on it drops.
 */
export async function settleDepartedCharacters(
  ctx: MutationCtx,
  campaignId: string,
  characterIds: readonly string[]
) {
  for (const characterId of characterIds) {
    const assignment = await ctx.db
      .query('campaignCharacterAssignments')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .unique()
    if (assignment?.campaignId === campaignId) continue
    await endCharacterRunEffects(encounterWriteTransaction(ctx), {
      characterId,
      classifyRun: async (encounterId) => {
        const run = await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', encounterId))
          .unique()
        if (run?.campaignId !== campaignId) return null
        return (await isRoomHeldRun(ctx, run)) ? 'ROOM_HELD' : 'TERMINABLE'
      },
      occurredAt: new Date().toISOString()
    })
    const record = await readCharacterRow(ctx, characterId)
    if (!record) throw new Error('Departing Character is unavailable.')
    await reconcileCharacterSourceLoss({
      ctx,
      record,
      targets: [],
      stateAfterContextChange: readCharacterRecord(record).state as CharacterAuthored['state']
    })
    // Campaign adjustments and attunement no longer apply to the stored maximum hit points.
    const departed = await readCharacterRow(ctx, characterId)
    if (!departed) throw new Error('Departing Character is unavailable.')
    await writeCharacterRecord(ctx, {
      current: departed,
      fields: {
        streamVersion: departed.play.streamVersion,
        updatedAt: departed.updatedAt
      }
    })
  }
}

/** Caller authorizes the lifecycle operation before changing membership or Campaign authority. */
export async function removeCampaignCharacterAssignment(input: {
  ctx: MutationCtx
  campaign: Doc<'campaigns'>
  assignment: Doc<'campaignCharacterAssignments'>
  actorUserId: string
  reason: string
  authorityScope?: import('./authority').CampaignInternalScope
}) {
  const { ctx, campaign, assignment } = input
  const record = await readCharacterRow(ctx, assignment.characterId)
  if (!record || record.userId !== assignment.userId || assignment.campaignId !== campaign.id)
    throw new Error('Stored Campaign Character assignment mismatch.')
  const character = readCharacterRecord(record) as CharacterAuthored
  if (
    (await readCharacterCampaign(ctx, character, character.userId, input.authorityScope))?.id !==
    campaign.id
  )
    throw new Error('Stored Campaign Character assignment mismatch.')
  const [{ stored: overlay }, draftRecord] = await Promise.all([
    readCampaignCharacterState(ctx, campaign.id, character.id),
    ctx.db
      .query('characterDrafts')
      .withIndex('by_characterId', (q) => q.eq('characterId', character.id))
      .unique()
  ])
  character.state = await retainCharacterEquipmentRules(ctx, character, input.authorityScope)
  const draft = draftRecord ? await readCharacterDraft(ctx, draftRecord, record) : null
  const returned = await returnDepartingCharacterCurrency({
    ctx,
    campaign,
    characterId: character.id,
    actorUserId: input.actorUserId,
    reason: input.reason,
    state: character.state
  })
  // The Campaign's open Runs stop reading the Character and keep its last projected health;
  // the room reconciles the Runs it holds itself (D74).
  for (const status of ['PREPARED', 'ACTIVE'] as const)
    for (const run of await ctx.db
      .query('encounterRuns')
      .withIndex('by_campaignId_status', (q) =>
        q.eq('campaignId', campaign.id).eq('status', status)
      )
      .collect())
      if (!(await isRoomHeldRun(ctx, run)))
        await freezeEncounterCharacterStates(
          encounterWriteTransaction(ctx),
          readRunState(run),
          character.id
        )
  await ctx.db.delete(assignment._id)
  if (overlay) await ctx.db.delete(overlay._id)
  for await (const prompt of ctx.db
    .query('campaignClockRecoveryPrompts')
    .withIndex('by_campaignId_characterId', (q) =>
      q.eq('campaignId', campaign.id).eq('characterId', character.id)
    ))
    await ctx.db.delete(prompt._id)
  const targets = await readCharacterSourceAccessLoss(ctx, character)
  if (draft)
    targets.push(
      ...(await readCharacterSourceAccessLoss(ctx, draft.payload.character as CharacterAuthored))
    )
  const result = await reconcileCharacterSourceLoss({
    ctx,
    record,
    targets,
    stateAfterContextChange: returned.state
  })
  // A held Character's play is the room's until its hold drops, which settles it then.
  if (!(await readCharacterLiveHold(ctx, character.id)))
    await settleDepartedCharacters(ctx, campaign.id, [character.id])
  if (result)
    await ctx.db.insert(
      'campaignEvents',
      campaignStoredEventSchema.parse({
        id: crypto.randomUUID(),
        campaignId: campaign.id,
        actorUserId: input.actorUserId,
        type: 'CAMPAIGN_CHARACTER_RECONCILED',
        visibility: 'SUBJECT',
        subjectCharacterId: character.id,
        visibleInHistory: true,
        createdAt: new Date().toISOString(),
        payloadJson: JSON.stringify({
          reason: input.reason,
          characterId: character.id,
          status: result.status,
          streamVersion: result.streamVersion,
          removedSources: result.removedSources,
          draftOnly: result.draftOnly
        })
      })
    )
}
