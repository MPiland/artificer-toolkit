import type { SavingThrowAuthored } from '#authored'
import {
  ABILITY_OPTIONS,
  SAVING_THROW_KIND_OPTIONS
} from '#core'
import { buildNodeMap } from '#utils'

const savingThrow = buildNodeMap<SavingThrowAuthored>()

export const SAVING_THROW_NODE_MAP = savingThrow.define((map, { local }) => map({
  savingThrowKind: {
    kind: 'INPUT',
    label: 'Saving Throw Kind',
    type: 'SELECT_SINGLE',
    requiredIf: true,
    source: {
      kind: 'INLINE',
      options: SAVING_THROW_KIND_OPTIONS
    }
  },
  ability: {
    kind: 'INPUT',
    label: 'Ability',
    type: 'SELECT_SINGLE',
    requiredIf: true,
    source: {
      kind: 'INLINE',
      options: ABILITY_OPTIONS
    },
    showIf: local('savingThrowKind').eq('FIXED_VALUE')
  },
  dc: {
    kind: 'INPUT',
    label: 'Difficulty Class',
    type: 'NUMBER',
    showIf: local('savingThrowKind').eq('FIXED_VALUE')
  }
}))
