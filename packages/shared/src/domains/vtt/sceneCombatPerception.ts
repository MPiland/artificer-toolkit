import type {
  CombatPerceptionChannel,
  CombatPerceptionEnvironment,
  CombatPerceptionIllumination,
  CombatPerceptionObscurement
} from '../rules/combatPerception.js'
import {
  canLightPassBetween,
  canMoveBetween,
  measureSceneDistance,
  SceneBarrierIndex,
  scenePointInPolygon
} from './geometry.js'
import type { CampaignSceneState, SceneGrid, SceneLight, ScenePoint, SceneToken } from './scene.js'
import { lengthMeasurementInSceneUnits } from './sceneReducer.js'

const illuminationRank: Readonly<Record<CombatPerceptionIllumination, number>> = {
  BRIGHT: 0,
  DIM: 1,
  ORDINARY_DARKNESS: 2,
  MAGICAL_DARKNESS: 3
}

const obscurementRank: Readonly<Record<CombatPerceptionObscurement, number>> = {
  NONE: 0,
  LIGHT: 1,
  HEAVY: 2
}

type PerceptionSceneState = Pick<
  CampaignSceneState,
  'ambientIllumination' | 'barriers' | 'darknessZones' | 'doorStates' | 'grid' | 'lights'
>

type PerceptionSceneToken = Pick<SceneToken, 'height' | 'position' | 'width'>

function closestIntervalCoordinates(
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number
): readonly [number, number] {
  if (leftEnd < rightStart) return [leftEnd, rightStart]
  if (rightEnd < leftStart) return [leftStart, rightEnd]

  const sharedCoordinate = Math.max(leftStart, rightStart)
  return [sharedCoordinate, sharedCoordinate]
}

/** The System's base square (SRD 5.1: 5 feet), which a gridless Scene adds to the edge gap. */
const SYSTEM_BASE_SQUARE = { amount: 5, unit: 'FEET' } as const

/**
 * The base square in gridless Scene units: 5 feet, or one square on an uncalibrated Scene. Adding it
 * to the footprint edge gap makes adjacent 5 feet, so reach means the same on every Scene.
 */
export function gridlessBaseSquare(grid: Extract<SceneGrid, { kind: 'GRIDLESS' }>): number {
  return grid.unit === 'SQUARES' ? 1 : (lengthMeasurementInSceneUnits(SYSTEM_BASE_SQUARE, grid) ?? 0)
}

/**
 * Half the extent a footprint is measured from along one axis. On a square grid that is the span of
 * its occupied squares' centres, so counting squares includes the target's square (SRD: adjacent is
 * one square); a creature smaller than a square measures from its position. A gridless Scene has no
 * squares and measures from the footprint edge, then adds the base square.
 */
export function sceneFootprintMeasureHalfExtent(grid: SceneGrid, size: number): number {
  return grid.kind === 'SQUARE' ? Math.max(0, (size - grid.cellSize) / 2) : size / 2
}

function closestFootprintPoints(
  grid: SceneGrid,
  observer: PerceptionSceneToken,
  subject: PerceptionSceneToken
): readonly [ScenePoint, ScenePoint] {
  const observerHalfWidth = sceneFootprintMeasureHalfExtent(grid, observer.width)
  const observerHalfHeight = sceneFootprintMeasureHalfExtent(grid, observer.height)
  const subjectHalfWidth = sceneFootprintMeasureHalfExtent(grid, subject.width)
  const subjectHalfHeight = sceneFootprintMeasureHalfExtent(grid, subject.height)
  const observerLeft = observer.position.x - observerHalfWidth
  const observerRight = observer.position.x + observerHalfWidth
  const observerTop = observer.position.y - observerHalfHeight
  const observerBottom = observer.position.y + observerHalfHeight
  const subjectLeft = subject.position.x - subjectHalfWidth
  const subjectRight = subject.position.x + subjectHalfWidth
  const subjectTop = subject.position.y - subjectHalfHeight
  const subjectBottom = subject.position.y + subjectHalfHeight

  const [observerX, subjectX] = closestIntervalCoordinates(
    observerLeft,
    observerRight,
    subjectLeft,
    subjectRight
  )
  const [observerY, subjectY] = closestIntervalCoordinates(
    observerTop,
    observerBottom,
    subjectTop,
    subjectBottom
  )
  const observerPoint = { x: observerX, y: observerY }
  const subjectPoint = { x: subjectX, y: subjectY }
  return [observerPoint, subjectPoint]
}

export function measureSceneTokenFootprintDistance(
  grid: SceneGrid,
  observer: PerceptionSceneToken,
  subject: PerceptionSceneToken
): number {
  const [observerPoint, subjectPoint] = closestFootprintPoints(grid, observer, subject)
  const distance = measureSceneDistance(grid, observerPoint, subjectPoint)
  return grid.kind === 'GRIDLESS' ? distance + gridlessBaseSquare(grid) : distance
}

function withinLightCone(light: SceneLight, point: ScenePoint): boolean {
  if (light.kind === 'POINT' || light.angleDegrees >= 360) return true
  const direction = (light.directionDegrees * Math.PI) / 180
  const angle = Math.atan2(point.y - light.position.y, point.x - light.position.x)
  const fullCircle = Math.PI * 2
  const offset =
    ((((angle - direction + Math.PI) % fullCircle) + fullCircle) % fullCircle) - Math.PI
  return Math.abs(offset) <= (light.angleDegrees * Math.PI) / 360
}

function illuminationFromLight(
  light: SceneLight,
  point: ScenePoint
): CombatPerceptionIllumination | null {
  if (!withinLightCone(light, point)) return null
  const distance = Math.hypot(point.x - light.position.x, point.y - light.position.y)
  if (distance <= light.brightRadius) return 'BRIGHT'
  if (distance <= light.dimRadius) return 'DIM'
  return null
}

function brighterIllumination(
  current: CombatPerceptionIllumination,
  candidate: CombatPerceptionIllumination
): CombatPerceptionIllumination {
  return illuminationRank[candidate] < illuminationRank[current] ? candidate : current
}

function darkerIllumination(
  current: CombatPerceptionIllumination,
  candidate: CombatPerceptionIllumination
): CombatPerceptionIllumination {
  return illuminationRank[candidate] > illuminationRank[current] ? candidate : current
}

function strongerObscurement(
  current: CombatPerceptionObscurement,
  candidate: CombatPerceptionObscurement
): CombatPerceptionObscurement {
  return obscurementRank[candidate] > obscurementRank[current] ? candidate : current
}

/**
 * Derives portable combat-perception environment facts from authoritative Scene state.
 * Token presentation (`hidden`), fog, labels, and viewer projections are deliberately absent.
 * Illumination/obscurement are sampled at the subject anchor; distance uses occupied footprints.
 */
export function resolveSceneCombatPerceptionEnvironment(input: {
  scene: PerceptionSceneState
  observer: PerceptionSceneToken
  subject: PerceptionSceneToken
  sharedSurface: boolean
  invisibleChannels: readonly CombatPerceptionChannel[]
  suppressedChannels: readonly CombatPerceptionChannel[]
}): CombatPerceptionEnvironment {
  const barrierIndex = new SceneBarrierIndex(input.scene.barriers)
  const visualLineOfSight = canLightPassBetween(
    input.scene,
    input.observer.position,
    input.subject.position,
    barrierIndex
  )
  let illumination = input.scene.ambientIllumination
  for (const light of input.scene.lights) {
    if (!canLightPassBetween(input.scene, light.position, input.subject.position, barrierIndex))
      continue
    const candidate = illuminationFromLight(light, input.subject.position)
    if (candidate) illumination = brighterIllumination(illumination, candidate)
  }
  let obscurement: CombatPerceptionObscurement = 'NONE'
  for (const zone of input.scene.darknessZones) {
    if (!scenePointInPolygon(input.subject.position, zone.polygon)) continue
    if (zone.mechanicalIllumination)
      illumination = darkerIllumination(illumination, zone.mechanicalIllumination)
    if (zone.mechanicalObscurement)
      obscurement = strongerObscurement(obscurement, zone.mechanicalObscurement)
  }
  const suppressedChannels = new Set(input.suppressedChannels)
  if (!visualLineOfSight) suppressedChannels.add('VISUAL')
  return {
    distance: measureSceneTokenFootprintDistance(input.scene.grid, input.observer, input.subject),
    lineOfEffect: canMoveBetween(
      input.scene,
      input.observer.position,
      input.subject.position,
      barrierIndex
    ),
    sharedSurface: input.sharedSurface,
    illumination,
    obscurement,
    invisibleChannels: [...new Set(input.invisibleChannels)].sort(),
    suppressedChannels: [...suppressedChannels].sort()
  }
}
