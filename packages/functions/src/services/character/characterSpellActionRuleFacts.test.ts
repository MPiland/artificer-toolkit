import { describe, expect, it } from 'vitest'

import {
  ACTIVATION_CODE,
  EFFECT_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TRIGGER
} from '@artificer-toolkit/shared/core'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { buildCharacterSpellActionRuleFacts } from './characterSpellActionRuleFacts.js'

const EFFECT_ID = '00000000-0000-4000-8000-0000000000c4'

const spell: SpellAuthored = {
  kind: 'SPELL',
  id: 'spell-1',
  label: 'Test spell',
  description: '',
  castingTime: { unit: 'ROUND', amount: 1 },
  level: 1,
  classIds: ['wizard'],
  magicSchoolId: 'evocation',
  userId: 'user-1',
  systemId: 'dnd5e2014',
  effects: [
    {
      id: EFFECT_ID,
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.ACTIVATED,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: { id: 'range-1', rangeKind: RANGE_KIND.SELF }
      },
      paths: [
        {
          id: 'path-1',
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED',
          resultBlock: {
            id: 'result-1',
            resultKind: 'SINGLE',
            outcomes: [{ id: 'outcome-1', effectKind: EFFECT_KIND.CONDITION, conditionId: 'prone' }]
          }
        }
      ]
    }
  ]
}

describe('buildCharacterSpellActionRuleFacts', () => {
  it('hydrates each candidate spell once and emits normalized JSON-safe effects', () => {
    const result = buildCharacterSpellActionRuleFacts({
      spellIds: ['spell-1', 'spell-1'],
      spells: [spell]
    })

    expect(result).toEqual({
      spellActionFacts: [
        {
          spellId: 'spell-1',
          effects: [
            {
              effectId: EFFECT_ID,
              mechanicFacts: {
                invocation: {
                  triggerCode: TRIGGER.ACTIVATED,
                  activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
                  range: { rangeKind: RANGE_KIND.SELF, amount: null, unit: null },
                  reactionMovementTrigger: null,
                  savingThrow: null
                },
                outcomes: [{ kind: 'CONDITION', pathCode: PATH_CODE.ON_USE, conditionId: 'prone' }]
              }
            }
          ]
        }
      ]
    })
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })

  it('fails closed when a requested reference spell has no hydrated definition', () => {
    expect(() => buildCharacterSpellActionRuleFacts({ spellIds: ['spell-1'], spells: [] })).toThrow(
      'missing spell "spell-1"'
    )
  })
})
