import type { ChargeAuthored } from '#authored'
import { CHARGE_LIMIT_OPTIONS, CHARGE_RESET_OPTIONS } from '#core'
import { buildNodeMap } from '#utils'

const charges = buildNodeMap<ChargeAuthored>()

export const CHARGE_NODE_MAP = charges.define((map) => map({
  resetKind: {
    kind: 'INPUT',
    label: 'Reset Kind',
    type: 'SELECT_SINGLE',
    requiredIf: true,
    source: {
      kind: 'INLINE',
      options: CHARGE_RESET_OPTIONS
    }
  },

  limitKind: {
    kind: 'INPUT',
    label: 'Limit Kind',
    type: 'SELECT_SINGLE',
    requiredIf: true,
    source: {
      kind: 'INLINE',
      options: CHARGE_LIMIT_OPTIONS
    }
  }
}))
