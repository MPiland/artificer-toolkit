import { describe, expect, it } from 'vitest'

import { compileCharge, compileFeature } from '@artificer-toolkit/shared/compilers'
import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import { characterResourcePoolCandidatesSchema } from '@artificer-toolkit/schema/api/characterResourceRules'
import type {
  CharacterAssemblyRegistry,
  CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { createEmptyCharacterAuthored } from './builderService.js'
import { buildCharacterResourceRuleFacts } from './characterResourceRuleFacts.js'
import { compileCharacterGrantFoldRuleFacts } from './characterGrantFoldRuleFacts.js'

const regularCharge = (
  id: string,
  limitKind: 'FIXED_AMOUNT' | 'SPELL_CAST_LEVEL' = 'FIXED_AMOUNT'
) =>
  compileCharge(
    limitKind === 'FIXED_AMOUNT'
      ? { id, resetKind: 'LONG_REST', limitKind, scalingKind: 'NONE', amount: 2 }
      : { id, resetKind: 'SHORT_REST', limitKind, scalingKind: 'NONE', multiplier: 1 }
  )

function classRecord(
  id: string,
  resourceId: string
): NonNullable<CharacterAssemblyRegistry['classes'][string]> {
  return {
    id,
    category: 'BASE',
    startingGold: { multiplier: 0, currencyId: 'gp', dieConfig: '1d4' },
    startingEquipment: { id: `${id}-equipment`, sets: [] },
    hitpoint: { ability: 'CONSTITUTION', dieConfig: 'd8' },
    multiclass: {
      id: `${id}-multiclass`,
      requirementGroups: { id: `${id}-requirements`, groups: [] }
    },
    resources: {
      id: resourceId,
      label: resourceId,
      availableAtLevel: 1,
      charges: regularCharge(`${resourceId}-charge`)
    }
  }
}

function itemRecord(
  id: string,
  chargeId: string
): NonNullable<CharacterAssemblyRegistry['equipment'][string]> {
  return {
    id,
    category: 'ADVENTURING_GEAR',
    properties: [],
    rarityId: 'COMMON',
    charges: regularCharge(chargeId)
  }
}

function snapshot(items: CharacterBuildSnapshot['equipmentItems']): CharacterBuildSnapshot {
  return {
    characterId: 'character-1',
    systemId: 'dnd5e2014',
    totalLevel: 3,
    classes: [{ classId: 'fighter', level: 3 }],
    abilities: {
      STRENGTH: 10,
      DEXTERITY: 10,
      CONSTITUTION: 10,
      INTELLIGENCE: 10,
      WISDOM: 10,
      CHARISMA: 10
    },
    hitpoints: [],
    features: [],
    equipmentItems: items
  }
}

function candidate(overrides: Partial<CharacterRulePolicyInput['spellAccessCandidates'][number]>) {
  return {
    sequence: 0,
    accessId: 'access-1',
    sourceInstanceId: 'source-1',
    spellId: 'spell-1',
    sourceFeatureId: 'spell-feature',
    grantId: 'spell-grant',
    sourceKind: 'CLASS' as const,
    sourceId: 'fighter',
    owningClassId: 'fighter',
    activeSourceLevel: 3,
    featureAvailableAtLevel: 1,
    inheritedFeatureDuplicate: false,
    specializationId: null,
    specializationRestrictionIds: null,
    selectionKind: 'GRANTED' as const,
    authoringMode: 'ALL' as const,
    selectedByCharacter: false,
    scalingKind: 'NONE' as const,
    scalingSource: null,
    progressionLevel: null,
    totalLevel: 3,
    classLevel: 3,
    attributes: ['LIMITED_USE' as const],
    castAtLevel: 4,
    castingAbility: null,
    charge: { id: 'spell-charge', limitKind: 'SPELL_CAST_LEVEL', resetKind: 'SHORT_REST' },
    ...overrides
  }
}

describe('buildCharacterResourceRuleFacts', () => {
  it('orders live owners, retains selected/fixed Spell pools, and excludes unselected choices and source charges', () => {
    const character = createEmptyCharacterAuthored({
      id: 'character-1',
      systemId: 'dnd5e2014',
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
      userId: 'user-1'
    })
    character.intent.classes = [{ classId: 'fighter', classLevel: 3 }]
    character.state.creatures = [
      {
        id: 'companion-1',
        creatureId: 'wolf',
        relationshipKind: 'COMPANION',
        originKind: 'WORLD',
        isActive: false
      }
    ]

    const spellFeature = compileFeature({
      id: 'spell-feature',
      label: 'Spell Feature',
      description: '',
      order: 1,
      grants: {
        spells: [
          {
            id: 'spell-grant',
            order: 1,
            grantKind: 'SPELL_GRANT',
            selectionKind: 'GRANTED',
            scalingKind: 'NONE',
            authoringModeKind: 'ALL',
            charges: {
              id: 'spell-charge',
              limitKind: 'SPELL_CAST_LEVEL',
              scalingKind: 'NONE',
              resetKind: 'SHORT_REST'
            }
          },
          {
            id: 'source-spell-grant',
            order: 2,
            grantKind: 'SPELL_GRANT',
            selectionKind: 'GRANTED',
            scalingKind: 'NONE',
            authoringModeKind: 'ALL',
            charges: {
              id: 'source-charge',
              limitKind: 'SOURCE_CHARGES',
              scalingKind: 'NONE',
              cost: 1
            }
          }
        ]
      }
    })
    const fighter = classRecord('fighter', 'fighter-resource')
    fighter.features = [spellFeature]
    const registry: CharacterAssemblyRegistry = {
      classes: { fighter },
      races: {},
      backgrounds: {},
      features: { 'spell-feature': spellFeature },
      feats: {},
      equipment: { wand: itemRecord('wand', 'wand-charge') },
      spells: {}
    }
    const creaturesById = new Map<string, CreatureAuthored>([
      [
        'wolf',
        {
          id: 'wolf',
          label: 'Wolf',
          userId: 'system',
          systemId: 'dnd5e2014',
          category: 'BEAST',
          creatureTypeId: 'BEAST',
          size: 'MEDIUM',
          abilityScores: {
            STRENGTH: 12,
            DEXTERITY: 10,
            CONSTITUTION: 10,
            INTELLIGENCE: 10,
            WISDOM: 10,
            CHARISMA: 10
          },
          armorClass: 13,
          hitPoints: 11,
          speeds: [],
          features: [
            {
              id: 'bite-feature',
              label: 'Bite',
              description: '',
              order: 1,
              charges: {
                id: 'bite-charge',
                resetKind: 'LONG_REST',
                limitKind: 'FIXED_AMOUNT',
                scalingKind: 'NONE',
                amount: 2
              }
            },
            {
              id: 'source-feature',
              label: 'Source Feature',
              description: '',
              order: 2,
              charges: {
                id: 'source-feature-charge',
                limitKind: 'SOURCE_CHARGES',
                scalingKind: 'NONE',
                cost: 1
              }
            }
          ]
        }
      ]
    ])
    const params: Parameters<typeof buildCharacterResourceRuleFacts>[0] = {
      character,
      snapshot: snapshot(
        [
          {
            instanceId: 'wand-1',
            contentRef: {
              definitionId: 'wand',
              binding: { kind: 'ACTIVE' as const },
              systemId: 'dnd5e2014'
            },
            quantity: 1,
            attuned: false
          },
          {
            instanceId: 'wand-2',
            contentRef: {
              definitionId: 'wand',
              binding: { kind: 'ACTIVE' as const },
              systemId: 'dnd5e2014'
            },
            quantity: 1,
            attuned: false
          }
        ].map((item) => ({ ...item, compiledItem: registry.equipment.wand! }))
      ),
      registry: {
        ...registry,
        classes: registry.classes,
        features: { 'spell-feature': spellFeature }
      },
      grantFoldFacts: compileCharacterGrantFoldRuleFacts({
        snapshot: snapshot(
          [
            {
              instanceId: 'wand-1',
              contentRef: {
                definitionId: 'wand',
                binding: { kind: 'ACTIVE' as const },
                systemId: 'dnd5e2014'
              },
              quantity: 1,
              attuned: false
            },
            {
              instanceId: 'wand-2',
              contentRef: {
                definitionId: 'wand',
                binding: { kind: 'ACTIVE' as const },
                systemId: 'dnd5e2014'
              },
              quantity: 1,
              attuned: false
            }
          ].map((item) => ({ ...item, compiledItem: registry.equipment.wand! }))
        ),
        registry
      }),
      spellAccessCandidates: [
        candidate({ sequence: 0 }),
        candidate({
          sequence: 1,
          accessId: 'access-chosen',
          spellId: 'spell-chosen',
          selectionKind: 'CHOSEN',
          selectedByCharacter: true
        }),
        candidate({
          sequence: 2,
          accessId: 'access-inactive',
          spellId: 'spell-inactive',
          selectionKind: 'CHOSEN',
          selectedByCharacter: false
        }),
        candidate({
          sequence: 3,
          accessId: 'access-source',
          spellId: 'spell-source',
          grantId: 'source-spell-grant',
          charge: { id: 'source-charge', limitKind: 'SOURCE_CHARGES', resetKind: null }
        }),
        candidate({
          sequence: 4,
          accessId: 'access-source',
          spellId: 'spell-source',
          grantId: 'spell-grant'
        })
      ],
      creaturesById,
      resourceUsage: [
        {
          id: 'usage-1',
          characterId: character.id,
          owner: { kind: 'AUTHORED_GRANT', resourceGrantId: 'fighter-resource' },
          used: 8,
          createdBy: 'user-1',
          updatedBy: 'user-1',
          createdAt: '2026-08-14T00:00:00.000Z',
          updatedAt: '2026-08-14T00:00:00.000Z'
        },
        {
          id: 'usage-2',
          characterId: character.id,
          owner: { kind: 'ITEM_INSTANCE', itemInstanceId: 'wand-1', chargeId: 'wand-charge' },
          used: 3,
          createdBy: 'user-1',
          updatedBy: 'user-1',
          createdAt: '2026-08-14T00:00:00.000Z',
          updatedAt: '2026-08-14T00:00:00.000Z'
        }
      ]
    }
    const facts = buildCharacterResourceRuleFacts(params)

    expect(facts.resourcePoolCandidates.map((entry) => entry.ownerKind)).toEqual([
      'AUTHORED_GRANT',
      'ITEM_INSTANCE',
      'ITEM_INSTANCE',
      'COMPANION_FEATURE',
      'SPELL_SOURCE',
      'SPELL_SOURCE',
      'SPELL_SOURCE'
    ])
    expect(facts.resourcePoolCandidates.map((entry) => entry.sequence)).toEqual([
      0, 1, 2, 3, 4, 5, 6
    ])
    expect(
      facts.resourcePoolCandidates.filter((entry) => entry.ownerKind === 'ITEM_INSTANCE')
    ).toHaveLength(2)
    expect(
      facts.resourcePoolCandidates.filter((entry) => entry.ownerKind === 'SPELL_SOURCE')
    ).toHaveLength(3)
    expect(facts.chargeCalculations).toHaveLength(facts.resourcePoolCandidates.length)
    expect(
      facts.resourcePoolCandidates.find(
        (entry) => entry.ownerKind === 'SPELL_SOURCE' && entry.spellId === 'spell-inactive'
      )
    ).toBeUndefined()
    expect(
      facts.resourcePoolCandidates
        .filter((entry) => entry.ownerKind === 'SPELL_SOURCE')
        .map((entry) => entry.poolId)
    ).toEqual([
      'SPELL_SOURCE:access-1:spell-1:FEATURE:source-1',
      'SPELL_SOURCE:access-chosen:spell-chosen:FEATURE:source-1',
      'SPELL_SOURCE:access-source:spell-source:FEATURE:source-1'
    ])
    expect(
      facts.resourcePoolCandidates.some(
        (entry) => 'chargeId' in entry && entry.chargeId === 'source-charge'
      )
    ).toBe(false)
    expect(facts).not.toHaveProperty('remaining')
    expect(facts).not.toHaveProperty('usage')
    expect(facts.resourceUsageFacts).toEqual([
      { poolId: 'AUTHORED_GRANT:fighter-resource', rawUsed: 8 },
      { poolId: 'ITEM_INSTANCE:wand-1:wand-charge', rawUsed: 3 }
    ])
    expect(() =>
      buildCharacterResourceRuleFacts({
        ...params,
        resourceUsage: [...params.resourceUsage!, { ...params.resourceUsage![0]! }]
      })
    ).toThrow('Duplicate persisted resource usage for pool: AUTHORED_GRANT:fighter-resource')
  })

  it('emits separate active-source pools for separate feature acquisitions', () => {
    const character = createEmptyCharacterAuthored({
      id: 'character-1',
      systemId: 'dnd5e2014',
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
      userId: 'user-1'
    })
    const actionSurge = compileFeature({
      id: 'action-surge',
      label: 'Action Surge',
      description: '',
      order: 1,
      charges: {
        id: 'action-surge-charge',
        resetKind: 'SHORT_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 1
      }
    })
    const factsSnapshot = snapshot([])
    factsSnapshot.features = [
      {
        acquisitionId: 'action-surge-1',
        featureId: actionSurge.id,
        source: { kind: 'FEATURE', featureId: actionSurge.id },
        timing: { kind: 'CLASS_LEVEL', classId: 'fighter', classLevel: 2 }
      },
      {
        acquisitionId: 'action-surge-2',
        featureId: actionSurge.id,
        source: { kind: 'FEATURE', featureId: actionSurge.id },
        timing: { kind: 'CLASS_LEVEL', classId: 'fighter', classLevel: 2 }
      }
    ]
    const registry: CharacterAssemblyRegistry = {
      classes: { fighter: classRecord('fighter', 'fighter-resource') },
      races: {},
      backgrounds: {},
      features: { [actionSurge.id]: actionSurge },
      feats: {},
      equipment: {},
      spells: {}
    }
    const grantFoldFacts = compileCharacterGrantFoldRuleFacts({
      snapshot: factsSnapshot,
      registry
    })
    const facts = buildCharacterResourceRuleFacts({
      character,
      snapshot: factsSnapshot,
      registry,
      grantFoldFacts,
      spellAccessCandidates: [],
      creaturesById: new Map()
    })

    const featurePools = facts.resourcePoolCandidates.filter(
      (entry) => entry.ownerKind === 'AUTHORED_SOURCE'
    )
    expect(featurePools).toHaveLength(2)
    expect(new Set(featurePools.map((entry) => entry.poolId))).toHaveLength(2)
    expect(featurePools.map((entry) => entry.chargeId)).toEqual([
      'action-surge-charge',
      'action-surge-charge'
    ])
    expect(
      facts.resourcePoolCandidates.find((entry) => entry.ownerKind === 'AUTHORED_GRANT')
    ).toMatchObject({ chargeId: 'fighter-resource-charge' })
  })

  it('keeps choice-heavy ancestry resource identities within the rule contract bound', () => {
    const character = createEmptyCharacterAuthored({
      id: 'character-1',
      systemId: 'dnd5e2014',
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
      userId: 'user-1'
    })
    const ancestryId = '00000000-0000-0000-a001-000509010000'
    const optionId = '00000000-0000-0000-a001-0005aa010000'
    const featureId = '00000000-0000-0000-a001-000511010000'
    const chargeId = '00000000-0000-0000-a001-000511020000'
    const breathWeapon = compileFeature({
      id: featureId,
      label: 'Breath Weapon',
      description: '',
      order: 1,
      charges: {
        id: chargeId,
        resetKind: 'SHORT_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 1
      }
    })
    const factsSnapshot = snapshot([])
    factsSnapshot.features = [
      {
        featureId,
        source: { kind: 'ANCESTRY', ancestryId, optionId },
        timing: { kind: 'IMMEDIATE' }
      }
    ]
    const registry: CharacterAssemblyRegistry = {
      classes: { fighter: classRecord('fighter', 'fighter-resource') },
      races: {},
      backgrounds: {},
      features: { [featureId]: breathWeapon },
      feats: {},
      equipment: {},
      spells: {}
    }
    const grantFoldFacts = compileCharacterGrantFoldRuleFacts({
      snapshot: factsSnapshot,
      registry
    })
    const facts = buildCharacterResourceRuleFacts({
      character,
      snapshot: factsSnapshot,
      registry,
      grantFoldFacts,
      spellAccessCandidates: [],
      creaturesById: new Map()
    })
    const resource = facts.resourcePoolCandidates.find(
      (entry) => entry.ownerKind === 'AUTHORED_SOURCE'
    )

    expect(resource?.poolId).toHaveLength(233)
    expect(resource?.sourceId).toBe(grantFoldFacts.features[0]?.definition?.sourceId)
    expect(() =>
      characterResourcePoolCandidatesSchema.parse(facts.resourcePoolCandidates)
    ).not.toThrow()
  })

  it('emits a nested item charge when the item has no root charge', () => {
    const character = createEmptyCharacterAuthored({
      id: 'character-1',
      systemId: 'dnd5e2014',
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
      userId: 'user-1'
    })
    const nestedFeature = compileFeature({
      id: 'nested-feature',
      label: 'Nested feature',
      description: '',
      order: 1,
      charges: {
        id: 'nested-charge',
        resetKind: 'LONG_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 1
      }
    })
    const nestedOnlyItem: NonNullable<CharacterAssemblyRegistry['equipment'][string]> = {
      id: 'nested-wand',
      category: 'ADVENTURING_GEAR',
      properties: [],
      rarityId: 'COMMON',
      features: [nestedFeature]
    }
    const factsSnapshot = snapshot([
      {
        instanceId: 'nested-wand-1',
        contentRef: {
          definitionId: nestedOnlyItem.id,
          binding: { kind: 'ACTIVE' },
          systemId: 'dnd5e2014'
        },
        attuned: false,
        compiledItem: nestedOnlyItem
      }
    ])
    const registry: CharacterAssemblyRegistry = {
      classes: {},
      races: {},
      backgrounds: {},
      features: {},
      feats: {},
      equipment: { [nestedOnlyItem.id]: nestedOnlyItem },
      spells: {}
    }
    const grantFoldFacts = compileCharacterGrantFoldRuleFacts({
      snapshot: factsSnapshot,
      registry
    })
    const facts = buildCharacterResourceRuleFacts({
      character,
      snapshot: factsSnapshot,
      registry,
      grantFoldFacts,
      spellAccessCandidates: [],
      creaturesById: new Map()
    })

    expect(facts.resourcePoolCandidates).toMatchObject([
      {
        ownerKind: 'ITEM_INSTANCE',
        itemInstanceId: 'nested-wand-1',
        chargeId: 'nested-charge',
        sourceId: grantFoldFacts.equipmentItems[0]?.features[0]?.source.sourceId
      }
    ])
  })
})
