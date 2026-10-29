import { EFFECT_KIND, ROUNDING_OPTIONS } from '#core'
import type { SpellSlotExchangeAuthored } from '#authored'
import { buildNodeMap } from '#utils'
import type { OutcomeNodeMapApi } from './path.js'

type RecoverSlotsAuthored = Extract<SpellSlotExchangeAuthored, { mode: 'RECOVER_SLOTS' }>
type ResourceToSlotAuthored = Extract<SpellSlotExchangeAuthored, { mode: 'RESOURCE_TO_SLOT' }>

const levelBudget = buildNodeMap<RecoverSlotsAuthored['levelBudget']>()
const slotCost = buildNodeMap<ResourceToSlotAuthored['costs'][number]>()

/** The combined slot levels a RECOVER_SLOTS outcome frees: one class's level divided and rounded. */
const SPELL_SLOT_LEVEL_BUDGET_NODE_MAP = levelBudget.define(
  'spellSlotLevelBudget',
  ({ map, nodes, data }) => {
    const { selectSingle, number } = nodes
    map
      .set(
        'classId',
        selectSingle(
          ['classId'],
          'Class',
          {
            kind: 'DATA',
            relationship: data.table('classes', { selectColumns: ['id', 'label'] })
          },
          { requiredIf: true }
        )
      )
      .set(
        'divisor',
        number(['divisor'], 'Divide Class Level By', {
          constraints: { minimum: 1 },
          requiredIf: true
        })
      )
      .set(
        'rounding',
        selectSingle(
          ['rounding'],
          'Rounding',
          { kind: 'INLINE_OPTIONS', options: ROUNDING_OPTIONS },
          { requiredIf: true }
        )
      )
  }
)

/** What one extra slot of a level costs from the pool a RESOURCE_TO_SLOT outcome spends. */
const SPELL_SLOT_COST_NODE_MAP = slotCost.define('spellSlotCost', ({ map, nodes }) => {
  const { number } = nodes
  map
    .set(
      'slotLevel',
      number(['slotLevel'], 'Slot Level', {
        constraints: { minimum: 1, maximum: 9 },
        requiredIf: true
      })
    )
    .set('cost', number(['cost'], 'Cost', { constraints: { minimum: 1 }, requiredIf: true }))
})

/**
 * The fields only a SPELL_SLOT_EXCHANGE outcome has, by the direction value moves. The pool modes'
 * `chargeId` shares the RESTORE_RESOURCE Charge ID node in the outcome map.
 */
export function registerSpellSlotExchangeOutcomeFields(
  map: OutcomeNodeMapApi['map'],
  nodes: OutcomeNodeMapApi['nodes'],
  cond: OutcomeNodeMapApi['cond'],
  logic: OutcomeNodeMapApi['logic']
) {
  const { selectSingle, number, groupObject, groupArray } = nodes
  const { and, or } = logic
  const local = cond.local()
  const isExchange = local.field(['effectKind']).eq(EFFECT_KIND.SPELL_SLOT_EXCHANGE)
  const inMode = (mode: SpellSlotExchangeAuthored['mode']) =>
    and([isExchange, local.field(['mode']).eq(mode)])
  map
    .set(
      'spellSlotExchangeMode',
      selectSingle(
        ['mode'],
        'Exchange',
        {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'RECOVER_SLOTS', label: 'Recover Expended Spell Slots' },
            { code: 'SLOT_TO_RESOURCE', label: 'Convert a Spell Slot Into the Pool' },
            { code: 'RESOURCE_TO_SLOT', label: 'Spend the Pool for a Spell Slot' }
          ]
        },
        { requiredIf: true, showIf: isExchange, hiddenBehavior: 'CLEAR' }
      )
    )
    .set(
      'spellSlotLevelBudget',
      groupObject(['levelBudget'], 'Combined Slot Levels', () => SPELL_SLOT_LEVEL_BUDGET_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true,
        showIf: inMode('RECOVER_SLOTS'),
        hiddenBehavior: 'CLEAR'
      })
    )
    .set(
      'spellSlotMaximumLevel',
      number(['maximumSlotLevel'], 'Highest Slot Level', {
        constraints: { minimum: 1, maximum: 9 },
        requiredIf: inMode('RECOVER_SLOTS'),
        showIf: or([inMode('RECOVER_SLOTS'), inMode('SLOT_TO_RESOURCE')]),
        hiddenBehavior: 'CLEAR'
      })
    )
    .set(
      'spellSlotCosts',
      groupArray(['costs'], 'Slot Costs', () => SPELL_SLOT_COST_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true,
        showIf: inMode('RESOURCE_TO_SLOT'),
        hiddenBehavior: 'CLEAR'
      })
    )
}
