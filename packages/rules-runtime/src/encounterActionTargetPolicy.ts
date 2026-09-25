import type { EncounterActorDispositionDto } from '@artificer-toolkit/schema/api/encounterData'
import type { CompiledActionTargetPolicy } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import {
  lengthMeasurementInSceneUnits,
  measureSceneTokenFootprintDistance,
  type SceneGrid,
  type SceneToken
} from '@artificer-toolkit/shared/vtt'

type DispositionActor = { id: string; disposition: EncounterActorDispositionDto }

/**
 * How two Encounter actors stand toward each other, from their GM-set dispositions (Foundry token
 * disposition): a neutral actor is neutral to everyone, equal dispositions are allied, and friendly
 * and hostile actors are hostile to each other.
 */
export function encounterActorRelationship(
  source: EncounterActorDispositionDto,
  target: EncounterActorDispositionDto
): 'ALLIED' | 'HOSTILE' | 'NEUTRAL' {
  if (source === 'NEUTRAL' || target === 'NEUTRAL') return 'NEUTRAL'
  return source === target ? 'ALLIED' : 'HOSTILE'
}

/**
 * Only mechanical geometry crosses the action targeting boundary. Returns `null` for a policy this
 * single-target path cannot resolve (a hard refusal); otherwise the overridable targeting warnings.
 */
export function evaluateEncounterActionTargetPolicy(input: {
  actor: DispositionActor
  target: DispositionActor
  targetPolicy: CompiledActionTargetPolicy
  sceneContext: {
    grid: SceneGrid
    sourceToken: Pick<SceneToken, 'position' | 'height' | 'width' | 'rotationDegrees'>
    targetToken: Pick<SceneToken, 'position' | 'height' | 'width' | 'rotationDegrees'>
  } | null
}): EncounterRuleWarningDto[] | null {
  const policy = input.targetPolicy
  if (policy.shape !== null || policy.pathOverrides.length !== 0) return null
  const targetsSelf = input.target.id === input.actor.id
  if (policy.range.rangeKind === 'SELF')
    return targetsSelf
      ? []
      : [{ code: 'TARGET_OUT_OF_RANGE', message: 'This action can only target its user.' }]
  const { range, targeting } = policy
  if (
    (range.rangeKind !== 'DISTANCE' && range.rangeKind !== 'UNLIMITED') ||
    targeting?.selectionKind !== 'SINGLE_TARGET' ||
    targeting.dispositionKind === undefined ||
    targeting.excludedCreatureTypeIds?.length
  )
    return null
  const warnings: EncounterRuleWarningDto[] = []
  const relationship = encounterActorRelationship(input.actor.disposition, input.target.disposition)
  if (targetsSelf)
    warnings.push({ code: 'TARGET_DISPOSITION', message: 'This action targets another creature.' })
  else if (targeting.dispositionKind === 'WILLING' && relationship === 'HOSTILE')
    warnings.push({ code: 'TARGET_DISPOSITION', message: 'This action needs a willing target.' })
  else if (targeting.dispositionKind === 'HOSTILE' && relationship === 'ALLIED')
    warnings.push({ code: 'TARGET_DISPOSITION', message: 'This action targets hostile creatures.' })
  if (range.rangeKind !== 'DISTANCE') return warnings
  const distance = input.sceneContext
    ? measuredDistance(input.sceneContext, { amount: range.amount, unit: range.unit })
    : null
  if (distance === null)
    warnings.push({
      code: 'TARGET_RANGE_UNCHECKED',
      message: "Range can't be checked without both tokens on the map."
    })
  else if (distance.measured > distance.maximum)
    warnings.push({ code: 'TARGET_OUT_OF_RANGE', message: 'The target is out of range.' })
  return warnings
}

function measuredDistance(
  scene: NonNullable<Parameters<typeof evaluateEncounterActionTargetPolicy>[0]['sceneContext']>,
  range: Parameters<typeof lengthMeasurementInSceneUnits>[0]
) {
  try {
    const maximum = lengthMeasurementInSceneUnits(range, scene.grid)
    return maximum === null
      ? null
      : {
          maximum,
          measured: measureSceneTokenFootprintDistance(
            scene.grid,
            scene.sourceToken,
            scene.targetToken
          )
        }
  } catch {
    return null
  }
}
