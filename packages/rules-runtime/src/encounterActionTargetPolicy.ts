import type { CompiledActionTargetPolicy } from '@artificer-toolkit/schema/projections/characterMechanics'
import {
  lengthMeasurementInSceneUnits,
  measureSceneTokenFootprintDistance,
  type SceneGrid,
  type SceneToken
} from '@artificer-toolkit/shared/vtt'

/** Only mechanical geometry crosses the action targeting boundary. */
export function targetPolicyPermitsEncounterActor(input: {
  actorId: string
  targetPolicy: CompiledActionTargetPolicy
  sceneContext: {
    grid: SceneGrid
    sourceToken: Pick<SceneToken, 'position' | 'height' | 'width' | 'rotationDegrees'>
    targetToken: Pick<SceneToken, 'position' | 'height' | 'width' | 'rotationDegrees'>
  } | null
  targetActorId: string
}): boolean {
  const policy = input.targetPolicy
  if (policy.shape !== null || policy.pathOverrides.length !== 0) return false
  if (policy.range.rangeKind === 'SELF') return input.targetActorId === input.actorId
  if (
    policy.range.rangeKind === 'DISTANCE' &&
    input.sceneContext &&
    policy.targeting?.selectionKind === 'SINGLE_TARGET' &&
    policy.targeting.dispositionKind === 'ANY' &&
    !policy.targeting.excludedCreatureTypeIds?.length &&
    input.targetActorId !== input.actorId
  ) {
    try {
      const maximumDistance = lengthMeasurementInSceneUnits(
        { amount: policy.range.amount, unit: policy.range.unit },
        input.sceneContext.grid
      )
      return (
        maximumDistance !== null &&
        measureSceneTokenFootprintDistance(
          input.sceneContext.grid,
          input.sceneContext.sourceToken,
          input.sceneContext.targetToken
        ) <= maximumDistance
      )
    } catch {
      return false
    }
  }
  return (
    policy.range.rangeKind === 'UNLIMITED' &&
    policy.targeting?.selectionKind === 'SINGLE_TARGET' &&
    policy.targeting.dispositionKind === 'ANY' &&
    !policy.targeting.excludedCreatureTypeIds?.length &&
    input.targetActorId !== input.actorId
  )
}
