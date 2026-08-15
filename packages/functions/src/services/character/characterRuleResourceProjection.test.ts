import { describe, expect, it } from 'vitest'

import { characterResourcesSchema } from '@artificer-toolkit/schema/api/characterResourceRules'
import { projectCharacterRuleResources } from './characterRuleResourceProjection.js'
import {
  BASE_RESOURCES,
  baseInput,
  baseResource
} from './characterRuleResourceProjection.fixtureData.js'
import {
  authoredSourcePoolId,
  feature,
  option,
  featureSource,
  optionSource,
  featSource
} from './characterRuleResourceProjection.fixtures.js'
describe('projectCharacterRuleResources', () => {
  it('maps all owner kinds and keeps policy order', () => {
    const input = baseInput()
    const projected = projectCharacterRuleResources(input)
    const featureSourcePoolId = authoredSourcePoolId('feature-source-charge', featureSource)
    const optionSourcePoolId = authoredSourcePoolId('selected-option-charge', optionSource)
    const featSourcePoolId = authoredSourcePoolId('feat-source-charge', featSource)

    expect(projected.map((row) => row.id)).toEqual(BASE_RESOURCES.map((row) => row.poolId))
    expect(projected.map((row) => row.owner.kind)).toEqual([
      'AUTHORED_GRANT',
      'AUTHORED_GRANT',
      'AUTHORED_SOURCE',
      'AUTHORED_SOURCE',
      'AUTHORED_SOURCE',
      'ITEM_INSTANCE',
      'ITEM_INSTANCE',
      'ITEM_INSTANCE',
      'ITEM_INSTANCE',
      'COMPANION_FEATURE',
      'SPELL_SOURCE'
    ])
    expect(projected.find((row) => row.id === featureSourcePoolId)?.sourceFeatureId).toBe(
      feature.id
    )
    expect(projected.find((row) => row.id === optionSourcePoolId)?.sourceFeatureId).toBe(option.id)
    expect(projected.find((row) => row.id === featSourcePoolId)).not.toHaveProperty(
      'sourceFeatureId'
    )
    expect(projected.find((row) => row.id === 'ITEM_INSTANCE:root-1:root-item-charge')?.label).toBe(
      'Torch #1 charges'
    )
    expect(projected.find((row) => row.id === 'ITEM_INSTANCE:root-2:root-item-charge')?.label).toBe(
      'Torch #2 charges'
    )
    expect(
      projected.find((row) => row.id === 'ITEM_INSTANCE:nested-1:nested-feature-charge')?.label
    ).toBe('Nested feature')
    expect(
      projected.find((row) => row.id === 'ITEM_INSTANCE:nested-2:nested-feature-charge')?.label
    ).toBe('Nested wand #2 charges')
    expect(
      projected.find(
        (row) =>
          row.id === 'SPELL_SOURCE:spell-access-1:magic-missile:FEATURE:spell-source-instance'
      )?.sourceFeatureId
    ).toBe('magic-source')
    expect(
      projected.find((row) => row.id === 'AUTHORED_GRANT:persisted-resource-grant')
    ).toMatchObject({ used: 3, recoveries: [{ trigger: 'SHORT_REST', amount: { kind: 'ALL' } }] })
  })

  it('omits unresolved resources', () => {
    const input = baseInput()
    input.policy.resources = characterResourcesSchema.parse([
      baseResource({
        sequence: 0,
        ownerKind: 'SPELL_SOURCE',
        state: 'UNRESOLVED',
        poolId: 'SPELL_SOURCE:missing:missing:FEATURE:missing',
        sourceInstanceId: 'missing-instance',
        resourceDefinitionId: 'missing-resource',
        chargeId: 'missing',
        chargeCalculationId: 'SPELL_SOURCE:missing:missing:FEATURE:missing',
        spellId: 'missing-spell',
        accessId: 'missing-access',
        maximum: null,
        rawUsed: 0,
        effectiveUsed: null,
        remaining: null,
        reasonCode: 'MISSING_REQUIRED_FACT',
        baseContribution: null,
        bonusContributions: [],
        resetKind: 'SHORT_REST',
        resetResolution: { baseResetKind: 'SHORT_REST', appliedGrantId: null, source: null }
      }),
      ...BASE_RESOURCES.slice(1)
    ])
    expect(projectCharacterRuleResources(input)).toHaveLength(BASE_RESOURCES.length - 1)
  })

  it('uses the exact granted summary for an embedded authored feature resource', () => {
    const input = baseInput()
    input.resolution.registry.features = input.resolution.registry.features.filter(
      (entry) => entry.id !== feature.id
    )

    expect(
      projectCharacterRuleResources(input).find(
        (row) => row.id === authoredSourcePoolId('feature-source-charge', featureSource)
      )
    ).toMatchObject({
      label: feature.label,
      sourceFeatureId: feature.id,
      sourceLabel: 'Class'
    })
  })

  it('throws owner-key mismatch and presentation errors', () => {
    const mismatch = baseInput()
    mismatch.policy.resources = mismatch.policy.resources.map((row, index) =>
      index === 0 ? { ...row, poolId: 'AUTHORED_GRANT:mismatch' } : row
    )
    expect(() => projectCharacterRuleResources(mismatch)).toThrow(
      'Character rule resource owner key mismatch: AUTHORED_GRANT:mismatch'
    )

    const missingFeature = baseInput()
    missingFeature.resolution.grants.features = missingFeature.resolution.grants.features.filter(
      (entry) => entry.id !== feature.id
    )
    expect(() => projectCharacterRuleResources(missingFeature)).toThrow(
      'Character rule resource presentation is missing'
    )

    const ambiguousNested = baseInput()
    const nestedFacts = ambiguousNested.grantFoldFacts.equipmentItems.find(
      (entry) => entry.instanceId === 'nested-1'
    )
    const duplicated = nestedFacts?.features?.[0]
    if (nestedFacts && duplicated) nestedFacts.features = [duplicated, duplicated]
    expect(() => projectCharacterRuleResources(ambiguousNested)).toThrow(
      'Character rule resource presentation is ambiguous'
    )

    const missingNested = baseInput()
    missingNested.policy.resources = missingNested.policy.resources.map((resource) =>
      resource.ownerKind === 'ITEM_INSTANCE' && resource.itemInstanceId === 'nested-1'
        ? { ...resource, sourceId: 'missing' }
        : resource
    )
    expect(() => projectCharacterRuleResources(missingNested)).toThrow(
      'Character rule resource presentation is missing'
    )
  })
})
