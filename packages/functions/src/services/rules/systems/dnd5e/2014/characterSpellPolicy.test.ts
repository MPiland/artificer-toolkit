import { describe, expect, it } from 'vitest'

import { characterRulePolicyOutputSchema } from '@artificer-toolkit/schema/api/characterRules'

import { buildCharacterSpellRuleFacts } from '../../../../character/characterSpellRuleFacts.js'
import { dnd5e2014CharacterGrantFoldEmptyInput } from './characterGrantFoldSource.js'
import { dnd5e2014CharacterPolicyDocument } from './characterPolicy.js'
import { createSpellGrantPolicyFixture } from './characterSpellPolicy.fixtures.js'
import { evaluateZenRuleModel } from '../../../zenRuleEngine.js'

function isDecisionGraph(value: unknown): value is {
  nodes: Array<{ id: string; content: unknown }>
  edges: unknown
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'nodes' in value &&
    Array.isArray(value.nodes) &&
    'edges' in value
  )
}

function policyFacts(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: 4 as const,
    grantFoldFacts: dnd5e2014CharacterGrantFoldEmptyInput,
    totalLevel: 1,
    derivedBaseFacts: {
      abilities: [],
      savingThrows: [],
      skills: [],
      initiative: { abilityId: 'DEXTERITY', abilityIndex: null, bonuses: [] },
      spellcasting: null
    },
    spellAccessCandidates: [],
    spellClasses: [],
    spellPreparationClasses: [],
    spellPreparationCatalog: [],
    spellPreparationRequest: null,
    spellCastCandidates: [],
    spellCastSlots: [],
    spellCastResources: [],
    spellcastingClasses: [],
    chargeCalculations: [],
    resourcePoolCandidates: [],
    eligibilityFacets: [],
    rest: {
      totalHitDice: 0,
      currentExhaustion: 0,
      attunementSlotOverride: null
    },
    ...overrides
  }
}

describe('D&D 5e 2014 Character spell policy', () => {
  it('resolves included spell access before the serial grant-fold path', () => {
    const model = dnd5e2014CharacterPolicyDocument.models['character-policy']
    if (!isDecisionGraph(model)) throw new Error('Character policy graph is required.')

    const grantFold = model.nodes.find((node) => node.id === 'grant-fold')
    expect(grantFold?.content).toMatchObject({ inputField: 'resolvedGrantFoldFacts' })
    expect(
      model.nodes.find((node) => node.id === 'resolved-grant-fold-facts')?.content
    ).toMatchObject({
      expressions: [
        {
          key: 'resolvedGrantFoldFacts',
          value:
            'merge([grantFoldFacts, { upstreamSpellIds: map(filter(spellAccess as access, !some(spellAccess as earlier, earlier.spellId == access.spellId and earlier.sequence < access.sequence)), #.spellId) }])'
        }
      ]
    })
    expect(model.edges).toEqual(
      expect.arrayContaining([
        {
          id: 'input-spell-access-candidates',
          sourceId: 'input',
          targetId: 'spell-access-candidates'
        },
        {
          id: 'spell-access-summary-resolved-grant-fold-facts',
          sourceId: 'spell-access-summary',
          targetId: 'resolved-grant-fold-facts'
        },
        {
          id: 'resolved-grant-fold-facts-grant-fold',
          sourceId: 'resolved-grant-fold-facts',
          targetId: 'grant-fold'
        },
        {
          id: 'charge-maximums-resource-pools',
          sourceId: 'charge-maximums',
          targetId: 'resource-pools'
        },
        {
          id: 'resource-pools-spell-class-states',
          sourceId: 'resource-pools',
          targetId: 'spell-class-states'
        }
      ])
    )
  })

  it('uses only included spell access for same-evaluation grant restrictions', async () => {
    const grantFoldFacts = {
      ...dnd5e2014CharacterGrantFoldEmptyInput,
      features: [
        {
          sourceKind: 'FEATURE',
          sourceClassLevel: null,
          timingLevel: null,
          definition: {
            sourceId: 'upstream-spell-restrictions',
            mechanicSource: {
              kind: 'AUTHORED',
              sourceKind: 'FEATURE',
              definitionId: 'upstream-spell-restrictions',
              sourceInstanceId: 'upstream-spell-restrictions'
            },
            sourceState: null,
            restrictions: [],
            proficiencies: [],
            senses: [],
            modifiers: [
              {
                grantId: 'spell-obtained-grant',
                valueDomainCode: 'INITIATIVE',
                modifierKind: 'BONUS',
                domain: {},
                grant: { id: 'spell-obtained-grant' },
                restrictions: [
                  {
                    conditions: [
                      {
                        conditionId: 'spell-obtained',
                        constraint: 'INCLUDE',
                        kind: 'SPELL_OBTAINED',
                        mode: null,
                        abilityId: null,
                        classIds: [],
                        requiredIds: ['included-spell'],
                        secondaryRequiredIds: [],
                        min: null,
                        max: null,
                        proficiencyKind: null,
                        minimumRank: null,
                        category: null,
                        requiredProperties: [],
                        sourceState: null
                      }
                    ]
                  }
                ],
                scopeSpellIds: []
              },
              {
                grantId: 'can-cast-grant',
                valueDomainCode: 'INITIATIVE',
                modifierKind: 'BONUS',
                domain: {},
                grant: { id: 'can-cast-grant' },
                restrictions: [
                  {
                    conditions: [
                      {
                        conditionId: 'can-cast',
                        constraint: 'INCLUDE',
                        kind: 'CAN_CAST_SPELL',
                        mode: null,
                        abilityId: null,
                        classIds: [],
                        requiredIds: [],
                        secondaryRequiredIds: [],
                        min: null,
                        max: null,
                        proficiencyKind: null,
                        minimumRank: null,
                        category: null,
                        requiredProperties: [],
                        sourceState: null
                      }
                    ]
                  }
                ],
                scopeSpellIds: []
              },
              {
                grantId: 'excluded-spell-grant',
                valueDomainCode: 'INITIATIVE',
                modifierKind: 'BONUS',
                domain: {},
                grant: { id: 'excluded-spell-grant' },
                restrictions: [
                  {
                    conditions: [
                      {
                        conditionId: 'excluded-spell',
                        constraint: 'INCLUDE',
                        kind: 'SPELL_OBTAINED',
                        mode: null,
                        abilityId: null,
                        classIds: [],
                        requiredIds: ['excluded-spell'],
                        secondaryRequiredIds: [],
                        min: null,
                        max: null,
                        proficiencyKind: null,
                        minimumRank: null,
                        category: null,
                        requiredProperties: [],
                        sourceState: null
                      }
                    ]
                  }
                ],
                scopeSpellIds: []
              }
            ],
            feats: [],
            spells: []
          },
          selectedOptions: [],
          featDefinition: null
        }
      ]
    }
    const candidate = {
      sequence: 0,
      accessId: 'included-access',
      sourceInstanceId: 'spell-source',
      spellId: 'included-spell',
      sourceFeatureId: 'spell-source',
      grantId: 'spell-grant',
      sourceKind: 'RACE',
      sourceId: 'race',
      owningClassId: null,
      activeSourceLevel: 1,
      featureAvailableAtLevel: 1,
      inheritedFeatureDuplicate: false,
      specializationId: null,
      specializationRestrictionIds: null,
      selectionKind: 'GRANTED',
      authoringMode: 'SELECTED',
      selectedByCharacter: false,
      scalingKind: 'NONE',
      scalingSource: null,
      progressionLevel: null,
      totalLevel: 1,
      classLevel: null,
      attributes: [],
      castAtLevel: null,
      castingAbility: null,
      charge: null
    } as const
    const result = characterRulePolicyOutputSchema.parse(
      (
        await evaluateZenRuleModel({
          document: dnd5e2014CharacterPolicyDocument,
          modelKey: 'character-policy',
          context: policyFacts({
            grantFoldFacts,
            spellAccessCandidates: [
              candidate,
              {
                ...candidate,
                sequence: 1,
                accessId: 'same-spell-second-access',
                sourceInstanceId: 'spell-source-second',
                sourceFeatureId: 'spell-source-second'
              },
              {
                ...candidate,
                sequence: 2,
                accessId: 'excluded-access',
                spellId: 'excluded-spell',
                activeSourceLevel: 0
              }
            ]
          })
        })
      ).result
    )

    expect(result.spellAccess).toEqual([
      expect.objectContaining({ accessId: 'included-access', spellId: 'included-spell' }),
      expect.objectContaining({ accessId: 'same-spell-second-access', spellId: 'included-spell' })
    ])
    expect(
      result.spellAccessDecisions.map(({ sequence, status, reasonCode }) => ({
        sequence,
        status,
        reasonCode
      }))
    ).toEqual([
      { sequence: 0, status: 'INCLUDED', reasonCode: 'ACCESS_GRANTED' },
      { sequence: 1, status: 'INCLUDED', reasonCode: 'ACCESS_GRANTED' },
      { sequence: 2, status: 'EXCLUDED', reasonCode: 'SOURCE_LEVEL_LOCKED' }
    ])
    expect(result.grantFold.modifiers.map(({ grant }) => grant)).toEqual([
      { id: 'spell-obtained-grant' },
      { id: 'can-cast-grant' }
    ])
  })

  it('resolves access metadata, class state, and source order', async () => {
    const { snapshot, registry } = createSpellGrantPolicyFixture()
    const spellFacts = buildCharacterSpellRuleFacts(snapshot, registry)
    const evaluated = await evaluateZenRuleModel({
      document: dnd5e2014CharacterPolicyDocument,
      modelKey: 'character-policy',
      context: policyFacts({ totalLevel: snapshot.totalLevel, ...spellFacts })
    })
    const result = characterRulePolicyOutputSchema.parse(evaluated.result)
    expect(result.spellAccess).toEqual([
      {
        sequence: 0,
        accessId: 'CLASS:wizard:wizard:wizard-spells:wizard-spellbook:shield',
        sourceInstanceId: 'CLASS:wizard:wizard:wizard-spells:wizard-spellbook',
        spellId: 'shield',
        sourceFeatureId: 'wizard-spells',
        grantId: 'wizard-spellbook',
        sourceKind: 'CLASS',
        sourceId: 'wizard',
        owningClassId: 'wizard',
        timingKind: 'CLASS_LEVEL',
        timingLevel: 5,
        attributes: ['KNOWN'],
        acquisition: 'KNOWN',
        castMode: 'SPELL_SLOT',
        castAtLevel: null,
        castingAbility: null,
        charge: null,
        learned: true,
        prepared: false
      },
      {
        sequence: 1,
        accessId: 'SUBCLASS:school-of-evocation:wizard:school-spells:arctic-spells:fog-cloud',
        sourceInstanceId: 'SUBCLASS:school-of-evocation:wizard:school-spells:arctic-spells',
        spellId: 'fog-cloud',
        sourceFeatureId: 'school-spells',
        grantId: 'arctic-spells',
        sourceKind: 'SUBCLASS',
        sourceId: 'school-of-evocation',
        owningClassId: 'wizard',
        timingKind: 'CLASS_LEVEL',
        timingLevel: 5,
        attributes: ['PREPARED'],
        acquisition: 'ALWAYS_PREPARED',
        castMode: 'SPELL_SLOT',
        castAtLevel: null,
        castingAbility: null,
        charge: null,
        learned: false,
        prepared: true
      },
      {
        sequence: 4,
        accessId: 'RACE:elf:elf-magic-feature:elf-magic:dancing-lights',
        sourceInstanceId: 'RACE:elf:elf-magic-feature:elf-magic',
        spellId: 'dancing-lights',
        sourceFeatureId: 'elf-magic-feature',
        grantId: 'elf-magic',
        sourceKind: 'RACE',
        sourceId: 'elf',
        owningClassId: null,
        timingKind: 'CHARACTER_LEVEL',
        timingLevel: 5,
        attributes: ['KNOWN', 'CAST_AT_WILL'],
        acquisition: 'KNOWN',
        castMode: 'AT_WILL',
        castAtLevel: null,
        castingAbility: null,
        charge: null,
        learned: true,
        prepared: false
      },
      {
        sequence: 6,
        accessId: 'SUBRACE:high-elf:high-elf-cantrip-feature:high-elf-cantrip:fire-bolt',
        sourceInstanceId: 'SUBRACE:high-elf:high-elf-cantrip-feature:high-elf-cantrip',
        spellId: 'fire-bolt',
        sourceFeatureId: 'high-elf-cantrip-feature',
        grantId: 'high-elf-cantrip',
        sourceKind: 'SUBRACE',
        sourceId: 'high-elf',
        owningClassId: null,
        timingKind: 'CHARACTER_LEVEL',
        timingLevel: 5,
        attributes: ['KNOWN', 'CAST_AT_WILL'],
        acquisition: 'KNOWN',
        castMode: 'AT_WILL',
        castAtLevel: null,
        castingAbility: 'INTELLIGENCE',
        charge: null,
        learned: true,
        prepared: false
      }
    ])
    expect(result.classSpellStates).toEqual([
      {
        classId: 'wizard',
        learnedSpellIds: ['shield'],
        preparedSpellIds: ['fog-cloud']
      }
    ])
    expect(
      result.spellAccessDecisions.map(({ sequence, status, reasonCode }) => ({
        sequence,
        status,
        reasonCode
      }))
    ).toEqual([
      { sequence: 0, status: 'INCLUDED', reasonCode: 'ACCESS_GRANTED' },
      { sequence: 1, status: 'INCLUDED', reasonCode: 'ACCESS_GRANTED' },
      { sequence: 2, status: 'EXCLUDED', reasonCode: 'PROGRESSION_LEVEL_LOCKED' },
      { sequence: 3, status: 'EXCLUDED', reasonCode: 'SPECIALIZATION_MISMATCH' },
      { sequence: 4, status: 'INCLUDED', reasonCode: 'ACCESS_GRANTED' },
      { sequence: 5, status: 'EXCLUDED', reasonCode: 'INHERITED_FEATURE_DUPLICATE' },
      { sequence: 6, status: 'INCLUDED', reasonCode: 'ACCESS_GRANTED' },
      { sequence: 7, status: 'EXCLUDED', reasonCode: 'DUPLICATE_ACCESS_ID' },
      { sequence: 8, status: 'EXCLUDED', reasonCode: 'TARGET_NOT_SELECTED' }
    ])
  })

  it('fails unsupported race scaling closed', async () => {
    const { snapshot, registry } = createSpellGrantPolicyFixture()
    const facts = buildCharacterSpellRuleFacts(snapshot, registry)
    const raceCandidate = facts.spellAccessCandidates.find(
      ({ sourceKind }) => sourceKind === 'RACE'
    )
    if (!raceCandidate) throw new Error('Spell fixture requires a race candidate.')

    const evaluated = await evaluateZenRuleModel({
      document: dnd5e2014CharacterPolicyDocument,
      modelKey: 'character-policy',
      context: policyFacts({
        spellAccessCandidates: [
          {
            ...raceCandidate,
            sequence: 0,
            scalingKind: 'PER_LEVEL',
            scalingSource: 'CLASS_LEVEL',
            progressionLevel: 1
          }
        ],
        spellClasses: facts.spellClasses
      })
    })
    const result = characterRulePolicyOutputSchema.parse(evaluated.result)

    expect(result.spellAccess).toEqual([])
    expect(result.spellAccessDecisions).toEqual([
      {
        sequence: 0,
        accessId: raceCandidate.accessId,
        status: 'EXCLUDED',
        reasonCode: 'UNSUPPORTED_SCALING_SOURCE'
      }
    ])
  })
})
