import { describe, expect, it, vi } from 'vitest'
import type { CharacterAuthored } from '@artificer-toolkit/shared'
import { CharacterStartingEquipmentSource } from '@artificer-toolkit/shared'
import type { DBLike } from '#types'
import { upsertCharacter } from '../domains/subjects/upserts/character.js'
import { createCharacterRepository } from '../repositories/index.js'
import { InMemoryDb } from './helpers/in-memory-db.js'

vi.mock('kysely', () => ({
  sql: (sql: TemplateStringsArray, ...values: unknown[]) => ({
    execute: async (db: InMemoryDb) => {
      const statement = sql
        .map((piece, index) => `${piece}${index < values.length ? String(values[index]) : ''}`)
        .join('')
      const lowered = statement.toLowerCase()
      const queryTable = lowered.includes('character_spell_slot_state')
        ? 'character_spell_slot_state'
        : lowered.includes('character_conditions')
          ? 'character_conditions'
          : lowered.includes('character_exhaustion')
            ? 'character_exhaustion'
            : null

      if (!queryTable) {
        throw new Error(`Unhandled SQL in test mock: ${statement}`)
      }

      const characterId = values[0]
      if (typeof characterId !== 'string') {
        throw new TypeError('Expected the character query to bind a string character ID.')
      }

      const rows = await db
        .selectFrom(queryTable)
        .selectAll()
        .where('character_id', '=', characterId)
        .execute()

      return { rows }
    }
  })
}))

function buildCharacter(): CharacterAuthored {
  return {
    id: 'character-1',
    label: 'Aria',
    description: 'Initial character state',
    profile: {
      alignmentId: 'alignment-1',
      lifestyleId: 'lifestyle-1',
      faith: 'Selune',
      personalityTraits: 'Always offers a kind word.',
      backstory: 'Raised on the road between two temple cities.',
      notes: 'Carries a weathered journal.'
    },
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
          specializationId: 'specialization-1'
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
            classId: 'class-1',
            classLevel: 1,
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
      chosenGrantSelections: [
        {
          id: 'chosen-grant-selection-1',
          grantId: 'proficiency-grant-1',
          source: {
            kind: 'CLASS',
            classId: 'class-1',
            classLevel: 3
          },
          timing: {
            kind: 'CLASS_LEVEL',
            classId: 'class-1',
            classLevel: 3
          },
          progressionLevel: 3,
          targetIds: ['skill-arcana', 'skill-arcana', 'skill-history']
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
          id: 'currency-group-1',
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
        hitDice: [{ die: 10, total: 3, used: 1 }]
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
      ],
      spellSlots: [
        {
          slotKey: 'STANDARD:1',
          used: 1
        }
      ],
      conditions: [
        {
          conditionTypeId: 'condition-1',
          notes: 'Poisoned'
        }
      ],
      exhaustion: {
        level: 2,
        notes: 'Forced march'
      },
      inspiration: true,
      noteGroups: [
        {
          id: 'note-group-session',
          label: 'Session Notes',
          sortOrder: 0,
          kind: 'SESSION'
        }
      ],
      notes: [
        {
          id: 'note-1',
          title: 'The Saltglass Ruins',
          body: 'The western gate bears an artificer sigil.',
          groupId: 'note-group-session',
          pinned: true,
          createdAt: '2026-07-01T12:00:00.000Z',
          updatedAt: '2026-07-02T15:30:00.000Z'
        }
      ],
      creatures: [
        {
          id: 'character-creature-1',
          creatureId: 'creature-1',
          relationshipKind: 'MOUNT',
          originKind: 'WORLD',
          customName: 'Storm',
          isActive: true
        }
      ],
      vehicles: [
        {
          id: 'character-vehicle-1',
          vehicleId: 'vehicle-1',
          customName: 'Dawnrunner'
        }
      ],
      creatureEquipment: {
        'character-creature-1': [{ equipmentItemId: 'inventory-1' }]
      },
      vehicleEquipment: {
        'character-vehicle-1': [{ equipmentItemId: 'inventory-2' }]
      }
    }
  }
}

describe('upsertCharacter', () => {
  it('serializes IDS selection values and removes stale character child rows on rewrite', async () => {
    const db = new InMemoryDb()
    const initial = buildCharacter()

    await upsertCharacter(db as never, initial)

    expect(db.snapshot('character_hitpoint_levels')).toEqual([
      {
        character_id: 'character-1',
        char_level: 1,
        class_id: 'class-1',
        class_level: 1,
        value: 10,
        overridden: true
      }
    ])

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
    expect(db.snapshot('character_profile')).toEqual([
      {
        character_id: 'character-1',
        alignment_id: 'alignment-1',
        lifestyle_id: 'lifestyle-1',
        faith: 'Selune',
        gender: null,
        age: null,
        eyes: null,
        hair: null,
        skin: null,
        height: null,
        weight: null,
        physical_characteristics: null,
        personality_traits: 'Always offers a kind word.',
        ideals: null,
        bonds: null,
        flaws: null,
        organizations: null,
        allies: null,
        enemies: null,
        backstory: 'Raised on the road between two temple cities.',
        notes: 'Carries a weathered journal.'
      }
    ])
    expect(db.snapshot('character_creatures')).toEqual([
      {
        id: 'character-creature-1',
        character_id: 'character-1',
        creature_id: 'creature-1',
        relationship_kind: 'MOUNT',
        origin_kind: 'WORLD',
        current_hit_points: null,
        temp_hit_points: null,
        custom_name: 'Storm',
        notes: null,
        is_active: true
      }
    ])
    expect(db.snapshot('character_vehicles')).toEqual([
      {
        id: 'character-vehicle-1',
        character_id: 'character-1',
        vehicle_id: 'vehicle-1',
        current_hit_points: null,
        custom_name: 'Dawnrunner',
        notes: null,
        is_active: null
      }
    ])
    expect(db.snapshot('character_creature_equipment')).toEqual([
      {
        character_id: 'character-1',
        character_creature_id: 'character-creature-1',
        equipment_id: 'inventory-1'
      }
    ])
    expect(db.snapshot('character_vehicle_equipment')).toEqual([
      {
        character_id: 'character-1',
        character_vehicle_id: 'character-vehicle-1',
        equipment_id: 'inventory-2'
      }
    ])
    expect(db.snapshot('character_hitpoint_state')).toEqual([
      {
        character_id: 'character-1',
        current: 9,
        temp: 2,
        max_override: null
      }
    ])
    expect(db.snapshot('character_resources')).toEqual([
      {
        character_id: 'character-1',
        resource_grant_id: 'resource-grant-1',
        used: 1
      }
    ])
    expect(db.snapshot('character_spell_slot_state')).toEqual([
      {
        character_id: 'character-1',
        slot_key: 'STANDARD:1',
        used: 1
      }
    ])
    expect(db.snapshot('character_conditions')).toEqual([
      {
        character_id: 'character-1',
        condition_type_id: 'condition-1',
        notes: 'Poisoned'
      }
    ])
    expect(db.snapshot('character_exhaustion')).toEqual([
      {
        character_id: 'character-1',
        level: 2,
        notes: 'Forced march'
      }
    ])
    expect(db.snapshot('character_note_groups')).toEqual([
      {
        id: 'note-group-session',
        character_id: 'character-1',
        label: 'Session Notes',
        sort_order: 0,
        kind: 'SESSION'
      }
    ])
    expect(db.snapshot('character_notes')).toEqual([
      {
        id: 'note-1',
        character_id: 'character-1',
        group_id: 'note-group-session',
        title: 'The Saltglass Ruins',
        body: 'The western gate bears an artificer sigil.',
        pinned: true,
        created_at: '2026-07-01T12:00:00.000Z',
        updated_at: '2026-07-02T15:30:00.000Z'
      }
    ])
    expect(db.snapshot('character_currency_groups')).toEqual([
      {
        id: 'currency-group-1',
        character_id: 'character-1',
        container_id: 'inventory-1'
      }
    ])
    expect(db.snapshot('character_currencies')).toEqual([
      {
        character_id: 'character-1',
        group_id: 'currency-group-1',
        currency_id: 'currency-1',
        amount: 50
      }
    ])

    const repository = createCharacterRepository(db as unknown as DBLike)
    const hydrated = await repository.findAuthoredById(initial.id)
    expect(hydrated?.state.inspiration).toBe(true)
    expect(hydrated?.state.noteGroups).toEqual(initial.state.noteGroups)
    expect(hydrated?.state.notes).toEqual(initial.state.notes)
    expect(hydrated?.state.currency).toEqual(initial.state.currency)

    await upsertCharacter(db as never, {
      ...initial,
      label: 'Aria Revised',
      description: undefined,
      profile: {
        alignmentId: 'alignment-2',
        notes: 'Updated note'
      },
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
              classId: 'class-2',
              classLevel: 1,
              value: 8
            }
          ]
        },
        startingEquipment: undefined,
        featureAcquisitions: [],
        chosenGrantSelections: undefined,
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
        resources: [],
        creatures: [],
        vehicles: [],
        creatureEquipment: {},
        vehicleEquipment: {}
      }
    })

    expect(db.snapshot('characters')).toEqual([
      {
        id: 'character-1',
        system_id: 'system-1',
        user_id: 'user-1',
        label: 'Aria Revised',
        description: null,
        status: 'DRAFT',
        inspiration: false,
        stream_version: 0
      }
    ])
    expect(db.snapshot('character_profile')).toEqual([
      {
        character_id: 'character-1',
        alignment_id: 'alignment-2',
        lifestyle_id: null,
        faith: null,
        gender: null,
        age: null,
        eyes: null,
        hair: null,
        skin: null,
        height: null,
        weight: null,
        physical_characteristics: null,
        personality_traits: null,
        ideals: null,
        bonds: null,
        flaws: null,
        organizations: null,
        allies: null,
        enemies: null,
        backstory: null,
        notes: 'Updated note'
      }
    ])
    expect(db.snapshot('character_feature_acquisitions')).toEqual([])
    expect(db.snapshot('character_feature_selection_records')).toEqual([])
    expect(db.snapshot('character_feature_selection_values')).toEqual([])
    expect(db.snapshot('character_chosen_grant_selections')).toEqual([])
    expect(db.snapshot('character_chosen_grant_selection_targets')).toEqual([])
    expect(db.snapshot('character_spell_selections')).toEqual([])
    expect(db.snapshot('character_spell_selection_spells')).toEqual([])
    expect(db.snapshot('character_resource_grants')).toEqual([])
    expect(db.snapshot('character_resources')).toEqual([])
    expect(db.snapshot('character_spell_slot_state')).toEqual([])
    expect(db.snapshot('character_conditions')).toEqual([])
    expect(db.snapshot('character_exhaustion')).toEqual([])
    expect(db.snapshot('character_note_groups')).toEqual([])
    expect(db.snapshot('character_notes')).toEqual([])
    expect(db.snapshot('character_equipment')).toEqual([])
    expect(db.snapshot('character_creatures')).toEqual([])
    expect(db.snapshot('character_vehicles')).toEqual([])
    expect(db.snapshot('character_creature_equipment')).toEqual([])
    expect(db.snapshot('character_vehicle_equipment')).toEqual([])
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

  it('persists and hydrates chosen grant selections with duplicate ordered targets', async () => {
    const db = new InMemoryDb()
    const character = buildCharacter()

    await upsertCharacter(db as unknown as DBLike, character)

    expect(db.snapshot('character_chosen_grant_selections')).toEqual([
      {
        id: 'chosen-grant-selection-1',
        character_id: 'character-1',
        grant_id: 'proficiency-grant-1',
        source_kind: 'CLASS',
        class_id: 'class-1',
        subclass_id: null,
        source_class_level: 3,
        race_id: null,
        subrace_id: null,
        ancestry_id: null,
        option_id: null,
        acquired_parent_id: null,
        background_id: null,
        feat_id: null,
        feature_id: null,
        reason: null,
        timing_kind: 'CLASS_LEVEL',
        timing_level: null,
        timing_class_id: 'class-1',
        timing_class_level: 3,
        progression_level: 3
      }
    ])
    expect(db.snapshot('character_chosen_grant_selection_targets')).toEqual([
      {
        selection_id: 'chosen-grant-selection-1',
        slot_index: 0,
        target_id: 'skill-arcana'
      },
      {
        selection_id: 'chosen-grant-selection-1',
        slot_index: 1,
        target_id: 'skill-arcana'
      },
      {
        selection_id: 'chosen-grant-selection-1',
        slot_index: 2,
        target_id: 'skill-history'
      }
    ])

    const repository = createCharacterRepository(db as unknown as DBLike)
    const hydrated = await repository.findAuthoredById(character.id)

    expect(hydrated?.intent.chosenGrantSelections).toEqual(character.intent.chosenGrantSelections)
  })

  it('rejects duplicate chosen grant selection identities before persistence', async () => {
    const db = new InMemoryDb()
    const character = buildCharacter()
    const existingSelection = character.intent.chosenGrantSelections?.[0]
    if (!existingSelection || existingSelection.source.kind !== 'CLASS') {
      throw new Error('class-owned chosen grant selection missing from test setup')
    }

    character.intent.chosenGrantSelections = [
      existingSelection,
      {
        ...existingSelection,
        id: 'chosen-grant-selection-duplicate',
        source: {
          ...existingSelection.source,
          classLevel: (existingSelection.source.classLevel ?? 1) + 1
        },
        timing: {
          kind: 'CLASS_LEVEL',
          classId: existingSelection.source.classId,
          classLevel: 5
        }
      }
    ]

    await expect(upsertCharacter(db as unknown as DBLike, character)).rejects.toThrow(
      /duplicate chosen grant selection identity/i
    )
    expect(db.snapshot('characters')).toEqual([])
  })

  it('rejects currency groups without stable identities', async () => {
    const db = new InMemoryDb()
    const character = buildCharacter()
    const currencyGroup = character.state.currency[0]
    if (!currencyGroup) throw new Error('currency group missing from test setup')

    await expect(
      upsertCharacter(
        db as unknown as DBLike,
        {
          ...character,
          state: {
            ...character.state,
            currency: [
              {
                ...currencyGroup,
                id: undefined
              }
            ]
          }
        } as unknown as CharacterAuthored
      )
    ).rejects.toThrow('Character character-1 has a currency group without an id.')
  })

  it('rejects notes that reference a missing note group', async () => {
    const db = new InMemoryDb()
    const character = buildCharacter()
    const note = character.state.notes?.[0]
    if (!note) throw new Error('note missing from test setup')

    await expect(
      upsertCharacter(db as unknown as DBLike, {
        ...character,
        state: {
          ...character.state,
          notes: [{ ...note, groupId: 'missing-note-group' }]
        }
      })
    ).rejects.toThrow(
      'Character character-1 note note-1 references missing note group missing-note-group.'
    )
  })

  it('increments stream version when requested for finalized authored writes', async () => {
    const db = new InMemoryDb()
    const initial = buildCharacter()

    await upsertCharacter(db as never, initial)
    await upsertCharacter(
      db as never,
      {
        ...initial,
        label: 'Aria Finalized'
      },
      {
        incrementStreamVersion: true
      }
    )

    expect(db.snapshot('characters')).toEqual([
      expect.objectContaining({
        id: 'character-1',
        label: 'Aria Finalized',
        inspiration: true,
        stream_version: 1
      })
    ])
  })

  it('patches Sheet-owned state without replacing Builder-owned authored data', async () => {
    const db = new InMemoryDb()
    const character = buildCharacter()
    await upsertCharacter(db as never, character)
    const profileBefore = db.snapshot('character_profile')
    const classesBefore = db.snapshot('character_classes')
    const repository = createCharacterRepository(db as unknown as DBLike)
    let callbackVersion: number | undefined

    const streamVersion = await repository.patchSheetState(
      character.id,
      [
        { kind: 'INSPIRATION', value: false },
        {
          kind: 'HITPOINTS',
          value: {
            current: 4,
            temp: 2,
            hitDice: [{ die: 8, total: 2, used: 1 }]
          }
        },
        {
          kind: 'CONDITIONS',
          value: [{ conditionTypeId: 'condition-2', notes: 'From a Sheet command' }]
        }
      ],
      {
        expectedStreamVersion: 0,
        afterPersist: async (_trx, nextStreamVersion) => {
          callbackVersion = nextStreamVersion
        }
      }
    )

    expect(streamVersion).toBe(1)
    expect(callbackVersion).toBe(1)
    expect(db.snapshot('character_profile')).toEqual(profileBefore)
    expect(db.snapshot('character_classes')).toEqual(classesBefore)
    expect(db.snapshot('characters')).toEqual([
      expect.objectContaining({ id: character.id, inspiration: false, stream_version: 1 })
    ])
    await expect(repository.findAuthoredById(character.id)).resolves.toEqual(
      expect.objectContaining({
        profile: character.profile,
        intent: character.intent,
        state: expect.objectContaining({
          inspiration: false,
          hitpoints: {
            current: 4,
            temp: 2,
            hitDice: [{ die: 8, total: 2, used: 1 }]
          },
          conditions: [{ conditionTypeId: 'condition-2', notes: 'From a Sheet command' }]
        })
      })
    )
  })

  it('rejects stale Sheet state patches before mutating state or appending history', async () => {
    const db = new InMemoryDb()
    const character = buildCharacter()
    await upsertCharacter(db as never, character)
    const repository = createCharacterRepository(db as unknown as DBLike)
    const hitpointsBefore = db.snapshot('character_hitpoint_state')
    const afterPersist = vi.fn()

    await expect(
      repository.patchSheetState(
        character.id,
        [
          {
            kind: 'HITPOINTS',
            value: { current: 1, hitDice: [] }
          }
        ],
        {
          expectedStreamVersion: 1,
          afterPersist
        }
      )
    ).rejects.toMatchObject({ name: 'ConcurrencyError' })

    expect(db.snapshot('character_hitpoint_state')).toEqual(hitpointsBefore)
    expect(afterPersist).not.toHaveBeenCalled()
  })

  it('throws for unsupported ancestry source discriminator from persisted character rows', async () => {
    const db = new InMemoryDb()
    const character = buildCharacter()

    await upsertCharacter(db as never, character)

    const ancestryRows = db.snapshot('character_ancestry_acquisitions')
    const existingAncestry = ancestryRows.find((row) => row.character_id === character.id)
    if (!existingAncestry) {
      throw new Error('character ancestry acquisition row missing in test setup')
    }

    await db
      .deleteFrom('character_ancestry_acquisitions')
      .where('id', '=', existingAncestry.id as string)
      .execute()

    await db
      .insertInto('character_ancestry_acquisitions')
      .values({ ...existingAncestry, source_kind: 'CUSTOM_ORIGIN' as string })
      .execute()

    const repository = createCharacterRepository(db as never)

    await expect(repository.findAuthoredById(character.id)).rejects.toThrow(
      'Unsupported ancestry source kind: CUSTOM_ORIGIN'
    )
  })

  it('throws for unsupported ancestry timing discriminator from persisted character rows', async () => {
    const db = new InMemoryDb()
    const character = buildCharacter()

    await upsertCharacter(db as never, character)

    const ancestryRows = db.snapshot('character_ancestry_acquisitions')
    const existingAncestry = ancestryRows.find((row) => row.character_id === character.id)
    if (!existingAncestry) {
      throw new Error('character ancestry acquisition row missing in test setup')
    }

    await db
      .deleteFrom('character_ancestry_acquisitions')
      .where('id', '=', existingAncestry.id as string)
      .execute()

    await db
      .insertInto('character_ancestry_acquisitions')
      .values({ ...existingAncestry, timing_kind: 'MILESTONE' as string })
      .execute()

    const repository = createCharacterRepository(db as never)

    await expect(repository.findAuthoredById(character.id)).rejects.toThrow(
      'Unsupported ancestry timing kind: MILESTONE'
    )
  })
})
