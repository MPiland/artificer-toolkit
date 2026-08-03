import { EFFECT_KIND, type ShapeMeasurementValueAuthored } from '#core'

export type TreeStrideAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.TREE_STRIDE
  destinationDistance: ShapeMeasurementValueAuthored
  entryMovementCost: ShapeMeasurementValueAuthored
  exitMovementCost: ShapeMeasurementValueAuthored
  sameTreeKind: boolean
  livingTreesOnly: boolean
  minimumTreeSizeRelativeToTraveler: boolean
  usesPerRound: number
  mustEndTurnOutside: boolean
}
