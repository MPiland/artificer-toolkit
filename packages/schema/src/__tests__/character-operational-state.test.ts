import { expect, it } from 'vitest'
import { NO_DEATH_SAVES } from '../subjects/characterState.js'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { DEFAULT_CHARACTER_PARTY_VISIBILITY } from '../api/healthDisplay.js'
import { characterDocumentSchema } from '../projections/characterStoredState.js'
import {
  characterStoredHeadSchema,
  characterStoredRecordSchema
} from '../projections/characterPersistence.js'
import { splitCharacterPlayState } from '../projections/characterPlayState.js'
import {
  assembleCharacterStructure,
  encodeCharacterNoteRecords,
  encodeCharacterOperationalStructure,
  readCharacterBuildFields,
  readCharacterCollectionValues,
  readCharacterNoteState
} from '../projections/characterOperationalState.js'

const character = characterDocumentSchema.parse({
  id: '00000000-0000-4000-8000-000000000001',
  userId: '00000000-0000-4000-8000-000000000002',
  systemId: '00000000-0000-4000-8000-000000000003',
  label: 'Astra',
  status: 'ACTIVE',
  profile: { backstory: 'Private history' },
  intent: {
    advancement: { method: 'MILESTONE' },
    race: { raceId: 'elf' },
    background: { backgroundId: 'sage' },
    classes: [{ classId: 'wizard', classLevel: 1 }],
    abilities: { method: 'STANDARD_ARRAY', assignments: [] },
    hitpoints: {
      method: 'FIXED',
      levels: [{ level: 1, classId: 'wizard', classLevel: 1, value: 6 }]
    },
    featureAcquisitions: []
  },
  state: {
    equipment: {
      inventory: [
        { id: 'bag', equipmentId: 'backpack', quantity: 1 },
        { id: 'wand', equipmentId: 'wand', quantity: 1, containerId: 'bag' }
      ],
      equipped: [{ itemId: 'wand', slot: 'WORN' }],
      attuned: []
    },
    currency: [],
    hitpoints: { current: 6, temp: 0, hitDice: [], deathSaves: NO_DEATH_SAVES },
    classes: [{ classId: 'wizard', spells: { prepared: ['shield'] } }, { classId: 'wizard' }],
    noteGroups: [{ id: 'session', label: 'Session', sortOrder: 0, kind: 'SESSION' }],
    notes: [
      {
        id: 'note',
        title: 'Secret',
        groupId: 'session',
        body: 'Private',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01'
      }
    ],
    creatures: [
      {
        id: 'owl',
        creatureId: 'owl-source',
        relationshipKind: 'COMPANION',
        originKind: 'SUMMONED',
        currentHitPoints: 1
      }
    ],
    vehicles: [],
    creatureEquipment: { owl: [{ equipmentItemId: 'wand' }] },
    vehicleEquipment: {}
  }
})
const headFields = {
  id: character.id,
  userId: character.userId,
  systemId: character.systemId,
  label: character.label,
  status: character.status,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}

function capture(state: typeof character.state) {
  const { structure } = splitCharacterPlayState({
    state,
    sheetState: {
      adjustments: [],
      movementDisplayPreference: { mode: 'AUTO' },
      spellCustomizations: [],
      resourceUsage: [],
      itemUsage: [],
      itemDegradation: [],
      partyVisibility: DEFAULT_CHARACTER_PARTY_VISIBILITY
    }
  })
  const document = { ...character, state: structure.state }
  return characterStoredRecordSchema.parse({
    ...headFields,
    documentJson: canonicalizeRuleDocument(document),
    checksum: checksumRuleDocument(document),
    sheetStateChecksum: checksumRuleDocument(structure.sheetState),
    sheetState: {
      documentJson: canonicalizeRuleDocument(structure.sheetState),
      checksum: checksumRuleDocument(structure.sheetState)
    }
  })
}

/** The persisted head: identity only, without the capture's clock, structure and hashes. */
function storedHead(record: ReturnType<typeof capture>) {
  const {
    updatedAt: _updatedAt,
    documentJson: _documentJson,
    sheetState: _sheetState,
    checksum: _checksum,
    sheetStateChecksum: _sheetStateChecksum,
    ...head
  } = record
  return characterStoredHeadSchema.parse(head)
}

it('round-trips complete structures, ordered public IDs, relationships and absent/empty optional collections', () => {
  const {
    classes: _classes,
    notes: _notes,
    noteGroups: _noteGroups,
    creatures: _creatures,
    vehicles: _vehicles,
    creatureEquipment: _creatureEquipment,
    vehicleEquipment: _vehicleEquipment,
    ...minimal
  } = character.state
  for (const state of [
    character.state,
    minimal,
    {
      ...minimal,
      classes: [],
      notes: [],
      noteGroups: [],
      creatures: [],
      vehicles: [],
      creatureEquipment: {},
      vehicleEquipment: {}
    }
  ]) {
    const original = capture(state)
    const split = encodeCharacterOperationalStructure(original)
    expect(
      assembleCharacterStructure(storedHead(original), split.build, split.collections)
    ).toEqual(original)
    expect(split.build).not.toHaveProperty('documentJson')
    expect(split.collections.characterInventoryItems.map((row) => row.id)).toEqual(['bag', 'wand'])
  }
})

it('refuses corrupted build, missing/duplicated/reordered rows and foreign Character bindings', () => {
  const original = capture(character.state)
  const head = storedHead(original)
  const split = encodeCharacterOperationalStructure(original)
  expect(() =>
    assembleCharacterStructure(head, { ...split.build, profile: {} }, split.collections)
  ).toThrow('integrity')
  for (const inventory of [
    split.collections.characterInventoryItems.slice(1),
    split.collections.characterInventoryItems.slice(0, 1),
    [split.collections.characterInventoryItems[0]!, split.collections.characterInventoryItems[0]!],
    split.collections.characterInventoryItems.map((row) => ({
      ...row,
      characterId: crypto.randomUUID()
    })),
    split.collections.characterInventoryItems.map((row) => ({
      ...row,
      value: { ...row.value, quantity: 9 }
    }))
  ])
    expect(() =>
      assembleCharacterStructure(head, split.build, {
        ...split.collections,
        characterInventoryItems: inventory
      })
    ).toThrow(/integrity|checksum/)
  expect(characterStoredHeadSchema.safeParse({ ...head, documentJson: '{}' }).success).toBe(false)
  for (const field of ['checksum', 'sheetStateChecksum'] as const)
    expect(
      characterStoredHeadSchema.safeParse({ ...head, [field]: original.checksum }).success
    ).toBe(false)
  const miskeyed = split.collections.characterClassSpellStates.map((row) => {
    const { checksum: _checksum, ...fields } = row
    const altered = { ...fields, id: `wrong:${fields.id}` }
    return { ...altered, checksum: checksumRuleDocument(altered) }
  })
  expect(() =>
    assembleCharacterStructure(head, split.build, {
      ...split.collections,
      characterClassSpellStates: miskeyed
    })
  ).toThrow('identity')
})

it('detects missing tail and empty selected collections using checksummed counts', () => {
  const split = encodeCharacterOperationalStructure(capture(character.state))
  const fields = readCharacterBuildFields(character.id, split.build)
  const inventory = split.collections.characterInventoryItems
  expect(
    readCharacterCollectionValues(
      character.id,
      inventory,
      fields.collectionCounts.characterInventoryItems
    )
  ).toEqual(character.state.equipment.inventory)
  for (const rows of [inventory.slice(0, -1), []])
    expect(() =>
      readCharacterCollectionValues(
        character.id,
        rows,
        fields.collectionCounts.characterInventoryItems
      )
    ).toThrow('collection integrity')
  expect(() =>
    readCharacterBuildFields(character.id, {
      ...split.build,
      collectionCounts: { ...split.build.collectionCounts, characterInventoryItems: 0 }
    })
  ).toThrow('build integrity')
})

it('re-encodes a note edit exactly as the complete split does and leaves every other record alone', () => {
  const { notes, noteGroups, ...withoutNotes } = character.state
  const before = encodeCharacterOperationalStructure(capture(withoutNotes))
  for (const next of [{ notes, noteGroups }, { notes: [], noteGroups: [] }, {}]) {
    const focused = encodeCharacterNoteRecords(before.build, next, before.build.updatedAt)
    const complete = encodeCharacterOperationalStructure(capture({ ...withoutNotes, ...next }))
    expect(focused.build).toEqual(complete.build)
    expect(focused.collections).toEqual({
      characterNotes: complete.collections.characterNotes,
      characterNoteGroups: complete.collections.characterNoteGroups
    })
    expect(readCharacterNoteState(character.id, focused.build, focused.collections)).toEqual(next)
  }
})

it('refuses missing note rows, a foreign Character and rows for an absent note collection', () => {
  const split = encodeCharacterOperationalStructure(capture(character.state))
  const records = {
    characterNotes: split.collections.characterNotes,
    characterNoteGroups: split.collections.characterNoteGroups
  }
  expect(readCharacterNoteState(character.id, split.build, records)).toEqual({
    notes: character.state.notes,
    noteGroups: character.state.noteGroups
  })
  expect(() =>
    readCharacterNoteState(character.id, split.build, { ...records, characterNotes: [] })
  ).toThrow('collection integrity')
  expect(() => readCharacterNoteState(crypto.randomUUID(), split.build, records)).toThrow(
    'build integrity'
  )
  const { checksum: _checksum, ...fields } = split.build
  const absent = {
    ...fields,
    optionalStateKeys: fields.optionalStateKeys.filter((key) => key !== 'notes')
  }
  expect(() =>
    readCharacterNoteState(
      character.id,
      { ...absent, checksum: checksumRuleDocument(absent) },
      records
    )
  ).toThrow('optional collection')
})
