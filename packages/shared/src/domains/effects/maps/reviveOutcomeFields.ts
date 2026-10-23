import { EFFECT_KIND } from '#core'
import type { OutcomeNodeMapApi } from './path.js'

/** The fields only a REVIVE outcome has: how many hit points the returned creature wakes with. */
export function registerReviveOutcomeFields(
  map: OutcomeNodeMapApi['map'],
  nodes: OutcomeNodeMapApi['nodes'],
  cond: OutcomeNodeMapApi['cond'],
  logic: OutcomeNodeMapApi['logic']
) {
  const local = cond.local()
  const showIf = local.field(['effectKind']).eq(EFFECT_KIND.REVIVE)
  map
    .set(
      'reviveValueKind',
      nodes.selectSingle(
        ['valueKind'],
        'Returns With',
        {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'FIXED', label: 'A Set Number of Hit Points' },
            { code: 'MAXIMUM', label: 'All Its Hit Points' }
          ]
        },
        { requiredIf: true, showIf }
      )
    )
    .set(
      'reviveAmount',
      nodes.number(['amount'], 'Hit Points', {
        constraints: { minimum: 1 },
        requiredIf: true,
        showIf: logic.and([showIf, local.field(['valueKind']).eq('FIXED')])
      })
    )
}
