import { EFFECT_KIND } from '#core'
import type { OutcomeNodeMapApi } from './path.js'

/** The field only a REMOVE_FROM_PLAY outcome has: whether the removed actor keeps its place in initiative (D178). */
export function registerRemoveFromPlayOutcomeFields(
  map: OutcomeNodeMapApi['map'],
  nodes: OutcomeNodeMapApi['nodes'],
  cond: OutcomeNodeMapApi['cond']
) {
  map.set(
    'keepsTurn',
    nodes.toggle(['keepsTurn'], 'Keeps Its Turn', {
      showIf: cond.local().field(['effectKind']).eq(EFFECT_KIND.REMOVE_FROM_PLAY),
      hiddenBehavior: 'CLEAR'
    })
  )
}
