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
import { CAMPAIGN_BACKGROUND_SETTLE_MS } from '../characters/sheetSectionStores'
import { readCharacterRow } from '../characters/stateDocuments'
import { readCharacterSourceAccessLoss, readStillLostSources } from '../characters/sourceAccessLoss'
import { reconcileCharacterSourceLoss } from '../characters/sourceLoss'
import { isRoomHeldRun, readCharacterLiveHold } from '../liveSessions/authorityGuard'
import { encounterCharacterEffectsTransaction } from '../encounters/characterEffectsTransaction'

const runReference = makeFunctionReference<'mutation', CampaignCharacterReconcileStep, null>(
  'campaigns/characterReconcileSteps:run'
)
const verifyReference = makeFunctionReference<'mutation', CampaignCharacterReconcileStep, null>(
  'campaigns/characterReconcileSteps:verify'
)

/** How long after a run is queued its check looks at whether it landed. */
const CHARACTER_RECONCILE_CHECK_MS = 2_000
/** Runs a step gets, the first included, before it stays pending as exhausted. */
export const CHARACTER_RECONCILE_ATTEMPTS = 3

/** Queues the step's run and the check that queues it again if the run fails or times out. */
async function scheduleRun(ctx: MutationCtx, step: CampaignCharacterReconcileStep) {
  const scheduledId = await ctx.scheduler.runAfter(
    CAMPAIGN_BACKGROUND_SETTLE_MS,
    runReference,
    step
  )
  await ctx.scheduler.runAfter(
    CAMPAIGN_BACKGROUND_SETTLE_MS + CHARACTER_RECONCILE_CHECK_MS,
    verifyReference,
    step
  )
  return scheduledId
}

function readPendingReconcile(ctx: MutationCtx, stepId: string) {
  return ctx.db
    .query('campaignCharacterReconciles')
    .withIndex('by_stepId', (q) => q.eq('stepId', stepId))
    .unique()
}

/** Queues one Character's reconcile after the caller's authority change commits. */
export async function queueCharacterReconcile(
  ctx: MutationCtx,
  input: Omit<CampaignCharacterReconcileStep, 'stepId'>
) {
  const step = { ...input, stepId: crypto.randomUUID() }
  await ctx.db.insert('campaignCharacterReconciles', {
    stepId: step.stepId,
    scheduledId: await scheduleRun(ctx, step),
    attempts: 1
  })
}

/**
 * The step's check (the Sheet store's D215 pattern). A run still waiting or running is looked at
 * again later. A run that failed or timed out while its step is pending is queued again, up to
 * `CHARACTER_RECONCILE_ATTEMPTS` runs; after the last one fails the step stays pending, marked
 * exhausted and logged once.
 */
export const verify = internalMutation({
  args: () => zodToConvexFields(campaignCharacterReconcileStepSchema.shape),
  returns: () => v.null(),
  handler: async (ctx, args) => {
    const step = campaignCharacterReconcileStepSchema.parse(args)
    const pending = await readPendingReconcile(ctx, step.stepId)
    if (!pending || pending.exhaustedAt !== undefined) return null
    const job = await ctx.db.system.get(pending.scheduledId)
    if (job?.state.kind === 'pending' || job?.state.kind === 'inProgress') {
      await ctx.scheduler.runAfter(CHARACTER_RECONCILE_CHECK_MS, verifyReference, step)
      return null
    }
    if (pending.attempts >= CHARACTER_RECONCILE_ATTEMPTS) {
      console.error(
        `Character ${step.characterId} reconcile step ${step.stepId} failed ${pending.attempts} times; it stays pending.`
      )
      await ctx.db.patch(pending._id, { exhaustedAt: new Date().toISOString() })
      return null
    }
    await ctx.db.patch(pending._id, {
      scheduledId: await scheduleRun(ctx, step),
      attempts: pending.attempts + 1
    })
    return null
  }
})

/**
 * D81: ends what the Campaign's Runs put on a Character no longer assigned to it. A room-held Run
 * keeps its maintained states for the room to settle.
 */
export async function endDepartedCampaignRunEffects(
  ctx: MutationCtx,
  campaignId: string,
  characterId: string
) {
  await endCharacterRunEffects(encounterCharacterEffectsTransaction(ctx), {
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
 * The queued reconcile. Its transaction reads one Character. Fences, in order: a step whose pending
 * row is gone already committed (the run deletes it); a deleted Character has nothing left to
 * reconcile; a removed source the Character can read again (shared again, or now owned) is no
 * longer lost; a departed Character assigned to the Campaign again, or held by the live table, keeps
 * its Run effects (the hold's drop settles them).
 */
export const run = internalMutation({
  args: () => zodToConvexFields(campaignCharacterReconcileStepSchema.shape),
  returns: () => v.null(),
  handler: async (ctx, args) => {
    const step = campaignCharacterReconcileStepSchema.parse(args)
    const pending = await readPendingReconcile(ctx, step.stepId)
    if (!pending) return null
    await ctx.db.delete(pending._id)
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
