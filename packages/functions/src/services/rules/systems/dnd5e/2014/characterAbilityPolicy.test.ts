import { describe, expect, it } from 'vitest'

import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema
} from '@artificer-toolkit/schema/api/characterRules'
import { characterGrantFoldInputSchema } from '@artificer-toolkit/schema/api/characterGrantFoldRules'

import { dnd5e2014CharacterPolicyDocument } from './characterPolicy.js'
import { evaluateZenRuleModel } from '../../../zenRuleEngine.js'

function canonicalInput() {
  const fixture = dnd5e2014CharacterPolicyDocument.fixtures.find(
    ({ modelKey }) => modelKey === 'character-policy'
  )
  if (!fixture) throw new Error('The canonical Character policy fixture is missing.')
  return characterRulePolicyInputSchema.parse(fixture.input)
}

function modifier(
  grantId: string,
  valueDomainCode: string,
  modifierKind: string,
  domain: Record<string, string>,
  payload: Record<string, string | number>
) {
  return {
    grantId,
    valueDomainCode,
    modifierKind,
    domain,
    grant: { payload },
    restrictions: [],
    scopeSpellIds: []
  }
}

describe('D&D 5e 2014 Character ability policy', () => {
  it('uses only the latest SET across short and long ability aliases', async () => {
    const base = canonicalInput()
    const grantFoldFacts = characterGrantFoldInputSchema.parse({
      ...base.grantFoldFacts,
      base: {
        ...base.grantFoldFacts.base,
        totalLevel: 1,
        abilities: { DEXTERITY: 8 }
      },
      features: [
        {
          sourceKind: 'FEATURE',
          sourceClassLevel: null,
          timingLevel: null,
          definition: {
            sourceId: 'ability-source',
            mechanicSource: { kind: 'SYSTEM', systemId: 'dnd5e2014' },
            sourceState: null,
            restrictions: [],
            proficiencies: [],
            senses: [],
            modifiers: [
              modifier(
                'set-short',
                'ABILITY_SCORE',
                'SET_VALUE',
                { ability: 'DEX' },
                { value: 12 }
              ),
              modifier(
                'set-long',
                'ABILITY_SCORE',
                'SET_VALUE',
                { ability: 'DEXTERITY' },
                { value: 14 }
              ),
              modifier(
                'spell-dexterity',
                'ATTACK_ROLL',
                'ABILITY_MODIFIER_BONUS',
                { attackDomain: 'SPELL' },
                { ability: 'DEX' }
              )
            ],
            feats: [],
            spells: []
          },
          selectedOptions: [],
          featDefinition: null
        }
      ]
    })
    const input = characterRulePolicyInputSchema.parse({
      ...base,
      totalLevel: 1,
      grantFoldFacts,
      derivedBaseFacts: {
        abilities: [
          {
            abilityId: 'DEXTERITY',
            baseScore: 8,
            bonuses: [
              {
                kind: 'MODIFIER_GROUP',
                sourceId: 'set-short',
                domainKey: 'ABILITY_SCORE:SET_VALUE|ability=DEX',
                operation: 'SET'
              },
              {
                kind: 'MODIFIER_GROUP',
                sourceId: 'set-long',
                domainKey: 'ABILITY_SCORE:SET_VALUE|ability=DEXTERITY',
                operation: 'SET'
              }
            ],
            scoreOverride: null
          }
        ],
        savingThrows: [],
        skills: [],
        initiative: { abilityId: 'DEXTERITY', abilityIndex: 0, bonuses: [] },
        spellcasting: {
          abilityId: 'DEXTERITY',
          abilityIndex: 0,
          saveDcBonuses: [],
          attackBonuses: [
            {
              kind: 'MODIFIER_GROUP',
              sourceId: 'spell-dexterity',
              domainKey: 'ATTACK_ROLL:ABILITY_MODIFIER_BONUS|attackDomain=SPELL',
              operation: 'ADD'
            }
          ]
        }
      }
    })

    const evaluated = await evaluateZenRuleModel({
      document: dnd5e2014CharacterPolicyDocument,
      modelKey: 'character-policy',
      context: input
    })
    const output = characterRulePolicyOutputSchema.parse(evaluated.result)

    expect(output.derivedStats.abilities[0]).toMatchObject({
      score: {
        base: 8,
        effective: 14,
        contributions: [
          { grantId: 'set-short', value: 4, state: 'SUPPRESSED' },
          { grantId: 'set-long', value: 6, state: 'APPLIED' }
        ]
      },
      modifier: { effective: 2 }
    })
    expect(
      output.modifierGroups.find(
        ({ domainKey }) => domainKey === 'ATTACK_ROLL:ABILITY_MODIFIER_BONUS|attackDomain=SPELL'
      )?.effective
    ).toBe(2)
    expect(output.derivedStats.spellcasting?.attackBonus).toMatchObject({ base: 4, effective: 6 })
  })
})
