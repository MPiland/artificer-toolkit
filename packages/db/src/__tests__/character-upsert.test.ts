import { describe, expect, it } from 'vitest'
import type { CharacterAuthored } from '@artificer-toolkit/shared'
import { CharacterStartingEquipmentSource } from '@artificer-toolkit/shared'
import { upsertCharacter } from '../domains/subjects/upserts/character.js'
import { InMemoryDb } from './helpers/in-memory-db.js'

function buildCharacter(): CharacterAuthored {
  return {
    id: 'character-1',
    label: 'Aria',
    description: 'Initial character state',
    systemId: 'system-1',
    userId: 'user-1',
    intent: {
      advancement: {
        method: 'EXPERIENCE',
        experience: 123
      },
      race: {
        raceId: 'race-1',
        subraceId: 'subrace-1'
      },
      ancestrySelections: [
        {
          id: 'ancestry-acq-1',
          ancestryId: 'ancestry-1',
          optionId: 'ancestry-option-1',
          source: {
            kind: 'RACE',
            raceId: 'race-1'
          },
          timing: {
            kind: 'IMMEDIATE'
          }
        }
      ],
      background: {
        backgroundId: 'background-1'
      },
      classes: [
        {
          classId: 'class-1',
          classLevel: 3,
          subclassId: 'subclass-1',
          subtypeId: 'subtype-1'
        }
      ],
      abilities: {
        method: 'STANDARD_ARRAY',
        assignments: [
          { ability: 'STRENGTH', option: '15' },
          { ability: 'DEXTERITY', option: '14' }
        ]
      },
      hitpoints: {
        method: 'MANUAL',
        levels: [
          {
            level: 1,
            value: 10,
            rolls: [{ die: 10, value: 7 }],
            overridden: true
          }
        ]
      },
      startingEquipment: {
        class: {
          source: CharacterStartingEquipmentSource.CLASS,
          tookGold: false,
          groups: [
            {
              groupId: 'class-group-1',
              optionId: 'class-option-1',
              selections: [
                {
                  selectionKey: 'class-item-1',
                  equipmentId: 'equipment-1',
                  quantity: 1
                }
              ]
            }
          ],
          applied: true
        },
        background: {
          source: CharacterStartingEquipmentSource.BACKGROUND,
          tookGold: false,
          groups: [
            {
              groupId: 'background-group-1',
              optionId: 'background-option-1',
              selections: [
                {
                  selectionKey: 'background-item-1',
                  equipmentId: 'equipment-2',
                  quantity: 2
                }
              ]
            }
          ],
          applied: false
        }
      },
      featureAcquisitions: [
        {
          id: 'feature-acq-1',
          featureId: 'feature-1',
          source: {
            kind: 'FEATURE',
            featureId: 'feature-1'
          },
          timing: {
            kind: 'IMMEDIATE'
          },
          selections: [
            {
              selectionKey: 'selection-1',
              values: [
                { kind: 'ID', id: 'spell-1' },
                { kind: 'IDS', ids: ['spell-2', 'spell-3'] },
                { kind: 'NUMBER', value: 2 },
                { kind: 'BOOLEAN', value: true }
              ]
            }
          ]
        },
        {
          id: 'feature-acq-2',
          featureId: 'feature-2',
          source: {
            kind: 'OPTION',
            acquiredParentId: 'feature-acq-1',
            optionId: 'option-99'
          },
          timing: {
            kind: 'CLASS_LEVEL',
            classId: 'class-1',
            classLevel: 3
          }
        }
      ],
      spellSelections: [
        {
          id: 'spell-selection-1',
          source: {
            kind: 'OPTION',
            acquiredParentId: 'feature-acq-1',
            optionId: 'option-99'
          },
          timing: {
            kind: 'CHARACTER_LEVEL',
            level: 4
          },
          spells: ['spell-10', 'spell-11']
        }
      ],
      resourceGrants: [
        {
          id: 'resource-grant-1',
          resourceId: 'resource-1',
          source: {
            kind: 'FEATURE',
            featureId: 'feature-1'
          },
          timing: {
            kind: 'IMMEDIATE'
          }
        }
      ]
    },
    state: {
      equipment: {
        inventory: [
          {
            id: 'inventory-1',
            equipmentId: 'equipment-a',
            quantity: 1
          },
          {
            id: 'inventory-2',
            equipmentId: 'equipment-b',
            quantity: 1,
            containerId: 'inventory-1'
          }
        ],
        equipped: ['inventory-1'],
        attuned: ['inventory-2']
      },
      currency: [
        {
          containerId: 'inventory-1',
          currencies: [
            {
              currencyId: 'currency-1',
              amount: 50
            }
          ]
        }
      ],
      hitpoints: {
        current: 9,
        temp: 2,
        hitDice: [{ die: 10, total: 3, used: 1 }],
        maxOverride: 12
      },
      classes: [
        {
          classId: 'class-1',
          spells: {
            learned: ['spell-10'],
            prepared: ['spell-11']
          }
        }
      ],
      resources: [
        {
          resourceGrantId: 'resource-grant-1',
          used: 1
        }
      ]
    }
  }
}

describe('upsertCharacter', () => {
  it('serializes IDS selection values and removes stale character child rows on rewrite', async () => {
    const db = new InMemoryDb()
    const initial = buildCharacter()

    await upsertCharacter(db as never, initial)

    expect(db.snapshot('character_feature_selection_values')).toEqual([
      {
        feature_acquisition_id: 'feature-acq-1',
        selection_key: 'selection-1',
        value_index: 0,
        value_kind: 'ID',
        text_value: 'spell-1',
        number_value: null,
        boolean_value: null
      },
      {
        feature_acquisition_id: 'feature-acq-1',
        selection_key: 'selection-1',
        value_index: 1,
        value_kind: 'IDS',
        text_value: '["spell-2","spell-3"]',
        number_value: null,
        boolean_value: null
      },
      {
        feature_acquisition_id: 'feature-acq-1',
        selection_key: 'selection-1',
        value_index: 2,
        value_kind: 'NUMBER',
        text_value: null,
        number_value: 2,
        boolean_value: null
      },
      {
        feature_acquisition_id: 'feature-acq-1',
        selection_key: 'selection-1',
        value_index: 3,
        value_kind: 'BOOLEAN',
        text_value: null,
        number_value: null,
        boolean_value: true
      }
    ])

    await upsertCharacter(db as never, {
      ...initial,
      label: 'Aria Revised',
      description: undefined,
      intent: {
        ...initial.intent,
        advancement: {
          method: 'MILESTONE'
        },
        race: {
          raceId: 'race-2'
        },
        background: {
          backgroundId: 'background-2'
        },
        classes: [
          {
            classId: 'class-2',
            classLevel: 1
          }
        ],
        abilities: {
          method: 'MANUAL_ROLLED',
          state: {
            configuration: '4d6-drop-lowest',
            rollGroups: [
              {
                id: 'roll-group-1',
                rolls: [
                  { die: 6, value: 6 },
                  { die: 6, value: 5 },
                  { die: 6, value: 4 },
                  { die: 6, value: 1 }
                ],
                kept: [
                  { die: 6, value: 6 },
                  { die: 6, value: 5 },
                  { die: 6, value: 4 }
                ],
                assignedAbility: 'INTELLIGENCE',
                score: 15,
                applied: true,
                rolling: false
              }
            ],
            assignments: [
              {
                ability: 'INTELLIGENCE',
                score: 15
              }
            ]
          }
        },
        hitpoints: {
          method: 'FIXED',
          levels: [
            {
              level: 1,
              value: 8
            }
          ]
        },
        startingEquipment: undefined,
        featureAcquisitions: [],
        spellSelections: undefined,
        resourceGrants: undefined
      },
      state: {
        equipment: {
          inventory: [],
          equipped: [],
          attuned: []
        },
        currency: [],
        hitpoints: {
          current: 8,
          hitDice: []
        },
        classes: [],
        resources: []
      }
    })

    expect(db.snapshot('characters')).toEqual([
      {
        id: 'character-1',
        system_id: 'system-1',
        user_id: 'user-1',
        label: 'Aria Revised',
        description: null
      }
    ])
    expect(db.snapshot('character_feature_acquisitions')).toEqual([])
    expect(db.snapshot('character_feature_selection_records')).toEqual([])
    expect(db.snapshot('character_feature_selection_values')).toEqual([])
    expect(db.snapshot('character_spell_selections')).toEqual([])
    expect(db.snapshot('character_spell_selection_spells')).toEqual([])
    expect(db.snapshot('character_resource_grants')).toEqual([])
    expect(db.snapshot('character_resources')).toEqual([])
    expect(db.snapshot('character_equipment')).toEqual([])
    expect(db.snapshot('character_equipped')).toEqual([])
    expect(db.snapshot('character_attuned')).toEqual([])
    expect(db.snapshot('character_currency_groups')).toEqual([])
    expect(db.snapshot('character_currencies')).toEqual([])
    expect(db.snapshot('character_class_equipment_session')).toEqual([])
    expect(db.snapshot('character_class_equipment_groups')).toEqual([])
    expect(db.snapshot('character_class_equipment_items')).toEqual([])
    expect(db.snapshot('character_background_equipment_session')).toEqual([])
    expect(db.snapshot('character_background_equipment_groups')).toEqual([])
    expect(db.snapshot('character_background_equipment_items')).toEqual([])
    expect(db.snapshot('character_abilities_standard_array')).toEqual([])
    expect(db.snapshot('character_abilities_manual_rolled')).toEqual([
      {
        character_id: 'character-1',
        configuration: '4d6-drop-lowest'
      }
    ])
    expect(db.snapshot('character_abilities_manual_rolled_groups')).toEqual([
      {
        character_id: 'character-1',
        group_index: 0,
        id: 'roll-group-1',
        assigned_ability_code: 'INTELLIGENCE',
        score: 15,
        applied: true,
        rolling: false
      }
    ])
    expect(db.snapshot('character_abilities_manual_rolled_rolls')).toEqual([
      {
        character_id: 'character-1',
        group_index: 0,
        roll_index: 0,
        die: 6,
        value: 6,
        is_kept: true
      },
      {
        character_id: 'character-1',
        group_index: 0,
        roll_index: 1,
        die: 6,
        value: 5,
        is_kept: true
      },
      {
        character_id: 'character-1',
        group_index: 0,
        roll_index: 2,
        die: 6,
        value: 4,
        is_kept: true
      },
      {
        character_id: 'character-1',
        group_index: 0,
        roll_index: 3,
        die: 6,
        value: 1,
        is_kept: false
      }
    ])
    expect(db.snapshot('character_abilities_manual_assignments')).toEqual([
      {
        character_id: 'character-1',
        ability_code: 'INTELLIGENCE',
        score: 15
      }
    ])
  })
})
