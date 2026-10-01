import { readEncounterMaintenanceCapture as readSharedMaintenanceCapture } from '@artificer-toolkit/encounter-persistence/maintenanceCapture'
import {
  readCharacterEffect,
  readEncounterEffect
} from '@artificer-toolkit/encounter-persistence/effectStore'
import type { QueryCtx } from '../_generated/server'
import { encounterReadTransaction } from '../encounters/encounterPorts'

/** Native Convex cursors remain owned by the backend; the shared reader validates the dependent scope. */
export async function readEncounterMaintenanceCapture(
  ctx: QueryCtx,
  state: Parameters<typeof readSharedMaintenanceCapture>[1],
  request: Parameters<typeof readSharedMaintenanceCapture>[2]
) {
  return readSharedMaintenanceCapture(
    encounterReadTransaction(ctx),
    state,
    request,
    async (input) => {
      const page =
        input.ownerKind === 'CHARACTER'
          ? await ctx.db
              .query('characterActiveRuleEffects')
              .withIndex('by_state_source_owner_order', (q) =>
                q
                  .eq('maintainedEffectStateId', input.maintainedStateId)
                  .eq('sourceEncounterId', input.encounterId)
              )
              .paginate({ numItems: 4, cursor: input.cursor })
          : await ctx.db
              .query('encounterActiveRuleEffects')
              .withIndex('by_state_encounter_owner_order', (q) =>
                q
                  .eq('maintainedEffectStateId', input.maintainedStateId)
                  .eq('encounterId', input.encounterId)
              )
              .paginate({ numItems: 4, cursor: input.cursor })
      if (
        page.pageStatus === 'SplitRequired' ||
        (!page.isDone && page.continueCursor === input.cursor)
      )
        throw new Error('Maintained effect capture page is incomplete.')
      return {
        effects: page.page.map((effect) =>
          'characterId' in effect ? readCharacterEffect(effect) : readEncounterEffect(effect)
        ),
        continueCursor: page.isDone ? null : page.continueCursor
      }
    }
  )
}
