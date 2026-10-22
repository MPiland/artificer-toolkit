import { EFFECT_KIND } from '#core'
import { DURATION_NODE_MAP } from '../../shared/maps/index.js'
import type { OutcomeNodeMapApi } from './path.js'

/** The fields only a CONDITION outcome has beyond its condition: its source and its own timing (D172). */
export function registerConditionOutcomeFields(
  map: OutcomeNodeMapApi['map'],
  nodes: OutcomeNodeMapApi['nodes'],
  cond: OutcomeNodeMapApi['cond'],
  logic: OutcomeNodeMapApi['logic']
) {
  const { text, toggle, groupObject } = nodes
  const local = cond.local()
  const isCondition = local.field(['effectKind']).eq(EFFECT_KIND.CONDITION)
  map
    .set(
      'recordsSource',
      toggle(['recordsSource'], 'The Acting Creature Is Its Source', { showIf: isCondition })
    )
    .set(
      'fleesSource',
      toggle(['fleesSource'], 'The Holder Must Dash Away From Its Source', {
        showIf: logic.and([isCondition, local.field(['recordsSource']).eq(true)]),
        hiddenBehavior: 'CLEAR'
      })
    )
    .set(
      'duration',
      groupObject(['duration'], 'Duration', () => DURATION_NODE_MAP, {
        presentation: 'inline',
        showIf: isCondition,
        hiddenBehavior: 'CLEAR'
      })
    )
    .set(
      'endsWithOutcomeId',
      text(['endsWithOutcomeId'], 'Ends With Condition Outcome ID', {
        showIf: isCondition,
        hiddenBehavior: 'CLEAR'
      })
    )
}
