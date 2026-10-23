import { EFFECT_KIND } from '#core'
import type { OutcomeNodeMapApi } from './path.js'

/** The fields only an END_EFFECTS outcome has: how many effects it ends and which it matches (D174). */
export function registerEndEffectsOutcomeFields(
  map: OutcomeNodeMapApi['map'],
  nodes: OutcomeNodeMapApi['nodes'],
  cond: OutcomeNodeMapApi['cond'],
  data: OutcomeNodeMapApi['data']
) {
  const { selectSingle, selectMulti } = nodes
  const showIf = cond.local().field(['effectKind']).eq(EFFECT_KIND.END_EFFECTS)
  map
    .set(
      'endEffectsScope',
      selectSingle(
        ['scope'],
        'Ends',
        {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'ALL', label: 'Every Matching Effect' },
            { code: 'ONE_CHOSEN', label: 'One Effect the Caster Picks' }
          ]
        },
        { requiredIf: true, showIf }
      )
    )
    .set(
      'endEffectsConditionIds',
      selectMulti(
        ['conditionIds'],
        'Ends Effects Granting',
        {
          kind: 'DATA',
          relationship: data.table('condition_types', {
            selectColumns: ['id', 'label', 'description']
          })
        },
        { requiredIf: true, showIf }
      )
    )
    .set(
      'endEffectsOriginCreatureTypeIds',
      selectMulti(
        ['originCreatureTypeIds'],
        'Only Effects From Creatures Of Type',
        {
          kind: 'DATA',
          relationship: data.table('creature_types', {
            selectColumns: ['id', 'label', 'description']
          })
        },
        { showIf }
      )
    )
}
