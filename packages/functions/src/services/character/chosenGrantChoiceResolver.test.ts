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
import type { CharacterAuthored, SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type {
  ProficiencyGrantAuthored,
  SpellGrantAuthored
} from '@artificer-toolkit/shared/authored'
import type { CharacterBuilderEquipmentCatalogRecord } from './builderCatalog.js'

import {
  resolveCharacterChosenGrantChoices,
  type CharacterChosenGrantChoiceRegistry,
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
        groups: [
          {
            id: 'spell-filter-group',
            order: 1,
            contexts: [
              {
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
              }
            ]
          }
        ]
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
          makeEquipment('longsword', 'Longsword', EQUIPMENT_CATEGORY_CODE.WEAPON, [
            EQUIPMENT_PROPERTY_CODE.MARTIAL
          ]),
          makeEquipment('club', 'Club', EQUIPMENT_CATEGORY_CODE.WEAPON, [
            EQUIPMENT_PROPERTY_CODE.SIMPLE
          ]),
          makeEquipment('shield', 'Shield', EQUIPMENT_CATEGORY_CODE.SHIELD, [
            EQUIPMENT_PROPERTY_CODE.MARTIAL
          ])
        ]
      },
      [makeOwner({ proficiencies: [grant] })]
    )

    expect(choices[0]?.options).toEqual([{ id: 'longsword', label: 'Longsword' }])
  })

  it('disables a chosen full proficiency already granted at full rank', () => {
    const fixedGrant = {
      id: 'fixed-skill',
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SKILL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      skillIds: ['arcana'],
      level: SCALING_AMOUNT_KIND.FULL,
      order: 0
    } satisfies ProficiencyGrantAuthored<'FEATURE'>
    const chosenGrant = {
      id: 'chosen-skill',
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SKILL,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      skillIds: ['arcana'],
      count: 1,
      level: SCALING_AMOUNT_KIND.FULL,
      order: 1
    } satisfies ProficiencyGrantAuthored<'FEATURE'>

    const choices = resolveCharacterChosenGrantChoices(
      makeCharacter(),
      {
        system: {
          skills: [{ id: 'arcana', label: 'Arcana' }]
        } as CharacterChosenGrantChoiceRegistry['system'],
        equipment: [],
        feats: [],
        spells: []
      },
      [makeOwner({ proficiencies: [fixedGrant, chosenGrant] })]
    )

    expect(choices[0]?.options).toEqual([
      {
        id: 'arcana',
        label: 'Arcana',
        disabled: true,
        disabledReason: 'Granted by Test feature'
      }
    ])
  })

  it('requires full proficiency before a chosen expertise selection', () => {
    const grant = {
      id: 'expertise-skill',
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SKILL,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      skillIds: ['arcana'],
      count: 1,
      level: SCALING_AMOUNT_KIND.DOUBLE,
      order: 0
    } satisfies ProficiencyGrantAuthored<'FEATURE'>

    const choices = resolveCharacterChosenGrantChoices(
      makeCharacter(),
      {
        system: {
          skills: [{ id: 'arcana', label: 'Arcana' }]
        } as CharacterChosenGrantChoiceRegistry['system'],
        equipment: [],
        feats: [],
        spells: []
      },
      [makeOwner({ proficiencies: [grant] })]
    )

    expect(choices[0]?.options[0]?.disabledReason).toBe('Requires full proficiency first.')
  })

  it('keeps a chosen full proficiency eligible when it supplies an expertise prerequisite', () => {
    const fullGrant = {
      id: 'chosen-full',
      grantKind: GRANT_KIND.PROFICIENCY_GRANT,
      proficiencyKind: PROFICIENCY_KIND.SKILL,
      selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
      selectionDuplicatePolicy: AUTHORING_SELECTION_DUPLICATE_POLICY.UNIQUE,
      scalingKind: SCALING.NONE,
      authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
      skillIds: ['arcana'],
      count: 1,
      level: SCALING_AMOUNT_KIND.FULL,
      order: 0
    } satisfies ProficiencyGrantAuthored<'FEATURE'>
    const expertiseGrant = {
      ...fullGrant,
      id: 'chosen-expertise',
      level: SCALING_AMOUNT_KIND.DOUBLE,
      order: 1
    } satisfies ProficiencyGrantAuthored<'FEATURE'>
    const character = makeCharacter()
    character.intent.chosenGrantSelections = [
      {
        id: 'selection-full',
        grantId: fullGrant.id,
        source: { kind: 'FEATURE', featureId: 'feature-1' },
        timing: { kind: 'IMMEDIATE' },
        targetIds: ['arcana']
      },
      {
        id: 'selection-expertise',
        grantId: expertiseGrant.id,
        source: { kind: 'FEATURE', featureId: 'feature-1' },
        timing: { kind: 'IMMEDIATE' },
        targetIds: ['arcana']
      }
    ]

    const choices = resolveCharacterChosenGrantChoices(
      character,
      {
        system: {
          skills: [{ id: 'arcana', label: 'Arcana' }]
        } as CharacterChosenGrantChoiceRegistry['system'],
        equipment: [],
        feats: [],
        spells: []
      },
      [makeOwner({ proficiencies: [fullGrant, expertiseGrant] })]
    )

    expect(choices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.stringContaining(fullGrant.id),
          options: [{ id: 'arcana', label: 'Arcana' }]
        }),
        expect.objectContaining({
          id: expect.stringContaining(expertiseGrant.id),
          options: [{ id: 'arcana', label: 'Arcana' }]
        })
      ])
    )
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
      ownerFeatureId: 'feature-a',
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
          makeEquipment('longsword', 'Longsword', EQUIPMENT_CATEGORY_CODE.WEAPON, [
            EQUIPMENT_PROPERTY_CODE.MARTIAL
          ]),
          makeEquipment('club', 'Club', EQUIPMENT_CATEGORY_CODE.WEAPON, [
            EQUIPMENT_PROPERTY_CODE.SIMPLE
          ])
        ]
      },
      [ownerA, ownerB]
    )

    expect(choices.map((choice) => choice.id)).toHaveLength(2)
    expect(new Set(choices.map((choice) => choice.id)).size).toBe(2)
    expect(choices.map((choice) => choice.selectedTargetIds)).toEqual([['longsword'], ['club']])
    expect(choices.map((choice) => choice.ownerFeatureId)).toEqual(['feature-a', undefined])
  })
})
