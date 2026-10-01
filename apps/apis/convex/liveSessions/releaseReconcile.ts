import { reconcileRunActorDepartures } from '@artificer-toolkit/encounter-persistence/actorDepartures'
import { removeMissingCharacterActors } from '@artificer-toolkit/encounter-persistence/actorRemovalCommand'
import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import type { MutationCtx } from '../_generated/server'
import { encounterWriteTransaction } from '../encounters/encounterPorts'

/**
 * Convex regains the Campaign's open Runs at room release, including any the room never hydrated
 * this epoch, so it applies the departures it skipped under live authority (D74) against current
 * membership and assignment. Actors of Characters that no longer exist go first; the rest freeze
 * from their play records.
 */
export async function reconcileOpenRunsAtRelease(ctx: MutationCtx, campaignId: string) {
  const campaign = await ctx.db
    .query('campaigns')
    .withIndex('by_publicId', (q) => q.eq('id', campaignId))
    .unique()
  // Like the room, an archived or deleting Campaign has no current members and reconciles nothing.
  if (campaign?.status !== 'ACTIVE') return
  const [memberships, assignments] = await Promise.all([
    ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_status', (q) =>
        q.eq('campaignId', campaignId).eq('status', 'ACTIVE')
      )
      .collect(),
    ctx.db
      .query('campaignCharacterAssignments')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
      .collect()
  ])
  const memberIds = new Set(memberships.map((member) => member.userId))
  const assigned = new Set(assignments.map((assignment) => assignment.characterId))
  const transaction = encounterWriteTransaction(ctx)
  await removeMissingCharacterActors(
    transaction,
    campaign,
    campaign.ownerUserId,
    async (characterId) => !(await transaction.ports.readCharacterRow(characterId))
  )
  for (const status of ['PREPARED', 'ACTIVE'] as const)
    for (const run of await ctx.db
      .query('encounterRuns')
      .withIndex('by_campaignId_status', (q) => q.eq('campaignId', campaignId).eq('status', status))
      .collect())
      await reconcileRunActorDepartures(transaction, readRunState(run), {
        isDeparted: (userId) => !memberIds.has(userId),
        isUnassigned: (characterId) => !assigned.has(characterId)
      })
}
