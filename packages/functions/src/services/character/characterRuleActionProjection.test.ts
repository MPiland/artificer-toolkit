import { describe, expect, it } from 'vitest'

import type { CharacterSheetMechanicsQueryResult } from '@artificer-toolkit/db'
import type { CharacterActionDecision } from '@artificer-toolkit/schema/api/characterActionRules'

import { projectCharacterRuleActionMechanic } from './characterRuleActionProjection.js'

function query(
  overrides: Partial<CharacterSheetMechanicsQueryResult> = {}
): CharacterSheetMechanicsQueryResult {
  return {
    owners: [],
    ownerAttributes: [],
    ownerEffects: [],
    ownerCharges: [],
    invocations: [],
    paths: [],
    choiceOptions: [],
    rollTableRows: [],
    resultBlocks: [],
    outcomes: [],
    characteristics: [],
    shapeDimensions: [],
    savingThrows: [],
    savingThrowBonuses: [],
    damages: [],
    damageScaling: [],
    damageBonusKinds: [],
    damageBonuses: [],
    conditions: [],
    genericOutcomes: [],
    charges: [],
    chargeScaling: [],
    chargeBonuses: [],
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
      query({
        damages: [
          {
            damageId: 'damage-1',
            damageTypeId: 'fire',
            damageTypeCode: 'FIRE',
            damageTypeLabel: 'Fire',
            valueKind: 'DICE',
            scalingKind: 'NONE',
            amountKind: null,
            amountMultiplier: null,
            scalingSource: null,
            classId: null,
            order: 0,
            valueId: null,
            amount: null,
            dice: '2d6',
            valueMultiplier: null,
            valueMin: null,
            valueMax: null
          }
        ],
        conditions: [
          {
            conditionId: 'condition-1',
            conditionTypeId: 'prone',
            conditionTypeCode: 'PRONE',
            conditionTypeLabel: 'Prone'
          }
        ]
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
    expect(() => projectCharacterRuleActionMechanic(mechanic, query())).toThrow(
      'damage type is missing'
    )
  })
})
