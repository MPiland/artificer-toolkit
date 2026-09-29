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
const characterStructureDocumentSchema = lazySchema(() =>
  z.extend(characterDocumentSchema, { state: characterStructureStateSchema })
)

export type CharacterDocument = z.infer<typeof characterDocumentSchema>
type StoredRecord = z.infer<typeof characterStoredRecordSchema>
type StoredPlay = z.infer<typeof characterStoredPlayStateSchema>

/** The play record's fields a reader needs: identity, version and the checksummed play JSON. */
export type StoredCharacterPlay = Pick<
  StoredPlay,
  'characterId' | 'userId' | 'streamVersion' | 'playJson' | 'checksum' | 'updatedAt'
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
  play: Pick<StoredCharacterPlay, 'playJson' | 'checksum'>
): CharacterPlayState {
  const raw: unknown = JSON.parse(play.playJson)
  if (checksumRuleDocument(raw) !== play.checksum)
    throw new Error('Stored Character play state checksum mismatch.')
  return characterPlayStateSchema.parse(raw)
}

/** The Character document with its play state joined, verified against both checksums. */
export function readCharacterRecord(row: StoredCharacter): CharacterDocument {
  const raw: unknown = JSON.parse(row.documentJson)
  if (checksumRuleDocument(raw) !== row.checksum)
    throw new Error('Stored Character checksum mismatch.')
  const { state: structure, ...character } = characterStructureDocumentSchema.parse(raw)
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
  return { ...character, state: mergeCharacterStatePlay(structure, readCharacterPlay(row.play)) }
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
  const split = splitCharacterPlayState({
    state: next.document.state,
    sheetState: next.sheetState ?? readCharacterSheetState(row)
  })
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
        sheetState: {
          documentJson: canonicalizeRuleDocument(sheetStructure),
          checksum: checksumRuleDocument(sheetStructure)
        }
      }
    : {}
  const playFields = {
    playJson: canonicalizeRuleDocument(play),
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
