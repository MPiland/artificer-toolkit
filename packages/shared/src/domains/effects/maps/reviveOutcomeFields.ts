import { EFFECT_KIND } from '#core'
import type { OutcomeNodeMapApi } from './path.js'

/** The field only a REVIVE outcome has: how many hit points the returned creature wakes with. */
export function registerReviveOutcomeFields(
  map: OutcomeNodeMapApi['map'],
  nodes: OutcomeNodeMapApi['nodes'],
  cond: OutcomeNodeMapApi['cond']
) {
  map.set(
    'reviveHitPoints',
    nodes.selectSingle(
      ['hitPoints'],
      'Returns With',
      {
        kind: 'INLINE_OPTIONS',
        options: [
          { code: 'ONE', label: '1 Hit Point' },
          { code: 'MAXIMUM', label: 'All Its Hit Points' }
        ]
      },
      { requiredIf: true, showIf: cond.local().field(['effectKind']).eq(EFFECT_KIND.REVIVE) }
    )
  )
}
