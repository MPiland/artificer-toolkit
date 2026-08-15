import { describe, expect, it } from 'vitest'

import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema
} from '@artificer-toolkit/schema/api/characterRules'
import { characterGrantFoldInputSchema } from '@artificer-toolkit/schema/api/characterGrantFoldRules'

import { dnd5e2014CharacterPolicyDocument } from './characterPolicy.js'
import { evaluateZenRuleModel } from '../../../zenRuleEngine.js'

const RUNTIME_JSON_LIMIT = 256 * 1024
const RULE_DOCUMENT_JSON_LIMIT = 1024 * 1024

function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8')
}

function canonicalInput() {
  const fixture = dnd5e2014CharacterPolicyDocument.fixtures.find(
    ({ modelKey }) => modelKey === 'character-policy'
  )
  if (!fixture) throw new Error('The canonical Character policy fixture is missing.')
  return characterRulePolicyInputSchema.parse(fixture.input)
}

describe('D&D 5e 2014 Character policy runtime boundary', () => {
  it('keeps a dense combined Character evaluation within the runtime JSON limit', async () => {
    const base = canonicalInput()
    const abilities = [
      'STRENGTH',
      'DEXTERITY',
      'CONSTITUTION',
      'INTELLIGENCE',
      'WISDOM',
      'CHARISMA'
    ]
    const modifiers = Array.from({ length: 100 }, (_, index) => ({
      grantId: `boundary-modifier-${index}`,
      valueDomainCode: 'BOUNDARY',
      modifierKind: 'BONUS',
      domain: { index: String(index) },
      grant: { payload: { valueKind: 'FIXED', amount: (index % 3) + 1 } },
      restrictions: [],
      scopeSpellIds: []
    }))
    const grantFoldFacts = characterGrantFoldInputSchema.parse({
      ...base.grantFoldFacts,
      base: {
        ...base.grantFoldFacts.base,
        totalLevel: 20,
        abilities: Object.fromEntries(abilities.map((ability, index) => [ability, 10 + index])),
        classes: [{ classId: 'wizard', level: 20, spellcasting: true }]
      },
      features: [
        {
          sourceKind: 'FEATURE',
          sourceClassLevel: null,
          timingLevel: null,
          definition: {
            sourceId: 'boundary-source',
            mechanicSource: { kind: 'SYSTEM', systemId: 'dnd5e2014' },
            sourceState: null,
            restrictions: [],
            proficiencies: [],
            senses: [],
            modifiers,
            feats: [],
            spells: []
          },
          selectedOptions: [],
          featDefinition: null
        }
      ]
    })
    const skills = Array.from({ length: 18 }, (_, index) => ({
      skillId: `skill-${index}`,
      governingAbilityId: abilities[index % abilities.length]!,
      governingAbilityIndex: index % abilities.length,
      governingAbilityOverride: null,
      proficiencySubjectIds: [`skill-${index}`],
      proficiencyOverride: null,
      bonuses: [],
      totalOverride: null,
      passiveOverride: null
    }))
    const spellAccessCandidates = Array.from({ length: 60 }, (_, index) => ({
      sequence: index,
      accessId: `CLASS:wizard:boundary-source:spell-${index}`,
      sourceInstanceId: 'CLASS:wizard:boundary-source',
      spellId: `spell-${index}`,
      sourceFeatureId: 'boundary-source',
      grantId: `boundary-spell-${index}`,
      sourceKind: 'CLASS' as const,
      sourceId: 'wizard',
      owningClassId: 'wizard',
      activeSourceLevel: 20,
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
      totalLevel: 20,
      classLevel: 20,
      attributes: ['KNOWN'],
      castAtLevel: null,
      castingAbility: 'INTELLIGENCE',
      charge: null
    }))
    const input = characterRulePolicyInputSchema.parse({
      ...base,
      totalLevel: 20,
      grantFoldFacts,
      derivedBaseFacts: {
        abilities: abilities.map((abilityId, index) => ({
          abilityId,
          baseScore: 10 + index,
          bonuses: [],
          scoreOverride: null
        })),
        savingThrows: abilities.map((abilityId, abilityIndex) => ({
          abilityId,
          abilityIndex,
          proficiencySubjectId: abilityId,
          proficiencyOverride: null,
          bonuses: [],
          totalOverride: null
        })),
        skills,
        initiative: { abilityId: 'DEXTERITY', abilityIndex: 1, bonuses: [] },
        spellcasting: {
          abilityId: 'INTELLIGENCE',
          abilityIndex: 3,
          saveDcBonuses: [],
          attackBonuses: []
        }
      },
      spellAccessCandidates,
      spellClasses: [{ classId: 'wizard' }],
      spellCastCandidates: Array.from({ length: 30 }, (_, index) => ({
        sequence: index,
        candidateId: `spell-${index}:at-will`,
        spellId: `spell-${index}`,
        source: {
          spellId: `spell-${index}`,
          sourceKind: 'CLASS' as const,
          sourceInstanceId: `class-source-${index}`
        },
        spellLevel: 1,
        castMode: 'AT_WILL',
        castLevel: 1,
        baseEntry: true,
        resourceOwnerKey: null
      })),
      spellActionFacts: Array.from({ length: 30 }, (_, index) => ({
        spellId: `spell-${index}`,
        effects: []
      })),
      chargeCalculations: Array.from({ length: 30 }, (_, index) => ({
        calculationId: `charge-${index}`,
        sourceId: `source-${index}`,
        base: {
          kind: 'FIXED_AMOUNT',
          amount: 3
        },
        bonuses: []
      }))
    })

    const evaluated = await evaluateZenRuleModel({
      document: dnd5e2014CharacterPolicyDocument,
      modelKey: 'character-policy',
      context: input
    })
    const output = characterRulePolicyOutputSchema.parse(evaluated.result)

    expect(jsonBytes(input)).toBeGreaterThan(64 * 1024)
    expect(jsonBytes(input)).toBeLessThan(RUNTIME_JSON_LIMIT)
    expect(jsonBytes(output)).toBeGreaterThan(64 * 1024)
    expect(jsonBytes(output)).toBeLessThan(RUNTIME_JSON_LIMIT)
    expect(jsonBytes(dnd5e2014CharacterPolicyDocument)).toBeLessThan(RULE_DOCUMENT_JSON_LIMIT)
  })
})
