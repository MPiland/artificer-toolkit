import { describe, expect, it } from 'vitest'

import { CLASS_CATEGORY } from '@artificer-toolkit/shared/core'
import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'

import type { CharacterBuilderCatalog } from './builderCatalog.js'
import { createEmptyCharacterAuthored, type CharacterBuilderRegistry } from './builderService.js'
import { buildCharacterSpellPreparationRuleFacts } from './characterSpellPreparationRuleFacts.js'

describe('Character spell preparation rule facts', () => {
  it('normalizes active sources, state presence, catalog rows, and request identity', () => {
    const character = createEmptyCharacterAuthored({
      id: 'character-1',
      systemId: 'dnd5e2014',
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
      userId: 'user-1'
    })
    character.intent.classes = [
      {
        classId: 'wizard',
        classLevel: 5,
        subclassId: 'subclass-choice'
      }
    ]
    character.intent.spellSelections = [
      {
        id: 'wizard-selection',
        source: { kind: 'CLASS', classId: 'wizard' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-1', 'spell-1']
      },
      {
        id: 'subclass-selection',
        source: { kind: 'SUBCLASS', subclassId: 'subclass-choice' },
        timing: { kind: 'IMMEDIATE' },
        spells: ['spell-2']
      }
    ]
    character.state.classes = [
      {
        classId: 'wizard',
        spells: { learned: [], prepared: ['spell-2', 'spell-2'] }
      }
    ]

    const registry = {
      system: null,
      races: [],
      backgrounds: [],
      equipment: [],
      feats: [],
      features: [],
      classes: [
        {
          id: 'wizard',
          label: 'Wizard',
          category: CLASS_CATEGORY.BASE,
          spellcasting: {
            ability: 'INTELLIGENCE',
            attributes: ['PREPARES_SPELLS'],
            maxSpellLevel: 9,
            spellLimits: [
              {
                classLevel: 1,
                preparedSpellsLimit: 0,
                slots: [{ spellLevel: 1, slotCount: 2 }]
              }
            ],
            prepareLimit: {
              methodKinds: ['CLASS_LEVEL'],
              scaling: 'HALF',
              rounding: 'UP',
              perLevel: [{ classLevel: 1, amount: 1 }]
            }
          }
        },
        {
          id: 'subclass-choice',
          label: 'Order of Scribes',
          category: CLASS_CATEGORY.SUBCLASS,
          parentClassId: 'wizard'
        },
        {
          id: 'subclass-canonical',
          label: 'Order of Scribes',
          category: CLASS_CATEGORY.SUBCLASS,
          parentClassId: 'wizard',
          spellcasting: {
            maxSpellLevel: 9,
            spellLimits: [
              {
                classLevel: 3,
                slots: [{ spellLevel: 2, slotCount: 2 }]
              }
            ],
            prepareLimit: {
              methodKinds: ['PER_LEVEL'],
              perLevel: [{ classLevel: 3, amount: 2 }]
            }
          }
        }
      ]
    } as unknown as CharacterBuilderRegistry
    const catalog = {
      spells: [
        { id: 'spell-1', level: 1, classIds: ['wizard', 'wizard'] },
        { id: 'spell-2', level: 2, classIds: ['subclass-canonical'] }
      ]
    } as unknown as CharacterBuilderCatalog
    const snapshot = {
      abilities: { INTELLIGENCE: 16 }
    } as unknown as CharacterBuildSnapshot

    expect(
      buildCharacterSpellPreparationRuleFacts(character, registry, catalog, snapshot, {
        classId: 'wizard',
        spellIds: ['spell-1', 'spell-1', 'spell-2']
      })
    ).toEqual({
      spellPreparationClasses: [
        {
          classId: 'wizard',
          classLevel: 5,
          sources: [
            {
              sourceKind: 'CLASS',
              sourceId: 'wizard',
              attributes: ['PREPARES_SPELLS'],
              abilityIndex: 0,
              spellLimits: [
                {
                  classLevel: 1,
                  preparedSpellsLimit: 0,
                  spellLevels: [1]
                }
              ],
              prepareLimit: {
                methodKinds: ['CLASS_LEVEL'],
                scaling: 'HALF',
                rounding: 'UP',
                perLevel: [{ classLevel: 1, amount: 1 }]
              }
            },
            {
              sourceKind: 'SUBCLASS',
              sourceId: 'subclass-canonical',
              attributes: [],
              abilityIndex: null,
              spellLimits: [
                {
                  classLevel: 3,
                  preparedSpellsLimit: null,
                  spellLevels: [2]
                }
              ],
              prepareLimit: {
                methodKinds: ['PER_LEVEL'],
                scaling: null,
                rounding: null,
                perLevel: [{ classLevel: 3, amount: 2 }]
              }
            }
          ],
          learnedStatePresent: true,
          learnedStateSpellIds: [],
          intentSpellIds: ['spell-1', 'spell-2'],
          preparedStateSpellIds: ['spell-2']
        }
      ],
      spellPreparationCatalog: [
        { spellId: 'spell-1', spellLevel: 1, classIds: ['wizard'] },
        { spellId: 'spell-2', spellLevel: 2, classIds: ['subclass-canonical'] }
      ],
      spellPreparationRequest: {
        classId: 'wizard',
        spellIds: ['spell-1', 'spell-2']
      }
    })
  })

  it('omits a class spellcasting source until its configured availability level', () => {
    const character = createEmptyCharacterAuthored({
      id: 'character-1',
      systemId: 'dnd5e2014',
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
      userId: 'user-1'
    })
    character.intent.classes = [{ classId: 'paladin', classLevel: 1 }]
    const registry = {
      system: null,
      races: [],
      backgrounds: [],
      equipment: [],
      feats: [],
      features: [],
      classes: [
        {
          id: 'paladin',
          label: 'Paladin',
          category: CLASS_CATEGORY.BASE,
          spellcasting: {
            availableAtLevel: 2,
            ability: 'CHARISMA',
            attributes: ['PREPARES_SPELLS'],
            maxSpellLevel: 5,
            spellLimits: [{ classLevel: 2, slots: [{ spellLevel: 1, slotCount: 2 }] }],
            prepareLimit: {
              methodKinds: ['SPELLCASTING_ABILITY', 'CLASS_LEVEL'],
              scaling: 'HALF',
              rounding: 'DOWN'
            }
          }
        }
      ]
    } as unknown as CharacterBuilderRegistry
    const catalog = { spells: [] } as unknown as CharacterBuilderCatalog
    const snapshot = {
      abilities: { CHARISMA: 16 }
    } as unknown as CharacterBuildSnapshot

    expect(
      buildCharacterSpellPreparationRuleFacts(character, registry, catalog, snapshot)
        .spellPreparationClasses[0]?.sources
    ).toEqual([])

    character.intent.classes[0] = { classId: 'paladin', classLevel: 2 }
    expect(
      buildCharacterSpellPreparationRuleFacts(character, registry, catalog, snapshot)
        .spellPreparationClasses[0]?.sources
    ).toHaveLength(1)
  })
})
