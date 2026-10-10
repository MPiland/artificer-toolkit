import type { CompiledActionTargetPolicy } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import type { EncounterActionChoiceDto } from '@artificer-toolkit/schema/api/encounterActionChoices'
import {
  lengthMeasurementInSceneUnits,
  measureSceneDistance,
  pointAreaInSceneCoordinates,
  sceneFootprintMeasureHalfExtent,
  type SceneGrid,
  type ScenePoint,
  type SceneToken,
  type SpatialPointAreaShape
} from '@artificer-toolkit/shared/vtt'

const RANGE_UNCHECKED: EncounterRuleWarningDto = {
  code: 'TARGET_RANGE_UNCHECKED',
  message: "Range can't be checked without both tokens on the map."
}

const OUT_OF_SIGHT: EncounterRuleWarningDto = {
  code: 'TARGET_OUT_OF_SIGHT',
  message: 'The area origin is out of sight.'
}

const POINT_AREA_SHAPE_KINDS: ReadonlySet<string> = new Set([
  'SPHERE',
  'CYLINDER',
  'CIRCLE',
  'CUBE'
])

/**
 * Which target a compiled action takes. An AREA_CONTENTS action over a sphere, cylinder, circle or
 * cube takes a point; a policy that names no shape takes one creature. Null is a policy this path
 * cannot resolve (a cone, line, wall or dome area, or per-path overrides): a hard refusal.
 */
export function encounterActionTargetKind(
  policy: CompiledActionTargetPolicy
): 'ACTOR' | 'POINT' | null {
  if (policy.pathOverrides.length !== 0) return null
  if (policy.targeting?.selectionKind === 'AREA_CONTENTS')
    return policy.shape !== null && POINT_AREA_SHAPE_KINDS.has(policy.shape.shapeKind)
      ? 'POINT'
      : null
  return policy.shape === null ? 'ACTOR' : null
}

/** A length in the Scene's distance unit; null when the Scene cannot hold the authored unit. */
function measuredLength(
  measurement: Parameters<typeof lengthMeasurementInSceneUnits>[0],
  grid: SceneGrid
): number | null {
  try {
    return lengthMeasurementInSceneUnits(measurement, grid)
  } catch {
    return null
  }
}

/**
 * The authored area of a point-taking policy: a sphere, cylinder or circle is a radius and a cube
 * is its edge. Null for an action that does not take a point.
 */
function authoredPointArea(
  policy: CompiledActionTargetPolicy
): Extract<EncounterActionChoiceDto['target'], { kind: 'POINT' }>['area'] | null {
  const { shape } = policy
  if (encounterActionTargetKind(policy) !== 'POINT' || shape === null) return null
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
 * What the action's choice asks the client to pick: a creature, or the point an area is centered on
 * (with the area as authored, for the client's preview). A policy this path cannot resolve stays an
 * actor choice; resolving it is refused.
 */
export function encounterActionChoiceTarget(
  policy: CompiledActionTargetPolicy | undefined
): EncounterActionChoiceDto['target'] {
  const area = policy ? authoredPointArea(policy) : null
  return area ? { kind: 'POINT', area } : { kind: 'ACTOR' }
}

/**
 * The authored area as a point-origin shape in Scene coordinates. A cylinder's height is not
 * modeled (the Scene is flat). Null for an unsupported shape or a size that is scaled, empty or
 * unmeasurable on this Scene.
 */
export function compileEncounterPointArea(
  policy: CompiledActionTargetPolicy,
  grid: SceneGrid
): SpatialPointAreaShape | null {
  const area = authoredPointArea(policy)
  return area ? pointAreaInSceneCoordinates(area, grid) : null
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
  /** Whether the caster can see the point; an undecided sight counts as seen. */
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

/** The range warning for the picked origin; null when the range is not a distance or unlimited. */
function evaluateRangeWarnings(
  input: Pick<
    Parameters<typeof evaluateEncounterAreaTargetPolicy>[0],
    'point' | 'grid' | 'sourceToken'
  >,
  range: CompiledActionTargetPolicy['range']
): EncounterRuleWarningDto[] | null {
  if (range.rangeKind === 'UNLIMITED') return []
  if (range.rangeKind !== 'DISTANCE') return null
  const maximum = measuredLength({ amount: range.amount, unit: range.unit }, input.grid)
  if (input.sourceToken === null || maximum === null) return [RANGE_UNCHECKED]
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
