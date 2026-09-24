import type { QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { readRunState } from './documents'

/** The Campaign update transaction owns the proposed source removal. */
export async function requireEncounterPolicySources(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  removedSourceIds: ReadonlySet<string>
) {
  for (const status of ['PREPARED', 'ACTIVE'] as const) {
    for await (const row of ctx.db
      .query('encounterRuns')
      .withIndex('by_campaignId_status', (q) =>
        q.eq('campaignId', campaign.id).eq('status', status)
      )) {
      const state = readRunState(row)
      if (state.campaignId !== campaign.id || state.gameSystemId !== campaign.gameSystemId)
        throw new Error('Stored Encounter policy snapshot mismatch.')
      const initiative = state.initiativePolicySnapshot
      const pins = [
        ...state.optionalCombatSnapshot.definitions,
        ...(initiative
          ? [
              initiative.policy,
              initiative.evaluationGraph,
              initiative.orderChoiceGraph,
              initiative.tieResolver
            ]
          : [])
      ]
      if (pins.some((pin) => removedSourceIds.has(pin.contentSourceId)))
        throw new Error(
          `Campaign Rules Catalogues cannot remove an active combat-policy dependency. Encounter: ${row.id}.`
        )
    }
  }
}
