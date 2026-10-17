import type { TargetingDto } from '@artificer-toolkit/schema/effects/targeting'
import type { CompiledActionTargetPolicy } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import type { EncounterActionChoiceDto } from '@artificer-toolkit/schema/api/encounterActionChoices'
import {
  directedAreaInSceneCoordinates,
  isDirectedAreaOriginOnToken,
  lengthMeasurementInSceneUnits,
  measureSceneDistance,
  pointAreaInSceneCoordinates,
  sceneFootprintMeasureHalfExtent,
  type SceneGrid,
  type ScenePoint,
  type SceneToken,
  type SpatialDirectedAreaShape,
  type SpatialPointAreaShape,
  type SpatialTokenFootprint
} from '@artificer-toolkit/shared/vtt'

import { TOUCH_RANGE } from './encounterActionTargetPolicy.js'
import { selectScalingRow } from './scalingRowSelection.js'

const OUT_OF_SIGHT: EncounterRuleWarningDto = {
  code: 'TARGET_OUT_OF_SIGHT',
  message: 'The area origin is out of sight.'
}

const ROUND_AREA_SHAPE_KINDS: ReadonlySet<string> = new Set(['SPHERE', 'CYLINDER', 'CIRCLE'])

const POINT_AREA_SHAPE_KINDS: ReadonlySet<string> = new Set([...ROUND_AREA_SHAPE_KINDS, 'CUBE'])

const DIRECTED_AREA_SHAPE_KINDS: ReadonlySet<string> = new Set(['CONE', 'LINE', 'CUBE'])

/**
 * Which target an area of `shapeKind` takes from `rangeKind`: a Self range over a cone, line or
 * cube takes an origin on the caster and a direction, and over a sphere, cylinder or circle it is
 * centered on the caster and takes no aim; any other range over a sphere, cylinder, circle or cube
 * takes a point. Null is a pairing this path cannot resolve (a wall or dome area, a cone or line
 * with another range). This is the one support table: the System compiler and the target policy
 * both read it.
 */
export function encounterAreaTargetKind(
  rangeKind: string,
  shapeKind: string
): 'POINT' | 'DIRECTED' | 'CASTER_CENTERED' | null {
  if (rangeKind === 'SELF') {
    if (ROUND_AREA_SHAPE_KINDS.has(shapeKind)) return 'CASTER_CENTERED'
    return DIRECTED_AREA_SHAPE_KINDS.has(shapeKind) ? 'DIRECTED' : null
  }
  return POINT_AREA_SHAPE_KINDS.has(shapeKind) ? 'POINT' : null
}

type ChosenCreaturesTargeting = Extract<TargetingDto, { selectionKind: 'CHOSEN_CREATURES' }>

/**
 * The most creatures a chosen-creatures targeting names, or null when it is not a bounded list:
 * no authored cap, or a cap that still scales (a cap scaled by the spell's cast level or the
 * Character's level is resolved first, {@link resolveChosenCreaturesTargeting}). A creature may be
 * named once per entry, up to this cap, when the targeting allows repeated targets.
 */
export function chosenCreaturesMaxTargets(targeting: ChosenCreaturesTargeting): number | null {
  if (targeting.maxTargetsScaling !== undefined) return null
  return targeting.maxTargets ?? null
}

/**
 * Whether a chosen-creatures targeting bounds its list at every cast: a fixed cap, or one that
 * scales only with the spell's cast level or the Character's level, which each cast resolves
 * ({@link resolveChosenCreaturesTargeting}). The execution plan is compiled before either level is
 * known, so this is what it can check.
 */
export function chosenCreaturesCapIsAuthored(targeting: ChosenCreaturesTargeting): boolean {
  return targeting.maxTargetsScaling
    ? targeting.maxTargetsScaling.scalingSource === 'SPELL_CAST_LEVEL' ||
        targeting.maxTargetsScaling.scalingSource === 'CHARACTER_LEVEL'
    : targeting.maxTargets !== undefined
}

/**
 * A chosen-creatures targeting whose cap scales with the spell's cast level (Magic Missile's darts)
 * or the Character's level (Eldritch Blast's beams), with that cap resolved to the number it is at
 * the level the cast names. Any other scaling, or a level the cast does not name, is left as
 * authored, so the cap stays unresolved and the action is refused.
 */
export function resolveChosenCreaturesTargeting(
  targeting: ChosenCreaturesTargeting,
  levels: { spellCastLevel?: number; characterLevel?: number }
): ChosenCreaturesTargeting {
  const { maxTargetsScaling, ...rest } = targeting
  const level =
    maxTargetsScaling?.scalingSource === 'SPELL_CAST_LEVEL'
      ? levels.spellCastLevel
      : maxTargetsScaling?.scalingSource === 'CHARACTER_LEVEL'
        ? levels.characterLevel
        : undefined
  if (!maxTargetsScaling || level === undefined) return targeting
  const row = selectScalingRow(maxTargetsScaling.breakpoints, level)
  return row ? { ...rest, maxTargets: row.value.amount } : targeting
}

/**
 * Whether a list of chosen creatures may be bounded by an area (Mass Cure Wounds): a round shape
 * around a point picked within the range, the same point the creatures are then chosen inside.
 */
export function chosenCreaturesAreaSupported(rangeKind: string, shapeKind: string): boolean {
  return (
    ROUND_AREA_SHAPE_KINDS.has(shapeKind) &&
    encounterAreaTargetKind(rangeKind, shapeKind) === 'POINT'
  )
}

/**
 * Which target a compiled action takes: a directed, point or caster-centered target for an
 * AREA_CONTENTS action ({@link encounterAreaTargetKind}), a bounded list of chosen creatures
 * ({@link chosenCreaturesMaxTargets}, inside a round area when it names one), one creature for a
 * policy that names no shape. Null is a policy this path cannot resolve (an unsupported area, or
 * per-path overrides): a hard refusal.
 */
export function encounterActionTargetKind(
  policy: CompiledActionTargetPolicy
): 'ACTOR' | 'ACTORS' | 'POINT' | 'DIRECTED' | 'CASTER_CENTERED' | null {
  if (policy.pathOverrides.length !== 0) return null
  if (policy.targeting?.selectionKind === 'CHOSEN_CREATURES')
    return chosenCreaturesMaxTargets(policy.targeting) !== null &&
      (policy.shape === null ||
        chosenCreaturesAreaSupported(policy.range.rangeKind, policy.shape.shapeKind))
      ? 'ACTORS'
      : null
  if (policy.targeting?.selectionKind === 'AREA_CONTENTS')
    return policy.shape === null
      ? null
      : encounterAreaTargetKind(policy.range.rangeKind, policy.shape.shapeKind)
  return policy.shape === null ? 'ACTOR' : null
}

/**
 * The authored area of a policy that takes a point or is centered on the caster: a sphere, cylinder
 * or circle is a radius and a cube is its edge. Null for an action that takes neither.
 */
function authoredPointArea(
  policy: CompiledActionTargetPolicy
): Extract<EncounterActionChoiceDto['target'], { kind: 'POINT' }>['area'] | null {
  const { shape } = policy
  const targetKind = encounterActionTargetKind(policy)
  if (
    (targetKind !== 'POINT' && targetKind !== 'CASTER_CENTERED' && targetKind !== 'ACTORS') ||
    shape === null
  )
    return null
  if (shape.shapeKind === 'CUBE') return { kind: 'CUBE', edgeLength: shape.edgeLength }
  if (
    shape.shapeKind === 'SPHERE' ||
    shape.shapeKind === 'CYLINDER' ||
    shape.shapeKind === 'CIRCLE'
  )
    return { kind: 'RADIUS', radius: shape.radius }
  return null
}

/**
 * The authored area of a directed policy: a cone or a line as authored, a cube as the cube that
 * extends from the caster's side. Null for an action that does not take a direction.
 */
function authoredDirectedArea(
  policy: CompiledActionTargetPolicy
): Extract<EncounterActionChoiceDto['target'], { kind: 'DIRECTED' }>['area'] | null {
  const { shape } = policy
  if (encounterActionTargetKind(policy) !== 'DIRECTED' || shape === null) return null
  if (shape.shapeKind === 'CUBE') return { kind: 'CUBE_FROM_SIDE', edgeLength: shape.edgeLength }
  if (shape.shapeKind === 'CONE') return { kind: 'CONE', length: shape.length }
  if (shape.shapeKind === 'LINE')
    return { kind: 'LINE', length: shape.length, ...(shape.width ? { width: shape.width } : {}) }
  return null
}

/**
 * What the action's choice asks the client to pick, as authored: nothing for a self action, a
 * creature (with whether its user may be chosen), the point an area is centered on, or the origin
 * and direction of a directed area (each with the area, for the client's preview). A list of chosen
 * creatures also offers the forms the action authors, when it authors any, and says when the user
 * may name any Creature that meets the action's form filter. A policy this path cannot resolve
 * stays an actor choice; resolving it is refused.
 */
export function encounterActionChoiceTarget(
  policy: CompiledActionTargetPolicy | undefined,
  formContribution?: {
    forms: readonly { id: string; label: string; maxTargets: number }[]
    filter: unknown
  } | null,
  /** The zone the action places; one that lets the caster spare creatures says so. */
  zonePlacement?: { choosesUnaffected?: boolean } | null
): EncounterActionChoiceDto['target'] {
  const forms = formContribution?.forms
  const sparesCreatures = zonePlacement?.choosesUnaffected
    ? { choosesUnaffected: true as const }
    : {}
  const area = policy ? authoredPointArea(policy) : null
  const targeting = policy?.targeting
  const maxTargets =
    policy &&
    targeting?.selectionKind === 'CHOSEN_CREATURES' &&
    encounterActionTargetKind(policy) === 'ACTORS'
      ? chosenCreaturesMaxTargets(targeting)
      : null
  if (maxTargets !== null)
    return {
      kind: 'ACTORS',
      maxTargets,
      area: area?.kind === 'RADIUS' ? area : null,
      ...(targeting?.selectionKind === 'CHOSEN_CREATURES' && targeting.allowRepeatedTargets
        ? { allowRepeatedTargets: true as const }
        : {}),
      ...(forms?.length
        ? { forms: forms.map(({ id, label, maxTargets }) => ({ id, label, maxTargets })) }
        : {}),
      ...(formContribution?.filter ? { choosesCreatureForm: true as const } : {})
    }
  if (area?.kind === 'RADIUS' && policy && encounterActionTargetKind(policy) === 'CASTER_CENTERED')
    return { kind: 'CASTER_CENTERED', area, ...sparesCreatures }
  if (area) return { kind: 'POINT', area, ...sparesCreatures }
  const directedArea = policy ? authoredDirectedArea(policy) : null
  if (directedArea) return { kind: 'DIRECTED', area: directedArea }
  if (targeting?.selectionKind === 'SELF') return { kind: 'SELF' }
  const self = targeting?.selectionKind === 'SINGLE_TARGET' ? targeting.self : undefined
  return { kind: 'ACTOR', self: self ?? 'ALLOWED' }
}

/**
 * The authored area as a point-origin shape in Scene coordinates. A cylinder's height is not
 * modeled (the Scene is flat). Null for an unsupported shape or a size that is scaled or empty.
 */
export function compileEncounterPointArea(
  policy: CompiledActionTargetPolicy,
  grid: SceneGrid
): SpatialPointAreaShape | null {
  const area = authoredPointArea(policy)
  return area ? pointAreaInSceneCoordinates(area, grid) : null
}

/**
 * Resolves a directed area action from its policy: the area to catch creatures with, aimed from
 * `origin` toward `toward`. Every creature in the area is caught, so the single-target disposition
 * rules (D99) do not apply, and the origin is on the caster so no range or sight is checked. A
 * refusal is hard and says why: the policy takes no direction or its size is unsupported, or the
 * origin and direction do not start the area on the caster's token as the shape requires.
 */
export function evaluateEncounterDirectedAreaTarget(input: {
  targetPolicy: CompiledActionTargetPolicy
  origin: ScenePoint
  toward: ScenePoint
  grid: SceneGrid
  /** The caster's token. */
  sourceToken: SpatialTokenFootprint
}):
  | { shape: SpatialDirectedAreaShape; warnings: EncounterRuleWarningDto[] }
  | { refusal: 'UNSUPPORTED_AREA' | 'ORIGIN_OFF_CASTER' } {
  const area = authoredDirectedArea(input.targetPolicy)
  const shape = area && directedAreaInSceneCoordinates(area, input.toward, input.grid)
  if (!shape) return { refusal: 'UNSUPPORTED_AREA' }
  return isDirectedAreaOriginOnToken({ token: input.sourceToken, origin: input.origin, shape })
    ? { shape, warnings: [] }
    : { refusal: 'ORIGIN_OFF_CASTER' }
}

/**
 * Resolves a caster-centered area action from its policy: the radius to catch creatures with, drawn
 * around the caster's token. No aim is taken, so no range or sight is checked, and every creature in
 * the area is caught, so the single-target disposition rules (D99) do not apply. A refusal is hard
 * and says why: the policy takes no centered area or its size is unsupported.
 */
export function evaluateEncounterCasterCenteredAreaTarget(input: {
  targetPolicy: CompiledActionTargetPolicy
  grid: SceneGrid
}):
  | { shape: SpatialPointAreaShape; warnings: EncounterRuleWarningDto[] }
  | { refusal: 'UNSUPPORTED_AREA' } {
  const shape =
    encounterActionTargetKind(input.targetPolicy) === 'CASTER_CENTERED'
      ? compileEncounterPointArea(input.targetPolicy, input.grid)
      : null
  return shape ? { shape, warnings: [] } : { refusal: 'UNSUPPORTED_AREA' }
}

/**
 * Resolves a point-origin area action from its policy: the area to catch creatures with, and the
 * overridable range and sight warnings for the picked origin. Every creature in the area is caught, so the
 * single-target self and disposition rules (D99) do not apply. Null is a hard refusal: the policy
 * does not take a point, its area is unsupported, or its range is not a distance or unlimited.
 */
export function evaluateEncounterAreaTargetPolicy(input: {
  targetPolicy: CompiledActionTargetPolicy
  point: ScenePoint
  grid: SceneGrid
  /** The caster's token. */
  sourceToken: Pick<SceneToken, 'position' | 'height' | 'width' | 'rotationDegrees'>
  /** Whether the caster can see the point. */
  pointSeen: boolean
}): { shape: SpatialPointAreaShape; warnings: EncounterRuleWarningDto[] } | null {
  const { range } = input.targetPolicy
  const shape = compileEncounterPointArea(input.targetPolicy, input.grid)
  if (shape === null) return null
  const rangeWarnings = evaluateRangeWarnings(input, range)
  if (rangeWarnings === null) return null
  return {
    shape,
    warnings: input.pointSeen ? rangeWarnings : [...rangeWarnings, OUT_OF_SIGHT]
  }
}

/**
 * The range a point area's origin is measured against; null for a kind the area evaluator refuses
 * (self, sight, special). A touch range reaches as far as a single-target touch does. A distance's
 * long range is never measured here.
 */
export function pointAreaOriginRange(
  range: CompiledActionTargetPolicy['range']
):
  | { rangeKind: 'UNLIMITED' }
  | Extract<CompiledActionTargetPolicy['range'], { rangeKind: 'DISTANCE' }>
  | null {
  if (range.rangeKind === 'UNLIMITED') return { rangeKind: 'UNLIMITED' }
  if (range.rangeKind === 'TOUCH') return { ...range, rangeKind: 'DISTANCE', ...TOUCH_RANGE }
  return range.rangeKind === 'DISTANCE' ? range : null
}

/** The range warning for the picked origin; null when the range is not a distance or unlimited. */
function evaluateRangeWarnings(
  input: Pick<
    Parameters<typeof evaluateEncounterAreaTargetPolicy>[0],
    'point' | 'grid' | 'sourceToken'
  >,
  policyRange: CompiledActionTargetPolicy['range']
): EncounterRuleWarningDto[] | null {
  const range = pointAreaOriginRange(policyRange)
  if (range === null) return null
  if (range.rangeKind === 'UNLIMITED') return []
  const maximum = lengthMeasurementInSceneUnits(
    { amount: range.amount, unit: range.unit },
    input.grid
  )
  const { position, width, height } = input.sourceToken
  const halfWidth = sceneFootprintMeasureHalfExtent(input.grid, width)
  const halfHeight = sceneFootprintMeasureHalfExtent(input.grid, height)
  const nearest = {
    x: Math.min(Math.max(input.point.x, position.x - halfWidth), position.x + halfWidth),
    y: Math.min(Math.max(input.point.y, position.y - halfHeight), position.y + halfHeight)
  }
  return measureSceneDistance(input.grid, nearest, input.point) > maximum
    ? [{ code: 'TARGET_OUT_OF_RANGE', message: 'The area origin is out of range.' }]
    : []
}
