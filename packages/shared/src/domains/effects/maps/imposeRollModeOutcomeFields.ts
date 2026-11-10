import { EFFECT_KIND } from '#core'
import type { OutcomeNodeMapApi } from './path.js'

/** The field only an IMPOSE_ROLL_MODE_ON_TRIGGERING_ROLL outcome has: the roll mode it gives the roll it answers. */
export function registerImposeRollModeOutcomeFields(
  map: OutcomeNodeMapApi['map'],
  nodes: OutcomeNodeMapApi['nodes'],
  cond: OutcomeNodeMapApi['cond'],
  data: OutcomeNodeMapApi['data']
) {
  const imposesRollMode = cond
    .local()
    .field(['effectKind'])
    .eq(EFFECT_KIND.IMPOSE_ROLL_MODE_ON_TRIGGERING_ROLL)

  map.set(
    'rollMode',
    nodes.selectSingle(
      ['rollMode'],
      'Roll Mode',
      {
        kind: 'DATA',
        relationship: data.table('roll_modes', { selectColumns: ['id', 'label', 'description'] })
      },
      { showIf: imposesRollMode, requiredIf: imposesRollMode, hiddenBehavior: 'CLEAR' }
    )
  )
}
