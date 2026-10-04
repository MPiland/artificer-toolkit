import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  liveSessionCheckpointCommitInputSchema,
  liveSessionCheckpointPartInputSchema,
  liveSessionCheckpointStageInputSchema,
  liveSessionCheckpointStageResponseSchema,
  type LiveSessionCheckpointCommitInput,
  type LiveSessionCheckpointPartInput,
  type LiveSessionCheckpointStageInput
} from '@artificer-toolkit/schema/api/liveSessionCheckpointStaging'
import { liveSessionCheckpointResponseSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import { liveSessionCheckpointRecordsSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpointRecords'
import { liveSessionStoredCheckpointUploadSchema } from '@artificer-toolkit/schema/projections/liveSessionCheckpointStaging'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { decodeBase64, encodeBase64 } from '@artificer-toolkit/shared/base64'
import {
  JSON_PAYLOAD_CHUNK_MAX_BYTES,
  decodeUtf8PayloadChunks
} from '@artificer-toolkit/shared/jsonPayloadChunks'
import type { MutationCtx } from '../_generated/server'
import { untrackedInternalMutation } from '../lib/mutations'
import { inspectCampaignLiveCheckpoint } from './authority'
import { publishCheckpointFrame } from './checkpoint'
import { applyCheckpointRecords } from './checkpointRecords'

const UPLOAD_WINDOW_MS = 24 * 60 * 60_000
const cleanupReference = makeFunctionReference<'mutation', { checkpointId: string }, null>(
  'liveSessions/checkpointStaging:cleanup'
)

async function readUpload(ctx: MutationCtx, checkpointId: string) {
  const row = await ctx.db
    .query('liveSessionCheckpointUploads')
    .withIndex('by_checkpointId', (q) => q.eq('checkpointId', checkpointId))
    .unique()
  if (!row) throw new Error('Live Session checkpoint upload is missing.')
  const { _id, _creationTime, ...fields } = row
  const upload = liveSessionStoredCheckpointUploadSchema.parse(fields)
  if (upload.expiresAt <= Date.now()) throw new Error('Live Session checkpoint upload has expired.')
  return { row, upload }
}

export async function stageCheckpoint(ctx: MutationCtx, rawInput: LiveSessionCheckpointStageInput) {
  const input = liveSessionCheckpointStageInputSchema.parse(rawInput)
  const { byteLength: _byteLength, partCount: _partCount, ...frame } = input
  const inspected = await inspectCampaignLiveCheckpoint(ctx, frame)
  if (inspected.status === 'REPLAYED') return { status: 'REPLAYED' as const }
  const existing = await ctx.db
    .query('liveSessionCheckpointUploads')
    .withIndex('by_checkpointId', (q) => q.eq('checkpointId', input.checkpointId))
    .unique()
  if (existing) {
    const { upload } = await readUpload(ctx, input.checkpointId)
    const { expiresAt: _expiresAt, ...storedInput } = upload
    if (canonicalizeJson(storedInput) !== canonicalizeJson(input))
      throw new Error('Live Session checkpoint upload identity was already used.')
  } else {
    const expiresAt = Date.now() + UPLOAD_WINDOW_MS
    await ctx.db.insert('liveSessionCheckpointUploads', {
      ...input,
      expiresAt
    })
    await ctx.scheduler.runAt(expiresAt, cleanupReference, {
      checkpointId: input.checkpointId
    })
  }
  return { status: 'STAGED' as const }
}

export async function stageCheckpointPart(
  ctx: MutationCtx,
  rawInput: LiveSessionCheckpointPartInput
) {
  const input = liveSessionCheckpointPartInputSchema.parse(rawInput)
  const { upload } = await readUpload(ctx, input.checkpointId)
  if (upload.campaignId !== input.campaignId || upload.epoch !== input.epoch)
    throw new Error('Live Session checkpoint part scope does not match.')
  const { byteLength, partCount, expiresAt: _expiresAt, ...frame } = upload
  const inspected = await inspectCampaignLiveCheckpoint(ctx, frame)
  if (inspected.status === 'REPLAYED')
    throw new Error('Live Session checkpoint is already committed.')
  if (input.index >= partCount) throw new Error('Live Session checkpoint part index is invalid.')
  const bytes = decodeBase64(input.data)
  const expectedLength =
    input.index === partCount - 1
      ? byteLength - input.index * JSON_PAYLOAD_CHUNK_MAX_BYTES
      : JSON_PAYLOAD_CHUNK_MAX_BYTES
  if (encodeBase64(bytes) !== input.data || bytes.byteLength !== expectedLength)
    throw new Error('Live Session checkpoint part bytes are invalid.')
  const existing = await ctx.db
    .query('liveSessionCheckpointUploadParts')
    .withIndex('by_checkpointId_index', (q) =>
      q.eq('checkpointId', input.checkpointId).eq('index', input.index)
    )
    .unique()
  if (existing) {
    if (encodeBase64(new Uint8Array(existing.bytes)) !== input.data)
      throw new Error('Live Session checkpoint part was already uploaded with different bytes.')
  } else {
    await ctx.db.insert('liveSessionCheckpointUploadParts', {
      checkpointId: input.checkpointId,
      index: input.index,
      bytes: bytes.slice().buffer
    })
  }
  return { status: 'STAGED' as const }
}

export async function commitStagedCheckpoint(
  ctx: MutationCtx,
  rawInput: LiveSessionCheckpointCommitInput
) {
  const {
    knownAuthorization,
    reason: _reason,
    ...frame
  } = liveSessionCheckpointCommitInputSchema.parse(rawInput)
  // An exact retry needs no uploaded bytes: the first transaction retained its validated fence.
  return publishCheckpointFrame(ctx, frame, async (writeCtx, io) => {
    const { row, upload } = await readUpload(writeCtx, frame.checkpointId)
    const { byteLength, partCount, expiresAt: _expiresAt, ...storedFrame } = upload
    if (canonicalizeJson(storedFrame) !== canonicalizeJson(frame))
      throw new Error('Live Session checkpoint upload fence does not match.')
    const parts = await writeCtx.db
      .query('liveSessionCheckpointUploadParts')
      .withIndex('by_checkpointId_index', (q) => q.eq('checkpointId', frame.checkpointId))
      .order('asc')
      .take(partCount + 1)
    if (parts.length !== partCount || parts.some((part, index) => part.index !== index))
      throw new Error('Live Session checkpoint upload is incomplete.')
    const json = decodeUtf8PayloadChunks(
      parts.map((part) => part.bytes),
      byteLength
    )
    const records = liveSessionCheckpointRecordsSchema.parse(JSON.parse(json))
    if (checksumCanonicalJson(records) !== frame.payloadChecksum)
      throw new Error('Live Session checkpoint payload checksum does not match.')
    // Reading and deleting the staged payload is charged to the remainder, not to the records.
    await io.mark('remainder')
    const adopted = await applyCheckpointRecords(writeCtx, frame, records, knownAuthorization, io)
    for (const part of parts) await writeCtx.db.delete(part._id)
    await writeCtx.db.delete(row._id)
    await io.mark('remainder')
    return adopted
  })
}

export const begin = untrackedInternalMutation({
  args: v.any(),
  returns: zodToConvex(liveSessionCheckpointStageResponseSchema),
  handler: stageCheckpoint
})
export const part = untrackedInternalMutation({
  args: v.any(),
  returns: zodToConvex(liveSessionCheckpointStageResponseSchema),
  handler: stageCheckpointPart
})
export const commit = untrackedInternalMutation({
  args: v.any(),
  returns: zodToConvex(liveSessionCheckpointResponseSchema),
  handler: commitStagedCheckpoint
})

/** Only expired, inaccessible staging bytes are removed; committed history uses its own lifecycle. */
export const cleanup = untrackedInternalMutation({
  args: { checkpointId: zodToConvex(postgresUuidSchema) },
  returns: v.null(),
  handler: async (ctx, { checkpointId }) => {
    const row = await ctx.db
      .query('liveSessionCheckpointUploads')
      .withIndex('by_checkpointId', (q) => q.eq('checkpointId', checkpointId))
      .unique()
    if (!row) return null
    if (row.expiresAt > Date.now()) {
      await ctx.scheduler.runAt(row.expiresAt, cleanupReference, {
        checkpointId
      })
      return null
    }
    const parts = await ctx.db
      .query('liveSessionCheckpointUploadParts')
      .withIndex('by_checkpointId_index', (q) => q.eq('checkpointId', checkpointId))
      .take(4)
    for (const part of parts) await ctx.db.delete(part._id)
    if (parts.length < 4) await ctx.db.delete(row._id)
    else await ctx.scheduler.runAfter(0, cleanupReference, { checkpointId })
    return null
  }
})
