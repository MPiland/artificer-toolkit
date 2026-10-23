import { EFFECT_KIND } from '#core'
import type { EndEffectsSelectorAuthored } from '#authored'
import { buildNodeMap } from '#utils'
import type { AllUnionFields } from 'type-fest'
import type { OutcomeNodeMapApi } from './path.js'

const endEffectsSelector = buildNodeMap<AllUnionFields<EndEffectsSelectorAuthored>>()

/** One thing an END_EFFECTS outcome matches: a condition a held effect owns, or the level its spell was cast at (D174, D182). */
const END_EFFECTS_SELECTOR_NODE_MAP = endEffectsSelector.define(
  'endEffectsSelector',
  ({ map, nodes, data, cond }) => {
    const { selectSingle, selectMulti, number } = nodes
    const local = cond.local()
    map
      .set(
        'kind',
        selectSingle(['kind'], 'Matches', {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'CONDITION', label: 'Effects Granting a Condition' },
            { code: 'SPELL_LEVEL', label: 'Effects Cast at a Spell Level' }
          ]
        })
      )
      .set(
        'conditionIds',
        selectMulti(
          ['conditionIds'],
          'Conditions',
          {
            kind: 'DATA',
            relationship: data.table('condition_types', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          { requiredIf: true, showIf: local.field(['kind']).eq('CONDITION') }
        )
      )
      .set(
        'limit',
        selectSingle(
          ['limit'],
          'Up To',
          {
            kind: 'INLINE_OPTIONS',
            options: [
              { code: 'SLOT_LEVEL', label: 'The Level This Spell Is Cast At' },
              { code: 'FIXED', label: 'A Fixed Spell Level' }
            ]
          },
          { requiredIf: true, showIf: local.field(['kind']).eq('SPELL_LEVEL') }
        )
      )
      .set(
        'level',
        number(['level'], 'Spell Level', {
          constraints: { minimum: 0, maximum: 9 },
          requiredIf: true,
          showIf: local.field(['limit']).eq('FIXED')
        })
      )
  }
)

/** The fields only an END_EFFECTS outcome has: how many effects it ends and which it matches (D174). */
export function registerEndEffectsOutcomeFields(
  map: OutcomeNodeMapApi['map'],
  nodes: OutcomeNodeMapApi['nodes'],
  cond: OutcomeNodeMapApi['cond'],
  data: OutcomeNodeMapApi['data']
) {
  const { selectSingle, selectMulti, groupArray } = nodes
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
      'endEffectsSelectors',
      groupArray(['selectors'], 'Ends Effects That Match', () => END_EFFECTS_SELECTOR_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true,
        showIf
      })
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
