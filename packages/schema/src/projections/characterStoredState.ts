import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { z, lazySchema } from '../zod.js'
import { characterAuthoredDtoSchema } from '../subjects/character.js'
import type {
  characterStoredPlayStateSchema,
  characterStoredRecordSchema
} from './characterPersistence.js'
import {
  characterPlayStateSchema,
  characterSheetStructureSchema,
  characterStructureStateSchema,
  effectiveEquippedItems,
  effectiveInventory,
  effectiveItemIds,
  mergeCharacterSheetStatePlay,
  mergeCharacterStatePlay,
  splitCharacterPlayState,
  type CharacterPlayState,
  type CharacterSheetStructure
} from './characterPlayState.js'
import type { CharacterSheetState } from './characterSheetState.js'

/** The Character as the Sheet and the rules read it: structure and play state joined. */
export const characterDocumentSchema = lazySchema(() =>
  z.omit(characterAuthoredDtoSchema, { primaryRulesCatalogueId: true })
)

/** The stored Character document: the Builder-owned structure, without play state. */
export const characterStructureDocumentSchema = lazySchema(() =>
  z.extend(characterDocumentSchema, { state: characterStructureStateSchema })
)

export type CharacterDocument = z.infer<typeof characterDocumentSchema>
type StoredRecord = z.infer<typeof characterStoredRecordSchema>
type StoredPlay = z.infer<typeof characterStoredPlayStateSchema>

/**
 * The play record's fields a reader needs: identity, version, checksummed typed state and the stored
 * maximum that bounds hit points before active effects.
 */
export type StoredCharacterPlay = Pick<
  StoredPlay,
  | 'characterId'
  | 'userId'
  | 'streamVersion'
  | 'state'
  | 'checksum'
  | 'updatedAt'
  | 'maximumHitPoints'
>

/** A Character's structure row with its play record joined, as the rules read it. */
export type StoredCharacter = Pick<
  StoredRecord,
  'id' | 'userId' | 'systemId' | 'label' | 'status' | 'documentJson' | 'checksum' | 'updatedAt'
> &
  Partial<Pick<StoredRecord, 'sheetState'>> & { play: StoredCharacterPlay }

/** JSON without `undefined` members, as the canonical stored form has none. */
const encode = (value: unknown): unknown => JSON.parse(JSON.stringify(value))

/** The play record's fields, verified against its checksum. */
export function readCharacterPlay(
  play: Pick<StoredCharacterPlay, 'state' | 'checksum'>
): CharacterPlayState {
  const raw: unknown = encode(play.state)
  if (checksumRuleDocument(raw) !== play.checksum)
    throw new Error('Stored Character play state checksum mismatch.')
  return characterPlayStateSchema.parse(raw)
}

function readCharacterStructure(row: StoredCharacter) {
  const raw: unknown = JSON.parse(row.documentJson)
  if (checksumRuleDocument(raw) !== row.checksum)
    throw new Error('Stored Character checksum mismatch.')
  return characterStructureDocumentSchema.parse(raw)
}

/**
 * The inventory a row stores and the usage that reduces it: the base a structural edit of the
 * effective inventory (`readCharacterRecord`) is translated against on write.
 */
export function readCharacterInventoryBase(row: StoredCharacter) {
  const play = readCharacterPlay(row.play)
  return {
    inventory: readCharacterStructure(row).state.equipment.inventory,
    itemUsage: play.itemUsage,
    equipped: play.equipped,
    attuned: play.attuned
  }
}

/**
 * The Character document with its play state joined, verified against both checksums. Its inventory
 * is the effective one: single-use items used up in play are subtracted and rows with none left are
 * absent. Every reader of a Character's inventory reads it through here.
 */
export function readCharacterRecord(row: StoredCharacter): CharacterDocument {
  const { state: structure, ...character } = readCharacterStructure(row)
  if (
    character.id !== row.id ||
    character.userId !== row.userId ||
    character.systemId !== row.systemId ||
    character.label !== row.label ||
    character.status !== row.status ||
    row.play.characterId !== row.id ||
    row.play.userId !== row.userId
  )
    throw new Error('Stored Character identity mismatch.')
  const play = readCharacterPlay(row.play)
  const state = mergeCharacterStatePlay(structure, play)
  const inventory = effectiveInventory(state.equipment.inventory, play.itemUsage)
  return {
    ...character,
    state: {
      ...state,
      equipment: {
        ...state.equipment,
        inventory,
        equipped: effectiveEquippedItems(state.equipment.equipped, inventory),
        attuned: effectiveItemIds(state.equipment.attuned, inventory)
      }
    }
  }
}

/** The Sheet structure a row stores, verified against its checksum; empty when it stores none. */
export function readCharacterSheetStructure(
  sheetState: StoredCharacter['sheetState']
): CharacterSheetStructure {
  if (!sheetState)
    return {
      adjustments: [],
      movementDisplayPreference: { mode: 'AUTO' },
      spellCustomizations: []
    }
  const raw: unknown = JSON.parse(sheetState.documentJson)
  if (checksumRuleDocument(raw) !== sheetState.checksum)
    throw new Error('Stored Character Sheet state checksum mismatch.')
  return characterSheetStructureSchema.parse(raw)
}

/** The Sheet state: the Sheet structure the row stores, joined with the play record's fields. */
export function readCharacterSheetState(
  row: Pick<StoredCharacter, 'sheetState' | 'play'>
): CharacterSheetState {
  return mergeCharacterSheetStatePlay(
    readCharacterSheetStructure(row.sheetState),
    readCharacterPlay(row.play)
  )
}

/**
 * The row as it would be stored after a write of `document` (and `sheetState`, when it changes) at
 * `streamVersion`: structure and play re-encoded separately, with each clock advancing only when its
 * own record changes, as the Convex Character writer does. Pure.
 */
export function encodeCharacterRecord<TRow extends StoredCharacter>(
  row: TRow,
  next: {
    document: CharacterDocument
    sheetState?: CharacterSheetState
    streamVersion: number
    updatedAt: string
  }
): TRow {
  const split = splitCharacterPlayState(
    {
      state: next.document.state,
      sheetState: next.sheetState ?? readCharacterSheetState(row)
    },
    readCharacterInventoryBase(row)
  )
  const structure = encode({ ...next.document, state: split.structure.state })
  const sheetStructure = next.sheetState ? encode(split.structure.sheetState) : undefined
  const sheetStructureChanged =
    sheetStructure !== undefined &&
    checksumRuleDocument(sheetStructure) !==
      checksumRuleDocument(encode(readCharacterSheetStructure(row.sheetState)))
  const play = encode(split.play)
  const documentFields = {
    documentJson: canonicalizeRuleDocument(structure),
    checksum: checksumRuleDocument(structure)
  }
  const sheetFields = sheetStructureChanged
    ? {
        sheetStateChecksum: checksumRuleDocument(sheetStructure),
        sheetState: {
          documentJson: canonicalizeRuleDocument(sheetStructure),
          checksum: checksumRuleDocument(sheetStructure)
        }
      }
    : {}
  const playFields = {
    state: characterPlayStateSchema.parse(play),
    checksum: checksumRuleDocument(play)
  }
  const structureChanged = documentFields.checksum !== row.checksum || sheetStructureChanged
  return {
    ...row,
    ...documentFields,
    ...sheetFields,
    updatedAt: structureChanged ? next.updatedAt : row.updatedAt,
    play: {
      ...row.play,
      ...playFields,
      streamVersion: next.streamVersion,
      updatedAt:
        playFields.checksum === row.play.checksum && next.streamVersion === row.play.streamVersion
          ? row.play.updatedAt
          : next.updatedAt
    }
  }
}
