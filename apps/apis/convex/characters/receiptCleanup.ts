import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  characterReceiptPurgeInputSchema,
  characterReceiptPurgeJobSchema,
  receiptLedgerMetadataSchema,
  receiptLedgerPartMetadataSchema,
  type CharacterReceiptPurgeInput
} from '@artificer-toolkit/schema/projections/receiptLedgerPersistence'
import { receiptHeaderSchemas } from '@artificer-toolkit/schema/projections/receiptHeaderPersistence'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import { JSON_PAYLOAD_CHUNK_MAX_BYTES } from '@artificer-toolkit/shared/jsonPayloadChunks'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { internalMutation } from '../lib/mutations'

const purgeReference = makeFunctionReference<'mutation', CharacterReceiptPurgeInput>(
  'characters/receiptCleanup:purge'
)
const PARTS_PER_PASS = 4

/** The authorized caller deletes the Character in this same transaction (ADR 0035 D71). */
export async function retireCharacterReceipts(
  ctx: MutationCtx,
  characterId: string,
  ownerUserId: string,
  headers: readonly Doc<'characterCommandReceipts'>[]
) {
  const intent = characterReceiptPurgeJobSchema.parse({
    characterId,
    ownerUserId,
    createdAt: new Date().toISOString()
  })
  for (const header of headers) {
    const { _id, _creationTime, ...fields } = header
    const parsed = receiptHeaderSchemas.characterCommandReceipts.parse(fields)
    if (parsed.characterId !== characterId || canonicalizeJson(parsed) !== canonicalizeJson(fields))
      throw new Error('Private receipt retirement ownership or metadata is invalid.')
  }
  const existing = await ctx.db
    .query('characterReceiptPurgeJobs')
    .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
    .unique()
  if (existing && existing.ownerUserId !== ownerUserId)
    throw new Error('Private receipt purge intent ownership is invalid.')
  if (!existing) await ctx.db.insert('characterReceiptPurgeJobs', intent)
  for (const header of headers) await ctx.db.delete(header._id)
  await ctx.scheduler.runAfter(0, purgeReference, { characterId })
}

export const purge = internalMutation({
  args: zodToConvexFields(characterReceiptPurgeInputSchema.shape),
  returns: v.null(),
  handler: async (ctx, args) => {
    const { characterId } = characterReceiptPurgeInputSchema.parse(args)
    const job = await ctx.db
      .query('characterReceiptPurgeJobs')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .unique()
    if (!job) return null
    const { _id, _creationTime, ...fields } = job
    characterReceiptPurgeJobSchema.parse(fields)
    const [active, draft, route, privateHeader] = await Promise.all([
      ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', characterId))
        .first(),
      ctx.db
        .query('characterDrafts')
        .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
        .first(),
      ctx.db
        .query('authoredRouteIds')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', characterId))
        .first(),
      ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_commandId', (q) => q.eq('characterId', characterId))
        .first()
    ])
    if (active || draft || route || privateHeader)
      throw new Error('Cannot purge receipt payloads for a retained Character or live history.')
    const head = await ctx.db
      .query('receiptLedgers')
      .withIndex('by_scope_scopeId', (q) => q.eq('scope', 'CHARACTER').eq('scopeId', characterId))
      .first()
    if (!head) {
      await ctx.db.delete(job._id)
      return null
    }
    const { _id: headId, _creationTime: _headTime, payload: _payload, ...metadataFields } = head
    const metadata = receiptLedgerMetadataSchema.parse(metadataFields)
    if (metadata.scope !== 'CHARACTER' || metadata.scopeId !== characterId)
      throw new Error('Private receipt purge ledger ownership is invalid.')
    for (const table of Object.keys(
      receiptHeaderSchemas
    ) as (keyof typeof receiptHeaderSchemas)[]) {
      const reference = await ctx.db
        .query(table)
        .withIndex('by_ledgerId_entryIndex', (q) => q.eq('ledgerId', head.id))
        .first()
      if (reference) throw new Error('Cannot purge a receipt ledger with live references.')
    }
    // Retired payloads are inaccessible. Remove bounded parts without decoding discarded history.
    const parts = await ctx.db
      .query('receiptLedgerParts')
      .withIndex('by_ledgerId_index', (q) => q.eq('ledgerId', head.id))
      .order('asc')
      .take(PARTS_PER_PASS)
    for (const part of parts) {
      const { _id: partId, _creationTime: _partTime, bytes, ...partFields } = part
      const parsed = receiptLedgerPartMetadataSchema.parse(partFields)
      if (
        parsed.ledgerId !== head.id ||
        parsed.index >= metadata.partCount ||
        bytes.byteLength > JSON_PAYLOAD_CHUNK_MAX_BYTES
      )
        throw new Error('Private receipt purge part metadata is invalid.')
      await ctx.db.delete(partId)
    }
    if (parts.length < PARTS_PER_PASS) await ctx.db.delete(headId)
    await ctx.scheduler.runAfter(0, purgeReference, { characterId })
    return null
  }
})
