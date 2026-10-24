import { sizeSpaceFeet } from '@artificer-toolkit/shared/core'
import { summonHitPoints } from './encounterSummon.js'
import type { TargetingDto } from '@artificer-toolkit/schema/effects/targeting'
import type {
  CompiledActionSummonPlacement,
  CompiledActionTargetPolicy,
  CompiledActionZoneChoice,
  CompiledActionZonePlacement
} from '@artificer-toolkit/schema/projections/characterMechanics'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import type { EncounterActionChoiceDto } from '@artificer-toolkit/schema/api/encounterActionChoices'
import type { ResolveEncounterActionTargetDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { ShapeDto } from '@artificer-toolkit/schema/shared/shape'
import {
  authoredLengthInSceneCoordinates,
  directedAreaInSceneCoordinates,
  isDirectedAreaOriginOnToken,
  lengthMeasurementInSceneUnits,
  measureSceneDistance,
  pointAreaInSceneCoordinates,
  sceneFootprintMeasureHalfExtent,
  sceneTokenFootprintsOverlap,
  wallAreaBoundsInSceneCoordinates,
  type SceneGrid,
  type ScenePoint,
  type SceneToken,
  type SpatialDirectedAreaShape,
  type SpatialPointAreaShape,
  type SpatialTokenFootprint,
  type SpatialWallAreaShape,
  type SpatialWallSide
} from '@artificer-toolkit/shared/vtt'

import { TOUCH_RANGE } from './encounterActionTargetPolicy.js'
import { selectScalingRow } from './scalingRowSelection.js'
import { sharedZonePlacement } from './encounterZonePlacement.js'

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
 * The cap on a chosen-creatures targeting's list: `{ maxTargets }` for a fixed cap, `{}` for a list
 * with no cap that names each creature once (Pass without Trace), or null when the list is not
 * resolved: a cap that still scales (a cap scaled by the spell's cast level or the Character's level
 * is resolved first, {@link resolveChosenCreaturesTargeting}), or no cap on a list that repeats
 * creatures. A creature may be named once per entry, up to the cap, when the targeting allows
 * repeated targets.
 */
export function chosenCreaturesCap(
  targeting: ChosenCreaturesTargeting
): { maxTargets?: number } | null {
  if (targeting.maxTargetsScaling !== undefined) return null
  if (targeting.maxTargets !== undefined) return { maxTargets: targeting.maxTargets }
  return targeting.allowRepeatedTargets ? null : {}
}

/**
 * Whether a chosen-creatures targeting resolves its list at every cast: a fixed cap, one that scales
 * only with the spell's cast level or the Character's level, which each cast resolves
 * ({@link resolveChosenCreaturesTargeting}), or no cap on a list that names each creature once. The
 * execution plan is compiled before either level is known, so this is what it can check.
 */
export function chosenCreaturesListResolves(targeting: ChosenCreaturesTargeting): boolean {
  return targeting.maxTargetsScaling
    ? targeting.maxTargetsScaling.scalingSource === 'SPELL_CAST_LEVEL' ||
        targeting.maxTargetsScaling.scalingSource === 'CHARACTER_LEVEL'
    : chosenCreaturesCap(targeting) !== null
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

type AreaContentsTargeting = Extract<TargetingDto, { selectionKind: 'AREA_CONTENTS' }>

/**
 * An area-contents targeting whose hit-point pool scales with the spell's cast level (Sleep's
 * 5d8, and 2d8 more per slot level above 1st), with that pool resolved to the dice it is at the
 * level the cast names (the authored base below the first row). A level the cast does not name
 * leaves the scaling as authored, so the pool stays unresolved and the action is refused.
 */
export function resolveAreaContentsTargeting(
  targeting: AreaContentsTargeting,
  levels: { spellCastLevel?: number }
): AreaContentsTargeting {
  const { hitPointPoolScaling, ...rest } = targeting
  if (
    hitPointPoolScaling?.scalingSource !== 'SPELL_CAST_LEVEL' ||
    levels.spellCastLevel === undefined
  )
    return targeting
  const row = selectScalingRow(hitPointPoolScaling.breakpoints, levels.spellCastLevel)
  return row ? { ...rest, hitPointPool: row.value } : rest
}

/**
 * Whether an area-contents targeting rolls a hit-point pool that every cast can resolve: a fixed
 * pool, or one that scales only with the spell's cast level ({@link resolveAreaContentsTargeting}).
 */
export function hitPointPoolIsAuthored(targeting: AreaContentsTargeting): boolean {
  return targeting.hitPointPoolScaling
    ? targeting.hitPointPoolScaling.scalingSource === 'SPELL_CAST_LEVEL'
    : targeting.hitPointPool !== undefined
}

/** Every dice expression the pool can be at a cast, the authored base and each scaled row. */
export function hitPointPoolDiceOptions(targeting: AreaContentsTargeting): string[] {
  return [
    ...(targeting.hitPointPool ? [targeting.hitPointPool.diceConfig] : []),
    ...(targeting.hitPointPoolScaling?.breakpoints.map(({ value }) => value.diceConfig) ?? [])
  ]
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
 * AREA_CONTENTS action ({@link encounterAreaTargetKind}; a Self one that names no shape takes the
 * caster's own space), a resolved list of chosen creatures
 * ({@link chosenCreaturesCap}, inside a round area when it names one), one creature for a
 * policy that names no shape. Null is a policy this path cannot resolve (an unsupported area, or
 * per-path overrides): a hard refusal.
 */
export function encounterActionTargetKind(
  policy: CompiledActionTargetPolicy
): 'ACTOR' | 'ACTORS' | 'POINT' | 'DIRECTED' | 'CASTER_CENTERED' | null {
  if (policy.pathOverrides.length !== 0) return null
  if (policy.targeting?.selectionKind === 'CHOSEN_CREATURES')
    return chosenCreaturesCap(policy.targeting) !== null &&
      (policy.shape === null ||
        chosenCreaturesAreaSupported(policy.range.rangeKind, policy.shape.shapeKind))
      ? 'ACTORS'
      : null
  if (policy.targeting?.selectionKind === 'AREA_CONTENTS')
    return policy.shape === null
      ? policy.range.rangeKind === 'SELF'
        ? 'CASTER_CENTERED'
        : null
      : encounterAreaTargetKind(policy.range.rangeKind, policy.shape.shapeKind)
  return policy.shape === null ? 'ACTOR' : null
}

/**
 * The authored area of a policy that takes a point or is centered on the caster: a sphere, cylinder
 * or circle is a radius and a cube is its edge. Null for an action that takes neither.
 */
function authoredPointArea(policy: CompiledActionTargetPolicy): PointArea | null {
  const { shape } = policy
  const targetKind = encounterActionTargetKind(policy)
  if (
    (targetKind !== 'POINT' && targetKind !== 'CASTER_CENTERED' && targetKind !== 'ACTORS') ||
    shape === null
  )
    return null
  return pointAreaOfShape(shape)
}

type PointArea = Extract<EncounterActionChoiceDto['target'], { kind: 'POINT' }>['area']

/** A sphere, cylinder or circle as its radius and a cube as its edge; null for any other shape. */
function pointAreaOfShape(shape: ShapeDto): PointArea | null {
  if (shape.shapeKind === 'CUBE') return { kind: 'CUBE', edgeLength: shape.edgeLength }
  if (
    shape.shapeKind === 'SPHERE' ||
    shape.shapeKind === 'CYLINDER' ||
    shape.shapeKind === 'CIRCLE'
  )
    return { kind: 'RADIUS', radius: shape.radius }
  return null
}

type ZoneRegionComponent = NonNullable<CompiledActionZonePlacement['regionComponents']>[number]

/** What the client aims to place one zone, with its authored area. */
export type EncounterZoneChoiceTarget = Extract<
  EncounterActionChoiceDto['target'],
  { kind: 'ZONE_OPTIONS' }
>['options'][number]['target']

/**
 * What placing `zone` with an action of `rangeKind` asks the client to aim, as authored (D154): a
 * straight wall between two endpoints within range, a ring (a hollow round zone) around a point
 * within range, or the point or caster a filled zone is centered on ({@link encounterAreaTargetKind}).
 * The zone's own shape decides, never the action's: a cast that offers several zones may offer
 * several shapes. Null is a zone this path cannot place. The compiler, the action's choice and the
 * Worker all read it.
 */
export function encounterZoneChoiceTarget(
  zone: Pick<CompiledActionZonePlacement, 'shape' | 'ringThickness'> & {
    regionComponents?: readonly Pick<ZoneRegionComponent, 'region'>[]
  },
  rangeKind: string
): EncounterZoneChoiceTarget | null {
  const { shape, ringThickness } = zone
  // A band beside the wall is reached on the side the caster picks once the wall is aimed.
  const band = zone.regionComponents?.find(({ region }) => region.kind === 'SIDE_BAND')
  const sideBand = band ? { sideBand: { distance: band.region.distance } } : {}
  if (shape.shapeKind === 'WALL')
    return shape.thickness && rangeKind !== 'SELF'
      ? { kind: 'WALL', area: { maxLength: shape.length, thickness: shape.thickness }, ...sideBand }
      : null
  const area = pointAreaOfShape(shape)
  if (ringThickness)
    return area?.kind === 'RADIUS' && rangeKind !== 'SELF'
      ? {
          kind: 'RING',
          area: { maxOuterRadius: area.radius, thickness: ringThickness },
          ...sideBand
        }
      : null
  if (band) return null
  const kind = encounterAreaTargetKind(rangeKind, shape.shapeKind)
  if (kind === 'POINT' && area) return { kind, area }
  return kind === 'CASTER_CENTERED' && area?.kind === 'RADIUS' ? { kind, area } : null
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
 * may name any Creature that meets the action's form filter, and a cast that picks an option lists
 * the options. A policy this path cannot resolve
 * stays an actor choice; resolving it is refused.
 */
export function encounterActionChoiceTarget(
  policy: CompiledActionTargetPolicy | undefined,
  formContribution?: {
    forms: readonly { id: string; label: string; maxTargets: number }[]
    filter: unknown
  } | null,
  /**
   * The zone the action places: one that lets the caster spare creatures says so, and a cast-time
   * pick lists the zones to pick from (D140).
   */
  zonePlacement?: CompiledActionZonePlacement | CompiledActionZoneChoice | null,
  /** The options a cast or a basic action (Shove) picks one of on the creatures it targets (D148). */
  castChoice?: { options: readonly { optionId: string; label: string }[] } | null,
  /** The action is used on an item its creature has equipped (Shillelagh, Heat Metal). */
  choosesItem?: boolean,
  /** The creature the action summons: the caster picks the point it stands at (T2v2a2). */
  summonPlacement?: Pick<CompiledActionSummonPlacement, 'statBlock'> | null
): EncounterActionChoiceDto['target'] {
  const summonFeet = summonPlacement && sizeSpaceFeet(summonPlacement.statBlock.size)
  if (summonFeet)
    return {
      kind: 'POINT',
      area: { kind: 'CUBE', edgeLength: { amount: summonFeet, unit: 'FEET' } }
    }
  const itemChoice = choosesItem ? { choosesItem: true as const } : {}
  const forms = formContribution?.forms
  const offered = (options: readonly { optionId: string; label: string }[] | undefined) =>
    options
      ? { choiceOptions: options.map(({ optionId, label }) => ({ id: optionId, label })) }
      : {}
  const zoneTarget = policy && zonePlacement && zonePlacementChoiceTarget(policy, zonePlacement)
  if (zoneTarget) return zoneTarget
  const choiceOptions = offered(castChoice?.options)
  const area = policy ? authoredPointArea(policy) : null
  const targeting = policy?.targeting
  const cap =
    policy &&
    targeting?.selectionKind === 'CHOSEN_CREATURES' &&
    encounterActionTargetKind(policy) === 'ACTORS'
      ? chosenCreaturesCap(targeting)
      : null
  if (cap !== null)
    return {
      kind: 'ACTORS',
      ...cap,
      area: area?.kind === 'RADIUS' ? area : null,
      ...(targeting?.selectionKind === 'CHOSEN_CREATURES' && targeting.allowRepeatedTargets
        ? { allowRepeatedTargets: true as const }
        : {}),
      ...(forms?.length
        ? { forms: forms.map(({ id, label, maxTargets }) => ({ id, label, maxTargets })) }
        : {}),
      ...(formContribution?.filter ? { choosesCreatureForm: true as const } : {}),
      ...choiceOptions
    }
  if (policy && encounterActionTargetKind(policy) === 'CASTER_CENTERED')
    return {
      kind: 'CASTER_CENTERED',
      area: area?.kind === 'RADIUS' ? area : { kind: 'OWN_SPACE' }
    }
  if (area) return { kind: 'POINT', area }
  const directedArea = policy ? authoredDirectedArea(policy) : null
  if (directedArea) return { kind: 'DIRECTED', area: directedArea }
  if (targeting?.selectionKind === 'SELF') return { kind: 'SELF' }
  const single = targeting?.selectionKind === 'SINGLE_TARGET' ? targeting : undefined
  return {
    kind: 'ACTOR',
    self: single?.self ?? 'ALLOWED',
    ...choiceOptions,
    ...itemChoice,
    ...(single?.heldBySource ? { heldBySource: true as const } : {})
  }
}

/**
 * What placing the action's zone asks the client to aim: that zone's own target, or the options a
 * cast-time pick offers (D140, D154), each aimed as its zone asks. Whether the caster spares
 * creatures is shared by every option. Null when a zone cannot be placed; resolving it is refused.
 */
function zonePlacementChoiceTarget(
  policy: CompiledActionTargetPolicy,
  zonePlacement: CompiledActionZonePlacement | CompiledActionZoneChoice
): EncounterActionChoiceDto['target'] | null {
  const spares = sharedZonePlacement(zonePlacement).choosesUnaffected
    ? { choosesUnaffected: true as const }
    : {}
  const { rangeKind } = policy.range
  if (!('options' in zonePlacement)) {
    const target = encounterZoneChoiceTarget(zonePlacement, rangeKind)
    return target && { ...target, ...spares }
  }
  const options = zonePlacement.options.flatMap(({ optionId, label, zone }) => {
    const target = encounterZoneChoiceTarget(zone, rangeKind)
    return target ? [{ id: optionId, label, target }] : []
  })
  return options.length === zonePlacement.options.length
    ? { kind: 'ZONE_OPTIONS', options, ...spares }
    : null
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
 * around the caster's token, or, for an action that names no shape, the caster's own space (a cube
 * of the token's size). No aim is taken, so no range or sight is checked, and every creature in
 * the area is caught, so the single-target disposition rules (D99) do not apply. A refusal is hard
 * and says why: the policy takes no centered area or its size is unsupported.
 */
export function evaluateEncounterCasterCenteredAreaTarget(input: {
  targetPolicy: CompiledActionTargetPolicy
  grid: SceneGrid
  /** The caster's token. */
  sourceToken: SpatialTokenFootprint
}):
  | { shape: SpatialPointAreaShape; warnings: EncounterRuleWarningDto[] }
  | { refusal: 'UNSUPPORTED_AREA' } {
  if (encounterActionTargetKind(input.targetPolicy) !== 'CASTER_CENTERED')
    return { refusal: 'UNSUPPORTED_AREA' }
  const { sourceToken } = input
  const shape =
    input.targetPolicy.shape === null
      ? { kind: 'CUBE' as const, edgeLength: Math.max(sourceToken.width, sourceToken.height) }
      : compileEncounterPointArea(input.targetPolicy, input.grid)
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
 * Resolves where a summon stands from the point the caster picked: the square its size fills in
 * Scene coordinates, and the overridable range and sight warnings for the point. A summon that
 * occupies space is refused at a square another token already fills; a size no Scene models, or a
 * range this path cannot measure, is refused as unsupported.
 */
export function evaluateEncounterSummonTarget(input: {
  statBlock: Pick<
    CompiledActionSummonPlacement['statBlock'],
    'size' | 'occupiesSpace' | 'hitPoints'
  >
  /** The caster's hit point maximum, when the Run holds it (a Character's lives on the Sheet). */
  casterHitPointMaximum: number | null
  range: CompiledActionTargetPolicy['range']
  point: ScenePoint
  grid: SceneGrid
  /** The caster's token. */
  sourceToken: Pick<SceneToken, 'position' | 'height' | 'width' | 'rotationDegrees'>
  /** Whether the caster sees the point. */
  pointSeen: boolean
  /** The Scene's tokens, which a summon that occupies space may not overlap. */
  tokens: readonly Pick<SceneToken, 'position' | 'height' | 'width'>[]
}):
  | {
      /** The square the summon fills, centered on the picked point. */
      shape: { kind: 'CUBE'; edgeLength: number }
      warnings: EncounterRuleWarningDto[]
    }
  | { refusal: 'UNSUPPORTED_SUMMON' | 'SPACE_OCCUPIED' | 'HIT_POINTS_UNKNOWN' } {
  const unsupported = { refusal: 'UNSUPPORTED_SUMMON' } as const
  const feet = sizeSpaceFeet(input.statBlock.size)
  const shape =
    feet === null
      ? null
      : pointAreaInSceneCoordinates(
          { kind: 'CUBE', edgeLength: { amount: feet, unit: 'FEET' } },
          input.grid
        )
  const rangeWarnings = evaluateRangeWarnings(input, input.range)
  if (shape?.kind !== 'CUBE' || rangeWarnings === null) return unsupported
  if (summonHitPoints(input.statBlock, input.casterHitPointMaximum) === null)
    return { refusal: 'HIT_POINTS_UNKNOWN' }
  const placed = { position: input.point, width: shape.edgeLength, height: shape.edgeLength }
  if (
    input.statBlock.occupiesSpace &&
    input.tokens.some((token) => sceneTokenFootprintsOverlap(placed, token))
  )
    return { refusal: 'SPACE_OCCUPIED' }
  return {
    shape,
    warnings: input.pointSeen ? rangeWarnings : [...rangeWarnings, OUT_OF_SIGHT]
  }
}

/** A command target that places a zone. */
type ZoneCommandTarget = Extract<
  ResolveEncounterActionTargetDto,
  { kind: 'POINT' | 'CASTER_CENTERED' | 'WALL' | 'RING' }
>

/** How far past an authored size an aimed size may fall: the client's own rounding, never more. */
const AREA_SIZE_TOLERANCE = 1e-6

/**
 * Resolves where a zone is placed from the zone's own target (D154), {@link encounterZoneChoiceTarget}:
 * the area it covers, and the overridable range and sight warnings for the points it is aimed at (a
 * wall's two endpoints, a ring's or a point area's center). A refusal is hard and says why: the
 * command aims another kind of target or the size is unsupported, a wall is longer or a ring wider
 * than authored, or a wall has no length or a ring no room inside its wall.
 */
export function evaluateEncounterZoneTarget(input: {
  zone: Pick<
    CompiledActionZonePlacement,
    'shape' | 'ringThickness' | 'regionComponents' | 'perDistanceMoved'
  >
  range: CompiledActionTargetPolicy['range']
  target: ZoneCommandTarget
  grid: SceneGrid
  /** The caster's token. */
  sourceToken: Pick<SceneToken, 'position' | 'height' | 'width' | 'rotationDegrees'>
  /** Whether the caster sees every point the target is aimed at. */
  aimSeen: boolean
}):
  | {
      shape: SpatialPointAreaShape | SpatialWallAreaShape
      /** Each region component's band, in order: the side the caster picked and its reach. */
      regions: Array<{ side: SpatialWallSide; distance: number }>
      /** The zone's per-distance-moved step in Scene distance units; absent when it acts on entry. */
      distanceStep?: number
      warnings: EncounterRuleWarningDto[]
    }
  | {
      refusal:
        | 'UNSUPPORTED_AREA'
        | 'AREA_TOO_LARGE'
        | 'AREA_TOO_SMALL'
        | 'SIDE_REQUIRED'
        | 'SIDE_NOT_OFFERED'
    } {
  const { target, grid } = input
  const aim = encounterZoneChoiceTarget(input.zone, input.range.rangeKind)
  const unsupported = { refusal: 'UNSUPPORTED_AREA' } as const
  // A zone with a band beside its wall takes the side it reaches, and only such a zone does.
  const side = 'side' in target ? target.side : undefined
  const bands = input.zone.regionComponents ?? []
  if (bands.length > 0 && !side) return { refusal: 'SIDE_REQUIRED' }
  if (bands.length === 0 && side) return { refusal: 'SIDE_NOT_OFFERED' }
  const regions: Array<{ side: SpatialWallSide; distance: number }> = []
  for (const { region } of bands) {
    const distance = authoredLengthInSceneCoordinates(region.distance, grid)
    if (distance === null || !side) return unsupported
    regions.push({ side, distance })
  }
  const { perDistanceMoved } = input.zone
  const distanceStep = perDistanceMoved && lengthMeasurementInSceneUnits(perDistanceMoved, grid)
  if (distanceStep === 0) return unsupported
  const placed = (
    shape: SpatialPointAreaShape | SpatialWallAreaShape,
    warnings: EncounterRuleWarningDto[]
  ) => ({ shape, regions, ...(distanceStep ? { distanceStep } : {}), warnings })
  if (aim?.kind === 'CASTER_CENTERED' && target.kind === 'CASTER_CENTERED') {
    const shape =
      aim.area.kind === 'OWN_SPACE'
        ? {
            kind: 'CUBE' as const,
            edgeLength: Math.max(input.sourceToken.width, input.sourceToken.height)
          }
        : pointAreaInSceneCoordinates(aim.area, grid)
    return shape ? placed(shape, []) : unsupported
  }
  const aimedAt = (points: readonly ScenePoint[]) => {
    const outOfRange = points.map((point) =>
      evaluateRangeWarnings({ point, grid, sourceToken: input.sourceToken }, input.range)
    )
    if (outOfRange.some((warnings) => warnings === null)) return null
    return [
      ...(outOfRange.find((warnings) => warnings!.length > 0) ?? []),
      ...(input.aimSeen ? [] : [OUT_OF_SIGHT])
    ]
  }
  if (aim?.kind === 'POINT' && target.kind === 'POINT') {
    const shape = pointAreaInSceneCoordinates(aim.area, grid)
    const warnings = aimedAt([target.point])
    return shape && warnings ? placed(shape, warnings) : unsupported
  }
  if (aim?.kind === 'WALL' && target.kind === 'WALL') {
    const bounds = wallAreaBoundsInSceneCoordinates({ kind: 'WALL', ...aim.area }, grid)
    const warnings = aimedAt([target.from, target.to])
    if (!bounds || !warnings) return unsupported
    const length = Math.hypot(target.to.x - target.from.x, target.to.y - target.from.y)
    if (length > bounds.maximum * (1 + AREA_SIZE_TOLERANCE)) return { refusal: 'AREA_TOO_LARGE' }
    if (!(length > 0)) return { refusal: 'AREA_TOO_SMALL' }
    return placed({ kind: 'WALL', to: target.to, thickness: bounds.thickness }, warnings)
  }
  if (aim?.kind === 'RING' && target.kind === 'RING') {
    const bounds = wallAreaBoundsInSceneCoordinates({ kind: 'RING', ...aim.area }, grid)
    const warnings = aimedAt([target.center])
    if (!bounds || !warnings) return unsupported
    const { outerRadius } = target
    if (outerRadius > bounds.maximum * (1 + AREA_SIZE_TOLERANCE))
      return { refusal: 'AREA_TOO_LARGE' }
    if (!(outerRadius > bounds.thickness)) return { refusal: 'AREA_TOO_SMALL' }
    return placed(
      { kind: 'RING', outerRadius, innerRadius: outerRadius - bounds.thickness },
      warnings
    )
  }
  return unsupported
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
