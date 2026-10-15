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

const RANGE_UNCHECKED: EncounterRuleWarningDto = {
  code: 'TARGET_RANGE_UNCHECKED',
  message: "Range can't be checked without both tokens on the map."
}

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

/**
 * Which target a compiled action takes: a directed, point or caster-centered target for an
 * AREA_CONTENTS action ({@link encounterAreaTargetKind}), one creature for a policy that names no
 * shape. Null is a policy this path cannot resolve (an unsupported area, or per-path overrides): a
 * hard refusal.
 */
export function encounterActionTargetKind(
  policy: CompiledActionTargetPolicy
): 'ACTOR' | 'POINT' | 'DIRECTED' | 'CASTER_CENTERED' | null {
  if (policy.pathOverrides.length !== 0) return null
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
  if ((targetKind !== 'POINT' && targetKind !== 'CASTER_CENTERED') || shape === null) return null
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
 * and direction of a directed area (each with the area, for the client's preview). A policy this path cannot resolve stays an actor choice;
 * resolving it is refused.
 */
export function encounterActionChoiceTarget(
  policy: CompiledActionTargetPolicy | undefined
): EncounterActionChoiceDto['target'] {
  const area = policy ? authoredPointArea(policy) : null
  if (area?.kind === 'RADIUS' && policy && encounterActionTargetKind(policy) === 'CASTER_CENTERED')
    return { kind: 'CASTER_CENTERED', area }
  if (area) return { kind: 'POINT', area }
  const directedArea = policy ? authoredDirectedArea(policy) : null
  if (directedArea) return { kind: 'DIRECTED', area: directedArea }
  const targeting = policy?.targeting
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
 * refusal is hard and says why: the policy takes no direction or its size is unsupported, the
 * caster has no token on the map, or the origin and direction do not start the area on the caster's
 * token as the shape requires.
 */
export function evaluateEncounterDirectedAreaTarget(input: {
  targetPolicy: CompiledActionTargetPolicy
  origin: ScenePoint
  toward: ScenePoint
  grid: SceneGrid
  /** The caster's token; null when it is not on the map. */
  sourceToken: SpatialTokenFootprint | null
}):
  | { shape: SpatialDirectedAreaShape; warnings: EncounterRuleWarningDto[] }
  | { refusal: 'UNSUPPORTED_AREA' | 'NO_CASTER_TOKEN' | 'ORIGIN_OFF_CASTER' } {
  const area = authoredDirectedArea(input.targetPolicy)
  const shape = area && directedAreaInSceneCoordinates(area, input.toward, input.grid)
  if (!shape) return { refusal: 'UNSUPPORTED_AREA' }
  if (input.sourceToken === null) return { refusal: 'NO_CASTER_TOKEN' }
  return isDirectedAreaOriginOnToken({ token: input.sourceToken, origin: input.origin, shape })
    ? { shape, warnings: [] }
    : { refusal: 'ORIGIN_OFF_CASTER' }
}

/**
 * Resolves a caster-centered area action from its policy: the radius to catch creatures with, drawn
 * around the caster's token. No aim is taken, so no range or sight is checked, and every creature in
 * the area is caught, so the single-target disposition rules (D99) do not apply. A refusal is hard
 * and says why: the policy takes no centered area or its size is unsupported, or the caster has no
 * token on the map.
 */
export function evaluateEncounterCasterCenteredAreaTarget(input: {
  targetPolicy: CompiledActionTargetPolicy
  grid: SceneGrid
  /** The caster's token; null when it is not on the map. */
  sourceToken: Pick<SceneToken, 'position'> | null
}):
  | { shape: SpatialPointAreaShape; warnings: EncounterRuleWarningDto[] }
  | { refusal: 'UNSUPPORTED_AREA' | 'NO_CASTER_TOKEN' } {
  const shape =
    encounterActionTargetKind(input.targetPolicy) === 'CASTER_CENTERED'
      ? compileEncounterPointArea(input.targetPolicy, input.grid)
      : null
  if (!shape) return { refusal: 'UNSUPPORTED_AREA' }
  if (input.sourceToken === null) return { refusal: 'NO_CASTER_TOKEN' }
  return { shape, warnings: [] }
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
  /** The caster's token; null when it is not on the map. */
  sourceToken: Pick<SceneToken, 'position' | 'height' | 'width' | 'rotationDegrees'> | null
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
 * (self, touch, sight, special). A distance's long range is never measured here.
 */
export function pointAreaOriginRange(
  range: CompiledActionTargetPolicy['range']
):
  | { rangeKind: 'UNLIMITED' }
  | Extract<CompiledActionTargetPolicy['range'], { rangeKind: 'DISTANCE' }>
  | null {
  if (range.rangeKind === 'UNLIMITED') return { rangeKind: 'UNLIMITED' }
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
  if (input.sourceToken === null) return [RANGE_UNCHECKED]
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
