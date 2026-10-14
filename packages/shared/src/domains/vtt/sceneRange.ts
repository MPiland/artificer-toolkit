import type { LengthUnitCode } from '../core/measurement.js'
import type { SceneGrid, ScenePoint, SceneToken } from './scene.js'
import {
  gridlessBaseSquare,
  measureSceneTokenFootprintDistance,
  sceneTokenFootprintsOverlap
} from './sceneCombatPerception.js'
import { lengthMeasurementInSceneUnits } from './sceneReducer.js'

type RangeToken = Pick<SceneToken, 'height' | 'position' | 'width'>
type RangeLength = { amount: number; unit: LengthUnitCode }

/** How far a target stands from its source: within the normal range, only the long range, or beyond. */
export type SceneRangeBand = 'NORMAL' | 'LONG' | 'OUT'

/**
 * The band `target` falls in for an action ranged from `source`. The one place a range is held
 * against a footprint-to-footprint distance, so the rules and the table preview cannot disagree.
 * A zero range without a long range reaches only a footprint that overlaps the source.
 */
export function sceneRangeBand(
  grid: SceneGrid,
  source: RangeToken,
  target: RangeToken,
  range: { normal: RangeLength; long?: RangeLength }
): SceneRangeBand {
  if (range.normal.amount === 0 && !range.long)
    return sceneTokenFootprintsOverlap(source, target) ? 'NORMAL' : 'OUT'
  const measured = measureSceneTokenFootprintDistance(grid, source, target)
  const normalMaximum = lengthMeasurementInSceneUnits(range.normal, grid)
  const longMaximum = range.long ? lengthMeasurementInSceneUnits(range.long, grid) : normalMaximum
  if (measured > longMaximum) return 'OUT'
  return measured > normalMaximum ? 'LONG' : 'NORMAL'
}

/** Polygon vertices per quarter turn of a gridless outline's rounded corners. */
const CORNER_SEGMENTS = 16

function withoutRedundantPoints(points: readonly ScenePoint[]): ScenePoint[] {
  const distinct = points.filter(
    (point, index) =>
      point.x !== points[(index + points.length - 1) % points.length]!.x ||
      point.y !== points[(index + points.length - 1) % points.length]!.y
  )
  return distinct.filter((point, index) => {
    const before = distinct[(index + distinct.length - 1) % distinct.length]!
    const after = distinct[(index + 1) % distinct.length]!
    return (
      (point.x - before.x) * (after.y - point.y) - (point.y - before.y) * (after.x - point.x) !== 0
    )
  })
}

/** The footprint's box grown by `reach` on every side, with arcs at the corners. */
function roundedBoxOutline(source: RangeToken, reach: number): ScenePoint[] {
  const left = source.position.x - source.width / 2
  const right = source.position.x + source.width / 2
  const top = source.position.y - source.height / 2
  const bottom = source.position.y + source.height / 2
  const corners = [
    { x: right, y: top, from: -90 },
    { x: right, y: bottom, from: 0 },
    { x: left, y: bottom, from: 90 },
    { x: left, y: top, from: 180 }
  ]
  return withoutRedundantPoints(
    corners.flatMap(({ x, y, from }) =>
      Array.from({ length: CORNER_SEGMENTS + 1 }, (_, step) => {
        const angle = ((from + (90 * step) / CORNER_SEGMENTS) * Math.PI) / 180
        return { x: x + reach * Math.cos(angle), y: y + reach * Math.sin(angle) }
      })
    )
  )
}

/**
 * The largest offset in 0..`limit` at which `inRange` holds, or -1 when it fails at offset 0.
 * `inRange` must hold up to some offset and never again after it (a distance only grows with the gap).
 */
function farthestInRange(limit: number, inRange: (offset: number) => boolean): number {
  if (!inRange(0)) return -1
  let near = 0
  let far = limit
  while (near < far) {
    const middle = Math.ceil((near + far) / 2)
    if (inRange(middle)) near = middle
    else far = middle - 1
  }
  return near
}

/**
 * The outline of the squares a Medium target may stand on and still be measured within `maximum`
 * of the source, each one tested with the same footprint measure the rules use. From the square
 * under the source's center the range runs contiguously in every direction, and the square in a
 * row nearest the source is the one in the source's column, so each edge is a binary search
 * rather than a scan of the whole window.
 */
function squareRangeOutline(
  grid: Extract<SceneGrid, { kind: 'SQUARE' }>,
  source: RangeToken,
  maximum: number
): ScenePoint[] | null {
  const { cellSize, origin } = grid
  const reach =
    Math.ceil(maximum / grid.distancePerCell) +
    Math.ceil(Math.max(source.width, source.height) / cellSize) +
    2
  const sourceColumn = Math.floor((source.position.x - origin.x) / cellSize)
  const sourceRow = Math.floor((source.position.y - origin.y) / cellSize)
  const isWithin = (column: number, row: number) =>
    measureSceneTokenFootprintDistance(grid, source, {
      height: cellSize,
      position: { x: origin.x + (column + 0.5) * cellSize, y: origin.y + (row + 0.5) * cellSize },
      width: cellSize
    }) <= maximum
  const above = farthestInRange(reach, (offset) => isWithin(sourceColumn, sourceRow - offset))
  const below = farthestInRange(reach, (offset) => isWithin(sourceColumn, sourceRow + offset))
  if (above < 0 || below < 0) return null
  const rows = Array.from({ length: above + below + 1 }, (_, index) => {
    const row = sourceRow - above + index
    return {
      bottom: origin.y + (row + 1) * cellSize,
      left:
        origin.x +
        (sourceColumn - farthestInRange(reach, (offset) => isWithin(sourceColumn - offset, row))) *
          cellSize,
      right:
        origin.x +
        (sourceColumn +
          1 +
          farthestInRange(reach, (offset) => isWithin(sourceColumn + offset, row))) *
          cellSize,
      top: origin.y + row * cellSize
    }
  })
  return withoutRedundantPoints([
    ...rows.flatMap(({ bottom, left, top }) => [
      { x: left, y: top },
      { x: left, y: bottom }
    ]),
    ...rows
      .slice()
      .reverse()
      .flatMap(({ bottom, right, top }) => [
        { x: right, y: bottom },
        { x: right, y: top }
      ])
  ])
}

/**
 * The region of the Scene in which part of a target is within `range` of `source`, as polygon
 * vertices: the squares it reaches on a square grid (by the grid's own diagonal rule), the
 * footprint grown by the range less the base square on a gridless Scene. Null when the range is
 * empty or reaches no further than the footprint itself.
 */
export function sceneRangeOutline(
  grid: SceneGrid,
  source: RangeToken,
  range: RangeLength
): ScenePoint[] | null {
  const maximum = lengthMeasurementInSceneUnits(range, grid)
  if (!(maximum > 0)) return null
  if (grid.kind === 'SQUARE') return squareRangeOutline(grid, source, maximum)
  const reach = (maximum - gridlessBaseSquare(grid)) * grid.pixelsPerUnit
  return reach < 0 ? null : roundedBoxOutline(source, reach)
}
