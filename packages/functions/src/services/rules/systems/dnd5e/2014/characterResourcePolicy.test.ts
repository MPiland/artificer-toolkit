import { describe, expect, it } from 'vitest'

import type { RulePackDocumentDto } from '@artificer-toolkit/schema/api/rules'
import { characterResourcesSchema } from '@artificer-toolkit/schema/api/characterResourceRules'

import {
  dnd5e2014CharacterResourcePolicyExpressions,
  dnd5e2014CharacterResourcePolicyOutputExpression
} from './characterResourcePolicy.js'
import { evaluateZenRuleModel } from '../../../zenRuleEngine.js'

const authoredSource = {
  kind: 'AUTHORED' as const,
  sourceKind: 'CLASS' as const,
  definitionId: 'fighter',
  sourceInstanceId: 'fighter'
}

type ResourceRestrictions = {
  groups: Array<{
    contexts: Array<{
      subject: string
      resourceIds?: string[]
      conditions?: Array<{ resourceIds?: string[] }>
    }>
  }>
}

function candidate(ownerKind: string, poolId: string, fields: Record<string, unknown>) {
  return {
    sequence: Number(fields.sequence ?? 0),
    poolId,
    ownerKind,
    resourceDefinitionId: String(fields.resourceDefinitionId ?? poolId),
    chargeId: String(fields.chargeId ?? `${poolId}:charge`),
    chargeCalculationId: poolId,
    baseResetKind: String(fields.baseResetKind ?? 'LONG_REST'),
    ...(ownerKind === 'ITEM_INSTANCE' ? { sourceId: null } : {}),
    ...fields
  }
}

function maximum(calculationId: string, maximumValue: number | null, resolved = true) {
  return {
    calculationId,
    sourceId: `${calculationId}:charge`,
    state: resolved ? 'RESOLVED' : 'UNRESOLVED',
    maximum: maximumValue,
    reasonCode: resolved ? 'CALCULATED' : 'MISSING_REQUIRED_FACT',
    baseContribution: resolved
      ? { sourceId: `${calculationId}:base`, value: maximumValue ?? 0 }
      : null,
    bonusContributions: []
  }
}

function resetModifier(
  id: string,
  resetKind: string,
  restrictions: ResourceRestrictions | null = null
) {
  return {
    domainKey: `CHARGE_RESET:REPLACE_CHARGE_RESET_KIND:${id}`,
    modifierKind: 'REPLACE_CHARGE_RESET_KIND',
    source: authoredSource,
    grant: {
      id,
      valueDomainCode: 'CHARGE_RESET',
      modifierKind: 'REPLACE_CHARGE_RESET_KIND',
      payload: { resetKind },
      restrictions
    }
  }
}

function resourcePolicyDocument(): RulePackDocumentDto {
  return {
    schemaVersion: 1,
    models: {
      resources: {
        contentType: 'application/vnd.gorules.decision',
        nodes: [
          {
            id: 'input',
            type: 'inputNode',
            name: 'Input',
            position: { x: 0, y: 0 },
            content: { schema: '' }
          },
          {
            id: 'resources',
            type: 'expressionNode',
            name: 'Resources',
            position: { x: 100, y: 0 },
            content: {
              passThrough: false,
              inputField: null,
              outputPath: null,
              executionMode: 'single',
              expressions: [
                ...dnd5e2014CharacterResourcePolicyExpressions,
                dnd5e2014CharacterResourcePolicyOutputExpression
              ]
            }
          },
          {
            id: 'output',
            type: 'outputNode',
            name: 'Output',
            position: { x: 200, y: 0 },
            content: { schema: '' }
          }
        ],
        edges: [
          { id: 'input-resources', sourceId: 'input', targetId: 'resources' },
          { id: 'resources-output', sourceId: 'resources', targetId: 'output' }
        ]
      }
    },
    fixtures: []
  }
}

describe('dnd5e2014CharacterResourcePolicy', () => {
  it('keeps zero and unresolved maxima, filters locked/missing access, and preserves owner identity', async () => {
    const candidates = [
      candidate('AUTHORED_GRANT', 'AUTHORED_GRANT:authored-a', {
        sequence: 0,
        resourceGrantId: 'authored-a',
        availableAtLevel: 1,
        activeSourceLevel: 3,
        resourceDefinitionId: 'authored-a',
        baseResetKind: 'LONG_REST'
      }),
      candidate('AUTHORED_GRANT', 'AUTHORED_GRANT:locked', {
        sequence: 1,
        resourceGrantId: 'locked',
        availableAtLevel: 5,
        activeSourceLevel: 3,
        resourceDefinitionId: 'locked'
      }),
      candidate('SPELL_SOURCE', 'SPELL_SOURCE:missing:spell-2:CLASS:source-2', {
        sequence: 2,
        accessId: 'missing-access',
        sourceInstanceId: 'source-2',
        spellId: 'spell-2',
        chargeId: 'missing-charge',
        resourceDefinitionId: 'missing-charge'
      }),
      candidate('ITEM_INSTANCE', 'ITEM_INSTANCE:item-1:charge', {
        sequence: 3,
        itemInstanceId: 'item-1',
        chargeId: 'charge',
        resourceDefinitionId: 'item-charge'
      }),
      candidate('COMPANION_FEATURE', 'COMPANION_FEATURE:companion-1:feature:charge', {
        sequence: 4,
        companionInstanceId: 'companion-1',
        featureId: 'feature',
        chargeId: 'companion-charge',
        resourceDefinitionId: 'companion-charge'
      }),
      candidate('SPELL_SOURCE', 'SPELL_SOURCE:access-1:spell-1:CLASS:source-1', {
        sequence: 5,
        accessId: 'access-1',
        sourceInstanceId: 'source-1',
        spellId: 'spell-1',
        chargeId: 'spell-charge',
        resourceDefinitionId: 'spell-charge',
        baseResetKind: 'SHORT_REST'
      })
    ]
    const result = await evaluateZenRuleModel({
      document: resourcePolicyDocument(),
      modelKey: 'resources',
      context: {
        resourcePoolCandidates: candidates,
        spellAccess: [{ accessId: 'access-1' }],
        resolvedChargeMaximums: [
          maximum('AUTHORED_GRANT:authored-a', 0),
          maximum('ITEM_INSTANCE:item-1:charge', 2),
          maximum('COMPANION_FEATURE:companion-1:feature:charge', null, false),
          maximum('SPELL_SOURCE:access-1:spell-1:CLASS:source-1', 3),
          maximum('AUTHORED_GRANT:locked', 5),
          maximum('SPELL_SOURCE:missing:spell-2:CLASS:source-2', 5)
        ],
        resourceUsageFacts: [
          { poolId: 'AUTHORED_GRANT:authored-a', rawUsed: 4 },
          { poolId: 'ITEM_INSTANCE:item-1:charge', rawUsed: 5 },
          { poolId: 'COMPANION_FEATURE:companion-1:feature:charge', rawUsed: 7 }
        ],
        grantFold: { activeSourceIds: [], modifiers: [] }
      }
    })
    const resources = characterResourcesSchema.parse(
      (result.result as { resolvedResourcePools: unknown }).resolvedResourcePools
    )
    expect(resources.map((resource) => resource.sequence)).toEqual([0, 3, 4, 5])
    expect(resources[0]).toMatchObject({
      ownerKind: 'AUTHORED_GRANT',
      resourceGrantId: 'authored-a',
      maximum: 0,
      rawUsed: 4,
      effectiveUsed: 0,
      remaining: 0,
      state: 'RESOLVED'
    })
    expect(resources[1]).toMatchObject({
      state: 'RESOLVED',
      maximum: 2,
      rawUsed: 5,
      effectiveUsed: 2,
      remaining: 0
    })
    expect(resources[2]).toMatchObject({
      state: 'UNRESOLVED',
      maximum: null,
      rawUsed: 7,
      effectiveUsed: null,
      remaining: null
    })
    expect(resources[3]).toMatchObject({
      ownerKind: 'SPELL_SOURCE',
      accessId: 'access-1',
      spellId: 'spell-1'
    })
  })

  it('emits one included spell pool after duplicate fact compilation', async () => {
    const duplicate = candidate('SPELL_SOURCE', 'SPELL_SOURCE:access-1:spell-1:FEATURE:source-1', {
      sequence: 0,
      accessId: 'access-1',
      sourceInstanceId: 'source-1',
      spellId: 'spell-1',
      chargeId: 'spell-charge',
      resourceDefinitionId: 'spell-charge'
    })
    const compiledCandidates = [
      ...new Map(
        [duplicate, { ...duplicate, sequence: 1 }].map((pool) => [pool.poolId, pool])
      ).values()
    ]
    const result = await evaluateZenRuleModel({
      document: resourcePolicyDocument(),
      modelKey: 'resources',
      context: {
        resourcePoolCandidates: compiledCandidates,
        spellAccess: [{ accessId: 'access-1' }],
        resolvedChargeMaximums: [maximum(duplicate.poolId, 2)],
        grantFold: { activeSourceIds: [], modifiers: [] }
      }
    })
    const resources = characterResourcesSchema.parse(
      (result.result as { resolvedResourcePools: unknown }).resolvedResourcePools
    )
    expect(resources).toHaveLength(1)
    expect(resources[0]).toMatchObject({
      poolId: duplicate.poolId,
      ownerKind: 'SPELL_SOURCE',
      accessId: 'access-1',
      maximum: 2
    })
  })

  it('applies accepted authored reset replacements in order and leaves non-authored owners unchanged', async () => {
    const candidates = [
      candidate('AUTHORED_GRANT', 'AUTHORED_GRANT:authored-a', {
        sequence: 0,
        resourceGrantId: 'authored-a',
        availableAtLevel: 1,
        activeSourceLevel: 3,
        resourceDefinitionId: 'authored-a'
      }),
      candidate('ITEM_INSTANCE', 'ITEM_INSTANCE:item-1:charge', {
        sequence: 1,
        itemInstanceId: 'item-1',
        chargeId: 'charge',
        resourceDefinitionId: 'item-charge'
      }),
      candidate('COMPANION_FEATURE', 'COMPANION_FEATURE:companion-1:feature:charge', {
        sequence: 2,
        companionInstanceId: 'companion-1',
        featureId: 'feature',
        chargeId: 'companion-charge',
        resourceDefinitionId: 'companion-charge'
      }),
      candidate('SPELL_SOURCE', 'SPELL_SOURCE:access-1:spell-1:CLASS:source-1', {
        sequence: 3,
        accessId: 'access-1',
        sourceInstanceId: 'source-1',
        spellId: 'spell-1',
        chargeId: 'spell-charge',
        resourceDefinitionId: 'spell-charge'
      })
    ]
    const result = await evaluateZenRuleModel({
      document: resourcePolicyDocument(),
      modelKey: 'resources',
      context: {
        resourcePoolCandidates: candidates,
        spellAccess: [{ accessId: 'access-1' }],
        resolvedChargeMaximums: candidates.map((pool) => maximum(pool.poolId, 1)),
        grantFold: {
          activeSourceIds: [],
          modifiers: [
            resetModifier('targeted', 'SHORT_REST', {
              groups: [
                {
                  contexts: [
                    {
                      subject: 'RESOURCE',
                      resourceIds: [],
                      conditions: [{ resourceIds: ['authored-a'] }]
                    }
                  ]
                }
              ]
            }),
            resetModifier('global', 'LONG_REST'),
            resetModifier('unknown', 'WEEKLY')
          ]
        }
      }
    })
    const resources = characterResourcesSchema.parse(
      (result.result as { resolvedResourcePools: unknown }).resolvedResourcePools
    )
    expect(resources[0]).toMatchObject({
      resetKind: 'MANUAL',
      resetResolution: {
        baseResetKind: 'LONG_REST',
        appliedGrantId: 'unknown',
        source: authoredSource
      }
    })
    expect(
      resources.slice(1).map((resource) => [resource.resetKind, resource.resetResolution])
    ).toEqual([
      ['LONG_REST', { baseResetKind: 'LONG_REST', appliedGrantId: null, source: null }],
      ['LONG_REST', { baseResetKind: 'LONG_REST', appliedGrantId: null, source: null }],
      ['LONG_REST', { baseResetKind: 'LONG_REST', appliedGrantId: null, source: null }]
    ])
  })

  it('keeps an authored-source pool only while its exact source is active', async () => {
    const sourceId = 'AUTHORED:FEATURE:action-surge:acquisition-1'
    const pool = candidate('AUTHORED_SOURCE', `${sourceId}:charge`, {
      sourceId,
      source: {
        kind: 'AUTHORED',
        sourceKind: 'FEATURE',
        definitionId: 'action-surge',
        sourceInstanceId: 'acquisition-1'
      },
      chargeId: 'action-surge-charge'
    })
    const evaluate = (activeSourceIds: string[]) =>
      evaluateZenRuleModel({
        document: resourcePolicyDocument(),
        modelKey: 'resources',
        context: {
          resourcePoolCandidates: [pool],
          spellAccess: [],
          resolvedChargeMaximums: [maximum(pool.poolId, 1)],
          grantFold: { activeSourceIds, modifiers: [] }
        }
      })

    const active = await evaluate([sourceId])
    expect(
      characterResourcesSchema.parse(
        (active.result as { resolvedResourcePools: unknown }).resolvedResourcePools
      )
    ).toMatchObject([{ ownerKind: 'AUTHORED_SOURCE', sourceId, chargeId: 'action-surge-charge' }])
    const inactive = await evaluate([])
    expect(
      characterResourcesSchema.parse(
        (inactive.result as { resolvedResourcePools: unknown }).resolvedResourcePools
      )
    ).toEqual([])
  })

  it('keeps a nested item pool only while its exact feature source is active', async () => {
    const sourceId = 'EQUIPMENT_INSTANCE:wand:item-1:FEATURE:nested-charge'
    const pool = candidate('ITEM_INSTANCE', 'ITEM_INSTANCE:item-1:nested-charge', {
      itemInstanceId: 'item-1',
      sourceId,
      chargeId: 'nested-charge'
    })
    const evaluate = (activeSourceIds: string[]) =>
      evaluateZenRuleModel({
        document: resourcePolicyDocument(),
        modelKey: 'resources',
        context: {
          resourcePoolCandidates: [pool],
          spellAccess: [],
          resolvedChargeMaximums: [maximum(pool.poolId, 1)],
          resourceUsageFacts: [{ poolId: pool.poolId, rawUsed: 1 }],
          grantFold: { activeSourceIds, modifiers: [] }
        }
      })

    const active = await evaluate([sourceId])
    expect(
      characterResourcesSchema.parse(
        (active.result as { resolvedResourcePools: unknown }).resolvedResourcePools
      )
    ).toMatchObject([{ ownerKind: 'ITEM_INSTANCE', sourceId, rawUsed: 1 }])
    const inactive = await evaluate([])
    expect(
      characterResourcesSchema.parse(
        (inactive.result as { resolvedResourcePools: unknown }).resolvedResourcePools
      )
    ).toEqual([])
  })
})
