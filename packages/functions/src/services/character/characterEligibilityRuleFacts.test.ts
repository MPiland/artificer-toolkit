import { describe, expect, it } from 'vitest'

import type { FacetAuthored } from '@artificer-toolkit/shared/authored'

import { compileCharacterEligibilityRuleFacts } from './characterEligibilityRuleFacts.js'

describe('compileCharacterEligibilityRuleFacts', () => {
  it('preserves ordered raw requirements without deciding eligibility', () => {
    const facet: FacetAuthored<'CHARACTER'> = {
      id: 'feat:example',
      groups: [
        {
          id: 'group:class',
          order: 1,
          contexts: [
            {
              id: 'context:class',
              order: 1,
              subject: 'CHARACTER',
              conditions: [
                {
                  id: 'condition:class',
                  order: 1,
                  kind: 'PREDICATE',
                  constraint: 'INCLUDE',
                  predicateCode: 'CLASS_LEVEL',
                  classIds: ['fighter'],
                  min: 4
                }
              ]
            }
          ]
        },
        {
          id: 'group:option',
          order: 2,
          contexts: [
            {
              id: 'context:option',
              order: 1,
              subject: 'CHARACTER',
              conditions: [
                {
                  id: 'condition:option',
                  order: 1,
                  kind: 'PREDICATE',
                  constraint: 'INCLUDE',
                  predicateCode: 'OPTION_OBTAINED',
                  featureIds: ['feature:training'],
                  optionIds: ['option:defense']
                }
              ]
            }
          ]
        }
      ]
    }

    expect(
      compileCharacterEligibilityRuleFacts({
        evaluationId: 'feat:example',
        facet,
        sourceState: { carried: true, equipped: false, attuned: false }
      })
    ).toEqual({
      evaluationId: 'feat:example',
      sourceState: { carried: true, equipped: false, attuned: false },
      groups: [
        {
          groupId: 'group:class',
          conditions: [
            {
              conditionId: 'condition:class',
              constraint: 'INCLUDE',
              kind: 'PREDICATE',
              predicateCode: 'CLASS_LEVEL',
              authoringMode: 'ALL',
              abilityId: null,
              min: 4,
              max: null,
              requiredIds: ['fighter'],
              secondaryRequiredIds: [],
              category: null,
              requiredProperties: [],
              minimumRank: null
            }
          ]
        },
        {
          groupId: 'group:option',
          conditions: [
            {
              conditionId: 'condition:option',
              constraint: 'INCLUDE',
              kind: 'PREDICATE',
              predicateCode: 'OPTION_OBTAINED',
              authoringMode: 'SELECTED',
              abilityId: null,
              min: null,
              max: null,
              requiredIds: ['feature:training'],
              secondaryRequiredIds: ['option:defense'],
              category: null,
              requiredProperties: [],
              minimumRank: null
            }
          ]
        }
      ]
    })
  })
})
