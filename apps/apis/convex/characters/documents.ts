import * as zMini from 'zod/mini'
import type { CharacterBuilderResolveInput } from '@artificer-toolkit/schema/api/characterBuilderQueries'
import { characterHistoryEntryDtoSchema } from '@artificer-toolkit/schema/api/characterHistory'
import {
  characterBuilderDraftDtoSchema,
  characterBuilderDraftPayloadDtoSchema,
  characterBuilderDraftSummaryDtoSchema
} from '@artificer-toolkit/schema/api/characterBuilder'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  CHARACTER_DRAFT_PAYLOAD_MAX_CHUNKS,
  characterStoredDraftPayloadSchema
} from '@artificer-toolkit/schema/projections/characterPersistence'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { decodeUtf8PayloadChunks, encodeUtf8PayloadChunks } from '../lib/jsonPayloadChunks'
import { characterDocumentSchema, loadCharacterState, readCharacterRecord } from './stateDocuments'
import { readVisibleAuthoredRouteId } from '../content/routeIds'
export { loadCharacterState, readCharacterRecord } from './stateDocuments'
export { readCharacterSheetState } from './sheetStateDocuments'

const characterDraftPayloadSchema = zMini.extend(characterBuilderDraftPayloadDtoSchema, {
  character: characterDocumentSchema
})
type StoredCharacterDraft = Omit<Doc<'characterDrafts'>, '_id' | '_creationTime'>

function parseDraftPayloadJson(payloadJson: string) {
  try {
    return JSON.parse(payloadJson) as unknown
  } catch {
    throw new Error('Stored Character draft payload JSON is invalid.')
  }
}

function storedPayloadFields(payload: Doc<'characterDraftPayloads'>) {
  return {
    id: payload.id,
    characterId: payload.characterId,
    ...(payload.importJobId !== undefined ? { importJobId: payload.importJobId } : {}),
    ...(payload.payloadJson !== undefined ? { payloadJson: payload.payloadJson } : {}),
    ...(payload.chunkCount !== undefined ? { chunkCount: payload.chunkCount } : {}),
    ...(payload.totalByteLength !== undefined ? { totalByteLength: payload.totalByteLength } : {}),
    checksum: payload.checksum,
    createdAt: payload.createdAt
  }
}

async function readCharacterDraftPayloadChunks(
  ctx: QueryCtx,
  payload: Doc<'characterDraftPayloads'>,
  chunkCount: number
) {
  const chunks = await ctx.db
    .query('characterDraftPayloadChunks')
    .withIndex('by_characterId_payloadId_chunkIndex', (q) =>
      q.eq('characterId', payload.characterId).eq('payloadId', payload.id)
    )
    .take(CHARACTER_DRAFT_PAYLOAD_MAX_CHUNKS + 1)
  if (chunks.length !== chunkCount)
    throw new Error('Stored Character draft payload chunk count mismatch.')
  for (const [index, chunk] of chunks.entries()) {
    if (
      chunk.characterId !== payload.characterId ||
      chunk.payloadId !== payload.id ||
      chunk.chunkIndex !== index
    )
      throw new Error('Stored Character draft payload chunk sequence mismatch.')
  }
  return chunks
}

function isSameCharacterDraftPayloadHead(
  current: Doc<'characterDraftPayloads'>,
  expected: Doc<'characterDraftPayloads'>
) {
  return (
    current._id === expected._id &&
    current._creationTime === expected._creationTime &&
    current.id === expected.id &&
    current.characterId === expected.characterId &&
    current.importJobId === expected.importJobId &&
    current.payloadJson === expected.payloadJson &&
    current.chunkCount === expected.chunkCount &&
    current.totalByteLength === expected.totalByteLength &&
    current.checksum === expected.checksum &&
    current.createdAt === expected.createdAt
  )
}

function parseCharacterDraftPayload(payloadJson: string, checksum: string) {
  const raw = parseDraftPayloadJson(payloadJson)
  if (checksumRuleDocument(raw) !== checksum)
    throw new Error('Stored Character draft checksum mismatch.')
  return characterDraftPayloadSchema.parse(raw)
}

async function loadStoredCharacterDraftPayload(
  ctx: QueryCtx,
  payload: Doc<'characterDraftPayloads'>
) {
  const stored = characterStoredDraftPayloadSchema.parse(storedPayloadFields(payload))
  const chunks =
    'chunkCount' in stored
      ? await readCharacterDraftPayloadChunks(ctx, payload, stored.chunkCount)
      : await ctx.db
          .query('characterDraftPayloadChunks')
          .withIndex('by_characterId_payloadId_chunkIndex', (q) =>
            q.eq('characterId', payload.characterId).eq('payloadId', payload.id)
          )
          .take(1)
  if (!('chunkCount' in stored) && chunks.length)
    throw new Error('Stored Character draft payload representation is invalid.')
  const draftPayload = parseCharacterDraftPayload(
    'chunkCount' in stored
      ? decodeUtf8PayloadChunks(
          chunks.map((chunk) => chunk.bytes),
          stored.totalByteLength
        )
      : stored.payloadJson,
    stored.checksum
  )
  if (draftPayload.character.id !== stored.characterId || draftPayload.character.status !== 'DRAFT')
    throw new Error('Stored Character draft payload identity mismatch.')
  return { stored, draftPayload, chunks }
}

function requireCharacterDraftPayloadIdentity(
  record: StoredCharacterDraft,
  payload: ReturnType<typeof characterDraftPayloadSchema.parse>
) {
  const { character } = payload
  if (
    character.id !== record.characterId ||
    character.userId !== record.userId ||
    character.systemId !== record.systemId ||
    character.status !== 'DRAFT' ||
    (character.label || 'Untitled Character') !== record.label
  )
    throw new Error('Stored Character draft identity mismatch.')
}

export async function readCharacterDraftPayload(ctx: QueryCtx, record: StoredCharacterDraft) {
  const hasInlinePayload = record.payloadJson !== undefined
  const hasPayloadReference = record.payloadId !== undefined
  if (hasInlinePayload === hasPayloadReference)
    throw new Error('Stored Character draft payload representation is invalid.')
  if (record.payloadJson !== undefined) {
    const payload = parseCharacterDraftPayload(record.payloadJson, record.checksum)
    requireCharacterDraftPayloadIdentity(record, payload)
    return payload
  }

  const payload = await ctx.db
    .query('characterDraftPayloads')
    .withIndex('by_characterId_id', (q) =>
      q.eq('characterId', record.characterId).eq('id', record.payloadId!)
    )
    .unique()
  if (!payload) throw new Error('Stored Character draft payload is missing.')
  const loaded = await loadStoredCharacterDraftPayload(ctx, payload)
  if (
    loaded.stored.id !== record.payloadId ||
    loaded.stored.characterId !== record.characterId ||
    loaded.stored.checksum !== record.checksum
  )
    throw new Error('Stored Character draft payload identity mismatch.')
  requireCharacterDraftPayloadIdentity(record, loaded.draftPayload)
  return loaded.draftPayload
}
export async function insertCharacterDraftPayload(
  ctx: MutationCtx,
  characterId: string,
  payload: unknown,
  createdAt: string,
  importJobId?: string
) {
  const encoded: unknown = JSON.parse(JSON.stringify(payload))
  const payloadJson = canonicalizeRuleDocument(encoded)
  const chunks = encodeUtf8PayloadChunks(payloadJson)
  const totalByteLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
  const stored = characterStoredDraftPayloadSchema.parse({
    id: crypto.randomUUID(),
    characterId,
    ...(importJobId !== undefined ? { importJobId } : {}),
    chunkCount: chunks.length,
    totalByteLength,
    checksum: checksumRuleDocument(encoded),
    createdAt
  })
  await ctx.db.insert('characterDraftPayloads', stored)
  for (const [chunkIndex, bytes] of chunks.entries())
    await ctx.db.insert('characterDraftPayloadChunks', {
      characterId,
      payloadId: stored.id,
      chunkIndex,
      bytes
    })
  return { payloadId: stored.id, checksum: stored.checksum, payload: encoded }
}

async function deleteStoredCharacterDraftPayload(
  ctx: MutationCtx,
  payload: Doc<'characterDraftPayloads'>,
  chunks: readonly Doc<'characterDraftPayloadChunks'>[]
) {
  for (const chunk of chunks) await ctx.db.delete(chunk._id)
  await ctx.db.delete(payload._id)
}

export async function deleteCharacterDraftPayload(
  ctx: MutationCtx,
  record: Doc<'characterDrafts'>
) {
  const hasInlinePayload = record.payloadJson !== undefined
  const hasPayloadReference = record.payloadId !== undefined
  if (hasInlinePayload === hasPayloadReference)
    throw new Error('Stored Character draft payload representation is invalid.')
  if (hasInlinePayload) return
  const payload = await ctx.db
    .query('characterDraftPayloads')
    .withIndex('by_characterId_id', (q) =>
      q.eq('characterId', record.characterId).eq('id', record.payloadId!)
    )
    .unique()
  if (!payload) throw new Error('Stored Character draft payload is missing.')
  const loaded = await loadStoredCharacterDraftPayload(ctx, payload)
  if (
    loaded.stored.id !== record.payloadId ||
    loaded.stored.characterId !== record.characterId ||
    loaded.stored.checksum !== record.checksum
  )
    throw new Error('Stored Character draft payload identity mismatch.')
  requireCharacterDraftPayloadIdentity(record, loaded.draftPayload)
  await deleteStoredCharacterDraftPayload(ctx, payload, loaded.chunks)
}

export async function deleteCharacterDraftPayloadByHead(
  ctx: MutationCtx,
  expected: Doc<'characterDraftPayloads'>
) {
  const current = await ctx.db.get(expected._id)
  if (!current || !isSameCharacterDraftPayloadHead(current, expected))
    throw new Error('Stored Character draft payload head identity mismatch.')
  const loaded = await loadStoredCharacterDraftPayload(ctx, current)
  await deleteStoredCharacterDraftPayload(ctx, current, loaded.chunks)
}
export async function loadCharacterDraftCandidate(
  ctx: QueryCtx,
  userId: string,
  input: CharacterBuilderResolveInput
) {
  const { active, draft } = await loadCharacterState(ctx, input.character.id)
  if (!draft || draft.userId !== userId || (active && active.userId !== userId))
    throw new Error('Character draft is unavailable for the current user.')
  if (draft.id !== input.expectedDraftId)
    throw new Error('Character draft generation changed; reopen it before resolving.')
  const working = await readCharacterDraft(ctx, draft, active)
  const current = active ? readCharacterRecord(active) : null
  if (input.mode !== (active ? 'edit' : 'create') || input.mode !== working.mode)
    throw new Error('Character draft mode does not match the current Character.')
  if (input.character.systemId !== working.payload.character.systemId)
    throw new Error('Character Game System is immutable.')
  return {
    activeRecord: active,
    draftRecord: draft,
    current,
    draft: working,
    character: { ...input.character, userId, status: 'DRAFT' as const }
  }
}

export function readCharacterReceiptHistory(receipt: Doc<'characterCommandReceipts'>) {
  const raw: unknown = JSON.parse(receipt.historyJson)
  if (checksumRuleDocument(raw) !== receipt.historyChecksum)
    throw new Error('Stored Sheet command receipt history checksum mismatch.')
  const historyEntry = characterHistoryEntryDtoSchema.parse(raw)
  if (
    historyEntry.eventId !== receipt.id ||
    historyEntry.actorId !== receipt.actorId ||
    historyEntry.occurredAt !== receipt.occurredAt
  ) {
    throw new Error('Stored Sheet command receipt history identity mismatch.')
  }
  return historyEntry
}

export function readCharacterDraftSummary(
  record: Doc<'characterDrafts'>,
  active: Doc<'characters'> | null
) {
  if (
    active &&
    (active.id !== record.characterId ||
      active.userId !== record.userId ||
      active.systemId !== record.systemId)
  ) {
    throw new Error('Stored Character draft ownership mismatch.')
  }
  return characterBuilderDraftSummaryDtoSchema.parse({
    ...record,
    draftState: active?.status === 'ACTIVE' ? 'ACTIVE_WITH_DRAFT' : 'DRAFT_ONLY'
  })
}

export async function readCharacterDraft(
  ctx: QueryCtx,
  record: Doc<'characterDrafts'>,
  active: Doc<'characters'> | null
) {
  const payload = await readCharacterDraftPayload(ctx, record)
  return characterBuilderDraftDtoSchema.parse({
    ...readCharacterDraftSummary(record, active),
    id: record.id,
    mode: record.mode,
    payload
  })
}

export async function resolveCharacterId(ctx: QueryCtx, id: string) {
  const uuid = postgresUuidSchema.safeParse(id)
  if (uuid.success) return uuid.data.toLowerCase()
  const route = await readVisibleAuthoredRouteId(ctx, { publicId: id })
  return route?.subjectKind === 'CHARACTER' ? route.subjectId : null
}
