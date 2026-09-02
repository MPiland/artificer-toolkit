import type { SceneGrid, ScenePoint, SceneToken } from './scene.js'
import { canTokenFootprintMoveBetween, measureSceneDistance } from './geometry.js'
import type { CampaignSceneState } from './scene.js'

const EPSILON = 1e-9

/** Mechanics safety limit: 16 by 16 cells covers unusually large tactical tokens. */
export const MAX_SQUARE_GRID_FOOTPRINT_CELLS = 256

/** A single geometry query must retain all evidence or fail closed rather than omit it. */
export const MAX_SQUARE_GRID_INTERACTION_EVIDENCE = 1_024

/** Bounds exact occupied-cell segment work for pure geometry queries. */
export const MAX_SQUARE_GRID_LINE_CHECKS = 65_536

export interface SquareGridCell {
  readonly column: number
  readonly id: string
  readonly center: ScenePoint
  readonly row: number
}

export interface SquareGridFootprint {
  readonly bounds: {
    readonly bottom: number
    readonly left: number
    readonly right: number
    readonly top: number
  }
  readonly cells: readonly SquareGridCell[]
  readonly center: ScenePoint
}

export type SquareGridContactSector =
  | 'NORTH'
  | 'NORTH_EAST'
  | 'EAST'
  | 'SOUTH_EAST'
  | 'SOUTH'
  | 'SOUTH_WEST'
  | 'WEST'
  | 'NORTH_WEST'

export interface SquareGridFlankingPair {
  readonly alliedCell: SquareGridCell
  readonly alliedSector: SquareGridContactSector
  readonly attackerCell: SquareGridCell
  readonly attackerSector: SquareGridContactSector
}

export type SquareGridFacingArc = 'FRONT' | 'LEFT_SIDE' | 'REAR' | 'RIGHT_SIDE'

export interface SquareGridFootprintFacingArcs {
  readonly sourceToTarget: SquareGridFacingArc | null
  readonly targetToSource: SquareGridFacingArc | null
}

export interface SquareGridCoverIntervenor {
  readonly cell: SquareGridCell
  readonly tokenId: string
}

export interface SquareGridTokenFootprint {
  readonly footprint: SquareGridFootprint
  readonly tokenId: string
}

export interface SquareGridShoveAsideDestination {
  readonly direction: SquareGridContactSector
  readonly position: ScenePoint
  readonly remainsAdjacentToAttacker: true
  readonly targetFootprint: SquareGridFootprint
}

function isFinitePoint(point: ScenePoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

function validSquareGrid(grid: SceneGrid): grid is Extract<SceneGrid, { kind: 'SQUARE' }> {
  return (
    grid.kind === 'SQUARE' &&
    Number.isFinite(grid.cellSize) &&
    grid.cellSize > 0 &&
    Number.isFinite(grid.distancePerCell) &&
    grid.distancePerCell > 0 &&
    isFinitePoint(grid.origin)
  )
}

function closeToInteger(value: number): number | null {
  const rounded = Math.round(value)
  return Math.abs(value - rounded) <= EPSILON ? rounded : null
}

function sameCoordinate(left: number, right: number): boolean {
  return Math.abs(left - right) <= EPSILON
}

function productWithinLimit(left: number, right: number, limit: number): boolean {
  return left > 0 && right > 0 && left <= Math.floor(limit / right)
}

function validTokenFootprint(token: Pick<SceneToken, 'height' | 'position' | 'width'>): boolean {
  return (
    Number.isFinite(token.width) &&
    token.width > 0 &&
    Number.isFinite(token.height) &&
    token.height > 0 &&
    isFinitePoint(token.position)
  )
}

function validSquareGridFootprint(
  grid: Extract<SceneGrid, { kind: 'SQUARE' }>,
  footprint: SquareGridFootprint
): boolean {
  if (
    !isFinitePoint(footprint.center) ||
    !Number.isFinite(footprint.bounds.left) ||
    !Number.isFinite(footprint.bounds.right) ||
    !Number.isFinite(footprint.bounds.top) ||
    !Number.isFinite(footprint.bounds.bottom) ||
    footprint.bounds.left >= footprint.bounds.right ||
    footprint.bounds.top >= footprint.bounds.bottom ||
    footprint.cells.length === 0 ||
    footprint.cells.length > MAX_SQUARE_GRID_FOOTPRINT_CELLS
  ) {
    return false
  }
  const leftColumn = closeToInteger((footprint.bounds.left - grid.origin.x) / grid.cellSize)
  const rightColumn = closeToInteger((footprint.bounds.right - grid.origin.x) / grid.cellSize)
  const topRow = closeToInteger((footprint.bounds.top - grid.origin.y) / grid.cellSize)
  const bottomRow = closeToInteger((footprint.bounds.bottom - grid.origin.y) / grid.cellSize)
  if (leftColumn === null || rightColumn === null || topRow === null || bottomRow === null) {
    return false
  }
  const widthCells = rightColumn - leftColumn
  const heightCells = bottomRow - topRow
  if (
    !productWithinLimit(widthCells, heightCells, MAX_SQUARE_GRID_FOOTPRINT_CELLS) ||
    footprint.cells.length !== widthCells * heightCells ||
    !sameCoordinate(
      footprint.center.x,
      grid.origin.x + (leftColumn + widthCells / 2) * grid.cellSize
    ) ||
    !sameCoordinate(footprint.center.y, grid.origin.y + (topRow + heightCells / 2) * grid.cellSize)
  ) {
    return false
  }
  const coordinates = new Set<string>()
  return footprint.cells.every((cell) => {
    const coordinate = `${cell.column}:${cell.row}`
    if (
      !Number.isSafeInteger(cell.column) ||
      !Number.isSafeInteger(cell.row) ||
      !isFinitePoint(cell.center) ||
      cell.id !== coordinate ||
      coordinates.has(coordinate) ||
      cell.column < leftColumn ||
      cell.column >= rightColumn ||
      cell.row < topRow ||
      cell.row >= bottomRow ||
      !sameCoordinate(cell.center.x, grid.origin.x + (cell.column + 0.5) * grid.cellSize) ||
      !sameCoordinate(cell.center.y, grid.origin.y + (cell.row + 0.5) * grid.cellSize)
    ) {
      return false
    }
    coordinates.add(coordinate)
    return true
  })
}

/**
 * Resolves an axis-aligned token into exact occupied square cells. Tokens that do not align to
 * whole cells are intentionally rejected rather than rounded into different mechanics.
 */
export function enumerateSquareGridFootprint(
  grid: SceneGrid,
  token: Pick<SceneToken, 'height' | 'position' | 'width'>
): SquareGridFootprint | null {
  if (!validSquareGrid(grid) || !validTokenFootprint(token)) return null
  const widthCells = closeToInteger(token.width / grid.cellSize)
  const heightCells = closeToInteger(token.height / grid.cellSize)
  if (
    !widthCells ||
    !heightCells ||
    !productWithinLimit(widthCells, heightCells, MAX_SQUARE_GRID_FOOTPRINT_CELLS)
  ) {
    return null
  }

  const left = token.position.x - token.width / 2
  const top = token.position.y - token.height / 2
  const leftColumn = closeToInteger((left - grid.origin.x) / grid.cellSize)
  const topRow = closeToInteger((top - grid.origin.y) / grid.cellSize)
  if (leftColumn === null || topRow === null) return null

  const cells: SquareGridCell[] = []
  for (let row = topRow; row < topRow + heightCells; row += 1) {
    for (let column = leftColumn; column < leftColumn + widthCells; column += 1) {
      cells.push({
        column,
        id: `${column}:${row}`,
        center: {
          x: grid.origin.x + (column + 0.5) * grid.cellSize,
          y: grid.origin.y + (row + 0.5) * grid.cellSize
        },
        row
      })
    }
  }
  return {
    bounds: {
      bottom: top + token.height,
      left,
      right: left + token.width,
      top
    },
    cells,
    center: { ...token.position }
  }
}

function contactSector(
  footprint: SquareGridFootprint,
  cell: SquareGridCell
): SquareGridContactSector | null {
  const west = cell.center.x < footprint.bounds.left - EPSILON
  const east = cell.center.x > footprint.bounds.right + EPSILON
  const north = cell.center.y < footprint.bounds.top - EPSILON
  const south = cell.center.y > footprint.bounds.bottom + EPSILON
  if (north && west) return 'NORTH_WEST'
  if (north && east) return 'NORTH_EAST'
  if (south && east) return 'SOUTH_EAST'
  if (south && west) return 'SOUTH_WEST'
  if (north) return 'NORTH'
  if (east) return 'EAST'
  if (south) return 'SOUTH'
  if (west) return 'WEST'
  return null
}

function sectorsAreOpposite(
  left: SquareGridContactSector,
  right: SquareGridContactSector
): boolean {
  return (
    (left === 'NORTH' && right === 'SOUTH') ||
    (left === 'SOUTH' && right === 'NORTH') ||
    (left === 'EAST' && right === 'WEST') ||
    (left === 'WEST' && right === 'EAST') ||
    (left === 'NORTH_EAST' && right === 'SOUTH_WEST') ||
    (left === 'SOUTH_WEST' && right === 'NORTH_EAST') ||
    (left === 'SOUTH_EAST' && right === 'NORTH_WEST') ||
    (left === 'NORTH_WEST' && right === 'SOUTH_EAST')
  )
}

function cellIsAdjacentToFootprint(
  grid: Extract<SceneGrid, { kind: 'SQUARE' }>,
  footprint: SquareGridFootprint,
  cell: SquareGridCell
): boolean {
  const halfCell = grid.cellSize / 2
  const left = cell.center.x - halfCell
  const right = cell.center.x + halfCell
  const top = cell.center.y - halfCell
  const bottom = cell.center.y + halfCell
  const overlapsInterior =
    left < footprint.bounds.right - EPSILON &&
    right > footprint.bounds.left + EPSILON &&
    top < footprint.bounds.bottom - EPSILON &&
    bottom > footprint.bounds.top + EPSILON
  if (overlapsInterior) return false
  const horizontalGap = Math.max(footprint.bounds.left - right, left - footprint.bounds.right, 0)
  const verticalGap = Math.max(footprint.bounds.top - bottom, top - footprint.bounds.bottom, 0)
  return horizontalGap <= EPSILON && verticalGap <= EPSILON
}

function footprintsOverlap(left: SquareGridFootprint, right: SquareGridFootprint): boolean {
  return (
    left.bounds.left < right.bounds.right - EPSILON &&
    left.bounds.right > right.bounds.left + EPSILON &&
    left.bounds.top < right.bounds.bottom - EPSILON &&
    left.bounds.bottom > right.bounds.top + EPSILON
  )
}

/** Returns whether two exact occupied square-grid footprints touch by a side or corner. */
export function areSquareGridFootprintsAdjacent(input: {
  readonly grid: SceneGrid
  readonly left: SquareGridFootprint
  readonly right: SquareGridFootprint
}): boolean {
  const grid = input.grid
  if (!validSquareGrid(grid)) return false
  return (
    validSquareGridFootprint(grid, input.left) &&
    validSquareGridFootprint(grid, input.right) &&
    !footprintsOverlap(input.left, input.right) &&
    input.right.cells.some((cell) => cellIsAdjacentToFootprint(grid, input.left, cell))
  )
}

function footprintIsWithinMap(
  footprint: SquareGridFootprint,
  map: Pick<CampaignSceneState['map'], 'height' | 'width'>
): boolean {
  return (
    Number.isFinite(map.width) &&
    Number.isFinite(map.height) &&
    map.width > 0 &&
    map.height > 0 &&
    footprint.bounds.left >= -EPSILON &&
    footprint.bounds.top >= -EPSILON &&
    footprint.bounds.right <= map.width + EPSILON &&
    footprint.bounds.bottom <= map.height + EPSILON
  )
}

const SHOVE_ASIDE_DIRECTIONS: readonly {
  readonly direction: SquareGridContactSector
  readonly column: number
  readonly row: number
}[] = [
  { direction: 'NORTH', column: 0, row: -1 },
  { direction: 'NORTH_EAST', column: 1, row: -1 },
  { direction: 'EAST', column: 1, row: 0 },
  { direction: 'SOUTH_EAST', column: 1, row: 1 },
  { direction: 'SOUTH', column: 0, row: 1 },
  { direction: 'SOUTH_WEST', column: -1, row: 1 },
  { direction: 'WEST', column: -1, row: 0 },
  { direction: 'NORTH_WEST', column: -1, row: -1 }
]

/**
 * Derives exact square-grid displacement positions without interpreting any game-system rule.
 * `occupants` excludes the attacker and target; malformed occupancy fails the entire query closed.
 */
export function deriveSquareGridShoveAsideDestinations(input: {
  readonly attacker: SquareGridTokenFootprint
  /** Exact, already-converted displacement in this Scene's measurement domain. */
  readonly displacement: number
  readonly occupants: readonly SquareGridTokenFootprint[]
  readonly state: Pick<CampaignSceneState, 'barriers' | 'doorStates' | 'grid' | 'map'>
  readonly target: SquareGridTokenFootprint
}): readonly SquareGridShoveAsideDestination[] {
  const grid = input.state.grid
  if (
    !validSquareGrid(grid) ||
    !validSquareGridFootprint(grid, input.attacker.footprint) ||
    !validSquareGridFootprint(grid, input.target.footprint) ||
    !Number.isFinite(input.displacement) ||
    input.displacement <= 0 ||
    !areSquareGridFootprintsAdjacent({
      grid,
      left: input.attacker.footprint,
      right: input.target.footprint
    }) ||
    input.attacker.tokenId === input.target.tokenId ||
    input.occupants.length > MAX_SQUARE_GRID_INTERACTION_EVIDENCE
  ) {
    return []
  }
  const occupiedIds = new Set<string>([input.attacker.tokenId, input.target.tokenId])
  for (const occupant of input.occupants) {
    if (
      occupant.tokenId.length === 0 ||
      occupiedIds.has(occupant.tokenId) ||
      !validSquareGridFootprint(grid, occupant.footprint)
    ) {
      return []
    }
    occupiedIds.add(occupant.tokenId)
  }
  const targetWidth = input.target.footprint.bounds.right - input.target.footprint.bounds.left
  const targetHeight = input.target.footprint.bounds.bottom - input.target.footprint.bounds.top
  const blockers = [input.attacker, ...input.occupants]
  return SHOVE_ASIDE_DIRECTIONS.flatMap(({ direction, column, row }) => {
    const position = {
      x: input.target.footprint.center.x + column * grid.cellSize,
      y: input.target.footprint.center.y + row * grid.cellSize
    }
    if (
      Math.abs(
        measureSceneDistance(grid, input.target.footprint.center, position) - input.displacement
      ) > EPSILON
    ) {
      return []
    }
    const targetFootprint = enumerateSquareGridFootprint(grid, {
      position,
      width: targetWidth,
      height: targetHeight
    })
    if (
      targetFootprint === null ||
      !footprintIsWithinMap(targetFootprint, input.state.map) ||
      !canTokenFootprintMoveBetween(input.state, input.target.footprint.center, position, {
        width: targetWidth,
        height: targetHeight
      }) ||
      blockers.some((occupant) => footprintsOverlap(targetFootprint, occupant.footprint)) ||
      !targetFootprint.cells.some((cell) =>
        cellIsAdjacentToFootprint(grid, input.attacker.footprint, cell)
      )
    ) {
      return []
    }
    return [
      {
        direction,
        position,
        remainsAdjacentToAttacker: true,
        targetFootprint
      }
    ]
  })
}

/** Returns exact adjacent, opposite-cell pairs; reach/range intentionally has no role here. */
export function findSquareGridFlankingPairs(input: {
  readonly allied: SquareGridFootprint
  readonly attacker: SquareGridFootprint
  readonly grid: SceneGrid
  readonly target: SquareGridFootprint
}): readonly SquareGridFlankingPair[] {
  const grid = input.grid
  if (
    !validSquareGrid(grid) ||
    !validSquareGridFootprint(grid, input.attacker) ||
    !validSquareGridFootprint(grid, input.allied) ||
    !validSquareGridFootprint(grid, input.target)
  ) {
    return []
  }
  const attacker = input.attacker.cells
    .map((cell) => ({ cell, sector: contactSector(input.target, cell) }))
    .filter(
      (entry): entry is { cell: SquareGridCell; sector: SquareGridContactSector } =>
        entry.sector !== null && cellIsAdjacentToFootprint(grid, input.target, entry.cell)
    )
  const allied = input.allied.cells
    .map((cell) => ({ cell, sector: contactSector(input.target, cell) }))
    .filter(
      (entry): entry is { cell: SquareGridCell; sector: SquareGridContactSector } =>
        entry.sector !== null && cellIsAdjacentToFootprint(grid, input.target, entry.cell)
    )
  if (!productWithinLimit(attacker.length, allied.length, MAX_SQUARE_GRID_INTERACTION_EVIDENCE))
    return []

  return attacker
    .flatMap((attackerEntry) =>
      allied.flatMap((alliedEntry) =>
        sectorsAreOpposite(attackerEntry.sector, alliedEntry.sector)
          ? [
              {
                alliedCell: alliedEntry.cell,
                alliedSector: alliedEntry.sector,
                attackerCell: attackerEntry.cell,
                attackerSector: attackerEntry.sector
              }
            ]
          : []
      )
    )
    .sort(
      (left, right) =>
        left.attackerCell.row - right.attackerCell.row ||
        left.attackerCell.column - right.attackerCell.column ||
        left.alliedCell.row - right.alliedCell.row ||
        left.alliedCell.column - right.alliedCell.column
    )
}

function normalizeDegrees(degrees: number): number | null {
  if (!Number.isFinite(degrees)) return null
  return ((degrees % 360) + 360) % 360
}

function classifyFacingArcAt(input: {
  readonly orientationCenter: ScenePoint
  readonly rotationDegrees: number
  readonly subject: ScenePoint
}): SquareGridFacingArc | null {
  if (!isFinitePoint(input.orientationCenter) || !isFinitePoint(input.subject)) return null
  const rotation = normalizeDegrees(input.rotationDegrees)
  if (rotation === null) return null
  const dx = input.subject.x - input.orientationCenter.x
  const dy = input.subject.y - input.orientationCenter.y
  if (Math.abs(dx) <= EPSILON && Math.abs(dy) <= EPSILON) return null
  const direction = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
  const offset = ((direction - rotation + 540) % 360) - 180
  const absoluteOffset = Math.abs(offset)
  if (absoluteOffset <= 45 + EPSILON) return 'FRONT'
  if (offset > 0 && offset <= 135 + EPSILON) return 'RIGHT_SIDE'
  if (offset < 0 && offset >= -135 - EPSILON) return 'LEFT_SIDE'
  return 'REAR'
}

function compareCells(left: SquareGridCell, right: SquareGridCell): number {
  return left.row - right.row || left.column - right.column
}

function closestFootprintCells(input: {
  readonly source: SquareGridFootprint
  readonly target: SquareGridFootprint
}): { readonly source: SquareGridCell; readonly target: SquareGridCell } | null {
  let closest: {
    readonly source: SquareGridCell
    readonly target: SquareGridCell
    readonly distance: number
  } | null = null
  const sources = [...input.source.cells].sort(compareCells)
  const targets = [...input.target.cells].sort(compareCells)
  for (const source of sources) {
    for (const target of targets) {
      const dx = source.center.x - target.center.x
      const dy = source.center.y - target.center.y
      const distance = dx * dx + dy * dy
      if (
        closest === null ||
        distance < closest.distance - EPSILON ||
        (sameCoordinate(distance, closest.distance) &&
          (compareCells(source, closest.source) < 0 ||
            (compareCells(source, closest.source) === 0 &&
              compareCells(target, closest.target) < 0)))
      ) {
        closest = { source, target, distance }
      }
    }
  }
  return closest === null ? null : { source: closest.source, target: closest.target }
}

/** Classifies a point against a token's orientation; rotation never changes collision geometry. */
export function classifySquareGridFacingArc(input: {
  readonly subject: ScenePoint
  readonly target: Pick<SceneToken, 'height' | 'position' | 'rotationDegrees' | 'width'>
}): SquareGridFacingArc | null {
  if (!validTokenFootprint(input.target) || !isFinitePoint(input.subject)) return null
  return classifyFacingArcAt({
    orientationCenter: input.target.position,
    rotationDegrees: input.target.rotationDegrees,
    subject: input.subject
  })
}

/**
 * Classifies two occupied square-grid footprints from their closest cell pair. This keeps the
 * physical point of contact authoritative for large tokens rather than treating their centers
 * as if they occupied a single square.
 */
export function classifySquareGridFootprintFacingArcs(input: {
  readonly grid: SceneGrid
  readonly source: { readonly footprint: SquareGridFootprint; readonly rotationDegrees: number }
  readonly target: { readonly footprint: SquareGridFootprint; readonly rotationDegrees: number }
}): SquareGridFootprintFacingArcs | null {
  if (
    !validSquareGrid(input.grid) ||
    !validSquareGridFootprint(input.grid, input.source.footprint) ||
    !validSquareGridFootprint(input.grid, input.target.footprint) ||
    normalizeDegrees(input.source.rotationDegrees) === null ||
    normalizeDegrees(input.target.rotationDegrees) === null
  ) {
    return null
  }
  const closest = closestFootprintCells({
    source: input.source.footprint,
    target: input.target.footprint
  })
  if (closest === null) return null
  return {
    sourceToTarget: classifyFacingArcAt({
      orientationCenter: input.source.footprint.center,
      rotationDegrees: input.source.rotationDegrees,
      subject: closest.target.center
    }),
    targetToSource: classifyFacingArcAt({
      orientationCenter: input.target.footprint.center,
      rotationDegrees: input.target.rotationDegrees,
      subject: closest.source.center
    })
  }
}

function segmentCrossesCellInterior(
  from: ScenePoint,
  to: ScenePoint,
  cell: SquareGridCell,
  grid: Extract<SceneGrid, { kind: 'SQUARE' }>
): boolean {
  const left = grid.origin.x + cell.column * grid.cellSize
  const right = left + grid.cellSize
  const top = grid.origin.y + cell.row * grid.cellSize
  const bottom = top + grid.cellSize
  const dx = to.x - from.x
  const dy = to.y - from.y
  let minimum = 0
  let maximum = 1
  for (const [start, delta, low, high] of [
    [from.x, dx, left, right],
    [from.y, dy, top, bottom]
  ] as const) {
    if (Math.abs(delta) <= EPSILON) {
      if (start <= low + EPSILON || start >= high - EPSILON) return false
      continue
    }
    const first = (low - start) / delta
    const second = (high - start) / delta
    minimum = Math.max(minimum, Math.min(first, second))
    maximum = Math.min(maximum, Math.max(first, second))
  }
  return minimum < maximum - EPSILON && maximum > EPSILON && minimum < 1 - EPSILON
}

/**
 * Finds candidate creature cells crossed by an occupied-cell line. This is geometry evidence
 * only: systems decide whether the evidence yields cover and what that cover means.
 */
export function findSquareGridCreatureCoverIntervenors(input: {
  readonly attacker: SquareGridTokenFootprint
  readonly candidates: readonly SquareGridTokenFootprint[]
  readonly grid: SceneGrid
  readonly target: SquareGridTokenFootprint
}): readonly SquareGridCoverIntervenor[] {
  const grid = input.grid
  if (
    !validSquareGrid(grid) ||
    !validSquareGridFootprint(grid, input.attacker.footprint) ||
    !validSquareGridFootprint(grid, input.target.footprint) ||
    input.candidates.length > MAX_SQUARE_GRID_INTERACTION_EVIDENCE
  ) {
    return []
  }
  const excluded = new Set([input.attacker.tokenId, input.target.tokenId])
  const candidates = input.candidates.filter((candidate) => !excluded.has(candidate.tokenId))
  const candidateIds = new Set<string>()
  let candidateCellCount = 0
  for (const candidate of candidates) {
    if (
      candidate.tokenId.length === 0 ||
      candidateIds.has(candidate.tokenId) ||
      !validSquareGridFootprint(grid, candidate.footprint)
    ) {
      return []
    }
    candidateIds.add(candidate.tokenId)
    candidateCellCount += candidate.footprint.cells.length
    if (candidateCellCount > MAX_SQUARE_GRID_INTERACTION_EVIDENCE) return []
  }
  const attackerTargetPairs =
    input.attacker.footprint.cells.length * input.target.footprint.cells.length
  if (
    !Number.isSafeInteger(attackerTargetPairs) ||
    attackerTargetPairs > MAX_SQUARE_GRID_LINE_CHECKS ||
    !productWithinLimit(candidateCellCount, attackerTargetPairs, MAX_SQUARE_GRID_LINE_CHECKS)
  ) {
    return []
  }
  const result = candidates.flatMap((candidate) => {
    return candidate.footprint.cells.flatMap((cell) =>
      input.attacker.footprint.cells.some((attackerCell) =>
        input.target.footprint.cells.some((targetCell) =>
          segmentCrossesCellInterior(attackerCell.center, targetCell.center, cell, grid)
        )
      )
        ? [{ cell, tokenId: candidate.tokenId }]
        : []
    )
  })
  return result.sort(
    (left, right) =>
      left.tokenId.localeCompare(right.tokenId) ||
      left.cell.row - right.cell.row ||
      left.cell.column - right.cell.column
  )
}
