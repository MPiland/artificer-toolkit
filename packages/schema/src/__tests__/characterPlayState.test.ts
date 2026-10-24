import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  characterPlayStateSchema,
  mergeCharacterSheetStatePlay,
  mergeCharacterStatePlay,
  splitCharacterPlayState,
  type CharacterPersistedState
} from '../projections/characterPlayState.js'
import { characterStoredPlayStateSchema } from '../projections/characterPersistence.js'
import { readCharacterPlay } from '../projections/characterStoredState.js'
import { NO_DEATH_SAVES } from '../subjects/characterState.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

const text = fc.string({ maxLength: 12 })
const uuid = fc.uuid().map((value) => value.toLowerCase())
const count = fc.integer({ min: 0, max: 40 })

const hitDie = fc.record({ die: fc.constantFrom(6, 8, 10, 12), total: count, used: fc.constant(0) })
const state = fc.record(
  {
    equipment: fc.record({
      inventory: fc.array(
        fc.record(
          { id: text, equipmentId: text, quantity: count, notes: text },
          { requiredKeys: ['id', 'equipmentId', 'quantity'] }
        ),
        { maxLength: 4 }
      ),
      equipped: fc.uniqueArray(text, { maxLength: 4 }).map((itemIds) =>
        itemIds.map((itemId, position) => ({
          itemId,
          slot: (['MAIN_HAND', 'OFF_HAND'] as const)[position] ?? ('WORN' as const)
        }))
      ),
      attuned: fc.array(text, { maxLength: 3 })
    }),
    currency: fc.constant(new Array<never>()),
    hitpoints: fc.record(
      {
        current: count,
        temp: count,
        hitDice: fc.array(hitDie, { maxLength: 3 }),
        deathSaves: fc.constant(NO_DEATH_SAVES)
      },
      { requiredKeys: ['current', 'temp', 'hitDice', 'deathSaves'] }
    ),
    inspiration: fc.boolean(),
    classes: fc.array(fc.record({ classId: text }), { maxLength: 3 }),
    resources: fc.array(fc.record({ resourceGrantId: text, used: count }), { maxLength: 3 }),
    spellSlots: fc.array(fc.record({ slotKey: text, used: count }), { maxLength: 3 }),
    conditions: fc.array(fc.record({ conditionTypeId: text }), { maxLength: 3 }),
    exhaustion: fc.record({ level: fc.integer({ min: 0, max: 6 }) }),
    spellSummons: fc.array(
      fc.record({
        id: uuid,
        spellId: text,
        summonOutcomeId: text,
        label: fc.constant('Arcane Hand'),
        concentration: fc.boolean(),
        armorClass: fc.option(count, { nil: null }),
        maximumHitPoints: fc.constant(40),
        currentHitPoints: fc.integer({ min: 1, max: 40 }),
        castAt: fc.constant('2026-10-23T00:00:00.000Z')
      }),
      { maxLength: 2 }
    ),
    noteGroups: fc.array(
      fc.record({
        id: text,
        label: text,
        sortOrder: count,
        kind: fc.constantFrom('SESSION', 'LOOT', 'CHARACTERS', 'PLACES', 'CUSTOM')
      }),
      { maxLength: 2 }
    ),
    creatureEquipment: fc.dictionary(
      text,
      fc.array(fc.record({ equipmentItemId: text }), { maxLength: 2 }),
      {
        maxKeys: 2
      }
    )
  },
  { requiredKeys: ['equipment', 'currency', 'hitpoints'] }
)
const sheetState = fc.record({
  adjustments: fc.constant(new Array<never>()),
  movementDisplayPreference: fc.constant({ mode: 'AUTO' as const }),
  partyVisibility: fc.record({
    sheet: fc.boolean(),
    health: fc.constantFrom('HIDDEN' as const, 'EXACT' as const)
  }),
  resourceUsage: fc.array(
    fc.record({
      id: uuid,
      characterId: uuid,
      createdBy: uuid,
      updatedBy: uuid,
      createdAt: fc.constant('2026-01-01T00:00:00.000Z'),
      updatedAt: fc.constant('2026-01-01T00:00:00.000Z'),
      owner: fc.record({
        kind: fc.constant('AUTHORED_GRANT' as const),
        resourceGrantId: text
      }),
      used: count
    }),
    { maxLength: 3 }
  ),
  // Usage of rows the inventory no longer stores is pruned, so only an empty overlay round-trips here;
  // characterItemUsage.test.ts proves the overlay itself.
  itemUsage: fc.constant(new Array<never>()),
  itemDegradation: fc.constant(new Array<never>()),
  spellCustomizations: fc.constant(new Array<never>())
})

const persisted: fc.Arbitrary<CharacterPersistedState> = fc.record({ state, sheetState })

describe('Character play state split', () => {
  it('validates typed persisted state and rejects changed state with a stale checksum', () => {
    const state = {
      hitpoints: { current: 5, temp: 0, hitDice: [], deathSaves: NO_DEATH_SAVES },
      equipped: [],
      attuned: [],
      partyVisibility: { sheet: false, health: 'HIDDEN' as const },
      resourceUsage: [],
      itemUsage: [],
      itemDegradation: []
    }
    const stored = characterStoredPlayStateSchema.parse({
      characterId: '00000000-0000-4000-8000-000000000001',
      userId: '00000000-0000-4000-8000-000000000002',
      streamVersion: 1,
      maximumHitPoints: 10,
      speeds: [{ speedId: '00000000-0000-4000-8000-000000000003', amount: 30, unit: 'FEET' }],
      state,
      checksum: checksumRuleDocument(state),
      updatedAt: '2026-09-29T00:00:00.000Z'
    })
    expect(readCharacterPlay(stored)).toEqual(state)
    expect(() =>
      readCharacterPlay({
        ...stored,
        state: {
          ...state,
          hitpoints: { current: 4, temp: 0, hitDice: [], deathSaves: NO_DEATH_SAVES }
        }
      })
    ).toThrow('checksum mismatch')
    expect(
      characterStoredPlayStateSchema.safeParse({
        ...stored,
        state: { ...state, hitpoints: { current: '5', hitDice: [] } }
      }).success
    ).toBe(false)
  })

  it('merges back exactly what it split', () => {
    fc.assert(
      fc.property(persisted, (input) => {
        const { structure, play } = splitCharacterPlayState(input)
        expect({
          state: mergeCharacterStatePlay(structure.state, play),
          sheetState: mergeCharacterSheetStatePlay(structure.sheetState, play)
        }).toEqual(input)
      })
    )
  })

  it('keeps play and structure fields disjoint', () => {
    fc.assert(
      fc.property(persisted, (input) => {
        const { structure, play } = splitCharacterPlayState(input)
        const structureKeys = new Set([
          ...Object.keys(structure.state),
          ...Object.keys(structure.sheetState)
        ])
        for (const key of [
          'hitpoints',
          'inspiration',
          'resources',
          'spellSlots',
          'conditions',
          'exhaustion'
        ])
          expect(structureKeys.has(key)).toBe(false)
        expect(structureKeys.has('resourceUsage')).toBe(false)
        expect(structureKeys.has('itemUsage')).toBe(false)
        expect(structureKeys.has('itemDegradation')).toBe(false)
        expect(structureKeys.has('partyVisibility')).toBe(false)
        expect('equipped' in structure.state.equipment).toBe(false)
        expect('attuned' in structure.state.equipment).toBe(false)
        expect(Object.keys(play).every((key) => key in characterPlayStateSchema.shape)).toBe(true)
      })
    )
  })

  it('does not carry absent optional play fields as undefined keys', () => {
    const { play } = splitCharacterPlayState({
      state: {
        equipment: { inventory: [], equipped: [], attuned: [] },
        currency: [],
        hitpoints: { current: 5, temp: 0, hitDice: [], deathSaves: NO_DEATH_SAVES }
      },
      sheetState: {
        adjustments: [],
        movementDisplayPreference: { mode: 'AUTO' },
        partyVisibility: { sheet: false, health: 'HIDDEN' },
        resourceUsage: [],
        itemUsage: [],
        itemDegradation: [],
        spellCustomizations: []
      }
    })
    expect(Object.keys(play).sort()).toEqual([
      'attuned',
      'equipped',
      'hitpoints',
      'itemDegradation',
      'itemUsage',
      'partyVisibility',
      'resourceUsage'
    ])
  })
})
