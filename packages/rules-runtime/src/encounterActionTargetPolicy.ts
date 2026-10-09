import type { EncounterActorDispositionDto } from '@artificer-toolkit/schema/api/encounterData'
import type { CompiledActionTargetPolicy } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import {
  lengthMeasurementInSceneUnits,
  measureSceneTokenFootprintDistance,
  sceneTokenFootprintsOverlap,
  type SceneGrid,
  type SceneToken
} from '@artificer-toolkit/shared/vtt'
import type { EncounterRelationshipD20Contributor } from './encounterRelationshipActionFacts.js'
import { ENCOUNTER_LONG_RANGE_CONTRIBUTOR_SOURCE_ID } from './encounterRollModeReasons.js'

type DispositionActor = { id: string; disposition: EncounterActorDispositionDto }

type SceneTokenGeometry = Pick<SceneToken, 'position' | 'height' | 'width' | 'rotationDegrees'>

/** The locked Scene geometry an action's range is measured on. */
export type EncounterActionSceneContext = {
  grid: SceneGrid
  sourceToken: SceneTokenGeometry
  targetToken: SceneTokenGeometry
}

/** A single-target Touch action reaches an adjacent creature: a 5-foot range that only warns. */
const TOUCH_RANGE = { amount: 5, unit: 'FEET' } as const

const RANGE_UNCHECKED: EncounterRuleWarningDto = {
  code: 'TARGET_RANGE_UNCHECKED',
  message: "Range can't be checked without both tokens on the map."
}

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
  sceneContext: EncounterActionSceneContext | null
  /** The action makes an attack roll; an attack never targets its own user (D99). */
  makesAttackRoll: boolean
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
    (range.rangeKind !== 'DISTANCE' &&
      range.rangeKind !== 'TOUCH' &&
      range.rangeKind !== 'UNLIMITED') ||
    targeting?.selectionKind !== 'SINGLE_TARGET' ||
    targeting.dispositionKind === undefined ||
    targeting.excludedCreatureTypeIds?.length
  )
    return null
  const warnings: EncounterRuleWarningDto[] = []
  const relationship = encounterActorRelationship(input.actor.disposition, input.target.disposition)
  // SRD "Targeting Yourself": a creature may choose itself unless the effect must be hostile,
  // makes an attack roll or names another creature (D99).
  if (
    targetsSelf &&
    (targeting.dispositionKind === 'HOSTILE' || input.makesAttackRoll || targeting.excludesSelf)
  )
    warnings.push({ code: 'TARGET_DISPOSITION', message: 'This action targets another creature.' })
  else if (targeting.dispositionKind === 'WILLING' && relationship === 'HOSTILE')
    warnings.push({ code: 'TARGET_DISPOSITION', message: 'This action needs a willing target.' })
  else if (targeting.dispositionKind === 'HOSTILE' && relationship === 'ALLIED')
    warnings.push({ code: 'TARGET_DISPOSITION', message: 'This action targets hostile creatures.' })
  if (range.rangeKind === 'UNLIMITED') return warnings
  // Reach 0 ft. (a swarm's "one target in the swarm's space") needs the footprints to overlap.
  if (range.rangeKind === 'DISTANCE' && range.amount === 0) {
    if (!input.sceneContext) warnings.push(RANGE_UNCHECKED)
    else if (
      !sceneTokenFootprintsOverlap(input.sceneContext.sourceToken, input.sceneContext.targetToken)
    )
      warnings.push({
        code: 'TARGET_OUT_OF_RANGE',
        message: "The target isn't in this creature's space."
      })
    return warnings
  }
  // A ranged weapon attack reaches its long range, at disadvantage beyond its normal range.
  const distance = input.sceneContext
    ? measuredDistance(
        input.sceneContext,
        range.rangeKind === 'DISTANCE'
          ? { amount: range.longAmount ?? range.amount, unit: range.unit }
          : TOUCH_RANGE
      )
    : null
  if (distance === null) warnings.push(RANGE_UNCHECKED)
  else if (distance.measured > distance.maximum)
    warnings.push({ code: 'TARGET_OUT_OF_RANGE', message: 'The target is out of range.' })
  return warnings
}

/**
 * A ranged weapon attack against a target beyond its normal range and within its long range has
 * disadvantage (D62), a contributor derived like any other roll-mode reason. None without a long
 * range or a Scene to measure on; beyond the long range the target policy warns instead.
 */
export function encounterActionLongRangeContributor(input: {
  targetPolicy: CompiledActionTargetPolicy
  sceneContext: EncounterActionSceneContext | null
}): EncounterRelationshipD20Contributor | null {
  const { range } = input.targetPolicy
  if (range.rangeKind !== 'DISTANCE' || range.longAmount === undefined || !input.sceneContext)
    return null
  const normal = measuredDistance(input.sceneContext, { amount: range.amount, unit: range.unit })
  const long = measuredDistance(input.sceneContext, { amount: range.longAmount, unit: range.unit })
  return normal && long && normal.measured > normal.maximum && long.measured <= long.maximum
    ? {
        sourceId: ENCOUNTER_LONG_RANGE_CONTRIBUTOR_SOURCE_ID,
        grantId: null,
        domainKey: ENCOUNTER_LONG_RANGE_CONTRIBUTOR_SOURCE_ID,
        influence: 'DISADVANTAGE'
      }
    : null
}

/** A range in Scene units and the token footprints' measured distance; null when unmeasurable. */
export function measuredDistance(
  scene: EncounterActionSceneContext,
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
