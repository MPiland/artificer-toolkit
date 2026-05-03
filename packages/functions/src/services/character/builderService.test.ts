import { describe, expect, it } from 'vitest'

import { AUTHORED_RECORD_STATUS } from '@artificer-toolkit/shared/core'
import {
  CharacterStartingEquipmentSource,
  type CharacterAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import type { StartingEquipmentAuthored } from '@artificer-toolkit/shared/authored'

import {
  createCharacterBuilderChangePreview,
  createEmptyCharacterAuthored,
  getInvalidSpellSelectionIds,
  isStartingEquipmentDecisionComplete,
  resolveRecommendedCharacterBuilderSection,
  type CharacterBuilderIssue,
  type CharacterBuilderRegistry,
  type CharacterSpellChoiceRequirement
} from './builderService.js'

function createCharacter(overrides?: Partial<CharacterAuthored>): CharacterAuthored {
  return {
    ...createEmptyCharacterAuthored({
      id: 'character-1',
      systemId: 'dnd5e2014',
      userId: 'user-1'
    }),
    ...overrides
  }
}

function createRegistry(): CharacterBuilderRegistry {
  return {
    system: null,
    races: [
      {
        id: 'dragonborn',
        label: 'Dragonborn',
        category: 'BASE',
        ancestry: {
          id: 'draconic-ancestry',
          label: 'Draconic Ancestry',
          options: [
            {
              id: 'red',
              label: 'Red'
            }
          ]
        }
      } as CharacterBuilderRegistry['races'][number]
    ],
    classes: [],
    backgrounds: [],
    equipment: [],
    spells: [
      {
        id: 'magic-missile',
        label: 'Magic Missile',
        level: 1,
        classIds: ['wizard']
      } as CharacterBuilderRegistry['spells'][number]
    ],
    features: [
      {
        id: 'arcane-recovery',
        label: 'Arcane Recovery'
      } as CharacterBuilderRegistry['features'][number]
    ]
  }
}

function createChoiceStartingEquipment(): StartingEquipmentAuthored {
  return {
    id: 'fighter-start',
    sets: [
      {
        id: 'fighter-set',
        order: 1,
        groups: [
          {
            id: 'fighter-group',
            order: 1,
            options: [
              {
                id: 'fighter-option',
                order: 1,
                items: [
                  {
                    id: 'martial-weapon-choice',
                    order: 1,
                    startingEquipmentKind: 'EQUIPMENT',
                    category: 'WEAPON',
                    selectionKind: 'CHOSEN',
                    count: 1,
                    authoringModeKind: 'SELECTED',
                    equipmentIds: ['longsword']
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}

describe('resolveRecommendedCharacterBuilderSection', () => {
  it('sends active edit mode to Basics', () => {
    const character = createCharacter({
      status: AUTHORED_RECORD_STATUS.ACTIVE,
      label: 'Aelar'
    })

    const section = resolveRecommendedCharacterBuilderSection(character, 'edit', {
      totalLevel: 1,
      abilities: {
        STRENGTH: 10,
        DEXTERITY: 10,
        CONSTITUTION: 10,
        INTELLIGENCE: 10,
        WISDOM: 10,
        CHARISMA: 10
      },
      classes: []
    }, [], [])

    expect(section).toBe('BASICS')
  })

  it('sends draft equipment blockers to Equipment', () => {
    const character = createCharacter({
      label: 'Aelar',
      intent: {
        ...createCharacter().intent,
        race: { raceId: 'dragonborn' },
        background: { backgroundId: 'sage' },
        classes: [{ classId: 'wizard', classLevel: 1 }],
        abilities: {
          method: 'STANDARD_ARRAY',
          assignments: [
            { ability: 'STRENGTH', option: '8' },
            { ability: 'DEXTERITY', option: '10' },
            { ability: 'CONSTITUTION', option: '12' },
            { ability: 'INTELLIGENCE', option: '15' },
            { ability: 'WISDOM', option: '14' },
            { ability: 'CHARISMA', option: '13' }
          ]
        },
        hitpoints: {
          method: 'FIXED',
          levels: [{ level: 1, value: 6 }]
        }
      }
    })

    const section = resolveRecommendedCharacterBuilderSection(character, 'create', {
      totalLevel: 1,
      abilities: {
        STRENGTH: 8,
        DEXTERITY: 10,
        CONSTITUTION: 12,
        INTELLIGENCE: 15,
        WISDOM: 14,
        CHARISMA: 13
      },
      classes: [{ classId: 'wizard', classLabel: 'Wizard', classLevel: 1, featureLabels: [], resourceLabels: [], spellcastingLabels: [] }]
    }, [], [
      {
        code: 'CLASS_STARTING_EQUIPMENT_REQUIRED',
        message: 'Wizard has starting equipment choices to resolve.',
        sourceLabel: 'Wizard',
        required: true
      }
    ] satisfies CharacterBuilderIssue[])

    expect(section).toBe('EQUIPMENT')
  })

  it('sends source-local feature blockers to the owning step', () => {
    const character = createCharacter({
      label: 'Aelar',
      intent: {
        ...createCharacter().intent,
        race: { raceId: 'dragonborn' },
        background: { backgroundId: 'sage' },
        classes: [{ classId: 'wizard', classLevel: 1 }],
        abilities: {
          method: 'STANDARD_ARRAY',
          assignments: [
            { ability: 'STRENGTH', option: '8' },
            { ability: 'DEXTERITY', option: '10' },
            { ability: 'CONSTITUTION', option: '12' },
            { ability: 'INTELLIGENCE', option: '15' },
            { ability: 'WISDOM', option: '14' },
            { ability: 'CHARISMA', option: '13' }
          ]
        },
        hitpoints: {
          method: 'FIXED',
          levels: [{ level: 1, value: 6 }]
        }
      }
    })

    const section = resolveRecommendedCharacterBuilderSection(character, 'create', {
      totalLevel: 1,
      abilities: {
        STRENGTH: 8,
        DEXTERITY: 10,
        CONSTITUTION: 12,
        INTELLIGENCE: 15,
        WISDOM: 14,
        CHARISMA: 13
      },
      classes: [{ classId: 'wizard', classLabel: 'Wizard', classLevel: 1, featureLabels: [], resourceLabels: [], spellcastingLabels: [] }]
    }, [], [
      {
        code: 'FEATURE_SELECTION_REQUIRED',
        message: 'Arcane Recovery requires a selection.',
        sourceLabel: 'Wizard',
        source: { kind: 'CLASS', classId: 'wizard', classLevel: 1 },
        required: true
      }
    ] satisfies CharacterBuilderIssue[])

    expect(section).toBe('CLASSES')
  })

  it('sends class spell selection blockers to Classes', () => {
    const character = createCharacter({
      label: 'Aelar',
      intent: {
        ...createCharacter().intent,
        race: { raceId: 'dragonborn' },
        background: { backgroundId: 'sage' },
        classes: [{ classId: 'wizard', classLevel: 1 }],
        abilities: {
          method: 'STANDARD_ARRAY',
          assignments: [
            { ability: 'STRENGTH', option: '8' },
            { ability: 'DEXTERITY', option: '10' },
            { ability: 'CONSTITUTION', option: '12' },
            { ability: 'INTELLIGENCE', option: '15' },
            { ability: 'WISDOM', option: '14' },
            { ability: 'CHARISMA', option: '13' }
          ]
        },
        hitpoints: {
          method: 'FIXED',
          levels: [{ level: 1, value: 6 }]
        }
      }
    })

    const section = resolveRecommendedCharacterBuilderSection(character, 'create', {
      totalLevel: 1,
      abilities: {
        STRENGTH: 8,
        DEXTERITY: 10,
        CONSTITUTION: 12,
        INTELLIGENCE: 15,
        WISDOM: 14,
        CHARISMA: 13
      },
      classes: [{ classId: 'wizard', classLabel: 'Wizard', classLevel: 1, featureLabels: [], resourceLabels: [], spellcastingLabels: [] }]
    }, [], [
      {
        code: 'SPELL_SELECTION_REQUIRED',
        message: 'Wizard Spellcasting requires spell selections.',
        sourceLabel: 'Wizard',
        source: { kind: 'CLASS', classId: 'wizard', classLevel: 1 },
        required: true
      }
    ] satisfies CharacterBuilderIssue[])

    expect(section).toBe('CLASSES')

    const overLimitSection = resolveRecommendedCharacterBuilderSection(character, 'create', {
      totalLevel: 1,
      abilities: {
        STRENGTH: 8,
        DEXTERITY: 10,
        CONSTITUTION: 12,
        INTELLIGENCE: 15,
        WISDOM: 14,
        CHARISMA: 13
      },
      classes: [{ classId: 'wizard', classLabel: 'Wizard', classLevel: 1, featureLabels: [], resourceLabels: [], spellcastingLabels: [] }]
    }, [], [
      {
        code: 'SPELL_SELECTION_OVER_LIMIT',
        message: 'Wizard Spellcasting has too many selected spells for the current class level.',
        sourceLabel: 'Wizard',
        source: { kind: 'CLASS', classId: 'wizard', classLevel: 1 },
        required: true
      }
    ] satisfies CharacterBuilderIssue[])

    expect(overLimitSection).toBe('CLASSES')
  })
})

describe('character builder source-local choice validation', () => {
  it('rejects class spell selections outside the allowed class and spell level', () => {
    const registry = createRegistry()
    registry.spells = [
      {
        id: 'magic-missile',
        label: 'Magic Missile',
        level: 1,
        classIds: ['wizard']
      } as CharacterBuilderRegistry['spells'][number],
      {
        id: 'cure-wounds',
        label: 'Cure Wounds',
        level: 1,
        classIds: ['cleric']
      } as CharacterBuilderRegistry['spells'][number],
      {
        id: 'fireball',
        label: 'Fireball',
        level: 3,
        classIds: ['wizard']
      } as CharacterBuilderRegistry['spells'][number]
    ]

    const requirement: CharacterSpellChoiceRequirement = {
      label: 'Wizard Spellcasting',
      sourceLabel: 'Wizard',
      source: { kind: 'CLASS', classId: 'wizard', classLevel: 1 },
      cantripLimit: 0,
      learnedSpellLimit: 1,
      maxSpellLevel: 1,
      allowedClassIds: ['wizard']
    }

    expect(getInvalidSpellSelectionIds({
      id: 'wizard-spells',
      source: requirement.source,
      timing: { kind: 'CLASS_LEVEL', classId: 'wizard', classLevel: 1 },
      spells: ['magic-missile', 'cure-wounds', 'fireball']
    }, requirement, registry)).toEqual(['cure-wounds', 'fireball'])
  })

  it('rejects starting equipment selections outside the chosen item allow-list', () => {
    const registry = createRegistry()
    registry.equipment = [
      {
        id: 'longsword',
        label: 'Longsword',
        category: 'WEAPON',
        properties: ['MARTIAL']
      } as CharacterBuilderRegistry['equipment'][number],
      {
        id: 'dagger',
        label: 'Dagger',
        category: 'WEAPON',
        properties: ['SIMPLE']
      } as CharacterBuilderRegistry['equipment'][number]
    ]
    const startingEquipment = createChoiceStartingEquipment()
    const validDecision = {
      source: CharacterStartingEquipmentSource.CLASS,
      tookGold: false,
      groups: [
        {
          groupId: 'fighter-group',
          optionId: 'fighter-option',
          selections: [
            {
              selectionKey: 'martial-weapon-choice',
              equipmentId: 'longsword',
              quantity: 1
            }
          ]
        }
      ]
    }
    const invalidDecision = {
      ...validDecision,
      groups: [
        {
          groupId: 'fighter-group',
          optionId: 'fighter-option',
          selections: [
            {
              selectionKey: 'martial-weapon-choice',
              equipmentId: 'dagger',
              quantity: 1
            }
          ]
        }
      ]
    }

    expect(isStartingEquipmentDecisionComplete(startingEquipment, validDecision, registry)).toBe(true)
    expect(isStartingEquipmentDecisionComplete(startingEquipment, invalidDecision, registry)).toBe(false)
  })
})

describe('createCharacterBuilderChangePreview', () => {
  it('summarizes removed dependent selections and status downgrades', () => {
    const previous = createCharacter({
      label: 'Aelar',
      status: AUTHORED_RECORD_STATUS.ACTIVE
    })
    previous.intent.ancestrySelections = [
      {
        id: 'ancestry-1',
        ancestryId: 'draconic-ancestry',
        optionId: 'red',
        source: { kind: 'RACE', raceId: 'dragonborn' },
        timing: { kind: 'IMMEDIATE' }
      }
    ]
    previous.intent.featureAcquisitions = [
      {
        id: 'feature-acquisition-1',
        featureId: 'arcane-recovery',
        source: { kind: 'CLASS', classId: 'wizard', classLevel: 1 },
        timing: { kind: 'IMMEDIATE' }
      }
    ]
    previous.intent.spellSelections = [
      {
        id: 'spell-selection-1',
        source: { kind: 'CLASS', classId: 'wizard', classLevel: 1 },
        timing: { kind: 'IMMEDIATE' },
        spells: ['magic-missile']
      }
    ]
    previous.intent.resourceGrants = [
      {
        id: 'resource-grant-1',
        resourceId: 'arcane-recovery-pool',
        source: { kind: 'CLASS', classId: 'wizard', classLevel: 1 },
        timing: { kind: 'IMMEDIATE' }
      }
    ]
    previous.intent.startingEquipment = {
      class: {
        source: CharacterStartingEquipmentSource.CLASS,
        tookGold: false
      }
    }

    const next = structuredClone(previous)
    next.status = AUTHORED_RECORD_STATUS.DRAFT
    next.intent.ancestrySelections = undefined
    next.intent.featureAcquisitions = []
    next.intent.spellSelections = undefined
    next.intent.resourceGrants = undefined
    next.intent.startingEquipment = undefined

    const preview = createCharacterBuilderChangePreview({
      previousCharacter: previous,
      nextCharacter: next,
      predictedStatus: AUTHORED_RECORD_STATUS.DRAFT,
      registry: createRegistry()
    })

    expect(preview.downgradesStatus).toBe(true)
    expect(preview.removedAncestrySelections.map((entry) => entry.label)).toEqual(['Draconic Ancestry: Red'])
    expect(preview.removedFeatureAcquisitions.map((entry) => entry.label)).toEqual(['Arcane Recovery'])
    expect(preview.removedSpellSelections.map((entry) => entry.label)).toEqual(['Magic Missile'])
    expect(preview.removedResourceGrants.map((entry) => entry.label)).toEqual(['arcane-recovery-pool'])
    expect(preview.clearedStartingEquipmentSources).toEqual([CharacterStartingEquipmentSource.CLASS])
    expect(preview.summaryLines).toContain('This save will move the character back to Draft until the build is complete again.')
    expect(preview.destructive).toBe(true)
  })
})
