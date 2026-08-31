import { describe, expect, it } from 'vitest'

import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { resolveRuleCapabilityState } from './ruleCapabilityStateService.js'

const systemId = '11111111-1111-4111-8111-111111111111'
const capabilityId = '22222222-2222-4222-8222-222222222222'
const conditionId = '33333333-3333-4333-8333-333333333333'
const contributionId = '44444444-4444-4444-8444-444444444444'
const sourceId = '55555555-5555-4555-8555-555555555555'
const userId = '66666666-6666-4666-8666-666666666666'

function current(input: {
  id: string
  family: string
  document: ReusableDefinitionCurrentDto['document']
}): ReusableDefinitionCurrentDto {
  return {
    id: input.id,
    gameSystemId: systemId,
    contentSourceId: sourceId,
    definitionFamilyKey: input.family,
    label: input.family,
    description: null,
    document: input.document,
    checksum: checksumRuleDocument(input.document),
    contractVersion: 1,
    version: 1,
    publishedAt: '2026-08-28T00:00:00.000Z',
    publishedBy: userId
  }
}

const capability = current({
  id: capabilityId,
  family: 'rule-capability',
  document: {
    schemaVersion: 1,
    kind: 'RULE_CAPABILITY',
    id: capabilityId,
    gameSystemId: systemId,
    usage: { maximum: 1, refreshBoundary: 'START_OF_TURN' }
  }
})
const condition = current({
  id: conditionId,
  family: 'condition-rule-state',
  document: {
    schemaVersion: 1,
    kind: 'CONDITION_RULE_STATE',
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
})

describe('rule capability state service', () => {
  it('pins exact current definitions and resolves UUID-backed suppression', async () => {
    const byId = new Map([
      [capability.id, capability],
      [condition.id, condition]
    ])
    const resolved = await resolveRuleCapabilityState({
      definitions: {
        async requireCurrent(definitionId) {
          const definition = byId.get(definitionId)
          if (!definition) throw new Error('missing')
          return definition
        }
      },
      gameSystemId: systemId,
      activeConditionDefinitionIds: [conditionId],
      capabilityDefinitionIds: [capabilityId]
    })
    expect(resolved.capabilities[0]).toMatchObject({
      available: false,
      suppressingConditionDefinitionIds: [conditionId],
      contributionIds: [contributionId],
      capability: {
        capabilityDefinitionId: capabilityId,
        definitionVersion: 1
      }
    })
    expect(resolved.conditionDefinitions[0]).toMatchObject({
      conditionDefinitionId: conditionId,
      definitionChecksum: condition.checksum
    })
    expect(resolved.checksum).toBe(
      checksumRuleDocument({
        schemaVersion: 1,
        gameSystemId: systemId,
        conditionDefinitions: resolved.conditionDefinitions,
        capabilities: resolved.capabilities
      })
    )
  })

  it('fails closed for missing, cross-System, or malformed current definitions', async () => {
    await expect(
      resolveRuleCapabilityState({
        definitions: {
          async requireCurrent() {
            throw new Error('missing')
          }
        },
        gameSystemId: systemId,
        activeConditionDefinitionIds: [conditionId],
        capabilityDefinitionIds: [capabilityId]
      })
    ).rejects.toThrow('missing')

    await expect(
      resolveRuleCapabilityState({
        definitions: {
          async requireCurrent(definitionId) {
            return definitionId === conditionId
              ? { ...condition, gameSystemId: userId }
              : capability
          }
        },
        gameSystemId: systemId,
        activeConditionDefinitionIds: [conditionId],
        capabilityDefinitionIds: [capabilityId]
      })
    ).rejects.toThrow(/does not match/)
  })
})
