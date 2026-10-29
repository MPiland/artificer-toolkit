import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { z } from '../zod.js'
import type {
  characterStoredHeadSchema,
  characterStoredRecordSchema
} from './characterPersistence.js'
import {
  characterNoteGroupStateDtoSchema,
  characterNoteStateDtoSchema
} from '../subjects/characterState.js'
import {
  characterStoredBuildStateSchema,
  characterOptionalStateKeySchema,
  type CharacterCollectionRecords,
  type CharacterStoredBuildState
} from './characterOperationalRecords.js'
import {
  characterStructureDocumentSchema,
  readCharacterSheetStructure
} from './characterStoredState.js'

type CharacterHead = z.infer<typeof characterStoredHeadSchema>
type CharacterCapture = z.infer<typeof characterStoredRecordSchema>
type OptionalStateKey = z.infer<typeof characterOptionalStateKeySchema>
const optionalStateKeys: OptionalStateKey[] = [
  'classes',
  'noteGroups',
  'notes',
  'creatures',
  'vehicles',
  'creatureEquipment',
  'vehicleEquipment'
]

/** One owned collection record with its integrity checksum. */
export function characterCollectionRecord<Value>(
  characterId: string,
  id: string,
  position: number,
  value: Value
) {
  const fields = { characterId, id, position, value }
  return { ...fields, checksum: checksumRuleDocument(fields) }
}

/** Splits a validated complete structure capture into the mutable operational records. */
export function encodeCharacterOperationalStructure(capture: CharacterCapture): {
  build: CharacterStoredBuildState
  collections: CharacterCollectionRecords
} {
  const raw: unknown = JSON.parse(capture.documentJson)
  if (checksumRuleDocument(raw) !== capture.checksum)
    throw new Error('Stored Character checksum mismatch.')
  const document = characterStructureDocumentSchema.parse(raw)
  if (
    document.id !== capture.id ||
    document.userId !== capture.userId ||
    document.systemId !== capture.systemId ||
    document.label !== capture.label ||
    document.status !== capture.status
  )
    throw new Error('Stored Character identity mismatch.')
  const sheet = readCharacterSheetStructure(capture.sheetState)
  const { state } = document
  const collections: CharacterCollectionRecords = {
    characterInventoryItems: state.equipment.inventory.map((value, position) =>
      characterCollectionRecord(capture.id, value.id, position, value)
    ),
    characterCurrencyGroups: state.currency.map((value, position) =>
      characterCollectionRecord(capture.id, value.id, position, value)
    ),
    // Class state has no instance ID; its existing array position identifies its record.
    characterClassSpellStates: (state.classes ?? []).map((value, position) =>
      characterCollectionRecord(capture.id, String(position), position, value)
    ),
    characterSpellCustomizations: sheet.spellCustomizations.map((value, position) =>
      characterCollectionRecord(capture.id, value.id, position, value)
    ),
    characterCreatureInstances: (state.creatures ?? []).map((value, position) =>
      characterCollectionRecord(capture.id, value.id, position, value)
    ),
    characterVehicleInstances: (state.vehicles ?? []).map((value, position) =>
      characterCollectionRecord(capture.id, value.id, position, value)
    ),
    characterNotes: (state.notes ?? []).map((value, position) =>
      characterCollectionRecord(capture.id, value.id, position, value)
    ),
    characterNoteGroups: (state.noteGroups ?? []).map((value, position) =>
      characterCollectionRecord(capture.id, value.id, position, value)
    ),
    characterExtraEquipment: [
      ...Object.entries(state.creatureEquipment ?? {}).map(([instanceId, assignments]) => ({
        kind: 'CREATURE' as const,
        instanceId,
        equipmentItemIds: assignments.map((item) => item.equipmentItemId)
      })),
      ...Object.entries(state.vehicleEquipment ?? {}).map(([instanceId, assignments]) => ({
        kind: 'VEHICLE' as const,
        instanceId,
        equipmentItemIds: assignments.map((item) => item.equipmentItemId)
      }))
    ].map((value, position) =>
      characterCollectionRecord(capture.id, `${value.kind}:${value.instanceId}`, position, value)
    )
  }
  const fields = {
    characterId: capture.id,
    updatedAt: capture.updatedAt,
    ...(document.description === undefined ? {} : { description: document.description }),
    profile: document.profile,
    intent: document.intent,
    adjustments: sheet.adjustments,
    movementDisplayPreference: sheet.movementDisplayPreference,
    optionalStateKeys: optionalStateKeys.filter((key) => document.state[key] !== undefined),
    collectionCounts: {
      characterInventoryItems: collections.characterInventoryItems.length,
      characterCurrencyGroups: collections.characterCurrencyGroups.length,
      characterClassSpellStates: collections.characterClassSpellStates.length,
      characterSpellCustomizations: collections.characterSpellCustomizations.length,
      characterCreatureInstances: collections.characterCreatureInstances.length,
      characterVehicleInstances: collections.characterVehicleInstances.length,
      characterNotes: collections.characterNotes.length,
      characterNoteGroups: collections.characterNoteGroups.length,
      characterExtraEquipment: collections.characterExtraEquipment.length
    }
  }
  return {
    build: characterStoredBuildStateSchema.parse({
      ...fields,
      checksum: checksumRuleDocument(fields)
    }),
    collections
  }
}

/** Focused reads validate every selected owned row without assembling unrelated collections. */
export function readCharacterCollectionValues<Value>(
  characterId: string,
  rows: readonly {
    characterId: string
    id: string
    position: number
    value: Value
    checksum: string
  }[],
  expectedCount: number
): Value[] {
  if (rows.length !== expectedCount)
    throw new Error('Stored Character collection integrity mismatch.')
  const ids = new Set<string>()
  return [...rows]
    .sort((left, right) => left.position - right.position)
    .map((row, position) => {
      const fields = {
        characterId: row.characterId,
        id: row.id,
        position: row.position,
        value: row.value
      }
      if (
        row.characterId !== characterId ||
        row.position !== position ||
        ids.has(row.id) ||
        (row.value !== null &&
          typeof row.value === 'object' &&
          'id' in row.value &&
          row.value.id !== row.id) ||
        checksumRuleDocument(fields) !== row.checksum
      )
        throw new Error('Stored Character collection integrity mismatch.')
      ids.add(row.id)
      return row.value
    })
}

export function readCharacterBuildFields(characterId: string, build: CharacterStoredBuildState) {
  const { checksum, ...fields } = characterStoredBuildStateSchema.parse(build)
  if (fields.characterId !== characterId || checksumRuleDocument(fields) !== checksum)
    throw new Error('Stored Character build integrity mismatch.')
  return fields
}

type NoteState = {
  notes?: CharacterCollectionRecords['characterNotes'][number]['value'][]
  noteGroups?: CharacterCollectionRecords['characterNoteGroups'][number]['value'][]
}
type NoteRecords = Pick<CharacterCollectionRecords, 'characterNotes' | 'characterNoteGroups'>

/** A note edit's focused read: the verified build counts and only the note and group records. */
export function readCharacterNoteState(
  characterId: string,
  build: CharacterStoredBuildState,
  records: NoteRecords
): NoteState {
  const fields = readCharacterBuildFields(characterId, build)
  const notes = readCharacterCollectionValues(
    characterId,
    records.characterNotes,
    fields.collectionCounts.characterNotes
  )
  const noteGroups = readCharacterCollectionValues(
    characterId,
    records.characterNoteGroups,
    fields.collectionCounts.characterNoteGroups
  )
  const present = (key: 'notes' | 'noteGroups', values: unknown[]) => {
    if (fields.optionalStateKeys.includes(key)) return true
    if (values.length) throw new Error('Stored Character optional collection mismatch.')
    return false
  }
  return {
    ...(present('notes', notes) ? { notes } : {}),
    ...(present('noteGroups', noteGroups) ? { noteGroups } : {})
  }
}

/** The build and note records after a note edit, with the structure clock at `updatedAt`; every other build field and record is untouched. */
export function encodeCharacterNoteRecords(
  build: CharacterStoredBuildState,
  next: NoteState,
  updatedAt: string
): { build: CharacterStoredBuildState; collections: NoteRecords } {
  const current = readCharacterBuildFields(build.characterId, build)
  // Values are stored as the complete structure split stores them: canonical JSON, contract-parsed.
  const collections = {
    characterNotes: (next.notes ?? []).map((value, position) => {
      const note = characterNoteStateDtoSchema.parse(JSON.parse(JSON.stringify(value)))
      return characterCollectionRecord(build.characterId, note.id, position, note)
    }),
    characterNoteGroups: (next.noteGroups ?? []).map((value, position) => {
      const group = characterNoteGroupStateDtoSchema.parse(JSON.parse(JSON.stringify(value)))
      return characterCollectionRecord(build.characterId, group.id, position, group)
    })
  }
  const fields = {
    ...current,
    updatedAt,
    optionalStateKeys: optionalStateKeys.filter((key) =>
      key === 'notes' || key === 'noteGroups'
        ? next[key] !== undefined
        : current.optionalStateKeys.includes(key)
    ),
    collectionCounts: {
      ...current.collectionCounts,
      characterNotes: collections.characterNotes.length,
      characterNoteGroups: collections.characterNoteGroups.length
    }
  }
  return {
    build: characterStoredBuildStateSchema.parse({
      ...fields,
      checksum: checksumRuleDocument(fields)
    }),
    collections
  }
}

/** Central assembly for Builder, rules, import/export and complete room captures. */
export function assembleCharacterStructure(
  head: CharacterHead,
  build: CharacterStoredBuildState,
  collections: CharacterCollectionRecords
): CharacterCapture {
  const fields = readCharacterBuildFields(head.id, build)
  if (
    collections.characterClassSpellStates.some((row) => row.id !== String(row.position)) ||
    collections.characterExtraEquipment.some(
      (row) => row.id !== `${row.value.kind}:${row.value.instanceId}`
    )
  )
    throw new Error('Stored Character collection identity mismatch.')
  const extras = readCharacterCollectionValues(
    head.id,
    collections.characterExtraEquipment,
    fields.collectionCounts.characterExtraEquipment
  )
  const assignments = (kind: 'CREATURE' | 'VEHICLE') =>
    Object.fromEntries(
      extras
        .filter((row) => row.kind === kind)
        .map((row) => [
          row.instanceId,
          row.equipmentItemIds.map((equipmentItemId) => ({ equipmentItemId }))
        ])
    )
  const optional = {
    classes: readCharacterCollectionValues(
      head.id,
      collections.characterClassSpellStates,
      fields.collectionCounts.characterClassSpellStates
    ),
    notes: readCharacterCollectionValues(
      head.id,
      collections.characterNotes,
      fields.collectionCounts.characterNotes
    ),
    noteGroups: readCharacterCollectionValues(
      head.id,
      collections.characterNoteGroups,
      fields.collectionCounts.characterNoteGroups
    ),
    creatures: readCharacterCollectionValues(
      head.id,
      collections.characterCreatureInstances,
      fields.collectionCounts.characterCreatureInstances
    ),
    vehicles: readCharacterCollectionValues(
      head.id,
      collections.characterVehicleInstances,
      fields.collectionCounts.characterVehicleInstances
    ),
    creatureEquipment: assignments('CREATURE'),
    vehicleEquipment: assignments('VEHICLE')
  }
  for (const key of optionalStateKeys) {
    if (!fields.optionalStateKeys.includes(key) && Object.keys(optional[key]).length)
      throw new Error('Stored Character optional collection mismatch.')
  }
  const document = characterStructureDocumentSchema.parse({
    id: head.id,
    userId: head.userId,
    systemId: head.systemId,
    label: head.label,
    status: head.status,
    ...(fields.description === undefined ? {} : { description: fields.description }),
    profile: fields.profile,
    intent: fields.intent,
    state: {
      equipment: {
        inventory: readCharacterCollectionValues(
          head.id,
          collections.characterInventoryItems,
          fields.collectionCounts.characterInventoryItems
        )
      },
      currency: readCharacterCollectionValues(
        head.id,
        collections.characterCurrencyGroups,
        fields.collectionCounts.characterCurrencyGroups
      ),
      ...Object.fromEntries(fields.optionalStateKeys.map((key) => [key, optional[key]]))
    }
  })
  const sheet = {
    adjustments: fields.adjustments,
    movementDisplayPreference: fields.movementDisplayPreference,
    spellCustomizations: readCharacterCollectionValues(
      head.id,
      collections.characterSpellCustomizations,
      fields.collectionCounts.characterSpellCustomizations
    )
  }
  return {
    ...head,
    updatedAt: fields.updatedAt,
    checksum: checksumRuleDocument(document),
    sheetStateChecksum: checksumRuleDocument(sheet),
    documentJson: canonicalizeRuleDocument(document),
    sheetState: {
      documentJson: canonicalizeRuleDocument(sheet),
      checksum: checksumRuleDocument(sheet)
    }
  }
}
