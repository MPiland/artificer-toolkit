import {
  isRunActorSettled,
  replaceRunCharacterActor,
  selectRunCharacterSwaps
} from '@artificer-toolkit/encounter-persistence/actorCharacterReplacement'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { encounterWriteTransaction } from '../encounters/encounterPorts'
import { isRoomHeldRun } from '../liveSessions/authorityGuard'

/**
 * D236: the ACTIVE Run in which the Character fights, or null. A frozen actor (its Character left)
 * and one the GM took out of initiative are not in the fight.
 */
export async function readFightingRun(ctx: MutationCtx, campaignId: string, characterId: string) {
  const runs = await ctx.db
    .query('encounterRuns')
    .withIndex('by_campaignId_status', (q) => q.eq('campaignId', campaignId).eq('status', 'ACTIVE'))
    .collect()
  for (const run of runs) {
    const actors = await readRunActors(encounterWriteTransaction(ctx), readRunState(run))
    if (
      actors.some(
        (actor) =>
          actor.kind === 'CHARACTER' &&
          actor.sourceId === characterId &&
          !actor.frozenState &&
          actor.absence !== 'GM_REMOVED'
      )
    )
      return run
  }
  return null
}

/** Deletes the player's open request, or only one naming the given Character when it is passed. */
export async function deleteActiveCharacterRequests(
  ctx: MutationCtx,
  campaignId: string,
  userId: string,
  characterId?: string
) {
  for await (const request of ctx.db
    .query('campaignActiveCharacterRequests')
    .withIndex('by_campaignId_userId', (q) => q.eq('campaignId', campaignId).eq('userId', userId)))
    if (
      characterId === undefined ||
      request.fromCharacterId === characterId ||
      request.toCharacterId === characterId
    )
      await ctx.db.delete(request._id)
}

/** The player's open request, if any. */
export async function readActiveCharacterRequest(
  ctx: QueryCtx,
  campaignId: string,
  userId: string
) {
  return ctx.db
    .query('campaignActiveCharacterRequests')
    .withIndex('by_campaignId_userId', (q) => q.eq('campaignId', campaignId).eq('userId', userId))
    .unique()
}

/**
 * Makes `to` the player's Active Character and benches `from` (D236), which settles their open
 * request. Each open Run Convex holds swaps the benched Character's actor for the new one in place
 * when the actor is between turns with nothing pending; the room swaps the Runs it holds, and any
 * other the next time it holds it.
 */
export async function switchActiveCharacter(
  ctx: MutationCtx,
  input: {
    campaignId: string
    userId: string
    from: Doc<'campaignCharacterAssignments'> | null
    to: Doc<'campaignCharacterAssignments'>
  }
) {
  const { campaignId, userId } = input
  if (input.from) await ctx.db.patch(input.from._id, { active: false })
  await ctx.db.patch(input.to._id, { active: true })
  await deleteActiveCharacterRequests(ctx, campaignId, userId)
  const assignments = await ctx.db
    .query('campaignCharacterAssignments')
    .withIndex('by_campaignId_userId', (q) => q.eq('campaignId', campaignId).eq('userId', userId))
    .collect()
  const occurredAt = new Date().toISOString()
  for (const status of ['PREPARED', 'ACTIVE'] as const)
    for (const run of await ctx.db
      .query('encounterRuns')
      .withIndex('by_campaignId_status', (q) => q.eq('campaignId', campaignId).eq('status', status))
      .collect()) {
      if (await isRoomHeldRun(ctx, run)) continue
      const transaction = encounterWriteTransaction(ctx)
      const state = readRunState(run)
      for (const swap of selectRunCharacterSwaps(
        await readRunActors(transaction, state),
        assignments
      ))
        if (await isRunActorSettled(transaction, state, swap.actorId))
          await replaceRunCharacterActor(transaction, {
            state,
            actorId: swap.actorId,
            characterId: swap.characterId,
            userId,
            commandId: crypto.randomUUID(),
            occurredAt
          })
    }
}
