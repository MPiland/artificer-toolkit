import { readEncounterMaintenanceCapture } from '@artificer-toolkit/encounter-persistence/maintenanceCapture'
import {
  readCharacterEffect,
  readEncounterEffect
} from '@artificer-toolkit/encounter-persistence/effectStore'
import type { EncounterReadTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'

/** Native row identities are cursors inside the admitted room command's selected scope. */
export function readRoomMaintenanceCapture(
  ctx: EncounterReadTransaction,
  state: EncounterRunState,
  request: Parameters<typeof readEncounterMaintenanceCapture>[2]
) {
  return readEncounterMaintenanceCapture(ctx, state, request, async (input) => {
    const rows =
      input.ownerKind === 'CHARACTER'
        ? await ctx.db
            .query('characterActiveRuleEffects')
            .withIndex('by_state_source_owner_order', (query) =>
              query
                .eq('maintainedEffectStateId', input.maintainedStateId)
                .eq('sourceEncounterId', input.encounterId)
            )
            .collect()
        : await ctx.db
            .query('encounterActiveRuleEffects')
            .withIndex('by_state_encounter_owner_order', (query) =>
              query
                .eq('maintainedEffectStateId', input.maintainedStateId)
                .eq('encounterId', input.encounterId)
            )
            .collect()
    const previous = input.cursor === null ? -1 : rows.findIndex((row) => row._id === input.cursor)
    if (input.cursor !== null && previous === -1)
      throw new Error('Maintained effect capture cursor is unavailable.')
    const page = rows.slice(previous + 1, previous + 5)
    return {
      effects: page.map((row) =>
        'characterId' in row ? readCharacterEffect(row) : readEncounterEffect(row)
      ),
      continueCursor: previous + 1 + page.length < rows.length ? page[page.length - 1]!._id : null
    }
  })
}
