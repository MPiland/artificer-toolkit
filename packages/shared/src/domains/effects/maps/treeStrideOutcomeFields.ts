import { EFFECT_KIND } from '#core'
import { MEASUREMENT_NODE_MAP } from '../../shared/maps/index.js'
import type { OutcomeNodeMapApi } from './path.js'

/**
 * The fields only a TREE_STRIDE outcome has: how far apart the trees may be, what entering and
 * leaving one costs in movement, which trees qualify, and how often a round the traveler steps.
 */
export function registerTreeStrideOutcomeFields(
  map: OutcomeNodeMapApi['map'],
  nodes: OutcomeNodeMapApi['nodes'],
  cond: OutcomeNodeMapApi['cond']
) {
  const { groupObject, number, toggle } = nodes
  const showIf = cond.local().field(['effectKind']).eq(EFFECT_KIND.TREE_STRIDE)

  map
    .set(
      'destinationDistance',
      groupObject(['destinationDistance'], 'Destination Distance', () => MEASUREMENT_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true,
        showIf
      })
    )
    .set(
      'entryMovementCost',
      groupObject(['entryMovementCost'], 'Entry Movement Cost', () => MEASUREMENT_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true,
        showIf
      })
    )
    .set(
      'exitMovementCost',
      groupObject(['exitMovementCost'], 'Exit Movement Cost', () => MEASUREMENT_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true,
        showIf
      })
    )
    .set('sameTreeKind', toggle(['sameTreeKind'], 'Same Tree Kind', { showIf }))
    .set('livingTreesOnly', toggle(['livingTreesOnly'], 'Living Trees Only', { showIf }))
    .set(
      'minimumTreeSizeRelativeToTraveler',
      toggle(['minimumTreeSizeRelativeToTraveler'], 'Tree At Least Traveler Size', { showIf })
    )
    .set(
      'usesPerRound',
      number(['usesPerRound'], 'Uses per Round', {
        constraints: { minimum: 1 },
        requiredIf: true,
        showIf
      })
    )
    .set(
      'mustEndTurnOutside',
      toggle(['mustEndTurnOutside'], 'Must End Turn Outside Tree', { showIf })
    )
}
