import {
  createEmptyCharacterAuthored,
  type CharacterBuilderResolution,
  type CharacterBuilderSummary
} from './builderService.js'
import type { CharacterRuleResourceProjectionInput } from './characterRuleResourceProjection.js'
import type { CharacterResource } from '@artificer-toolkit/schema/api/characterResourceRules'
import { characterResourcesSchema } from '@artificer-toolkit/schema/api/characterResourceRules'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  characterId,
  systemId,
  userId,
  feature,
  option,
  feat,
  featureSource,
  optionSource,
  featSource,
  rootItem,
  nestedItem,
  rootItemAuthored,
  nestedItemAuthored,
  spell,
  authoredSourcePoolId,
  SNAPSHOT,
  abilities,
  rootItemResolved,
  nestedItemResolved,
  featAuthored,
  grantFoldFacts
} from './characterRuleResourceProjection.fixtures.js'
function character() {
  const entity = createEmptyCharacterAuthored({ id: characterId, systemId, userId })
  entity.intent.resourceGrants = [
    {
      id: 'persisted-resource-grant',
      resourceId: 'granted-resource',
      source: { kind: 'CLASS', classId: 'fighter', classLevel: 3 },
      timing: { kind: 'CHARACTER_LEVEL', level: 1 }
    },
    {
      id: 'fallback-resource-grant',
      resourceId: 'fallback-resource',
      source: { kind: 'FEATURE', featureId: feat.id },
      timing: { kind: 'CHARACTER_LEVEL', level: 1 }
    }
  ]
  entity.state.equipment.inventory = [
    { id: 'root-1', equipmentId: rootItem.id, quantity: 1, customName: 'Torch' },
    { id: 'root-2', equipmentId: rootItem.id, quantity: 1, customName: 'Torch' },
    { id: 'nested-1', equipmentId: nestedItem.id, quantity: 1, customName: 'Nested wand' },
    { id: 'nested-2', equipmentId: nestedItem.id, quantity: 1, customName: 'Nested wand' }
  ]
  entity.state.creatures = [
    {
      id: 'companion-1',
      creatureId: 'wolf',
      relationshipKind: 'COMPANION',
      originKind: 'WORLD',
      isActive: true,
      currentHitPoints: 8
    }
  ]
  return entity
}

function companionRegistry() {
  const wolf: CreatureAuthored = {
    id: 'wolf',
    label: 'Wolf',
    userId: 'system',
    systemId,
    category: 'BEAST',
    creatureTypeId: 'beast',
    size: 'SMALL',
    abilityScores: abilities,
    armorClass: 12,
    hitPoints: 7,
    speeds: [],
    features: [{ id: 'companion-feature', label: 'Companion feature', description: '', order: 1 }]
  }
  return new Map([['wolf', wolf]])
}

function resolution(): CharacterBuilderResolution {
  const summary: CharacterBuilderSummary = { totalLevel: 3, abilities, classes: [] }
  return {
    mode: 'edit',
    catalog: {
      races: [],
      classes: [],
      backgrounds: [],
      feats: [{ id: 'feat-origin', label: 'Feat origin' }],
      equipment: [
        {
          id: rootItemAuthored.id,
          label: rootItemAuthored.label,
          isContainer: false,
          properties: rootItemAuthored.properties ?? [],
          requiresAttunement: false
        },
        {
          id: nestedItemAuthored.id,
          label: nestedItemAuthored.label,
          isContainer: false,
          properties: nestedItemAuthored.properties ?? [],
          requiresAttunement: false
        }
      ],
      spells: [spell]
    },
    registry: {
      system: null,
      races: [],
      classes: [],
      backgrounds: [],
      equipment: [rootItemResolved, nestedItemResolved],
      feats: [featAuthored],
      features: [feature, option, feat]
    },
    sourceRegistry: {
      system: null,
      races: [],
      classes: [],
      backgrounds: [],
      equipment: [],
      feats: [],
      features: []
    },
    summary,
    grants: {
      resources: [
        {
          id: 'granted-resource',
          label: 'Granted',
          sourceLabel: 'Fighter',
          source: { kind: 'CLASS', classId: 'fighter', classLevel: 3 }
        },
        {
          id: 'fallback-resource',
          label: 'Fallback',
          sourceLabel: 'Feature',
          source: { kind: 'FEATURE', featureId: feat.id }
        },
        {
          id: feature.id,
          label: feature.label,
          sourceLabel: 'Class',
          source: { kind: 'CLASS', classId: 'fighter', classLevel: 2 }
        },
        {
          id: option.id,
          label: option.label,
          sourceLabel: 'Option',
          source: { kind: 'OPTION', acquiredParentId: option.id, optionId: 'selected-option' }
        },
        {
          id: feat.id,
          label: feat.label,
          sourceLabel: 'Feat',
          source: { kind: 'FEAT', featId: 'feat-origin' }
        },
        {
          id: 'magic-source',
          label: 'Magic source',
          sourceLabel: 'Spell source',
          source: { kind: 'CLASS', classId: 'fighter', classLevel: 3 }
        }
      ],
      features: [
        {
          id: feature.id,
          label: feature.label,
          sourceLabel: 'Class',
          source: { kind: 'CLASS', classId: 'fighter', classLevel: 2 }
        },
        {
          id: option.id,
          label: option.label,
          sourceLabel: 'Option',
          source: { kind: 'OPTION', acquiredParentId: option.id, optionId: 'selected-option' }
        },
        {
          id: feat.id,
          label: feat.label,
          sourceLabel: 'Feat',
          source: { kind: 'FEAT', featId: 'feat-origin' }
        },
        {
          id: 'magic-source',
          label: 'Magic source',
          sourceLabel: 'Magic source',
          source: { kind: 'CLASS', classId: 'fighter', classLevel: 3 }
        }
      ],
      spellcasting: []
    },
    chosenGrantChoices: [],
    outstandingChoices: [],
    validations: [],
    readiness: { ready: true, blockingIssues: [], outstandingRequiredChoices: [] },
    recommendedSectionId: 'REVIEW'
  }
}

export function baseResource(overrides: Partial<CharacterResource>) {
  return {
    ...{
      state: 'RESOLVED',
      maximum: 3,
      rawUsed: 8,
      effectiveUsed: 3,
      remaining: 0,
      reasonCode: 'CALCULATED',
      baseContribution: { sourceId: 'base', value: 3 },
      bonusContributions: [],
      resetKind: 'SHORT_REST',
      resetResolution: { baseResetKind: 'SHORT_REST', appliedGrantId: null, source: null }
    },
    ...overrides
  }
}

export const BASE_RESOURCES = characterResourcesSchema.parse([
  baseResource({
    sequence: 0,
    ownerKind: 'AUTHORED_GRANT',
    resourceGrantId: 'persisted-resource-grant',
    availableAtLevel: 1,
    activeSourceLevel: 3,
    poolId: 'AUTHORED_GRANT:persisted-resource-grant',
    resourceDefinitionId: 'granted-resource',
    chargeId: 'granted-charge',
    chargeCalculationId: 'AUTHORED_GRANT:persisted-resource-grant'
  }),
  baseResource({
    sequence: 1,
    ownerKind: 'AUTHORED_GRANT',
    resourceGrantId: 'fallback-resource-grant',
    availableAtLevel: 1,
    activeSourceLevel: 1,
    poolId: 'AUTHORED_GRANT:fallback-resource-grant',
    resourceDefinitionId: 'fallback-resource',
    chargeId: 'fallback-charge',
    chargeCalculationId: 'AUTHORED_GRANT:fallback-resource-grant'
  }),
  baseResource({
    sequence: 2,
    ownerKind: 'AUTHORED_SOURCE',
    sourceId: 'feature-branch',
    source: featureSource,
    poolId: `${authoredSourcePoolId('feature-source-charge', featureSource)}`,
    chargeCalculationId: `${authoredSourcePoolId('feature-source-charge', featureSource)}`,
    resourceDefinitionId: 'feature-definition-resource',
    chargeId: 'feature-source-charge'
  }),
  baseResource({
    sequence: 3,
    ownerKind: 'AUTHORED_SOURCE',
    sourceId: 'option-branch',
    source: optionSource,
    poolId: `${authoredSourcePoolId('selected-option-charge', optionSource)}`,
    chargeCalculationId: `${authoredSourcePoolId('selected-option-charge', optionSource)}`,
    resourceDefinitionId: 'option-definition-resource',
    chargeId: 'selected-option-charge'
  }),
  baseResource({
    sequence: 4,
    ownerKind: 'AUTHORED_SOURCE',
    sourceId: 'feat-origin',
    source: featSource,
    poolId: `${authoredSourcePoolId('feat-source-charge', featSource)}`,
    chargeCalculationId: `${authoredSourcePoolId('feat-source-charge', featSource)}`,
    resourceDefinitionId: 'feat-definition-resource',
    chargeId: 'feat-source-charge'
  }),
  baseResource({
    sequence: 5,
    ownerKind: 'ITEM_INSTANCE',
    itemInstanceId: 'root-1',
    sourceId: null,
    poolId: 'ITEM_INSTANCE:root-1:root-item-charge',
    resourceDefinitionId: 'root-item-resource',
    chargeId: 'root-item-charge',
    chargeCalculationId: 'ITEM_INSTANCE:root-1:root-item-charge'
  }),
  baseResource({
    sequence: 6,
    ownerKind: 'ITEM_INSTANCE',
    itemInstanceId: 'root-2',
    sourceId: null,
    poolId: 'ITEM_INSTANCE:root-2:root-item-charge',
    resourceDefinitionId: 'root-item-resource',
    chargeId: 'root-item-charge',
    chargeCalculationId: 'ITEM_INSTANCE:root-2:root-item-charge'
  }),
  baseResource({
    sequence: 7,
    ownerKind: 'ITEM_INSTANCE',
    itemInstanceId: 'nested-1',
    sourceId: 'nested-source-1',
    poolId: 'ITEM_INSTANCE:nested-1:nested-feature-charge',
    resourceDefinitionId: 'nested-feature-resource',
    chargeId: 'nested-feature-charge',
    chargeCalculationId: 'ITEM_INSTANCE:nested-1:nested-feature-charge'
  }),
  baseResource({
    sequence: 8,
    ownerKind: 'ITEM_INSTANCE',
    itemInstanceId: 'nested-2',
    sourceId: null,
    poolId: 'ITEM_INSTANCE:nested-2:nested-feature-charge',
    resourceDefinitionId: 'nested-only-feature-resource',
    chargeId: 'nested-feature-charge',
    chargeCalculationId: 'ITEM_INSTANCE:nested-2:nested-feature-charge'
  }),
  baseResource({
    sequence: 9,
    ownerKind: 'COMPANION_FEATURE',
    companionInstanceId: 'companion-1',
    featureId: 'companion-feature',
    poolId: 'COMPANION_FEATURE:companion-1:companion-feature:companion-feature-charge',
    resourceDefinitionId: 'companion-resource',
    chargeId: 'companion-feature-charge',
    chargeCalculationId: 'COMPANION_FEATURE:companion-1:companion-feature:companion-feature-charge'
  }),
  baseResource({
    sequence: 10,
    ownerKind: 'SPELL_SOURCE',
    accessId: 'spell-access-1',
    sourceInstanceId: 'spell-source-instance',
    spellId: spell.id,
    poolId: 'SPELL_SOURCE:spell-access-1:magic-missile:FEATURE:spell-source-instance',
    resourceDefinitionId: 'spell-resource',
    chargeId: 'spell-charge',
    chargeCalculationId: 'SPELL_SOURCE:spell-access-1:magic-missile:FEATURE:spell-source-instance'
  })
])

export function baseInput(): CharacterRuleResourceProjectionInput {
  return {
    policy: {
      resources: BASE_RESOURCES,
      spellAccess: [
        {
          sequence: 0,
          accessId: 'spell-access-1',
          sourceInstanceId: 'spell-source-instance',
          spellId: spell.id,
          sourceFeatureId: 'magic-source',
          grantId: 'magic-grant',
          sourceKind: 'CLASS',
          sourceId: 'fighter',
          owningClassId: 'fighter',
          timingKind: 'CLASS_LEVEL',
          timingLevel: 3,
          attributes: ['LIMITED_USE'],
          acquisition: 'GRANTED',
          castMode: 'LIMITED_USE',
          castAtLevel: 1,
          castingAbility: null,
          charge: {
            id: 'spell-charge',
            limitKind: 'SPELL_CAST_LEVEL',
            resetKind: 'SHORT_REST'
          },
          learned: false,
          prepared: false
        }
      ]
    },
    snapshot: { features: SNAPSHOT.features, equipmentItems: SNAPSHOT.equipmentItems },
    grantFoldFacts: grantFoldFacts(),
    character: character(),
    resolution: resolution(),
    creaturesById: companionRegistry()
  }
}
