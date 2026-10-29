import { v } from 'convex/values'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import {
  ACCOUNT_DELETION_BATCH,
  accountDeletionStepArgs,
  continueAccountDeletion,
  readAccountDeletionStep
} from '../accountDeletionJobs'
import { internalMutation } from '../lib/mutations'
import { syncAccountUsage } from '../lib/accountUsage'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { retireCharacterReceipts } from './receiptCleanup'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { endCharacterRunEffects } from '@artificer-toolkit/encounter-persistence/characterRunEffects'
import { encounterWriteTransaction } from '../encounters/encounterPorts'
import { isRoomHeldRun } from '../liveSessions/authorityGuard'
import { scheduleLiveSessionInputInvalidation } from '../liveSessions/controlScheduling'
import {
  deleteCharacterDraftPayload,
  readCharacterDraft,
  readCharacterRecord,
  readCharacterSheetState
} from './documents'
import { joinCharacterPlay, readCharacterRow, type CharacterRow } from './stateDocuments'

/** Removes one private Character; Campaign departure has already removed every assignment. */
export async function removePrivateCharacter(
  ctx: MutationCtx,
  userId: string,
  characterId: string,
  active: CharacterRow | null,
  draft: Doc<'characterDrafts'> | null
) {
  const effects = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
  if ((active && active.userId !== userId) || (draft && draft.userId !== userId))
    throw new Error('Stored Character ownership mismatch.')
  if (active) {
    readCharacterRecord(active)
    readCharacterSheetState(active)
  }
  if (draft) await readCharacterDraft(ctx, draft, active)
  if (
    active &&
    draft &&
    (active.id !== draft.characterId ||
      active.userId !== draft.userId ||
      active.systemId !== draft.systemId)
  )
    throw new Error('Stored Character state ownership mismatch.')

  const [route, assignment, receipts] = await Promise.all([
    ctx.db
      .query('authoredRouteIds')
      .withIndex('by_subjectId', (q) => q.eq('subjectId', characterId))
      .unique(),
    ctx.db
      .query('campaignCharacterAssignments')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .unique(),
    ctx.db
      .query('characterCommandReceipts')
      .withIndex('by_characterId_commandId', (q) => q.eq('characterId', characterId))
      .collect()
  ])
  if (
    !route ||
    route.subjectKind !== 'CHARACTER' ||
    route.subjectId !== characterId ||
    route.ownerUserId !== userId ||
    (draft && route.publicId !== draft.publicId)
  )
    throw new Error('Stored Character route identity mismatch.')
  if (assignment) throw new Error('Stored Campaign Character assignment remains after departure.')
  for (const receipt of receipts) {
    if (receipt.characterId !== characterId)
      throw new Error('Stored Sheet command receipt Character mismatch.')
  }
  if (active) {
    // A held Character skipped D81 settlement at departure, and its hold drops after the row is
    // gone: end maintained states of Runs the room does not hold now, before the owner vanishes.
    await endCharacterRunEffects(encounterWriteTransaction(ctx), {
      characterId,
      classifyRun: async (encounterId) => {
        const run = await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', encounterId))
          .unique()
        return run && !(await isRoomHeldRun(ctx, run)) ? 'TERMINABLE' : null
      },
      occurredAt: new Date().toISOString()
    })
    for (const effect of await effects.list({ kind: 'CHARACTER', characterId })) {
      if (effect.owner.kind !== 'CHARACTER' || effect.owner.characterId !== characterId)
        throw new Error('Stored Character active rule effect ownership mismatch.')
      await effects.deleteCas({
        id: effect.id,
        owner: effect.owner,
        expectedVersion: effect.version,
        removal: 'REMOVED'
      })
    }
  } else {
    const activeEffects = await ctx.db
      .query('characterActiveRuleEffects')
      .withIndex('by_characterId_createdOrdinal_id', (q) => q.eq('characterId', characterId))
      .collect()
    if (activeEffects.length) throw new Error('Draft-only Character has active rule effects.')
  }

  await retireCharacterReceipts(ctx, characterId, userId, receipts)
  if (draft) {
    await deleteCharacterDraftPayload(ctx, draft)
    await ctx.db.delete(draft._id)
  }
  for (const table of [
    'characterInventoryItems',
    'characterCurrencyGroups',
    'characterClassSpellStates',
    'characterSpellCustomizations',
    'characterCreatureInstances',
    'characterVehicleInstances',
    'characterNotes',
    'characterNoteGroups',
    'characterExtraEquipment'
  ] as const) {
    for await (const row of ctx.db
      .query(table)
      .withIndex('by_characterId_position', (q) => q.eq('characterId', characterId)))
      await ctx.db.delete(row._id)
  }
  const build = await ctx.db
    .query('characterBuildStates')
    .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
    .unique()
  if (build) await ctx.db.delete(build._id)
  for await (const row of ctx.db
    .query('characterSheetSections')
    .withIndex('by_characterId_viewer_section', (q) => q.eq('characterId', characterId)))
    await ctx.db.delete(row._id)
  const derivation = await ctx.db
    .query('characterSheetDerivations')
    .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
    .unique()
  if (derivation) await ctx.db.delete(derivation._id)
  if (active) {
    await ctx.db.delete(active.play._id)
    await ctx.db.delete(active._id)
  }
  await ctx.db.delete(route._id)
  await syncAccountUsage(ctx, 'personalCharacters', characterId)
}

/**
 * A room may hold a departed Character's frozen actor, which it removes only once it reads the
 * Character deleted: each former Campaign's live room gets a `CHARACTER` notice when this step
 * commits (D200). Campaign departure has made every membership LEFT.
 */
async function notifyFormerCampaignRooms(ctx: MutationCtx, userId: string) {
  for await (const membership of ctx.db
    .query('campaignMemberships')
    .withIndex('by_userId_status_joinedAt', (q) => q.eq('userId', userId).eq('status', 'LEFT'))) {
    const authority = await ctx.db
      .query('campaignLiveAuthorities')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', membership.campaignId))
      .unique()
    if (authority?.phase === 'DO_ACTIVE')
      await scheduleLiveSessionInputInvalidation(ctx, membership.campaignId, ['CHARACTER'])
  }
}

/**
 * The CHARACTERS step (ADR 0040): one Character, active or draft-only, per invocation, then the
 * roll history in batches.
 */
export const step = internalMutation({
  args: accountDeletionStepArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await readAccountDeletionStep(ctx, args, 'CHARACTERS')
    if (!job) return null
    const activeHead = await ctx.db
      .query('characters')
      .withIndex('by_userId', (q) => q.eq('userId', job.userId))
      .first()
    const draftHead = activeHead
      ? null
      : await ctx.db
          .query('characterDrafts')
          .withIndex('by_userId_updatedAt', (q) => q.eq('userId', job.userId))
          .first()
    const characterId = activeHead?.id ?? draftHead?.characterId
    if (characterId) {
      const [active, draft] = await Promise.all([
        activeHead ? joinCharacterPlay(ctx, activeHead) : readCharacterRow(ctx, characterId),
        ctx.db
          .query('characterDrafts')
          .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
          .unique()
      ])
      await removePrivateCharacter(ctx, job.userId, characterId, active, draft)
      if (active) await notifyFormerCampaignRooms(ctx, job.userId)
      await continueAccountDeletion(ctx, job, true)
      return null
    }
    const rolls = await ctx.db
      .query('userRollHistory')
      .withIndex('by_userId_createdAt_id', (q) => q.eq('userId', job.userId))
      .take(ACCOUNT_DELETION_BATCH)
    for (const roll of rolls) await ctx.db.delete(roll._id)
    await continueAccountDeletion(ctx, job, rolls.length === ACCOUNT_DELETION_BATCH)
    return null
  }
})
