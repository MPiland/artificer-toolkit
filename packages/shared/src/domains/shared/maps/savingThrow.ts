import type { SavingThrowAuthored } from '#authored'
import {
  ABILITY_OPTIONS,
  SAVING_THROW_KIND_OPTIONS
} from '#core'
import { buildNodeMap } from '#utils'

const savingThrow = buildNodeMap<SavingThrowAuthored>()

export const SAVING_THROW_NODE_MAP = savingThrow.define('savingThrow', ({ map, cond, nodes }) => {
  const { selectSingle, number } = nodes
  const local = cond.local()

  map
    .set('savingThrowKind', selectSingle(['savingThrowKind'], 'Saving Throw Kind', {
      kind: 'INLINE',
      options: SAVING_THROW_KIND_OPTIONS
    }, {
      order: 1,
      requiredIf: true
    }))
    .set('ability', selectSingle(['ability'], 'Ability', {
      kind: 'INLINE',
      options: ABILITY_OPTIONS
    }, {
      order: 2,
      requiredIf: true,
      showIf: local.field(['savingThrowKind']).eq('FIXED_VALUE')
    }))
    .set('dc', number(['dc'], 'DC Amount', {
      order: 3,
      requiredIf: true,
      showIf: local.field(['savingThrowKind']).eq('FIXED_VALUE')
    }))
})
