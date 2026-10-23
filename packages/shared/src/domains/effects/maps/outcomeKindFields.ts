import { registerConditionOutcomeFields } from './conditionOutcomeFields.js'
import { registerEndEffectsOutcomeFields } from './endEffectsOutcomeFields.js'
import { registerRemoveFromPlayOutcomeFields } from './removeFromPlayOutcomeFields.js'
import { registerReviveOutcomeFields } from './reviveOutcomeFields.js'
import type { OutcomeNodeMapApi } from './path.js'

/** The fields that belong to one outcome effect kind, registered beside the common outcome fields. */
export function registerOutcomeKindFields(
  map: OutcomeNodeMapApi['map'],
  nodes: OutcomeNodeMapApi['nodes'],
  cond: OutcomeNodeMapApi['cond'],
  logic: OutcomeNodeMapApi['logic'],
  data: OutcomeNodeMapApi['data']
) {
  registerConditionOutcomeFields(map, nodes, cond, logic)
  registerEndEffectsOutcomeFields(map, nodes, cond, data)
  registerReviveOutcomeFields(map, nodes, cond, logic)
  registerRemoveFromPlayOutcomeFields(map, nodes, cond)
}
