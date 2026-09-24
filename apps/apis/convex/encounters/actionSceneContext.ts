import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterSceneGridPolicyRegistry } from '@artificer-toolkit/rules-runtime/sceneGridPolicyRegistry'
import type { QueryCtx } from '../_generated/server'
import { readNativeActionSceneInputs } from './actionSceneInputs'

/** Re-read exact action geometry in the same transaction as its mechanics and receipt. */
export async function readNativeActionSceneContext(
  ctx: QueryCtx,
  state: EncounterRunState,
  command: Pick<ResolveEncounterActionInputDto, 'actorId' | 'targetActorId' | 'sceneContext'>,
  scope: 'OWNER' | 'MEMBER' = 'OWNER'
) {
  const inputs = await readNativeActionSceneInputs(ctx, state, command, scope)
  if (!inputs) return null
  const { sceneGrid, ...context } = inputs
  return {
    ...context,
    grid: encounterSceneGridPolicyRegistry.resolveEffectiveGrid({
      encounter: state,
      sceneGrid
    })
  }
}
