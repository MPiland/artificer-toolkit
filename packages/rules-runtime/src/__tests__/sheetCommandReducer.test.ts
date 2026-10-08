import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characters'
import { createEmptyCharacterAuthored } from '@artificer-toolkit/shared/character'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { describe, expect, it } from 'vitest'
import type { CharacterDeathSaves } from '@artificer-toolkit/schema/shared/characterDeathSaves'
import { NO_DEATH_SAVES } from '@artificer-toolkit/schema/subjects/characterState'

import {
  applyCharacterSheetCommand,
  getNoteGroups,
  summarizeCharacterSheetCommand
} from '../character/sheetCommandReducer.js'
import {
  DND5E_SYSTEM_ID,
  DND5E_UNCONSCIOUS_CONDITION_DEFINITION_ID
} from '../systems/dnd5e/identity.js'

type Command = Parameters<typeof applyCharacterSheetCommand>[1]
type SheetExtra = CharacterSheetResponseDto['extras']['items'][number]
type Context = NonNullable<Parameters<typeof applyCharacterSheetCommand>[3]>

const ids = {
  character: '50000000-0000-4000-8000-000000000001',
  system: '50000000-0000-4000-8000-000000000002',
  user: '50000000-0000-4000-8000-000000000003',
  wolf: '50000000-0000-4000-8000-000000000004',
  boat: '50000000-0000-4000-8000-000000000005',
  saddle: '50000000-0000-4000-8000-000000000006',
  rope: '50000000-0000-4000-8000-000000000007',
  equipment: '50000000-0000-4000-8000-000000000008',
  missing: '50000000-0000-4000-8000-000000000009'
} as const

const created = '2026-09-26T10:00:00.000Z'
const edited = '2026-09-26T11:00:00.000Z'

function character(state: Partial<CharacterAuthored['state']> = {}): CharacterAuthored {
  const empty = createEmptyCharacterAuthored({
    id: ids.character,
    systemId: ids.system,
    userId: ids.user
  })
  return { ...empty, state: { ...empty.state, ...state } }
}

/** The smallest valid Sheet; the reducer reads only its extras for these commands. */
function sheet(extras: readonly SheetExtra[] = []): CharacterSheetResponseDto {
  return {
    meta: {
      characterId: ids.character,
      viewer: 'CHARACTER_OWNER',
      capabilities: {
        managePlayState: true,
        managePrivateNotes: true,
        manageInventory: true,
        openBuilder: true
      },
      systemId: ids.system,
      status: 'DRAFT',
      streamVersion: 1
    },
    identity: { label: 'Hero', classSummary: 'Ranger 3', totalLevel: 3 },
    overview: {
      abilities: [],
      facts: [],
      armorClass: 14,
      initiative: 2,
      initiativeRollMode: 'NORMAL',
      proficiencyBonus: 2,
      currentHitPoints: 20,
      maxHitPoints: 20,
      tempHitPoints: 0,
      maxHitPointsModifier: 0,
      maxHitPointsModifierAdjustmentId: null,
      maxHitPointsReductions: [],
      maxHitPointsOverride: null,
      savingThrows: [],
      skills: [],
      exhaustion: {
        label: 'Exhaustion',
        description: 'Exhaustion levels.',
        level: 0,
        minimumLevel: 0,
        maximumLevel: 6
      },
      conditions: [],
      hitDice: []
    },
    actions: { items: [] },
    resources: { items: [], hitDice: [] },
    spells: { saveDc: null, attackBonus: null, slots: [], activeGroups: [], spells: [] },
    inventory: { items: [], currencies: [] },
    extras: { kindOptions: [], originOptions: [], items: [...extras] },
    reference: {
      features: [],
      proficiencies: [],
      defenses: [],
      senses: [],
      conditionOptions: [],
      equipmentOptions: [],
      currencyOptions: []
    },
    notes: {}
  }
}

/**
 * A fixed clock and deterministic ids: each `createId` call returns the next `id-N`, counted by
 * `sequence`, which commands in one test share so their ids never collide.
 */
function context(
  input: {
    extraDefaults?: Context['extraDefaults']
    now?: string
    sequence?: { next: number }
  } = {}
): Context {
  const sequence = input.sequence ?? { next: 0 }
  return {
    ...(input.extraDefaults ? { extraDefaults: input.extraDefaults } : {}),
    createId: () => `id-${(sequence.next += 1)}`,
    now: () => input.now ?? created
  }
}

function apply(
  from: CharacterAuthored,
  command: Command,
  input: { sheet?: CharacterSheetResponseDto; context?: Context } = {}
) {
  return applyCharacterSheetCommand(
    from,
    command,
    input.sheet ?? sheet(),
    input.context ?? context()
  )
}

const base = { expectedVersion: 1 } as const

describe('Character Sheet notes', () => {
  it('creates a note in a built-in group by materializing that group once', () => {
    const sequence = { next: 0 }
    const first = apply(
      character(),
      {
        ...base,
        type: 'CREATE_NOTE',
        groupId: 'loot',
        title: 'Gold idol',
        body: 'Found in the crypt.',
        pinned: true
      },
      { context: context({ sequence }) }
    )
    expect(first.state.noteGroups).toEqual([
      { id: 'id-1', label: 'Loot', sortOrder: 1, kind: 'LOOT' }
    ])
    expect(first.state.notes).toEqual([
      {
        id: 'id-2',
        title: 'Gold idol',
        body: 'Found in the crypt.',
        groupId: 'id-1',
        pinned: true,
        createdAt: created,
        updatedAt: created
      }
    ])
    // A second note in "loot" reuses the materialized group; a blank body and unpinned are omitted.
    const second = apply(
      first,
      { ...base, type: 'CREATE_NOTE', groupId: 'loot', title: 'Silver key', body: '   ' },
      { context: context({ sequence, now: edited }) }
    )
    expect(second.state.noteGroups).toEqual(first.state.noteGroups)
    expect(second.state.notes?.[1]).toStrictEqual({
      id: 'id-3',
      title: 'Silver key',
      body: undefined,
      groupId: 'id-1',
      pinned: undefined,
      createdAt: edited,
      updatedAt: edited
    })
    expect(getNoteGroups(second).map((group) => [group.id, group.label])).toEqual([
      ['session-notes', 'Session Notes'],
      ['id-1', 'Loot'],
      ['characters', 'Characters'],
      ['places', 'Places']
    ])
  })

  it('refuses a note in an unknown group', () => {
    expect(() =>
      apply(character(), { ...base, type: 'CREATE_NOTE', groupId: 'nowhere', title: 'Lost' })
    ).toThrow('Note group "nowhere" was not found.')
  })

  it('edits and moves a note, keeping its creation time and clearing a null body', () => {
    const withGroups = character({
      noteGroups: [{ id: 'villains', label: 'Villains', sortOrder: 4, kind: 'CUSTOM' }],
      notes: [
        {
          id: 'note',
          title: 'Old title',
          body: 'Old body',
          groupId: 'villains',
          createdAt: created,
          updatedAt: created
        }
      ]
    })
    const editedNote = apply(
      withGroups,
      {
        ...base,
        type: 'UPDATE_NOTE',
        noteId: 'note',
        title: 'The Baron',
        body: null,
        pinned: true
      },
      { context: context({ now: edited }) }
    )
    expect(editedNote.state.notes).toStrictEqual([
      {
        id: 'note',
        title: 'The Baron',
        body: undefined,
        groupId: 'villains',
        pinned: true,
        createdAt: created,
        updatedAt: edited
      }
    ])
    const moved = apply(editedNote, {
      ...base,
      type: 'UPDATE_NOTE',
      noteId: 'note',
      groupId: 'characters'
    })
    expect(moved.state.noteGroups).toEqual([
      { id: 'villains', label: 'Villains', sortOrder: 4, kind: 'CUSTOM' },
      { id: 'id-1', label: 'Characters', sortOrder: 2, kind: 'CHARACTERS' }
    ])
    expect(moved.state.notes?.[0]).toMatchObject({ title: 'The Baron', groupId: 'id-1' })
    expect(() =>
      apply(withGroups, { ...base, type: 'UPDATE_NOTE', noteId: 'missing', title: 'x' })
    ).toThrow('Note was not found.')
  })

  it('deletes a note and refuses an unknown one', () => {
    const withNote = character({
      notes: [
        { id: 'note', title: 'Gone', groupId: 'loot', createdAt: created, updatedAt: created }
      ]
    })
    expect(apply(withNote, { ...base, type: 'DELETE_NOTE', noteId: 'note' }).state.notes).toEqual(
      []
    )
    expect(() => apply(withNote, { ...base, type: 'DELETE_NOTE', noteId: 'missing' })).toThrow(
      'Note was not found.'
    )
  })

  it('appends custom groups after the built-ins and renames or reorders them', () => {
    const sequence = { next: 0 }
    const one = apply(
      character(),
      { ...base, type: 'CREATE_NOTE_GROUP', label: 'Villains' },
      { context: context({ sequence }) }
    )
    const two = apply(
      one,
      { ...base, type: 'CREATE_NOTE_GROUP', label: 'Rumours' },
      { context: context({ sequence }) }
    )
    expect(two.state.noteGroups).toEqual([
      { id: 'id-1', label: 'Villains', sortOrder: 4, kind: 'CUSTOM' },
      { id: 'id-2', label: 'Rumours', sortOrder: 5, kind: 'CUSTOM' }
    ])
    const renamed = apply(one, {
      ...base,
      type: 'UPDATE_NOTE_GROUP',
      groupId: 'id-1',
      label: 'Enemies',
      sortOrder: 0
    })
    expect(renamed.state.noteGroups).toEqual([
      { id: 'id-1', label: 'Enemies', sortOrder: 0, kind: 'CUSTOM' }
    ])
    // Renaming a built-in group materializes it under its kind.
    expect(
      apply(character(), {
        ...base,
        type: 'UPDATE_NOTE_GROUP',
        groupId: 'places',
        label: 'Locations'
      }).state.noteGroups
    ).toEqual([{ id: 'id-1', label: 'Locations', sortOrder: 3, kind: 'PLACES' }])
  })

  it('deletes only an empty custom group', () => {
    const withGroup = character({
      noteGroups: [{ id: 'villains', label: 'Villains', sortOrder: 4, kind: 'CUSTOM' }],
      notes: [
        { id: 'note', title: 'Baron', groupId: 'villains', createdAt: created, updatedAt: created }
      ]
    })
    expect(() =>
      apply(withGroup, { ...base, type: 'DELETE_NOTE_GROUP', groupId: 'villains' })
    ).toThrow('Move or delete the notes in this group first.')
    expect(() =>
      apply(withGroup, { ...base, type: 'DELETE_NOTE_GROUP', groupId: 'session-notes' })
    ).toThrow('Built-in note groups cannot be deleted.')
    const emptied = apply(withGroup, { ...base, type: 'DELETE_NOTE', noteId: 'note' })
    expect(
      apply(emptied, { ...base, type: 'DELETE_NOTE_GROUP', groupId: 'villains' }).state.noteGroups
    ).toEqual([])
  })

  it('summarizes note and group commands', () => {
    const commands: Command[] = [
      { ...base, type: 'CREATE_NOTE', groupId: 'loot', title: 'Gold idol' },
      { ...base, type: 'UPDATE_NOTE', noteId: 'note' },
      { ...base, type: 'DELETE_NOTE', noteId: 'note' },
      { ...base, type: 'CREATE_NOTE_GROUP', label: 'Villains' },
      { ...base, type: 'UPDATE_NOTE_GROUP', groupId: 'villains' },
      { ...base, type: 'DELETE_NOTE_GROUP', groupId: 'villains' }
    ]
    expect(commands.map((command) => summarizeCharacterSheetCommand(command))).toEqual([
      'Note "Gold idol" created',
      'Note updated',
      'Note deleted',
      'Note group "Villains" created',
      'Note group updated',
      'Note group deleted'
    ])
  })
})

const extraDefaults = {
  creatures: new Map([[ids.wolf, { hitPoints: 11, hitDice: { count: 2, die: 8 } }]]),
  vehicles: new Map([[ids.boat, { hitPoints: 50 }]])
}

const wolfOnSheet: SheetExtra = {
  id: 'wolf-extra',
  kind: 'COMPANION',
  kindLabel: 'Companion',
  authoredName: 'Wolf',
  displayName: 'Wolf',
  isActive: true,
  actions: [],
  features: [],
  equipmentItemIds: [],
  creatureId: ids.wolf,
  relationshipKind: 'COMPANION',
  relationshipLabel: 'Companion',
  originKind: 'WORLD',
  originLabel: 'World',
  armorClass: 13,
  hitPoints: { current: 11, maximum: 11, temp: 0 },
  hitDice: [{ die: 8, total: 2, used: 0, remaining: 2 }]
}
const boatOnSheet: SheetExtra = {
  id: 'boat-extra',
  kind: 'VEHICLE',
  kindLabel: 'Vehicle',
  authoredName: 'Rowboat',
  displayName: 'Rowboat',
  isActive: true,
  actions: [],
  features: [],
  equipmentItemIds: [],
  vehicleId: ids.boat,
  categoryLabel: 'Waterborne',
  hitPoints: { current: 50, maximum: 50 }
}

function withExtras(state: Partial<CharacterAuthored['state']> = {}) {
  return character({
    equipment: {
      inventory: [
        { id: ids.saddle, equipmentId: ids.equipment, quantity: 1 },
        { id: ids.rope, equipmentId: ids.equipment, quantity: 1 }
      ],
      equipped: [],
      attuned: []
    },
    creatures: [
      {
        id: 'wolf-extra',
        creatureId: ids.wolf,
        relationshipKind: 'COMPANION',
        originKind: 'WORLD',
        isActive: true,
        currentHitPoints: 11,
        hitDice: [{ die: 8, total: 2, used: 0 }]
      }
    ],
    vehicles: [{ id: 'boat-extra', vehicleId: ids.boat, isActive: true, currentHitPoints: 50 }],
    ...state
  })
}

const extrasSheet = sheet([wolfOnSheet, boatOnSheet])

function update(
  from: CharacterAuthored,
  extra: Extract<Command, { type: 'UPDATE_SHEET_EXTRA' }>['extra']
) {
  return apply(from, { ...base, type: 'UPDATE_SHEET_EXTRA', extra }, { sheet: extrasSheet })
}

describe('Character Sheet extras', () => {
  it('adds a creature and a vehicle at their catalog defaults', () => {
    const added = apply(
      character(),
      {
        ...base,
        type: 'ADD_SHEET_EXTRA',
        extra: { kind: 'COMPANION', creatureId: ids.wolf, originKind: 'SUMMONED' }
      },
      { context: context({ extraDefaults }) }
    )
    expect(added.state.creatures).toStrictEqual([
      {
        id: 'id-1',
        creatureId: ids.wolf,
        relationshipKind: 'COMPANION',
        originKind: 'SUMMONED',
        isActive: true,
        currentHitPoints: 11,
        hitDice: [{ die: 8, total: 2, used: 0 }]
      }
    ])
    expect(
      apply(
        character(),
        { ...base, type: 'ADD_SHEET_EXTRA', extra: { kind: 'VEHICLE', vehicleId: ids.boat } },
        { context: context({ extraDefaults }) }
      ).state.vehicles
    ).toStrictEqual([{ id: 'id-1', vehicleId: ids.boat, isActive: true, currentHitPoints: 50 }])
  })

  it('adds an extra without catalog defaults at zero hit points and never below zero', () => {
    expect(
      apply(character(), {
        ...base,
        type: 'ADD_SHEET_EXTRA',
        extra: { kind: 'MOUNT', creatureId: ids.wolf, originKind: 'WORLD' }
      }).state.creatures
    ).toStrictEqual([
      {
        id: 'id-1',
        creatureId: ids.wolf,
        relationshipKind: 'MOUNT',
        originKind: 'WORLD',
        isActive: true,
        currentHitPoints: 0,
        hitDice: undefined
      }
    ])
    const negative = {
      creatures: new Map([[ids.wolf, { hitPoints: -4 }]]),
      vehicles: new Map([[ids.boat, {}]])
    }
    const added = [
      { kind: 'OWNED' as const, creatureId: ids.wolf, originKind: 'WORLD' as const },
      { kind: 'VEHICLE' as const, vehicleId: ids.boat }
    ].reduce(
      (current, extra) =>
        apply(
          current,
          { ...base, type: 'ADD_SHEET_EXTRA', extra },
          { context: context({ extraDefaults: negative }) }
        ),
      character()
    )
    expect(added.state.creatures?.[0]?.currentHitPoints).toBe(0)
    expect(added.state.vehicles?.[0]?.currentHitPoints).toBe(0)
  })

  it('updates a creature, clamping hit points to its Sheet maximum and used hit dice to the total', () => {
    const updated = update(withExtras(), {
      kind: 'COMPANION',
      extraId: 'wolf-extra',
      customName: 'Fang',
      notes: 'Loyal.',
      isActive: false,
      currentHitPoints: 99,
      tempHitPoints: 5,
      hitDice: [{ die: 8, total: 2, used: 5 }]
    })
    expect(updated.state.creatures).toStrictEqual([
      {
        id: 'wolf-extra',
        creatureId: ids.wolf,
        relationshipKind: 'COMPANION',
        originKind: 'WORLD',
        isActive: false,
        currentHitPoints: 11,
        tempHitPoints: 5,
        customName: 'Fang',
        notes: 'Loyal.',
        hitDice: [{ die: 8, total: 2, used: 2 }]
      }
    ])
    // null clears the custom name and notes; omitted fields keep their values.
    const cleared = update(updated, {
      kind: 'COMPANION',
      extraId: 'wolf-extra',
      customName: null,
      notes: null
    })
    expect(cleared.state.creatures?.[0]).toStrictEqual({
      ...updated.state.creatures![0]!,
      customName: undefined,
      notes: undefined
    })
  })

  it('clamps a vehicle to its Sheet maximum', () => {
    expect(
      update(withExtras(), { kind: 'VEHICLE', extraId: 'boat-extra', currentHitPoints: 99 }).state
        .vehicles
    ).toStrictEqual([
      {
        id: 'boat-extra',
        vehicleId: ids.boat,
        isActive: true,
        currentHitPoints: 50,
        customName: undefined,
        notes: undefined
      }
    ])
  })

  it('assigns inventory to one extra at a time', () => {
    const assigned = update(withExtras(), {
      kind: 'COMPANION',
      extraId: 'wolf-extra',
      equipmentItemIds: [ids.saddle, ids.saddle]
    })
    expect(assigned.state.creatureEquipment).toEqual({
      'wolf-extra': [{ equipmentItemId: ids.saddle }]
    })
    // Reassigning the same extra's own items is allowed and replaces its list.
    expect(
      update(assigned, {
        kind: 'COMPANION',
        extraId: 'wolf-extra',
        equipmentItemIds: [ids.saddle, ids.rope]
      }).state.creatureEquipment
    ).toEqual({
      'wolf-extra': [{ equipmentItemId: ids.saddle }, { equipmentItemId: ids.rope }]
    })
    expect(() =>
      update(assigned, { kind: 'VEHICLE', extraId: 'boat-extra', equipmentItemIds: [ids.saddle] })
    ).toThrow(`Inventory item "${ids.saddle}" is already assigned to another extra.`)
    expect(() =>
      update(withExtras(), {
        kind: 'COMPANION',
        extraId: 'wolf-extra',
        equipmentItemIds: [ids.missing]
      })
    ).toThrow(`Inventory item "${ids.missing}" is not available on this character.`)
    // An empty list clears the extra's assignments.
    expect(
      update(assigned, { kind: 'COMPANION', extraId: 'wolf-extra', equipmentItemIds: [] }).state
        .creatureEquipment
    ).toEqual({ 'wolf-extra': [] })
  })

  it('refuses an extra that is missing or of another relationship kind', () => {
    expect(() => update(withExtras(), { kind: 'COMPANION', extraId: 'nope' })).toThrow(
      'Creature "nope" is not available.'
    )
    expect(() => update(withExtras(), { kind: 'MOUNT', extraId: 'wolf-extra' })).toThrow(
      'Creature "wolf-extra" is not available.'
    )
    expect(() => update(withExtras(), { kind: 'VEHICLE', extraId: 'wolf-extra' })).toThrow(
      'Vehicle "wolf-extra" is not available.'
    )
    expect(() =>
      apply(withExtras(), {
        ...base,
        type: 'REMOVE_SHEET_EXTRA',
        extra: { kind: 'OWNED', extraId: 'wolf-extra' }
      })
    ).toThrow('Creature "wolf-extra" is not available.')
    expect(() =>
      apply(withExtras(), {
        ...base,
        type: 'REMOVE_SHEET_EXTRA',
        extra: { kind: 'VEHICLE', extraId: 'nope' }
      })
    ).toThrow('Vehicle "nope" is not available.')
  })

  it('removes an extra together with its equipment assignments', () => {
    const assigned = withExtras({
      creatureEquipment: { 'wolf-extra': [{ equipmentItemId: ids.saddle }] },
      vehicleEquipment: { 'boat-extra': [{ equipmentItemId: ids.rope }] }
    })
    const withoutWolf = apply(assigned, {
      ...base,
      type: 'REMOVE_SHEET_EXTRA',
      extra: { kind: 'COMPANION', extraId: 'wolf-extra' }
    })
    expect(withoutWolf.state.creatures).toEqual([])
    expect(withoutWolf.state.creatureEquipment).toEqual({})
    expect(withoutWolf.state.vehicleEquipment).toEqual(assigned.state.vehicleEquipment)
    const withoutBoat = apply(withoutWolf, {
      ...base,
      type: 'REMOVE_SHEET_EXTRA',
      extra: { kind: 'VEHICLE', extraId: 'boat-extra' }
    })
    expect(withoutBoat.state.vehicles).toEqual([])
    expect(withoutBoat.state.vehicleEquipment).toEqual({})
  })

  it('summarizes extra commands by kind', () => {
    const commands: Command[] = [
      {
        ...base,
        type: 'ADD_SHEET_EXTRA',
        extra: { kind: 'COMPANION', creatureId: ids.wolf, originKind: 'WORLD' }
      },
      { ...base, type: 'ADD_SHEET_EXTRA', extra: { kind: 'VEHICLE', vehicleId: ids.boat } },
      { ...base, type: 'UPDATE_SHEET_EXTRA', extra: { kind: 'MOUNT', extraId: ids.wolf } },
      { ...base, type: 'UPDATE_SHEET_EXTRA', extra: { kind: 'VEHICLE', extraId: ids.boat } },
      { ...base, type: 'REMOVE_SHEET_EXTRA', extra: { kind: 'OWNED', extraId: ids.wolf } },
      { ...base, type: 'REMOVE_SHEET_EXTRA', extra: { kind: 'VEHICLE', extraId: ids.boat } }
    ]
    expect(commands.map((command) => summarizeCharacterSheetCommand(command))).toEqual([
      'Creature added',
      'Vehicle added',
      'Creature updated',
      'Vehicle updated',
      'Creature removed',
      'Vehicle removed'
    ])
  })
})

describe('Character Sheet hit points at 0 (D63)', () => {
  const dnd = { ...character(), systemId: DND5E_SYSTEM_ID }
  const at = (current: number, conditions: { conditionTypeId: string }[] = []) => ({
    ...dnd,
    state: { ...dnd.state, hitpoints: { ...dnd.state.hitpoints, current }, conditions }
  })
  const unconscious = { conditionTypeId: DND5E_UNCONSCIOUS_CONDITION_DEFINITION_ID }

  it('makes a D&D Character unconscious when damage or an edit drops it to 0', () => {
    expect(
      apply(at(5), { ...base, type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount: 9 }).state
        .conditions
    ).toEqual([unconscious])
    expect(apply(at(5), { ...base, type: 'SET_HIT_POINTS', current: 0 }).state.conditions).toEqual([
      unconscious
    ])
  })

  it('wakes it when it regains hit points from 0', () => {
    expect(
      apply(at(0, [unconscious]), { ...base, type: 'ADJUST_HIT_POINTS', mode: 'HEAL', amount: 3 })
        .state.conditions ?? []
    ).toEqual([])
  })

  it('adds nothing for a System without a 0 hit point condition', () => {
    const other = character({ hitpoints: { ...character().state.hitpoints, current: 5 } })
    expect(
      apply(other, { ...base, type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount: 9 }).state
        .conditions ?? []
    ).toEqual([])
  })
})

describe('Character Sheet dying and death (D96)', () => {
  const dnd = { ...character(), systemId: DND5E_SYSTEM_ID }
  const dying = { successes: 1, failures: 1, stable: false }
  const dead = { successes: 0, failures: 3, stable: false }
  const at = (current: number, deathSaves: CharacterDeathSaves = NO_DEATH_SAVES) => ({
    ...dnd,
    state: { ...dnd.state, hitpoints: { ...dnd.state.hitpoints, current, deathSaves } }
  })
  const damage = (character: ReturnType<typeof at>, amount: number) =>
    apply(character, { ...base, type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount }).state.hitpoints
      .deathSaves

  it('leaves a Character dropped to 0 dying, and kills it by massive damage', () => {
    expect(damage(at(5), 24)).toEqual(NO_DEATH_SAVES)
    expect(damage(at(5), 25)).toEqual(dead)
  })

  it('adds a failure for damage at 0 and kills at the maximum', () => {
    expect(damage(at(0, dying), 3)).toEqual({ successes: 1, failures: 2, stable: false })
    expect(damage(at(0), 20)).toEqual(dead)
  })

  it('resets the saves when a dying Character is healed, and a Sheet edit revives a dead one', () => {
    const heal = (character: ReturnType<typeof at>) =>
      apply(character, { ...base, type: 'ADJUST_HIT_POINTS', mode: 'HEAL', amount: 4 }).state
        .hitpoints
    expect(heal(at(0, dying))).toMatchObject({ current: 4, deathSaves: NO_DEATH_SAVES })
    expect(heal(at(0, dead))).toMatchObject({ current: 4, deathSaves: NO_DEATH_SAVES })
  })

  it('revives a dead Character with a hit point edit above 0 and applies damage rules below', () => {
    const set = (character: ReturnType<typeof at>, current: number) =>
      apply(character, { ...base, type: 'SET_HIT_POINTS', current }).state.hitpoints
    expect(set(at(0, dead), 6)).toMatchObject({ current: 6, deathSaves: NO_DEATH_SAVES })
    expect(set(at(0, dying), 0).deathSaves).toEqual(dying)
  })
})
