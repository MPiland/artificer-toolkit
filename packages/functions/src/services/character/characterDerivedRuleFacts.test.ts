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

  it('uses v4 System check-to-ability definitions instead of the legacy skill map', () => {
    const snapshot: CharacterBuildSnapshot = {
      characterId: 'character-v4',
      systemId: 'dnd5e2014',
      totalLevel: 1,
      classes: [],
      abilities: { STRENGTH: 16, DEXTERITY: 14 },
      hitpoints: [],
      features: [],
      equipmentItems: []
    }
    const registry: CharacterAssemblyRegistry = {
      classes: {},
      equipment: {},
      feats: {},
      features: {},
      races: {},
      spells: {},
      system: {
        schemaVersion: 4,
        abilities: [
          { id: '00000000-0000-4000-8000-000000000001', code: 'STRENGTH', label: 'Strength' },
          { id: '00000000-0000-4000-8000-000000000002', code: 'DEXTERITY', label: 'Dexterity' }
        ],
        skills: [
          {
            id: '00000000-0000-4000-8000-000000000011',
            code: 'athletics',
            label: 'Athletics',
            governingAbilityDefinitionId: '00000000-0000-4000-8000-000000000001'
          },
          {
            id: '00000000-0000-4000-8000-000000000012',
            code: 'acrobatics',
            label: 'Acrobatics',
            governingAbilityDefinitionId: '00000000-0000-4000-8000-000000000002'
          },
          {
            id: '00000000-0000-4000-8000-000000000013',
            code: 'custom-check',
            label: 'Custom Check',
            governingAbilityDefinitionId: '00000000-0000-4000-8000-000000000002'
          },
          {
            id: '00000000-0000-4000-8000-000000000014',
            code: 'unavailable',
            label: 'Unavailable',
            governingAbilityDefinitionId: null
          }
        ]
      }
    }

    const facts = buildCharacterDerivedRuleFacts(snapshot, registry)

    expect(facts.skills).toMatchObject([
      { skillId: 'athletics', governingAbilityId: 'STR' },
      { skillId: 'acrobatics', governingAbilityId: 'DEX' },
      { skillId: 'custom-check', governingAbilityId: 'DEX' }
    ])
    expect(facts.skills.map((skill) => skill.skillId)).not.toContain('unavailable')
  })

  it('rejects invalid v4 System check mappings', () => {
    const snapshot: CharacterBuildSnapshot = {
      characterId: 'character-v4-invalid',
      systemId: 'dnd5e2014',
      totalLevel: 1,
      classes: [],
      abilities: { STRENGTH: 10 },
      hitpoints: [],
      features: [],
      equipmentItems: []
    }
    const registry: CharacterAssemblyRegistry = {
      classes: {},
      equipment: {},
      feats: {},
      features: {},
      races: {},
      spells: {},
      system: {
        schemaVersion: 4,
        abilities: [
          { id: '00000000-0000-4000-8000-000000000001', code: 'STRENGTH', label: 'Strength' }
        ],
        skills: [
          {
            id: '00000000-0000-4000-8000-000000000011',
            code: 'athletics',
            label: 'Athletics',
            governingAbilityDefinitionId: '00000000-0000-4000-8000-000000000099'
          }
        ]
      }
    }

    expect(() => buildCharacterDerivedRuleFacts(snapshot, registry)).toThrow(/invalid mapping/i)
    expect(() =>
      buildCharacterDerivedRuleFacts(snapshot, {
        ...registry,
        system: {
          ...registry.system!,
          skills: [
            {
              ...registry.system!.skills![0]!,
              governingAbilityDefinitionId: undefined
            }
          ]
        }
      })
    ).toThrow(/no governing ability/i)
    expect(() =>
      buildCharacterDerivedRuleFacts(snapshot, {
        ...registry,
        system: {
          ...registry.system!,
          abilities: [
            ...registry.system!.abilities!,
            { id: '00000000-0000-4000-8000-000000000001', code: 'DEXTERITY', label: 'Dexterity' }
          ],
          skills: [
            {
              ...registry.system!.skills![0]!,
              governingAbilityDefinitionId: '00000000-0000-4000-8000-000000000001'
            }
          ]
        }
      })
    ).toThrow(/ambiguous/i)
  })
})
