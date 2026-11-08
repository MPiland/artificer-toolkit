import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  campaignCharacterReconcileStepSchema,
  type CampaignCharacterReconcileStep
} from '@artificer-toolkit/schema/projections/campaignContentPersistence'
import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterSourceLossTarget } from '@artificer-toolkit/rules-runtime/character/characterSourceLoss'
import { endCharacterRunEffects } from '@artificer-toolkit/encounter-persistence/characterRunEffects'
import type { MutationCtx } from '../_generated/server'
import { internalMutation } from '../lib/mutations'
import { readCharacterDraft, readCharacterRecord } from '../characters/documents'
import { readCharacterRow } from '../characters/stateDocuments'
import { readCharacterSourceAccessLoss, readStillLostSources } from '../characters/sourceAccessLoss'
import { reconcileCharacterSourceLoss } from '../characters/sourceLoss'
import { isRoomHeldRun, readCharacterLiveHold } from '../liveSessions/authorityGuard'
import { encounterWriteTransaction } from '../encounters/encounterPorts'

const runReference = makeFunctionReference<'mutation', CampaignCharacterReconcileStep, null>(
  'campaigns/characterReconcileSteps:run'
)

/** Queues one Character's reconcile after the caller's authority change commits. */
export async function queueCharacterReconcile(
  ctx: MutationCtx,
  step: Omit<CampaignCharacterReconcileStep, 'stepId'>
) {
  await ctx.scheduler.runAfter(0, runReference, { ...step, stepId: crypto.randomUUID() })
}

/**
 * D81: ends what the Campaign's Runs put on a Character no longer assigned to it. A room-held Run
 * keeps its maintained states for the room to settle.
 */
export async function endDepartedCampaignRunEffects(
  ctx: MutationCtx,
  campaignId: string,
  characterId: string
) {
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
}

/**
 * The queued reconcile. Its transaction reads one Character. Fences, in order: a step whose event
 * exists already ran; a deleted Character has nothing left to reconcile; a removed source the
 * Character can read again (shared again, or now owned) is no longer lost; a departed Character
 * assigned to the Campaign again, or held by the live table, keeps its Run effects (the hold's
 * drop settles them).
 */
export const run = internalMutation({
  args: zodToConvexFields(campaignCharacterReconcileStepSchema.shape),
  returns: v.null(),
  handler: async (ctx, args) => {
    const step = campaignCharacterReconcileStepSchema.parse(args)
    const done = await ctx.db
      .query('campaignEvents')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', step.campaignId).eq('commandId', step.stepId)
      )
      .first()
    if (done) return null
    if (!(await readCharacterRow(ctx, step.characterId))) return null
    if (step.change.kind === 'DEPARTED') {
      const assignment = await ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_characterId', (q) => q.eq('characterId', step.characterId))
        .unique()
      if (
        assignment?.campaignId !== step.campaignId &&
        !(await readCharacterLiveHold(ctx, step.characterId))
      )
        await endDepartedCampaignRunEffects(ctx, step.campaignId, step.characterId)
    }
    const record = await readCharacterRow(ctx, step.characterId)
    if (!record) throw new Error('Reconciled Character is unavailable.')
    const character = readCharacterRecord(record) as CharacterAuthored
    let targets: CharacterSourceLossTarget[]
    if (step.change.kind === 'DEPARTED') {
      const draftRecord = await ctx.db
        .query('characterDrafts')
        .withIndex('by_characterId', (q) => q.eq('characterId', character.id))
        .unique()
      targets = await readCharacterSourceAccessLoss(ctx, character)
      if (draftRecord)
        targets.push(
          ...(await readCharacterSourceAccessLoss(
            ctx,
            (await readCharacterDraft(ctx, draftRecord, record)).payload
              .character as CharacterAuthored
          ))
        )
    } else targets = await readStillLostSources(ctx, character, step.change.removed)
    const result = await reconcileCharacterSourceLoss({
      ctx,
      record,
      targets,
      // The Campaign context changed: evaluate the Character even when no source it uses was lost.
      stateAfterContextChange: character.state,
      persistedContextChange: step.persistedContextChange
    })
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', step.campaignId))
      .unique()
    if (!result || !campaign) return null
    await ctx.db.insert(
      'campaignEvents',
      campaignStoredEventSchema.parse({
        id: crypto.randomUUID(),
        campaignId: step.campaignId,
        actorUserId: step.actorUserId,
        type: 'CAMPAIGN_CHARACTER_RECONCILED',
        visibility: 'SUBJECT',
        subjectCharacterId: step.characterId,
        payloadJson: JSON.stringify(
          step.change.kind === 'DEPARTED'
            ? {
                reason: step.reason,
                characterId: step.characterId,
                status: result.status,
                streamVersion: result.streamVersion,
                removedSources: result.removedSources,
                draftOnly: result.draftOnly
              }
            : {
                reason: step.reason,
                removalEventId: step.change.removalEventId,
                removedSources: result.removedSources,
                status: result.status,
                streamVersion: result.streamVersion,
                draftOnly: result.draftOnly
              }
        ),
        visibleInHistory: true,
        commandId: step.stepId,
        createdAt: new Date().toISOString()
      })
    )
    return null
  }
})
