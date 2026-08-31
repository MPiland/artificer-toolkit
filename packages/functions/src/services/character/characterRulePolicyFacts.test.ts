import { describe, expect, it } from 'vitest'

import { characterRulePolicyInputSchema } from '@artificer-toolkit/schema/api/characterRules'
import { systemVocabularySnapshotSchema } from '@artificer-toolkit/schema/projections/systemVocabulary'
import { CHARACTER_ABILITY_GENERATION_METHOD } from '@artificer-toolkit/shared/core'

import { createEmptyCharacterAuthored } from './builderService.js'
import { composeCharacterRulePolicyFacts } from './characterRulePolicyFacts.js'

function context() {
  return {
    catalog: {
      races: [],
      classes: [],
      backgrounds: [],
      equipment: [],
      feats: [],
      spells: []
    },
    registry: {
      system: null,
      races: [],
      classes: [],
      backgrounds: [],
      equipment: [],
      feats: [],
      features: []
    }
  }
}

const vocabularySnapshot = systemVocabularySnapshotSchema.parse({
  snapshotId: 'vocabulary-snapshot-1',
  systemId: 'dnd5e2014',
  snapshotVersion: 1,
  schemaVersion: 2,
  checksum: 'a'.repeat(64),
  document: {
    id: 'dnd5e2014',
    label: 'D&D 5e 2014',
    rulesetCode: 'DND5E',
    rulesetVersion: '2014',
    userId: 'system-owner',
    schemaVersion: 2,
    abilities: [
      { id: '00000000-0000-4000-8000-0000000000d2', code: 'WISDOM', label: 'Wisdom' },
      { id: '00000000-0000-4000-8000-0000000000d1', code: 'DEXTERITY', label: 'Dexterity' }
    ],
    alignments: [],
    challengeRatings: [],
    conditionTypes: [],
    creatureTypes: [],
    currencies: [],
    damageTypes: [],
    heritages: [],
    languages: [],
    lifestyles: [],
    magicSchools: [],
    passives: [],
    rarities: [],
    senses: [],
    skills: [],
    speeds: [],
    terrains: []
  }
})

describe('composeCharacterRulePolicyFacts', () => {
  it('composes a complete schema-valid fact set from raw character context', () => {
    const character = createEmptyCharacterAuthored({
      id: 'character-1',
      systemId: 'dnd5e2014',
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
      userId: 'user-1'
    })
    character.intent.abilities = {
      method: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
      state: { assignments: [{ ability: 'DEXTERITY', score: 12 }] }
    }
    character.state.exhaustion = { level: 2 }
    character.state.hitpoints.hitDice = [{ die: 10, total: 3, used: 1 }]
    character.state.creatures = [
      {
        id: 'companion-wolf',
        creatureId: 'creature-wolf',
        relationshipKind: 'COMPANION',
        originKind: 'WORLD',
        isActive: true,
        currentHitPoints: 5,
        hitDice: [{ die: 8, total: 3, used: 1 }]
      }
    ]
    character.state.spellSlots = [
      { slotKey: 'STANDARD:1', used: 3 },
      { slotKey: 'PACT', used: 5 }
    ]

    const result = composeCharacterRulePolicyFacts({ character, context: context() })

    expect(characterRulePolicyInputSchema.safeParse(result.facts).success).toBe(true)
    expect(result.facts.totalLevel).toBe(0)
    expect(result.facts.derivedBaseFacts.abilities).toEqual([
      expect.objectContaining({ abilityId: 'DEXTERITY', baseScore: 12 })
    ])
    expect(result.facts.rest).toEqual({
      totalHitDice: 3,
      currentExhaustion: 2,
      attunementSlotOverride: null,
      companions: [{ companionInstanceId: 'companion-wolf', totalHitDice: 3 }]
    })
    expect(result.facts.spellSlotUsageFacts).toEqual([
      { kind: 'STANDARD', spellLevel: 1, rawUsed: 3 },
      { kind: 'PACT', rawUsed: 5 }
    ])
  })

  it('pins exact ability definitions from the System vocabulary snapshot', () => {
    const character = createEmptyCharacterAuthored({
      id: 'character-1',
      systemId: 'dnd5e2014',
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
      userId: 'user-1'
    })

    const result = composeCharacterRulePolicyFacts({
      character,
      context: { ...context(), vocabularySnapshot }
    })

    expect(result.facts.abilityDefinitions).toEqual([
      { id: '00000000-0000-4000-8000-0000000000d1', code: 'DEXTERITY' },
      { id: '00000000-0000-4000-8000-0000000000d2', code: 'WISDOM' }
    ])
  })

  it('fails closed for unsupported persisted spell slot keys', () => {
    const character = createEmptyCharacterAuthored({
      id: 'character-1',
      systemId: 'dnd5e2014',
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
      userId: 'user-1'
    })
    character.state.spellSlots = [{ slotKey: 'STANDARD:10', used: 1 }]

    expect(() => composeCharacterRulePolicyFacts({ character, context: context() })).toThrow(
      'Unsupported spell slot usage key: STANDARD:10'
    )
  })

  it('rejects duplicate persisted spell slot usage facts', () => {
    const character = createEmptyCharacterAuthored({
      id: 'character-1',
      systemId: 'dnd5e2014',
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
      userId: 'user-1'
    })
    character.state.spellSlots = [
      { slotKey: 'STANDARD:1', used: 1 },
      { slotKey: 'STANDARD:1', used: 2 }
    ]

    expect(() => composeCharacterRulePolicyFacts({ character, context: context() })).toThrow(
      'Spell slot usage facts must be unique by slot kind'
    )
  })
})
