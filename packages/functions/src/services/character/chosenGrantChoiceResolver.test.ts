import { describe, expect, it } from 'vitest'

import {
  ADVANCEMENT_METHOD_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_DUPLICATE_POLICY,
  AUTHORING_SELECTION_KIND,
  CHARACTER_ABILITY_GENERATION_METHOD,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  GRANT_KIND,
  HITPOINT_CALCULATION_METHOD_CODE,
  PROFICIENCY_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  SUBJECT
} from '@artificer-toolkit/shared/core'
import type {
  CharacterAuthored,
  SpellAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import type {
  ProficiencyGrantAuthored,
  SpellGrantAuthored
} from '@artificer-toolkit/shared/authored'
import type { CharacterBuilderEquipmentCatalogRecord } from './builderCatalog.js'

import {
  resolveCharacterChosenGrantChoices,
  type CharacterChosenGrantOwner
} from './chosenGrantChoiceResolver.js'

function makeCharacter(): CharacterAuthored {
  return {
    id: 'character-1',
    label: 'Mira',
    profile: {},
    intent: {
      advancement: { method: ADVANCEMENT_METHOD_CODE.MILESTONE },
      race: { raceId: 'human' },
      background: { backgroundId: 'sage' },
      classes: [],
      abilities: {
        method: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
        state: { assignments: [] }
      },
      hitpoints: { method: HITPOINT_CALCULATION_METHOD_CODE.FIXED, levels: [] },
      featureAcquisitions: []
    },
    state: {
      equipment: { inventory: [], equipped: [], attuned: [] },
      currency: [],
      hitpoints: { current: 0, hitDice: [] }
    },
    systemId: 'system-1',
    userId: 'user-1'
  }
}

function makeSpell(id: string, label: string, level: number, magicSchoolId: string): SpellAuthored {
  return {
    kind: SUBJECT.SPELL,
    id,
    label,
    description: label,
    castingTime: { unit: 'MINUTE', amount: 1 },
    level,
    classIds: ['wizard'],
    magicSchoolId,
    userId: 'user-1',
    systemId: 'system-1'
  }
}

function makeEquipment(
  id: string,
  label: string,
  category: CharacterBuilderEquipmentCatalogRecord['category'],
  properties: CharacterBuilderEquipmentCatalogRecord['properties']
): CharacterBuilderEquipmentCatalogRecord {
  return {
    id,
    label,
    category,
    properties,
    isContainer: false,
    requiresAttunement: false
  }
}

function makeOwner(grants: CharacterChosenGrantOwner['grants']): CharacterChosenGrantOwner {
  return {
    label: 'Choose one',
    sourceLabel: 'Test feature',
    source: { kind: 'FEATURE', featureId: 'feature-1' },
    timing: { kind: 'IMMEDIATE' },
    activeLevel: 1,
    grants
  }
}

describe('resolveCharacterChosenGrantChoices', () => {
  it('applies spell identity and property filters before presenting choices', () => {
    const grant = {
      id: 'spell-choice',
      grantKind: GRANT_KIND.SPELL_GRANT,
      order: 1,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
      scalingKind: SCALING.NONE,
      count: 1,
      authoringModeKind: AUTHORING_MODE_KIND.ALL,
      filters: {
        id: 'spell-filter',
        groups: [{
          id: 'spell-filter-group',
          order: 1,
          contexts: [{
            id: 'spell-filter-context',
            order: 1,
            subject: SUBJECT.SPELL,
            authoringModeKind: AUTHORING_MODE_KIND.ALL,
            conditions: [
              {
                id: 'school-filter',
                order: 1,
                kind: 'PREDICATE',
                constraint: 'INCLUDE',
                predicateCode: 'MAGIC_SCHOOL',
                authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                magicSchoolIds: ['evocation']
              },
              {
                id: 'level-filter',
                order: 2,
                kind: 'PREDICATE',
                constraint: 'INCLUDE',
                predicateCode: 'SPELL_LEVEL',
                min: 1,
                max: 2
              }
            ]
          }]
        }]
      }
    } satisfies SpellGrantAuthored<'FEATURE'>

    const choices = resolveCharacterChosenGrantChoices(
      makeCharacter(),
      {
        system: null,
        equipment: [],
        feats: [],
        spells: [
          makeSpell('fire-bolt', 'Fire Bolt', 0, 'evocation'),
          makeSpell('burning-hands', 'Burning Hands', 1, 'evocation'),
          makeSpell('misty-step', 'Misty Step', 2, 'conjuration'),
          makeSpell('fireball', 'Fireball', 3, 'evocation')
        ]
      },
      [makeOwner({ spells: [grant] })]
    )

    expect(choices[0]?.options).toEqual([{ id: 'burning-hands', label: 'Burning Hands' }])
  })

  it('filters broad equipment proficiency choices by category and properties', () => {
    const grant = {
      id: 'martial-weapon-choice',
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
      order: 1,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
      scalingKind: SCALING.NONE,
      count: 1,
      authoringModeKind: AUTHORING_MODE_KIND.ALL,
      category: EQUIPMENT_CATEGORY_CODE.WEAPON,
      properties: [EQUIPMENT_PROPERTY_CODE.MARTIAL],
      level: SCALING_AMOUNT_KIND.FULL
    } satisfies ProficiencyGrantAuthored<'FEATURE'>

    const choices = resolveCharacterChosenGrantChoices(
      makeCharacter(),
      {
        system: null,
        spells: [],
        feats: [],
        equipment: [
          makeEquipment('longsword', 'Longsword', EQUIPMENT_CATEGORY_CODE.WEAPON, [EQUIPMENT_PROPERTY_CODE.MARTIAL]),
          makeEquipment('club', 'Club', EQUIPMENT_CATEGORY_CODE.WEAPON, [EQUIPMENT_PROPERTY_CODE.SIMPLE]),
          makeEquipment('shield', 'Shield', EQUIPMENT_CATEGORY_CODE.SHIELD, [EQUIPMENT_PROPERTY_CODE.MARTIAL])
        ]
      },
      [makeOwner({ proficiencies: [grant] })]
    )

    expect(choices[0]?.options).toEqual([{ id: 'longsword', label: 'Longsword' }])
  })

  it('keeps a reused grant identity and selection scoped to its owner', () => {
    const grant = {
      id: 'shared-weapon-choice',
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
      order: 1,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
      scalingKind: SCALING.NONE,
      count: 1,
      authoringModeKind: AUTHORING_MODE_KIND.ALL,
      category: EQUIPMENT_CATEGORY_CODE.WEAPON,
      level: SCALING_AMOUNT_KIND.FULL
    } satisfies ProficiencyGrantAuthored<'FEATURE'>
    const character = makeCharacter()
    character.intent.chosenGrantSelections = [
      {
        id: 'selection-a',
        grantId: grant.id,
        source: { kind: 'FEATURE', featureId: 'feature-a' },
        timing: { kind: 'IMMEDIATE' },
        targetIds: ['longsword']
      },
      {
        id: 'selection-b',
        grantId: grant.id,
        source: { kind: 'FEATURE', featureId: 'feature-b' },
        timing: { kind: 'IMMEDIATE' },
        targetIds: ['club']
      }
    ]
    const ownerA = {
      ...makeOwner({ proficiencies: [grant] }),
      source: { kind: 'FEATURE', featureId: 'feature-a' } as const
    }
    const ownerB = {
      ...makeOwner({ proficiencies: [grant] }),
      source: { kind: 'FEATURE', featureId: 'feature-b' } as const
    }

    const choices = resolveCharacterChosenGrantChoices(
      character,
      {
        system: null,
        spells: [],
        feats: [],
        equipment: [
          makeEquipment('longsword', 'Longsword', EQUIPMENT_CATEGORY_CODE.WEAPON, [EQUIPMENT_PROPERTY_CODE.MARTIAL]),
          makeEquipment('club', 'Club', EQUIPMENT_CATEGORY_CODE.WEAPON, [EQUIPMENT_PROPERTY_CODE.SIMPLE])
        ]
      },
      [ownerA, ownerB]
    )

    expect(choices.map((choice) => choice.id)).toHaveLength(2)
    expect(new Set(choices.map((choice) => choice.id)).size).toBe(2)
    expect(choices.map((choice) => choice.selectedTargetIds)).toEqual([
      ['longsword'],
      ['club']
    ])
  })
})
