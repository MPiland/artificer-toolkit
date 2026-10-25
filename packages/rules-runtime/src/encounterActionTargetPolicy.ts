import type {
  EncounterActorAbsenceDto,
  EncounterActorDispositionDto
} from '@artificer-toolkit/schema/api/encounterData'
import type { CompiledActionTargetPolicy } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { lengthMeasurementInFeet, type LengthUnitCode } from '@artificer-toolkit/shared/core'
import { ROLL_MODE_RULE_SOURCE_IDS } from '@artificer-toolkit/shared/rules'
import {
  classifySquareGridFacingArc,
  classifySquareGridFootprintFacingArcs,
  enumerateSquareGridFootprint,
  lengthMeasurementInSceneUnits,
  measureSceneTokenFootprintDistance,
  sceneRangeBand,
  type SceneGrid,
  type SceneToken
} from '@artificer-toolkit/shared/vtt'
import {
  facingArcLabel,
  type FacingArc,
  type FacingArcRange
} from '@artificer-toolkit/shared/vtt/facingArc'
import type { EncounterRelationshipD20Contributor } from './encounterRelationshipActionFacts.js'
import type { FacingRule } from './optionalCombatPolicyCapability.js'
import {
  ENCOUNTER_LONG_RANGE_CONTRIBUTOR_SOURCE_ID,
  encounterRuleContributorSource
} from './encounterRollModeReasons.js'

type DispositionActor = {
  id: string
  disposition: EncounterActorDispositionDto
  /** Set while the actor is out of play (D128, D178): it cannot be targeted. */
  absence?: EncounterActorAbsenceDto | null
}

type SceneTokenGeometry = Pick<SceneToken, 'position' | 'height' | 'width' | 'rotationDegrees'>

/** The locked Scene geometry an action's range is measured on. */
export type EncounterActionSceneContext = {
  grid: SceneGrid
  sourceToken: SceneTokenGeometry
  targetToken: SceneTokenGeometry
}

/**
 * The arc of each token's facing the other stands in. A square grid measures from the closest
 * occupied cells, so a large token's contact point decides; elsewhere the token centres do.
 */
export function encounterFacingArcs(
  arcs: readonly FacingArcRange[],
  scene: EncounterActionSceneContext
): { sourceToTarget: FacingArc | null; targetToSource: FacingArc | null } | null {
  const { grid, sourceToken, targetToken } = scene
  if (grid.kind === 'SQUARE') {
    const source = enumerateSquareGridFootprint(grid, sourceToken)
    const target = enumerateSquareGridFootprint(grid, targetToken)
    return source && target
      ? classifySquareGridFootprintFacingArcs({
          arcs,
          grid,
          source: { footprint: source, rotationDegrees: sourceToken.rotationDegrees },
          target: { footprint: target, rotationDegrees: targetToken.rotationDegrees }
        })
      : null
  }
  return {
    sourceToTarget: classifySquareGridFacingArc({
      arcs,
      subject: targetToken.position,
      target: sourceToken
    }),
    targetToSource: classifySquareGridFacingArc({
      arcs,
      subject: sourceToken.position,
      target: targetToken
    })
  }
}

/** A single-target Touch action reaches an adjacent creature: a 5-foot range that only warns. */
export const TOUCH_RANGE = { amount: 5, unit: 'FEET' } as const

/**
 * An action's reach: Touch's 5 feet or its normal distance. A relationship the action takes hold with
 * seals it (D152), and a forced movement aside stays within it (D157).
 */
export function encounterActionReachFeet(policy: CompiledActionTargetPolicy): number {
  const { range } = policy
  if (range.rangeKind === 'TOUCH') return lengthMeasurementInFeet(TOUCH_RANGE)
  if (range.rangeKind === 'DISTANCE') return lengthMeasurementInFeet(range)
  throw new Error('This action has no measurable reach.')
}

/**
 * Whether the action has no effect on a creature of this type: the type is excluded, or the action
 * names the types it affects and this is not one of them.
 */
export function targetingExcludesCreatureType(
  targeting: CompiledActionTargetPolicy['targeting'],
  creatureTypeId: string
): boolean {
  if (!targeting || targeting.selectionKind === 'SELF') return false
  const { allowedCreatureTypeIds, excludedCreatureTypeIds } = targeting
  return (
    (excludedCreatureTypeIds?.includes(creatureTypeId) ?? false) ||
    (allowedCreatureTypeIds?.length ? !allowedCreatureTypeIds.includes(creatureTypeId) : false)
  )
}

/**
 * The policy an action's own targeting is checked against: its creature type restrictions are a
 * warning of their own (TARGET_CREATURE_TYPE_EXCLUDED), not an unsupported target.
 */
export function withoutCreatureTypeRestrictions(
  policy: CompiledActionTargetPolicy
): CompiledActionTargetPolicy {
  const { targeting } = policy
  return targeting?.selectionKind === 'SELF' || !targeting
    ? policy
    : {
        ...policy,
        targeting: { ...targeting, allowedCreatureTypeIds: [], excludedCreatureTypeIds: [] }
      }
}

type PolicyRange = CompiledActionTargetPolicy['range']
type MeasuredRange =
  | Extract<PolicyRange, { rangeKind: 'DISTANCE' }>
  | { id: string; rangeKind: 'TOUCH' | 'UNLIMITED' }

const isMeasuredRange = (range: PolicyRange): range is MeasuredRange =>
  range.rangeKind === 'DISTANCE' || range.rangeKind === 'TOUCH' || range.rangeKind === 'UNLIMITED'

/**
 * What the single-target evaluator measures: its user for a Self range, otherwise a measurable
 * range with the disposition it checks. Null is a policy it refuses: a shaped or path-overridden
 * policy (an area or movement action), a range it cannot measure (sight, special), or targeting
 * that is not a single target or a list of chosen creatures (each measured on its own) with a
 * disposition and no creature type restriction.
 */
export function singleTargetMeasure(policy: CompiledActionTargetPolicy):
  | { kind: 'SELF' }
  | {
      kind: 'MEASURED'
      range: MeasuredRange
      dispositionKind: NonNullable<
        Extract<
          NonNullable<CompiledActionTargetPolicy['targeting']>,
          { selectionKind: 'SINGLE_TARGET' }
        >['dispositionKind']
      >
      self: Extract<
        NonNullable<CompiledActionTargetPolicy['targeting']>,
        { selectionKind: 'SINGLE_TARGET' }
      >['self']
    }
  | null {
  if (policy.pathOverrides.length !== 0) return null
  const { range, targeting } = policy
  // A list of chosen creatures inside an area is held to the area, whose picked point carries the
  // range; the creatures themselves are only checked for their disposition.
  const inArea = policy.shape !== null
  if (inArea && targeting?.selectionKind !== 'CHOSEN_CREATURES') return null
  // An action that targets only its user is held to its user even when its range is a distance: the
  // distance measures a destination (Misty Step), not a target.
  if (range.rangeKind === 'SELF' || targeting?.selectionKind === 'SELF') return { kind: 'SELF' }
  if (
    !isMeasuredRange(range) ||
    (targeting?.selectionKind !== 'SINGLE_TARGET' &&
      targeting?.selectionKind !== 'CHOSEN_CREATURES') ||
    targeting.dispositionKind === undefined ||
    targeting.allowedCreatureTypeIds?.length ||
    targeting.excludedCreatureTypeIds?.length
  )
    return null
  return {
    kind: 'MEASURED',
    range: inArea ? { id: range.id, rangeKind: 'UNLIMITED' } : range,
    dispositionKind: targeting.dispositionKind,
    // A list of chosen creatures may include its user freely.
    self: targeting.selectionKind === 'SINGLE_TARGET' ? targeting.self : undefined
  }
}

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
  /** The Encounter's Facing rule (ATTACK-12): a creature cannot target into the arcs it names. */
  facing: Pick<FacingRule, 'arcs' | 'sourceCannotTargetInOwnArcs'> | null
}): EncounterRuleWarningDto[] | null {
  // An actor out of play, however it left, is no legal target (D178).
  if (input.target.absence != null) return null
  const measure = singleTargetMeasure(input.targetPolicy)
  if (measure === null) return null
  const targetsSelf = input.target.id === input.actor.id
  if (measure.kind === 'SELF')
    return targetsSelf
      ? []
      : [{ code: 'TARGET_OUT_OF_RANGE', message: 'This action can only target its user.' }]
  const { range, dispositionKind, self } = measure
  // An action that needs another creature (Help, First Aid) refuses its own user; nothing overrides it.
  if (targetsSelf && self === 'REFUSED') return null
  const warnings: EncounterRuleWarningDto[] = []
  const relationship = encounterActorRelationship(input.actor.disposition, input.target.disposition)
  // SRD "Targeting Yourself": a creature may choose itself unless the effect must be hostile,
  // makes an attack roll or names another creature (D99).
  if (targetsSelf && (dispositionKind === 'HOSTILE' || input.makesAttackRoll || self === 'WARN'))
    warnings.push({ code: 'TARGET_DISPOSITION', message: 'This action targets another creature.' })
  else if (dispositionKind === 'WILLING' && relationship === 'HOSTILE')
    warnings.push({ code: 'TARGET_DISPOSITION', message: 'This action needs a willing target.' })
  else if (dispositionKind === 'HOSTILE' && relationship === 'ALLIED')
    warnings.push({ code: 'TARGET_DISPOSITION', message: 'This action targets hostile creatures.' })
  const facingArc =
    input.facing && input.sceneContext && !targetsSelf
      ? encounterFacingArcs(input.facing.arcs, input.sceneContext)?.sourceToTarget
      : null
  if (facingArc && input.facing?.sourceCannotTargetInOwnArcs.includes(facingArc))
    warnings.push({
      code: 'TARGET_FACING_ARC',
      message: `The target is in this creature's ${facingArcLabel(facingArc)} arc.`
    })
  if (range.rangeKind === 'UNLIMITED') return warnings
  // A ranged weapon attack reaches its long range, at disadvantage beyond its normal range.
  const band = input.sceneContext
    ? sceneRangeBand(
        input.sceneContext.grid,
        input.sceneContext.sourceToken,
        input.sceneContext.targetToken,
        policyRangeLengths(range)
      )
    : null
  if (band === null) warnings.push(RANGE_UNCHECKED)
  else if (band === 'OUT')
    warnings.push({
      code: 'TARGET_OUT_OF_RANGE',
      // Reach 0 ft. (a swarm's "one target in the swarm's space") needs the footprints to overlap.
      message:
        range.rangeKind === 'DISTANCE' && range.amount === 0 && range.longAmount === undefined
          ? "The target isn't in this creature's space."
          : 'The target is out of range.'
    })
  return warnings
}

/** The lengths an action's range is held against: Touch is a 5-foot range, and only a ranged attack has a long one. */
function policyRangeLengths(range: MeasuredRange) {
  return range.rangeKind === 'DISTANCE'
    ? {
        normal: { amount: range.amount, unit: range.unit },
        long:
          range.longAmount === undefined
            ? undefined
            : { amount: range.longAmount, unit: range.unit }
      }
    : { normal: TOUCH_RANGE }
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
  const { grid, sourceToken, targetToken } = input.sceneContext
  return sceneRangeBand(grid, sourceToken, targetToken, policyRangeLengths(range)) === 'LONG'
    ? {
        sourceId: ENCOUNTER_LONG_RANGE_CONTRIBUTOR_SOURCE_ID,
        grantId: null,
        domainKey: ENCOUNTER_LONG_RANGE_CONTRIBUTOR_SOURCE_ID,
        influence: 'DISADVANTAGE',
        source: encounterRuleContributorSource(ROLL_MODE_RULE_SOURCE_IDS.LONG_RANGE)
      }
    : null
}

/** A range in Scene units and the token footprints' measured distance. */
export function measuredDistance(
  scene: EncounterActionSceneContext,
  range: { amount: number; unit: LengthUnitCode }
) {
  return {
    maximum: lengthMeasurementInSceneUnits(range, scene.grid),
    measured: measureSceneTokenFootprintDistance(scene.grid, scene.sourceToken, scene.targetToken)
  }
}
