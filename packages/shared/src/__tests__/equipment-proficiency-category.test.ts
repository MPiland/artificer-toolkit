import { describe, expect, it } from 'vitest'

import {
  dnd5e2014RulesSystem,
  compileProficiencyGrant,
  runEngine,
  type CharacterAssemblyRegistry,
  type CharacterBuildSnapshot
} from '@artificer-toolkit/shared'

describe('equipment-property proficiency categories', () => {
  it('retains category scope when compiling ALL-mode grants', () => {
    expect(compileProficiencyGrant({
      id: 'all-heavy-armor',
      order: 1,
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'EQUIPMENT_PROPERTY',
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      category: 'ARMOR',
      level: 'FULL'
    })).toMatchObject({
      authoringModeKind: 'ALL',
      category: 'ARMOR'
    })
  })

  it('preserves the authored category when applying a proficiency grant', () => {
    const snapshot: CharacterBuildSnapshot = {
      characterId: 'character-1',
      systemId: 'dnd5e2014',
      totalLevel: 1,
      classes: [],
      abilities: {},
      hitpoints: [],
      equipmentItems: [],
      features: [{
        featureId: 'heavy-armor-training',
        source: { kind: 'FEAT', featId: 'feat-1' },
        timing: { kind: 'CHARACTER_LEVEL', level: 1 }
      }]
    }
    const registry: CharacterAssemblyRegistry = {
      classes: {},
      feats: {},
      races: {},
      equipment: {},
      spells: {},
      features: {
        'heavy-armor-training': {
          proficiencies: [{
            id: 'heavy-armor-proficiency',
            order: 1,
            grantKind: 'PROFICIENCY_GRANT',
            proficiencyKind: 'EQUIPMENT_PROPERTY',
            selectionKind: 'GRANTED',
            authoringModeKind: 'SELECTED',
            properties: ['HEAVY'],
            category: 'ARMOR',
            level: 'FULL'
          }]
        }
      }
    }

    expect(runEngine(snapshot, registry, dnd5e2014RulesSystem).proficiencies).toContainEqual({
      kind: 'EQUIPMENT_PROPERTY',
      subjectId: 'HEAVY',
      category: 'ARMOR',
      scaling: 'FULL'
    })
  })

  it('uses multiclass proficiencies instead of full class proficiencies for secondary classes', () => {
    const primarySave = compileProficiencyGrant({
      id: 'fighter-strength-save',
      order: 1,
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'SAVE_ABILITY',
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      abilities: ['STRENGTH'],
      level: 'FULL'
    })
    const clericHeavyArmor = compileProficiencyGrant({
      id: 'cleric-heavy-armor',
      order: 1,
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'EQUIPMENT_PROPERTY',
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      category: 'ARMOR',
      properties: ['HEAVY'],
      level: 'FULL'
    })
    const clericLightArmor = compileProficiencyGrant({
      id: 'cleric-light-armor',
      order: 1,
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'EQUIPMENT_PROPERTY',
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      category: 'ARMOR',
      properties: ['LIGHT'],
      level: 'FULL'
    })
    const registry: CharacterAssemblyRegistry = {
      classes: {
        fighter: {
          id: 'fighter',
          category: 'BASE',
          startingGold: { multiplier: 10, currencyId: 'gp', dieConfig: '5d4' },
          startingEquipment: { id: 'fighter-equipment', sets: [] },
          hitpoint: { ability: 'CONSTITUTION', dieConfig: 'd10' },
          multiclass: {
            id: 'fighter-multiclass',
            requirementGroups: { id: 'fighter-requirements', groups: [] }
          },
          proficiencies: [primarySave]
        },
        cleric: {
          id: 'cleric',
          category: 'BASE',
          startingGold: { multiplier: 10, currencyId: 'gp', dieConfig: '5d4' },
          startingEquipment: { id: 'cleric-equipment', sets: [] },
          hitpoint: { ability: 'CONSTITUTION', dieConfig: 'd8' },
          multiclass: {
            id: 'cleric-multiclass',
            requirementGroups: { id: 'cleric-requirements', groups: [] },
            proficiencies: [clericLightArmor]
          },
          proficiencies: [clericHeavyArmor]
        }
      },
      feats: {},
      races: {},
      equipment: {},
      spells: {},
      features: {}
    }
    const snapshot: CharacterBuildSnapshot = {
      characterId: 'multiclass-character',
      systemId: 'dnd5e2014',
      totalLevel: 2,
      classes: [
        { classId: 'fighter', level: 1 },
        { classId: 'cleric', level: 1 }
      ],
      abilities: {},
      hitpoints: [],
      equipmentItems: [],
      features: []
    }

    const proficiencies = runEngine(snapshot, registry, dnd5e2014RulesSystem).proficiencies

    expect(proficiencies).toContainEqual({
      kind: 'SAVE_ABILITY',
      subjectId: 'STRENGTH',
      scaling: 'FULL'
    })
    expect(proficiencies).toContainEqual({
      kind: 'EQUIPMENT_PROPERTY',
      subjectId: 'LIGHT',
      category: 'ARMOR',
      scaling: 'FULL'
    })
    expect(proficiencies).not.toContainEqual({
      kind: 'EQUIPMENT_PROPERTY',
      subjectId: 'HEAVY',
      category: 'ARMOR',
      scaling: 'FULL'
    })
  })

  it('keeps selections for a reused chosen grant scoped to their owning source', () => {
    const sharedGrant = compileProficiencyGrant({
      id: 'shared-skill-choice',
      order: 1,
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'SKILL',
      selectionKind: 'CHOSEN',
      selectionDuplicatePolicy: 'UNIQUE',
      scalingKind: 'NONE',
      count: 1,
      authoringModeKind: 'ALL',
      level: 'FULL'
    })
    const registry: CharacterAssemblyRegistry = {
      classes: {},
      feats: {},
      races: {},
      equipment: {},
      spells: {},
      features: {
        'feature-a': { proficiencies: [sharedGrant] },
        'feature-b': { proficiencies: [sharedGrant] }
      }
    }
    const snapshot: CharacterBuildSnapshot = {
      characterId: 'two-owner-character',
      systemId: 'dnd5e2014',
      totalLevel: 1,
      classes: [],
      abilities: {},
      hitpoints: [],
      equipmentItems: [],
      features: [
        {
          featureId: 'feature-a',
          source: { kind: 'FEATURE', featureId: 'feature-a' },
          timing: { kind: 'IMMEDIATE' }
        },
        {
          featureId: 'feature-b',
          source: { kind: 'FEATURE', featureId: 'feature-b' },
          timing: { kind: 'IMMEDIATE' }
        }
      ],
      chosenGrantSelections: [
        {
          id: 'selection-a',
          grantId: sharedGrant.id,
          source: { kind: 'FEATURE', featureId: 'feature-a' },
          timing: { kind: 'IMMEDIATE' },
          targetIds: ['athletics']
        },
        {
          id: 'selection-b',
          grantId: sharedGrant.id,
          source: { kind: 'FEATURE', featureId: 'feature-b' },
          timing: { kind: 'IMMEDIATE' },
          targetIds: ['arcana']
        }
      ]
    }

    expect(runEngine(snapshot, registry, dnd5e2014RulesSystem).proficiencies).toEqual(
      expect.arrayContaining([
        { kind: 'SKILL', subjectId: 'athletics', scaling: 'FULL' },
        { kind: 'SKILL', subjectId: 'arcana', scaling: 'FULL' }
      ])
    )
  })
})
