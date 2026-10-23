import { EFFECT_KIND, HEAL_VALUE_OPTIONS } from '#core'
import { buildNodeMap } from '#utils'
import type { HealDamageDealtPayload } from '../authored/heal.js'
import type { OutcomeNodeMapApi } from './path.js'

const healFraction = buildNodeMap<HealDamageDealtPayload['fraction']>()

const HEAL_FRACTION_NODE_MAP = healFraction.define('healFraction', ({ map, nodes }) => {
  const { number } = nodes
  map
    .set(
      'numerator',
      number(['numerator'], 'Numerator', { constraints: { minimum: 1 }, requiredIf: true })
    )
    .set(
      'denominator',
      number(['denominator'], 'Denominator', { constraints: { minimum: 1 }, requiredIf: true })
    )
})

/** The fields only a HEAL outcome has beyond a damage-like amount: what its value is read from (D181). */
export function registerHealOutcomeFields(
  map: OutcomeNodeMapApi['map'],
  nodes: OutcomeNodeMapApi['nodes'],
  cond: OutcomeNodeMapApi['cond'],
  logic: OutcomeNodeMapApi['logic']
) {
  const { text, selectSingle, groupObject } = nodes
  const local = cond.local()
  const isHeal = local.field(['effectKind']).eq(EFFECT_KIND.HEAL)
  const isDamageDealt = logic.and([isHeal, local.field(['valueKind']).eq('DAMAGE_DEALT')])
  map
    .set(
      'healValueKind',
      selectSingle(
        ['valueKind'],
        'Value Kind',
        { kind: 'INLINE_OPTIONS', options: HEAL_VALUE_OPTIONS },
        { requiredIf: true, showIf: isHeal }
      )
    )
    .set(
      'healDamageOutcomeId',
      text(['damageOutcomeId'], 'Damage Outcome ID', { requiredIf: true, showIf: isDamageDealt })
    )
    .set(
      'healFraction',
      groupObject(['fraction'], 'Fraction', () => HEAL_FRACTION_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true,
        showIf: isDamageDealt
      })
    )
    .set(
      'healRecipient',
      selectSingle(
        ['recipient'],
        'Recipient',
        { kind: 'INLINE_OPTIONS', options: [{ code: 'SOURCE', label: 'The Source' }] },
        { requiredIf: true, showIf: isDamageDealt }
      )
    )
}
