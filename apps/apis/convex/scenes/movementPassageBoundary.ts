import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  discoverEncounterMovementPassage,
  prepareEncounterMovementPassageBoundary
} from '@artificer-toolkit/rules-runtime/encounterMovementPassageBoundary'
import type { FrozenMovementReactionRemainder } from '@artificer-toolkit/rules-runtime/encounterSpatialMovementRuleService'
import type { SceneToken } from '@artificer-toolkit/shared/vtt/scene'
import type { MutationCtx } from '../_generated/server'
import { readRunActors } from '../encounters/documents'
import type { evaluateNativeSpatialMovement } from '../encounters/spatialMovement'
import type { MovementTarget } from '../encounters/movementTargets'
import { availableNativeMovementPassageChoice } from '../encounters/movementPassagePreparation'

type Boundary = Extract<
  Awaited<ReturnType<typeof evaluateNativeSpatialMovement>>,
  { kind: 'REACTION_BOUNDARY' }
>

/** The complete original path determines hostile footprint contacts, including its endpoint. */
export async function discoverSceneMovementPassage(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    root: Parameters<typeof evaluateNativeSpatialMovement>[1]['root']
    sceneTokens: readonly SceneToken[]
    actorIdByTokenId: ReadonlyMap<string, string>
  }
) {
  if (input.state.automationMode === 'MANUAL') return null
  return discoverEncounterMovementPassage({
    ...input,
    actors: await readRunActors(ctx, input.state)
  })
}

/** Spatial contacts at this distance have already been evaluated before the passage choice. */
export async function prepareSceneMovementPassageBoundary(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    root: Parameters<typeof evaluateNativeSpatialMovement>[1]['root']
    boundary: Boundary
    passage: NonNullable<Awaited<ReturnType<typeof discoverSceneMovementPassage>>>
    reactionTimeline: FrozenMovementReactionRemainder['reactionTimeline']
    occurrenceId: string
    sceneVersion: number
    origin: SceneToken['position']
    userId: string
    targets: ReadonlyMap<string, MovementTarget>
  }
) {
  return prepareEncounterMovementPassageBoundary(input, (choice) =>
    availableNativeMovementPassageChoice(ctx, choice)
  )
}
