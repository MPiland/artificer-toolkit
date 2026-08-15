import { describe, expect, it } from 'vitest'

import type {
  CharacterAssemblyRegistry,
  CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'

import { buildCharacterDerivedRuleFacts } from './characterDerivedRuleFacts.js'

describe('buildCharacterDerivedRuleFacts', () => {
  it('normalizes aliases and stable candidates without resolving mechanics', () => {
    const snapshot: CharacterBuildSnapshot = {
      characterId: 'character-1',
      systemId: 'dnd5e2014',
      totalLevel: 5,
      classes: [{ classId: 'wizard', level: 5 }],
      abilities: { STRENGTH: 8, DEXTERITY: 14, WISDOM: 16 },
      hitpoints: [],
      features: [],
      equipmentItems: [],
      adjustments: [
        {
          id: 'strength-override',
          family: 'ABILITY',
          ability: 'STRENGTH',
          field: 'SCORE_OVERRIDE',
          value: 12
        },
        {
          id: 'perception-proficiency',
          family: 'SKILL',
          skillId: 'skill-perception',
          field: 'PROFICIENCY_OVERRIDE',
          value: 'DOUBLE'
        },
        {
          id: 'perception-passive',
          family: 'PASSIVE',
          skillId: 'PERCEPTION',
          field: 'TOTAL_OVERRIDE',
          value: 19
        }
      ]
    }
    const registry: CharacterAssemblyRegistry = {
      classes: {
        wizard: { spellcasting: { ability: 'WIS' } } as never
      },
      features: {},
      feats: {},
      races: {},
      equipment: {},
      spells: {},
      system: {
        skills: [{ id: 'skill-perception', code: 'perception', label: 'Perception' }]
      }
    }
    const facts = buildCharacterDerivedRuleFacts(snapshot, registry)

    expect(facts.abilities[0]).toMatchObject({
      abilityId: 'STRENGTH',
      scoreOverride: {
        sourceId: 'strength-override',
        source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: 'strength-override' },
        value: 12
      }
    })
    expect(facts.abilities[0]?.bonuses).toEqual(
      expect.arrayContaining([
        {
          kind: 'MODIFIER_GROUP',
          domainKey: 'ABILITY_SCORE:BONUS|ability=STRENGTH',
          sourceId: 'ABILITY_SCORE:BONUS|ability=STRENGTH',
          operation: 'ADD'
        },
        {
          kind: 'MODIFIER_GROUP',
          domainKey: 'ABILITY_SCORE:BONUS|ability=STR',
          sourceId: 'ABILITY_SCORE:BONUS|ability=STR',
          operation: 'ADD'
        }
      ])
    )
    expect(facts.skills.find(({ skillId }) => skillId === 'perception')).toMatchObject({
      governingAbilityId: 'WIS',
      proficiencySubjectIds: expect.arrayContaining([
        'perception',
        'PERCEPTION',
        'skill-perception'
      ]),
      proficiencyOverride: {
        sourceId: 'perception-proficiency',
        source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: 'perception-proficiency' },
        value: 'DOUBLE'
      },
      passiveOverride: {
        sourceId: 'perception-passive',
        source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: 'perception-passive' },
        value: 19
      }
    })
    expect(facts.skills.find(({ skillId }) => skillId === 'perception')?.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'MODIFIER_GROUP',
          domainKey: 'SKILL_MODIFIER:BONUS|skillId=perception',
          operation: 'ADD'
        })
      ])
    )
    expect(facts.initiative).toMatchObject({
      abilityId: 'DEXTERITY',
      abilityIndex: 1
    })
    expect(facts.initiative.bonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'MODIFIER_GROUP',
          domainKey: 'INITIATIVE:BONUS',
          operation: 'ADD'
        })
      ])
    )
    expect(facts.spellcasting?.abilityId).toBe('WISDOM')
  })
})
