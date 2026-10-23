import { EFFECT_KIND } from '#core'
import type { OutcomeNodeMapApi } from './path.js'

/** The field only a SOURCE_IMMUNITY outcome has: whether it lasts as long as the casting's Concentration. */
export function registerSourceImmunityOutcomeFields(
  map: OutcomeNodeMapApi['map'],
  nodes: OutcomeNodeMapApi['nodes'],
  cond: OutcomeNodeMapApi['cond']
) {
  const { selectSingle } = nodes
  map.set(
    'sourceImmunityLifetime',
    selectSingle(
      ['lifetime'],
      'Immunity Lasts',
      {
        kind: 'INLINE_OPTIONS',
        options: [{ code: 'CONCENTRATION', label: 'As long as the casting’s Concentration' }]
      },
      { showIf: cond.local().field(['effectKind']).eq(EFFECT_KIND.SOURCE_IMMUNITY) }
    )
  )
}
