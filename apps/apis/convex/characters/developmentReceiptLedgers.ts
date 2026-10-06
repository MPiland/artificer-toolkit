import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { makeFunctionReference } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import {
  developmentReceiptLedgerCreateInputSchema,
  developmentReceiptLedgerEntryInputSchema,
  developmentReceiptLedgerInspectionSchema,
  developmentReceiptLedgerNativePageSchema,
  developmentReceiptLedgerNativeWindowSchema,
  developmentReceiptLedgerPageInputSchema,
  developmentReceiptLedgerRemovalSchema,
  developmentReceiptLedgerSeedInputSchema,
  developmentReceiptLedgerSeedResultSchema,
  type DevelopmentReceiptLedgerCreateInput,
  type DevelopmentReceiptLedgerScope,
  type DevelopmentReceiptLedgerSeedInput
} from '@artificer-toolkit/schema/api/developmentReceiptLedger'
import { characterHistoryEntryDtoSchema } from '@artificer-toolkit/schema/api/characterHistory'
import {
  liveSessionCheckpointHistoryEntrySchema,
  liveSessionCheckpointHistoryKeyFields
} from '@artificer-toolkit/schema/api/liveSessionCheckpointRecords'
import {
  RECEIPT_LEDGER_MAX_BYTES,
  RECEIPT_LEDGER_MAX_PARTS,
  type ReceiptLedgerEncodedPayload
} from '@artificer-toolkit/schema/projections/receiptLedgerPersistence'
import {
  decodeReceiptLedgerPayload,
  encodeReceiptLedgerPayload
} from '@artificer-toolkit/encounter-persistence/receiptLedger'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { ActionCtx, QueryCtx } from '../_generated/server'
import { requireFixtureAccount } from '../lib/developmentFixtures'
import { internalMutation } from '../lib/mutations'
import { internalQuery } from '../lib/queries'
import { internalAction } from '../_generated/server'
import { deleteReceiptHeaders, writeReceiptLedger } from '../lib/receiptLedgers'
import { paginateReceiptHeaders } from '../lib/receiptPagination'
import { readCharacterReceiptHistory } from './documents'

const SEED_ROLLBACK_MARKER = 'RECEIPT_LEDGER_PROOF_ROLLBACK_AFTER_CREATE'
const FIXTURE_OCCURRED_AT = '2026-09-30T00:00:00.000Z'

async function requireFixtureCharacter(ctx: QueryCtx, scope: DevelopmentReceiptLedgerScope) {
  await requireFixtureAccount(ctx, scope.userId)
  const [active, draft] = await Promise.all([
    ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', scope.characterId))
      .unique(),
    ctx.db
      .query('characterDrafts')
      .withIndex('by_characterId', (q) => q.eq('characterId', scope.characterId))
      .unique()
  ])
  if (
    (!active && !draft) ||
    (active && active.userId !== scope.userId) ||
    (draft && draft.userId !== scope.userId)
  )
    throw new Error('Receipt ledger proof requires an owned fixture Character.')
}

function fixtureIdentity(characterId: string, ordinal: number) {
  return `${characterId.slice(0, -2)}${ordinal.toString(16).padStart(2, '0')}`
}

/**
 * Builds, encodes and decodes the maximal ledger in an action with the production codec. The
 * creating mutation then only writes it: encoding, decoding and hashing a 4 MiB body overrun the
 * one-second mutation limit, and production never writes a body that large in one mutation
 * (checkpoints are capped at 1 MiB).
 */
async function seedMaximalLedger(ctx: ActionCtx, input: DevelopmentReceiptLedgerSeedInput) {
  const ledgerId = fixtureIdentity(input.characterId, input.ordinal)
  const eventId = crypto.randomUUID()
  const commandFingerprint = checksumCanonicalJson({
    characterId: input.characterId,
    userId: input.userId,
    ordinal: input.ordinal
  })
  function entry(summary: string) {
    const history = characterHistoryEntryDtoSchema.parse({
      eventId,
      occurredAt: FIXTURE_OCCURRED_AT,
      actorId: input.userId,
      eventType: 'RECEIPT_LEDGER_PROOF',
      summary
    })
    const value = {
      id: eventId,
      characterId: input.characterId,
      commandId: ledgerId,
      actorId: input.userId,
      commandFingerprint,
      occurredAt: FIXTURE_OCCURRED_AT,
      historyJson: history,
      historyChecksum: checksumRuleDocument(history)
    }
    return liveSessionCheckpointHistoryEntrySchema.parse({
      table: 'characterCommandReceipts',
      key: liveSessionCheckpointHistoryKeyFields.characterCommandReceipts.map(
        (field) => value[field]
      ),
      value,
      checksum: checksumCanonicalJson(value)
    })
  }
  const encoder = new TextEncoder()
  const overhead = encoder.encode(canonicalizeJson([entry('')])).byteLength
  if (overhead >= RECEIPT_LEDGER_MAX_BYTES)
    throw new Error('Receipt ledger fixture overhead is invalid.')
  const padded = entry(
    String.fromCharCode(65 + input.ordinal).repeat(RECEIPT_LEDGER_MAX_BYTES - overhead)
  )
  const encoded = encodeReceiptLedgerPayload([padded])
  if (encoded.byteLength !== RECEIPT_LEDGER_MAX_BYTES)
    throw new Error('Receipt ledger fixture is not exactly maximal.')
  const [decoded] = decodeReceiptLedgerPayload(encoded)
  await ctx.runMutation(
    makeFunctionReference<
      'mutation',
      DevelopmentReceiptLedgerCreateInput & { encoded: ReceiptLedgerEncodedPayload },
      null
    >('characters/developmentReceiptLedgers:create'),
    { ...input, entry: decoded!, encoded }
  )
  return developmentReceiptLedgerSeedResultSchema.parse({
    ledgerId,
    commandId: ledgerId,
    eventId,
    byteLength: encoded.byteLength
  })
}

export const create = internalMutation({
  args: {
    ...zodToConvexFields(developmentReceiptLedgerSeedInputSchema.shape),
    entry: v.any(),
    encoded: v.object({
      entryCount: v.number(),
      byteLength: v.number(),
      checksum: v.string(),
      partCount: v.number(),
      payload: v.null(),
      parts: v.array(v.bytes())
    })
  },
  returns: zodToConvex(developmentReceiptLedgerRemovalSchema),
  handler: async (ctx, { encoded, ...args }) => {
    const { entry, rollback, ...scope } = developmentReceiptLedgerCreateInputSchema.parse(args)
    await requireFixtureCharacter(ctx, scope)
    await writeReceiptLedger(
      ctx,
      {
        id: fixtureIdentity(scope.characterId, scope.ordinal),
        scope: 'CHARACTER',
        scopeId: scope.characterId,
        epoch: null,
        checkpointId: null,
        createdAt: FIXTURE_OCCURRED_AT
      },
      encoded,
      [entry]
    )
    if (rollback) throw new ConvexError(SEED_ROLLBACK_MARKER)
    return null
  }
})

export const seed = internalAction({
  args: zodToConvexFields(developmentReceiptLedgerSeedInputSchema.shape),
  returns: zodToConvex(developmentReceiptLedgerSeedResultSchema),
  handler: async (ctx, args) =>
    seedMaximalLedger(ctx, developmentReceiptLedgerSeedInputSchema.parse(args))
})

export const verifySeedRollback = internalAction({
  args: zodToConvexFields(developmentReceiptLedgerEntryInputSchema.shape),
  returns: zodToConvex(developmentReceiptLedgerRemovalSchema),
  handler: async (ctx, args) => {
    try {
      await seedMaximalLedger(ctx, {
        ...developmentReceiptLedgerEntryInputSchema.parse(args),
        rollback: true
      })
    } catch (error) {
      if (error instanceof ConvexError && error.data === SEED_ROLLBACK_MARKER) return null
      throw error
    }
    throw new Error('The native receipt ledger creation rollback marker was not raised.')
  }
})

export const page = internalQuery({
  args: zodToConvexFields(developmentReceiptLedgerPageInputSchema.shape),
  returns: zodToConvex(developmentReceiptLedgerNativePageSchema),
  handler: async (ctx, args) => {
    const input = developmentReceiptLedgerPageInputSchema.parse(args)
    await requireFixtureCharacter(ctx, input)
    const result = await paginateReceiptHeaders(
      ctx,
      'characterCommandReceipts',
      ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_actorId_occurredAt_id', (q) =>
          q.eq('characterId', input.characterId).eq('actorId', input.userId)
        )
        .order('asc'),
      { ...input.paginationOpts, maximumBytesRead: 1024 * 1024 }
    )
    return developmentReceiptLedgerNativePageSchema.parse({
      ...result,
      characterId: input.characterId,
      page: result.page.map(readCharacterReceiptHistory)
    })
  }
})

export const nativeWindow = internalQuery({
  args: zodToConvexFields(developmentReceiptLedgerPageInputSchema.shape),
  returns: zodToConvex(developmentReceiptLedgerNativeWindowSchema),
  handler: async (ctx, args) => {
    const input = developmentReceiptLedgerPageInputSchema.parse(args)
    await requireFixtureCharacter(ctx, input)
    const { page: headers, ...metadata } = await ctx.db
      .query('characterCommandReceipts')
      .withIndex('by_characterId_actorId_occurredAt_id', (q) =>
        q.eq('characterId', input.characterId).eq('actorId', input.userId)
      )
      .order('asc')
      .paginate({
        ...input.paginationOpts,
        numItems: 1,
        maximumRowsRead: 1,
        maximumBytesRead: 1024 * 1024
      })
    return developmentReceiptLedgerNativeWindowSchema.parse({
      ...metadata,
      headerIds: headers.map((header) => header.id)
    })
  }
})

export const inspect = internalQuery({
  args: zodToConvexFields(developmentReceiptLedgerEntryInputSchema.shape),
  returns: zodToConvex(developmentReceiptLedgerInspectionSchema),
  handler: async (ctx, args) => {
    const input = developmentReceiptLedgerEntryInputSchema.parse(args)
    await requireFixtureCharacter(ctx, input)
    const ledgerId = fixtureIdentity(input.characterId, input.ordinal)
    const [headers, heads, parts] = await Promise.all([
      ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_commandId', (q) =>
          q.eq('characterId', input.characterId).eq('commandId', ledgerId)
        )
        .take(2),
      ctx.db
        .query('receiptLedgers')
        .withIndex('by_publicId', (q) => q.eq('id', ledgerId))
        .take(2),
      ctx.db
        .query('receiptLedgerParts')
        .withIndex('by_ledgerId_index', (q) => q.eq('ledgerId', ledgerId))
        .take(RECEIPT_LEDGER_MAX_PARTS + 1)
    ])
    if (
      headers.length > 1 ||
      heads.length > 1 ||
      parts.length > RECEIPT_LEDGER_MAX_PARTS ||
      headers.some((header) => header.actorId !== input.userId || header.ledgerId !== ledgerId) ||
      heads.some((head) => head.scope !== 'CHARACTER' || head.scopeId !== input.characterId)
    )
      throw new Error('Receipt ledger fixture storage identity is invalid.')
    return developmentReceiptLedgerInspectionSchema.parse({
      headerExists: headers.length === 1,
      ledgerExists: heads.length === 1,
      partCount: parts.length
    })
  }
})

export const remove = internalMutation({
  args: zodToConvexFields(developmentReceiptLedgerEntryInputSchema.shape),
  returns: zodToConvex(developmentReceiptLedgerRemovalSchema),
  handler: async (ctx, args) => {
    const input = developmentReceiptLedgerEntryInputSchema.parse(args)
    await requireFixtureCharacter(ctx, input)
    const ledgerId = fixtureIdentity(input.characterId, input.ordinal)
    const headers = await ctx.db
      .query('characterCommandReceipts')
      .withIndex('by_characterId_commandId', (q) =>
        q.eq('characterId', input.characterId).eq('commandId', ledgerId)
      )
      .take(2)
    if (
      headers.length > 1 ||
      headers.some((header) => header.actorId !== input.userId || header.ledgerId !== ledgerId)
    )
      throw new Error('Receipt ledger fixture removal identity is invalid.')
    const header = headers[0]
    if (header) {
      await deleteReceiptHeaders(ctx, [{ table: 'characterCommandReceipts', header }])
    } else {
      const [heads, parts] = await Promise.all([
        ctx.db
          .query('receiptLedgers')
          .withIndex('by_publicId', (q) => q.eq('id', ledgerId))
          .take(1),
        ctx.db
          .query('receiptLedgerParts')
          .withIndex('by_ledgerId_index', (q) => q.eq('ledgerId', ledgerId))
          .take(1)
      ])
      if (heads.length || parts.length)
        throw new Error('Receipt ledger fixture removal found orphaned storage.')
    }
    return null
  }
})
