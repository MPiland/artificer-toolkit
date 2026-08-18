import { describe, expect, it } from 'vitest'

import type { CharacterActionDecision } from '@artificer-toolkit/schema/api/characterActionRules'

import {
  projectCharacterRuleActionMechanic,
  type CharacterRuleActionPresentationReferences
} from './characterRuleActionProjection.js'

function references(
  overrides: Partial<CharacterRuleActionPresentationReferences> = {}
): CharacterRuleActionPresentationReferences {
  return {
    damageLabels: new Map(),
    conditionLabels: new Map(),
    ...overrides
  }
}

const mechanic: CharacterActionDecision['mechanic'] = {
  effectId: 'effect-1',
  trigger: 'SAVING_THROW',
  activation: { kind: 'ACTION', amount: 1 },
  rangeLabel: '30 ft',
  attackBonus: null,
  attackRollMode: null,
  save: { ability: 'DEXTERITY', dc: null },
  outcomes: [
    {
      kind: 'DAMAGE',
      pathCode: 'ON_FAILURE',
      expression: '2d6 + 3',
      damageTypeId: 'fire',
      scaling: []
    },
    {
      kind: 'HEAL',
      pathCode: 'ON_SUCCESS',
      expression: '1d8 + 3',
      temporary: false,
      scaling: []
    },
    {
      kind: 'CONDITION',
      pathCode: 'ON_FAILURE',
      conditionId: 'prone'
    },
    {
      kind: 'EFFECT',
      pathCode: 'ON_USE',
      effectKind: 'MANUAL_ADJUDICATION',
      label: null
    }
  ]
}

describe('projectCharacterRuleActionMechanic', () => {
  it('keeps Zen mechanics authoritative and joins presentation labels only', () => {
    const projected = projectCharacterRuleActionMechanic(
      mechanic,
      references({
        damageLabels: new Map([['fire', 'Fire']]),
        conditionLabels: new Map([['prone', 'Prone']])
      })
    )

    expect(projected).toEqual({
      effectId: 'effect-1',
      trigger: 'SAVING_THROW',
      activation: { kind: 'ACTION', amount: 1 },
      rangeLabel: '30 ft',
      save: { ability: 'DEXTERITY' },
      outcomes: [
        {
          kind: 'DAMAGE',
          pathCode: 'ON_FAILURE',
          expression: '2d6 + 3',
          damageTypeId: 'fire',
          damageTypeLabel: 'Fire'
        },
        {
          kind: 'HEAL',
          pathCode: 'ON_SUCCESS',
          expression: '1d8 + 3',
          temporary: false
        },
        {
          kind: 'CONDITION',
          pathCode: 'ON_FAILURE',
          conditionId: 'prone',
          label: 'Prone'
        },
        {
          kind: 'EFFECT',
          pathCode: 'ON_USE',
          effectKind: 'MANUAL_ADJUDICATION'
        }
      ]
    })
  })

  it('fails closed when required presentation vocabulary is unavailable', () => {
    expect(() => projectCharacterRuleActionMechanic(mechanic, references())).toThrow(
      'damage type is missing'
    )
  })
})
