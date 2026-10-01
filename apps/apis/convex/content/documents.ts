import {
  AUTHORED_CHUNKED_PAYLOAD_MARKER,
  AUTHORED_PAYLOAD_CHUNK_MAX_BYTES,
  AUTHORED_PAYLOAD_MAX_CHUNKS,
  authoredDraftDtoSchema,
  authoredStoredDraftPayloadSchema,
  type AuthoredDraftResult
} from '@artificer-toolkit/schema/api/authoredDrafts'
import { IMPORT_MAX_ENTRY_BYTES } from '@artificer-toolkit/schema/api/imports'
import { jsonValueSchema, type JsonValue } from '@artificer-toolkit/schema/projections/identity'
import {
  canonicalizeRuleDocument,
  checksumCanonicalRuleDocument
} from '@artificer-toolkit/shared/rules/checksum'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import {
  decodeUtf8PayloadChunks,
  encodeUtf8PayloadChunks
} from '@artificer-toolkit/shared/jsonPayloadChunks'
import { isImportRowVisible } from '../imports/visibility'

function requireChunkHeader(chunkCount: number, totalByteLength: number) {
  if (
    !Number.isSafeInteger(chunkCount) ||
    chunkCount <= 0 ||
    chunkCount > AUTHORED_PAYLOAD_MAX_CHUNKS ||
    !Number.isSafeInteger(totalByteLength) ||
    totalByteLength <= 0 ||
    totalByteLength > IMPORT_MAX_ENTRY_BYTES
  )
    throw new Error('Stored authored payload chunk metadata is invalid.')
}

function encodedPayloadChunks(payloadJson: string) {
  const chunks = encodeUtf8PayloadChunks(payloadJson, AUTHORED_PAYLOAD_CHUNK_MAX_BYTES)
  const totalByteLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
  requireChunkHeader(chunks.length, totalByteLength)
  return { chunks, totalByteLength }
}

function storedDraftPayloadFields(payload: Doc<'authoredDraftPayloads'>) {
  const { _id: _payloadRowId, _creationTime: _payloadCreatedAt, ...stored } = payload
  return stored
}

function isSameDraftPayloadHead(
  current: Doc<'authoredDraftPayloads'>,
  expected: Doc<'authoredDraftPayloads'>
) {
  return (
    current._id === expected._id &&
    current._creationTime === expected._creationTime &&
    current.id === expected.id &&
    current.subjectId === expected.subjectId &&
    current.importJobId === expected.importJobId &&
    current.payloadJson === expected.payloadJson &&
    current.systemId === expected.systemId &&
    current.chunkCount === expected.chunkCount &&
    current.totalByteLength === expected.totalByteLength &&
    current.checksum === expected.checksum
  )
}

async function loadStoredDraftPayload(ctx: QueryCtx, payload: Doc<'authoredDraftPayloads'>) {
  const parsed = authoredStoredDraftPayloadSchema.parse(storedDraftPayloadFields(payload))
  if (!('chunkCount' in parsed)) {
    if (checksumCanonicalRuleDocument(parsed.payloadJson) !== parsed.checksum)
      throw new Error('Stored authored draft payload mismatch.')
    return { payloadJson: parsed.payloadJson, payload, stored: parsed, chunks: [] as const }
  }
  requireChunkHeader(parsed.chunkCount, parsed.totalByteLength)
  const chunks = await ctx.db
    .query('authoredDraftPayloadChunks')
    .withIndex('by_subjectId_payloadId_chunkIndex', (query) =>
      query.eq('subjectId', parsed.subjectId).eq('payloadId', parsed.id)
    )
    .take(AUTHORED_PAYLOAD_MAX_CHUNKS + 1)
  if (chunks.length !== parsed.chunkCount)
    throw new Error('Stored authored draft payload chunks are incomplete.')
  chunks.forEach((chunk, chunkIndex) => {
    if (
      chunk.subjectId !== parsed.subjectId ||
      chunk.systemId !== parsed.systemId ||
      chunk.payloadId !== parsed.id ||
      chunk.chunkIndex !== chunkIndex
    )
      throw new Error('Stored authored draft payload chunk identity mismatch.')
  })
  const payloadJson = decodeUtf8PayloadChunks(
    chunks.map((chunk) => chunk.bytes),
    parsed.totalByteLength,
    AUTHORED_PAYLOAD_CHUNK_MAX_BYTES
  )
  if (checksumCanonicalRuleDocument(payloadJson) !== parsed.checksum)
    throw new Error('Stored authored draft payload mismatch.')
  return { payloadJson, payload, stored: parsed, chunks }
}

async function loadDraftPayload(ctx: QueryCtx, record: Doc<'authoredDrafts'>) {
  const hasInlinePayload = 'payloadJson' in record
  const hasPayloadId = 'payloadId' in record
  if (hasInlinePayload === hasPayloadId) throw new Error('Stored authored draft payload mismatch.')
  if ('payloadJson' in record)
    return {
      payloadJson: record.payloadJson,
      payload: null,
      chunks: [] as const
    }
  const payload = await ctx.db
    .query('authoredDraftPayloads')
    .withIndex('by_publicId', (query) => query.eq('id', record.payloadId))
    .unique()
  if (!payload) throw new Error('Stored authored draft payload mismatch.')
  const loaded = await loadStoredDraftPayload(ctx, payload)
  if (
    loaded.stored.id !== record.payloadId ||
    loaded.stored.subjectId !== record.subjectId ||
    ('chunkCount' in loaded.stored && loaded.stored.systemId !== record.systemId)
  )
    throw new Error('Stored authored draft payload mismatch.')
  return loaded
}

export async function readDraftPayloadJson(
  ctx: QueryCtx,
  record: Doc<'authoredDrafts'>
): Promise<string> {
  return (await loadDraftPayload(ctx, record)).payloadJson
}

export async function insertDraftPayload(
  ctx: MutationCtx,
  subjectId: string,
  systemId: string,
  payloadJson: string,
  importJobId?: string
) {
  const { chunks, totalByteLength } = encodedPayloadChunks(payloadJson)
  const payloadId = crypto.randomUUID()
  await ctx.db.insert('authoredDraftPayloads', {
    id: payloadId,
    subjectId,
    systemId,
    ...(importJobId !== undefined ? { importJobId } : {}),
    payloadJson: AUTHORED_CHUNKED_PAYLOAD_MARKER,
    checksum: checksumCanonicalRuleDocument(payloadJson),
    chunkCount: chunks.length,
    totalByteLength
  })
  for (const [chunkIndex, bytes] of chunks.entries())
    await ctx.db.insert('authoredDraftPayloadChunks', {
      subjectId,
      systemId,
      payloadId,
      chunkIndex,
      bytes
    })
  return payloadId
}

export async function readDraft(
  ctx: QueryCtx,
  record: Doc<'authoredDrafts'>,
  currentImportJobId?: string
): Promise<AuthoredDraftResult> {
  if (!(await isImportRowVisible(ctx, record.importJobId, currentImportJobId)))
    throw new Error('Authored draft is unavailable.')
  const payloadJson = await readDraftPayloadJson(ctx, record)
  const { _id, _creationTime, ...stored } = record
  const metadata =
    'payloadJson' in stored
      ? (({ payloadJson: _payloadJson, ...value }) => value)(stored)
      : (({ payloadId: _payloadId, ...value }) => value)(stored)
  return authoredDraftDtoSchema.parse({
    ...metadata,
    payload: JSON.parse(payloadJson)
  })
}

export async function deleteDraftPayload(
  ctx: MutationCtx,
  record: Doc<'authoredDrafts'>
): Promise<void> {
  const loaded = await loadDraftPayload(ctx, record)
  if (!loaded.payload) return
  for (const chunk of loaded.chunks) await ctx.db.delete(chunk._id)
  await ctx.db.delete(loaded.payload._id)
}

export async function deleteDraftPayloadByHead(
  ctx: MutationCtx,
  expected: Doc<'authoredDraftPayloads'>
): Promise<void> {
  const current = await ctx.db.get(expected._id)
  if (!current || !isSameDraftPayloadHead(current, expected))
    throw new Error('Stored authored draft payload head identity mismatch.')
  const loaded = await loadStoredDraftPayload(ctx, current)
  for (const chunk of loaded.chunks) await ctx.db.delete(chunk._id)
  await ctx.db.delete(current._id)
}
export async function canReadAuthoredRoot(
  ctx: QueryCtx,
  root: Doc<'authoredRoots'>,
  userId: string | null,
  currentSource?: Doc<'contentSources'>,
  currentImportJobId?: string
) {
  if (!(await isImportRowVisible(ctx, root.importJobId, currentImportJobId))) return false
  if (root.ownerUserId !== undefined && root.ownerUserId !== userId) return false
  // Catalogue callers may reuse a source read in this transaction, never a persisted client cache.
  const source =
    currentSource ??
    (await ctx.db
      .query('contentSources')
      .withIndex('by_publicId', (q) => q.eq('id', root.contentSourceId))
      .unique())
  if (!source || source.id !== root.contentSourceId || source.gameSystemId !== root.systemId)
    return false
  if (source.kind === 'PLATFORM')
    return source.ownerUserId === null && root.ownerUserId === undefined
  return source.ownerUserId === userId && root.ownerUserId === userId
}

export async function readAuthoredVersion(
  ctx: QueryCtx,
  root: Doc<'authoredRoots'>,
  currentImportJobId?: string
) {
  const version = await ctx.db.get(root.currentVersionId)
  if (
    !version ||
    !(await isImportRowVisible(ctx, version.importJobId, currentImportJobId)) ||
    root.importJobId !== version.importJobId ||
    version.id !== root.id ||
    version.subjectKind !== root.subjectKind ||
    version.systemId !== root.systemId ||
    version.versionId !== root.currentVersionPublicId ||
    version.contentSourceId !== root.contentSourceId ||
    version.checksum !== root.checksum
  ) {
    throw new Error('Stored authored content identity mismatch.')
  }
  return version
}

// Only parsed JSON reaches this check. Native serialization is canonical when every object's
// enumeration order is lexical; integer-key maps may require the original sorted serializer.
function hasCanonicalJsonOrder(value: JsonValue): boolean {
  if (typeof value === 'number') return Number.isFinite(value)
  if (value === null || typeof value !== 'object') return true
  if (Array.isArray(value)) return value.every(hasCanonicalJsonOrder)
  const keys = Object.keys(value)
  return keys.every(
    (key, index) => (index === 0 || keys[index - 1]! < key) && hasCanonicalJsonOrder(value[key]!)
  )
}

function parseStoredVersionDocument(version: Doc<'authoredVersions'>, documentJson: string) {
  const parsed = JSON.parse(documentJson) as JsonValue
  // JSON syntax is checked above; the checksum rejects non-finite numbers recursively.
  // Preserve Zod's removal of __proto__ keys, including Unicode-escaped spellings.
  const document =
    documentJson.includes('__proto__') || documentJson.includes('\\u')
      ? jsonValueSchema.parse(parsed)
      : parsed
  const canonicalJson = hasCanonicalJsonOrder(document)
    ? JSON.stringify(document)
    : canonicalizeRuleDocument(document)
  if (checksumCanonicalRuleDocument(canonicalJson) !== version.checksum)
    throw new Error('Stored authored content checksum mismatch.')
  if (
    !document ||
    typeof document !== 'object' ||
    Array.isArray(document) ||
    document.id !== version.id ||
    (document.kind !== undefined && document.kind !== version.subjectKind) ||
    document.systemId !== version.systemId ||
    document.label !== version.label
  )
    throw new Error('Stored authored content metadata mismatch.')
  return document
}

async function loadVersionPayload(ctx: QueryCtx, version: Doc<'authoredVersions'>) {
  const hasChunkCount = version.documentChunkCount !== undefined
  const hasByteLength = version.documentByteLength !== undefined
  if (hasChunkCount !== hasByteLength)
    throw new Error('Stored authored version payload representation is invalid.')
  if (!hasChunkCount) {
    if (version.documentJson === AUTHORED_CHUNKED_PAYLOAD_MARKER)
      throw new Error('Stored authored version payload representation is invalid.')
    return { documentJson: version.documentJson, chunks: [] as const }
  }
  if (version.documentJson !== AUTHORED_CHUNKED_PAYLOAD_MARKER)
    throw new Error('Stored authored version payload representation is invalid.')
  requireChunkHeader(version.documentChunkCount!, version.documentByteLength!)
  const chunks = await ctx.db
    .query('authoredVersionPayloadChunks')
    .withIndex('by_versionId_chunkIndex', (query) => query.eq('versionId', version.versionId))
    .take(AUTHORED_PAYLOAD_MAX_CHUNKS + 1)
  if (chunks.length !== version.documentChunkCount)
    throw new Error('Stored authored version payload chunks are incomplete.')
  chunks.forEach((chunk, chunkIndex) => {
    if (
      chunk.subjectId !== version.id ||
      chunk.systemId !== version.systemId ||
      chunk.versionId !== version.versionId ||
      chunk.chunkIndex !== chunkIndex
    )
      throw new Error('Stored authored version payload chunk identity mismatch.')
  })
  return {
    documentJson: decodeUtf8PayloadChunks(
      chunks.map((chunk) => chunk.bytes),
      version.documentByteLength!,
      AUTHORED_PAYLOAD_CHUNK_MAX_BYTES
    ),
    chunks
  }
}

export async function insertAuthoredVersion(
  ctx: MutationCtx,
  metadata: Pick<
    Doc<'authoredVersions'>,
    | 'subjectKind'
    | 'id'
    | 'systemId'
    | 'label'
    | 'checksum'
    | 'contentSourceId'
    | 'importJobId'
    | 'versionId'
    | 'version'
    | 'documentSchemaVersion'
    | 'compilation'
  >,
  documentJson: string
) {
  if (checksumCanonicalRuleDocument(documentJson) !== metadata.checksum)
    throw new Error('Authored version payload checksum mismatch.')
  const { chunks, totalByteLength } = encodedPayloadChunks(documentJson)
  const storedVersionId = await ctx.db.insert('authoredVersions', {
    ...metadata,
    documentJson: AUTHORED_CHUNKED_PAYLOAD_MARKER,
    documentChunkCount: chunks.length,
    documentByteLength: totalByteLength
  })
  for (const [chunkIndex, bytes] of chunks.entries())
    await ctx.db.insert('authoredVersionPayloadChunks', {
      subjectId: metadata.id,
      systemId: metadata.systemId,
      versionId: metadata.versionId,
      chunkIndex,
      bytes
    })
  return storedVersionId
}

export async function readStoredAuthoredVersionDocument(
  ctx: QueryCtx,
  version: Doc<'authoredVersions'>
) {
  const { documentJson } = await loadVersionPayload(ctx, version)
  return parseStoredVersionDocument(version, documentJson)
}

export function parsePublishedDocument(
  root: Doc<'authoredRoots'>,
  version: Doc<'authoredVersions'>,
  documentJson: string
) {
  if (
    version.id !== root.id ||
    version.subjectKind !== root.subjectKind ||
    version.systemId !== root.systemId ||
    version.contentSourceId !== root.contentSourceId ||
    version.checksum !== root.checksum
  )
    throw new Error('Stored authored content identity mismatch.')
  const document = parseStoredVersionDocument(version, documentJson)
  if (root.ownerUserId !== undefined && document.userId !== root.ownerUserId)
    throw new Error('Stored authored content metadata mismatch.')
  return document
}

export async function readPublishedDocument(
  ctx: QueryCtx,
  root: Doc<'authoredRoots'>,
  version: Doc<'authoredVersions'>
) {
  const { documentJson } = await loadVersionPayload(ctx, version)
  return parsePublishedDocument(root, version, documentJson)
}

export async function deleteAuthoredVersion(ctx: MutationCtx, version: Doc<'authoredVersions'>) {
  const loaded = await loadVersionPayload(ctx, version)
  const document = parseStoredVersionDocument(version, loaded.documentJson)
  for (const chunk of loaded.chunks) await ctx.db.delete(chunk._id)
  await ctx.db.delete(version._id)
  return document
}
