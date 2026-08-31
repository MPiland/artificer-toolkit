import { describe, expect, it } from 'vitest'

import { resolveRuleCapabilityAvailability } from '../domains/rules/ruleState.js'

const systemId = '11111111-1111-4111-8111-111111111111'
const capabilityId = '22222222-2222-4222-8222-222222222222'
const otherCapabilityId = '33333333-3333-4333-8333-333333333333'
const conditionId = '44444444-4444-4444-8444-444444444444'
const contributionId = '55555555-5555-4555-8555-555555555555'

describe('rule capability availability', () => {
  it('resolves exact UUID-backed suppression without condition or capability labels', () => {
    expect(
      resolveRuleCapabilityAvailability({
        gameSystemId: systemId,
        capabilityDefinitionId: capabilityId,
        conditions: [
          {
            id: conditionId,
            gameSystemId: systemId,
            capabilitySuppressions: [
              {
                id: contributionId,
                order: 0,
                kind: 'CAPABILITY_SUPPRESS',
                capabilityDefinitionIds: [capabilityId]
              }
            ]
          }
        ]
      })
    ).toEqual({
      available: false,
      suppressingConditionDefinitionIds: [conditionId],
      contributionIds: [contributionId]
    })
  })

  it('leaves unrelated capabilities available and rejects cross-System definitions', () => {
    const condition = {
      id: conditionId,
      gameSystemId: systemId,
      capabilitySuppressions: [
        {
          id: contributionId,
          order: 0,
          kind: 'CAPABILITY_SUPPRESS' as const,
          capabilityDefinitionIds: [otherCapabilityId]
        }
      ]
    }
    expect(
      resolveRuleCapabilityAvailability({
        gameSystemId: systemId,
        capabilityDefinitionId: capabilityId,
        conditions: [condition]
      })
    ).toEqual({ available: true, suppressingConditionDefinitionIds: [], contributionIds: [] })
    expect(() =>
      resolveRuleCapabilityAvailability({
        gameSystemId: '66666666-6666-4666-8666-666666666666',
        capabilityDefinitionId: capabilityId,
        conditions: [condition]
      })
    ).toThrow(/another Game System/)
  })
})
