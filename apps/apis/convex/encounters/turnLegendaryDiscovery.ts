import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { discoverTurnLegendaryWindows } from '@artificer-toolkit/rules-runtime/encounterTurnLegendaryDiscovery'

import type { MutationCtx } from '../_generated/server'
import { readDefinitionRoot } from '../content/definitionStore'
import { requireSystem } from '../content/systemDocuments'
import { createRulesRuntime } from '../rules/runtime'
import { readRunActors } from './documents'
import { loadMovementTargets, type MovementTarget } from './movementTargets'

/** Discovers current eligible Legendary Action choices without staging or mutating a turn. */
export async function discoverNativeTurnLegendaryWindows(input: {
  ctx: MutationCtx
  state: EncounterRunState
  userId: string
  occurrenceId: string
  outgoingActorId: string
  actors?: Readonly<Awaited<ReturnType<typeof readRunActors>>>
  movementTargets?: ReadonlyMap<string, MovementTarget>
}) {
  const { ctx, state, userId } = input
  return discoverTurnLegendaryWindows({
    state,
    occurrenceId: input.occurrenceId,
    outgoingActorId: input.outgoingActorId,
    actors: input.actors ?? (await readRunActors(ctx, state)),
    movementTargets: input.movementTargets,
    loadTargets: (actorIds) =>
      loadMovementTargets(ctx, {
        encounterId: state.id,
        expectedEncounterVersion: state.version,
        targetActorIds: actorIds
      }),
    loadSystem: () => requireSystem(ctx, state.gameSystemId),
    definitions: {
      requireCurrent: async (definitionId) => {
        const definition = await readDefinitionRoot(ctx, definitionId, userId)
        if (!definition?.current || definition.current.gameSystemId !== state.gameSystemId)
          throw new Error('Legendary Action definition is unavailable.')
        return definition.current
      }
    },
    createRuntime: () => createRulesRuntime(ctx, userId)
  })
}
