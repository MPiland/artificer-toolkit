import type { CampaignCharacterReconcileStep } from '@artificer-toolkit/schema/projections/campaignContentPersistence'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { retainCharacterEquipmentRules } from '../characters/acquiredEquipment'
import { readCharacterRecord } from '../characters/documents'
import { readCharacterRow } from '../characters/stateDocuments'
import { readCharacterCampaign } from '../characters/context'
import {
  persistCharacterContextChange,
  reconcileCharacterSourceLoss
} from '../characters/sourceLoss'
import { readCampaignCharacterState } from './characterState'
import { returnDepartingCharacterCurrency } from './currencyDeparture'
import { endDepartedCampaignRunEffects, queueCharacterReconcile } from './characterReconcileSteps'
import { freezeEncounterCharacterStates } from '@artificer-toolkit/encounter-persistence/characterStates'
import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { isRoomHeldRun } from '../liveSessions/authorityGuard'
import { encounterWriteTransaction } from '../encounters/encounterPorts'

/**
 * D81: each listed Character no longer assigned to the Campaign loses what the Campaign put on its
 * play: the effects its Runs applied, slots and maximums its settings or adjustments granted. A
 * room-held Run keeps its maintained states for the room to settle. Called once Convex owns the
 * Character's play: at departure, or when the room's hold on it drops. A deleted Character is
 * skipped: account deletion ends its effects and unheld maintained states before removing it.
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
    // Account deletion already removed the Character's effects with it.
    if (!(await readCharacterRow(ctx, characterId))) continue
    await endDepartedCampaignRunEffects(ctx, campaignId, characterId)
    const record = await readCharacterRow(ctx, characterId)
    if (!record) throw new Error('Departing Character is unavailable.')
    // Campaign adjustments and attunement no longer apply to its stored maximums either.
    await reconcileCharacterSourceLoss({
      ctx,
      record,
      targets: [],
      stateAfterContextChange: readCharacterRecord(record).state as CharacterAuthored['state']
    })
  }
}

/**
 * Caller authorizes the lifecycle operation before changing membership or Campaign authority. The
 * transaction keeps what must commit with the departure (held rules retained, currency returned,
 * open Runs frozen, the assignment and its overlay removed) and queues the Character's D81
 * settlement and source-loss reconcile as its own step (`characterReconcileSteps`).
 */
export async function removeCampaignCharacterAssignment(input: {
  ctx: MutationCtx
  campaign: Doc<'campaigns'>
  assignment: Doc<'campaignCharacterAssignments'>
  actorUserId: string
  reason: Exclude<CampaignCharacterReconcileStep['reason'], 'UNSHARE'>
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
  const { stored: overlay } = await readCampaignCharacterState(ctx, campaign.id, character.id)
  character.state = await retainCharacterEquipmentRules(ctx, character, input.authorityScope)
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
  const persistedContextChange = await persistCharacterContextChange(ctx, record, returned.state)
  await queueCharacterReconcile(ctx, {
    campaignId: campaign.id,
    characterId: character.id,
    actorUserId: input.actorUserId,
    reason: input.reason,
    persistedContextChange,
    change: { kind: 'DEPARTED' }
  })
}
