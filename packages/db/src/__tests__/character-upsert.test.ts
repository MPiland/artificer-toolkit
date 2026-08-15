import { describe, expect, it, vi } from 'vitest'
import type { DBLike } from '#types'
import { upsertCharacter } from '../domains/subjects/upserts/character.js'
import { createCharacterRepository } from '../domains/subjects/repositories/character.js'
import { createInventoryRepository } from '../repositories/inventory.js'
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

      if (lowered.includes('from inventory_items')) {
        const ownerId = values[0]
        const rows = await db
          .selectFrom('inventory_items')
          .selectAll()
          .where('owner_id', '=', ownerId)
          .execute()
        return { rows }
      }
      if (lowered.includes('from inventory_currency_balances')) {
        return { rows: [] }
      }

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

import { buildCharacter } from './character-upsert.test-helpers.js'

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
    expect(db.snapshot('inventory_items')).toEqual([
      {
        id: 'inventory-1',
        owner_id: 'character-1',
        equipment_id: 'equipment-a',
        quantity: 1,
        container_id: null,
        custom_name: null,
        notes: null,
        equipped: true,
        attuned: false,
        placement_kind: 'CREATURE',
        placement_id: 'character-creature-1'
      },
      {
        id: 'inventory-2',
        owner_id: 'character-1',
        equipment_id: 'equipment-b',
        quantity: 1,
        container_id: 'inventory-1',
        custom_name: null,
        notes: null,
        equipped: false,
        attuned: true,
        placement_kind: 'VEHICLE',
        placement_id: 'character-vehicle-1'
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
    expect(db.snapshot('inventory_currency_groups')).toEqual([
      {
        id: 'currency-group-1',
        owner_id: 'character-1',
        container_item_id: 'inventory-1'
      }
    ])
    expect(db.snapshot('inventory_currency_balances')).toEqual([
      {
        owner_id: 'character-1',
        group_id: 'currency-group-1',
        ruleset_currency_id: 'currency-1',
        campaign_denomination_id: null,
        amount: 50
      }
    ])
    expect(db.snapshot('character_equipment')).toEqual([])
    expect(db.snapshot('character_equipped')).toEqual([])
    expect(db.snapshot('character_attuned')).toEqual([])
    expect(db.snapshot('character_creature_equipment')).toEqual([])
    expect(db.snapshot('character_vehicle_equipment')).toEqual([])
    expect(db.snapshot('character_currency_groups')).toEqual([])
    expect(db.snapshot('character_currencies')).toEqual([])

    const repository = createCharacterRepository(db as unknown as DBLike)
    const hydrated = await repository.findAuthoredById(initial.id)
    expect(hydrated?.state.inspiration).toBe(true)
    expect(hydrated?.state.noteGroups).toEqual(initial.state.noteGroups)
    expect(hydrated?.state.notes).toEqual(initial.state.notes)
    expect(hydrated?.state.currency).toEqual(initial.state.currency)

    const inventoryRepository = createInventoryRepository(db as unknown as DBLike)
    await expect(
      inventoryRepository.getInventory({ kind: 'CHARACTER', characterId: initial.id })
    ).resolves.toMatchObject({
      items: [
        expect.objectContaining({ id: 'inventory-1', ownerId: 'character-1', quantity: 1 }),
        expect.objectContaining({ id: 'inventory-2', ownerId: 'character-1', quantity: 1 })
      ]
    })

    await db
      .insertInto('inventory_owners')
      .values({ id: 'campaign-owner', kind: 'CAMPAIGN', campaign_id: 'campaign-1' })
      .execute()
    await db
      .insertInto('inventory_items')
      .values({
        id: 'inventory-transferred',
        owner_id: 'campaign-owner',
        equipment_id: 'equipment-c',
        quantity: 2,
        container_id: null,
        custom_name: null,
        notes: null,
        equipped: false,
        attuned: false,
        placement_kind: null,
        placement_id: null
      })
      .execute()
    await db
      .deleteFrom('inventory_items')
      .where('owner_id', '=', 'campaign-owner')
      .where('id', '=', 'inventory-transferred')
      .execute()
    await db
      .insertInto('inventory_items')
      .values({
        id: 'inventory-transferred',
        owner_id: 'character-1',
        equipment_id: 'equipment-c',
        quantity: 2,
        container_id: null,
        custom_name: null,
        notes: null,
        equipped: false,
        attuned: false,
        placement_kind: null,
        placement_id: null
      })
      .execute()
    await expect(repository.findAuthoredById(initial.id)).resolves.toMatchObject({
      state: expect.objectContaining({
        equipment: expect.objectContaining({
          inventory: expect.arrayContaining([
            expect.objectContaining({ id: 'inventory-transferred', quantity: 2 })
          ])
        })
      })
    })

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
    expect(db.snapshot('inventory_items')).toEqual([])
    expect(db.snapshot('character_creatures')).toEqual([])
    expect(db.snapshot('character_vehicles')).toEqual([])
    expect(db.snapshot('character_creature_equipment')).toEqual([])
    expect(db.snapshot('character_vehicle_equipment')).toEqual([])
    expect(db.snapshot('character_equipped')).toEqual([])
    expect(db.snapshot('character_attuned')).toEqual([])
    expect(db.snapshot('character_currency_groups')).toEqual([])
    expect(db.snapshot('character_currencies')).toEqual([])
    expect(db.snapshot('inventory_currency_groups')).toEqual([])
    expect(db.snapshot('inventory_currency_balances')).toEqual([])
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
})
