import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { makeFunctionReference } from 'convex/server'
import { ConvexError } from 'convex/values'
import {
  developmentReceiptLedgerEntryInputSchema,
  developmentReceiptLedgerInspectionSchema,
  developmentReceiptLedgerKeysetInputSchema,
  developmentReceiptLedgerNativePageSchema,
  developmentReceiptLedgerNativeWindowSchema,
  developmentReceiptLedgerPageInputSchema,
  developmentReceiptLedgerRemovalSchema,
  developmentReceiptLedgerSeedInputSchema,
  developmentReceiptLedgerSeedResultSchema,
  type DevelopmentReceiptLedgerScope,
  type DevelopmentReceiptLedgerSeedInput,
  type DevelopmentReceiptLedgerSeedResult
} from '@artificer-toolkit/schema/api/developmentReceiptLedger'
import {
  characterHistoryEntryDtoSchema,
  characterHistoryPageSchema
} from '@artificer-toolkit/schema/api/characterHistory'
import {
  liveSessionCheckpointHistoryEntrySchema,
  liveSessionCheckpointHistoryKeyFields
} from '@artificer-toolkit/schema/api/liveSessionCheckpointRecords'
import {
  RECEIPT_LEDGER_MAX_BYTES,
  RECEIPT_LEDGER_MAX_PARTS
} from '@artificer-toolkit/schema/projections/receiptLedgerPersistence'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { QueryCtx } from '../_generated/server'
import { requireFixtureAccount } from '../lib/developmentFixtures'
import { internalMutation } from '../lib/mutations'
import { internalQuery } from '../lib/queries'
import { internalAction } from '../_generated/server'
import { createReceiptLedger, deleteReceiptHeaders } from '../lib/receiptLedgers'
import { paginateReceiptHeaders, readCharacterHistoryHeaders } from '../lib/receiptPagination'
import { readCharacterReceiptHistory } from './documents'

const SEED_ROLLBACK_MARKER = 'RECEIPT_LEDGER_PROOF_ROLLBACK_AFTER_CREATE'

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

export const seed = internalMutation({
  args: zodToConvexFields(developmentReceiptLedgerSeedInputSchema.shape),
  returns: zodToConvex(developmentReceiptLedgerSeedResultSchema),
  handler: async (ctx, args) => {
    const input = developmentReceiptLedgerSeedInputSchema.parse(args)
    await requireFixtureCharacter(ctx, input)
    const ledgerId = fixtureIdentity(input.characterId, input.ordinal)
    const commandId = ledgerId
    const eventId = crypto.randomUUID()
    const occurredAt = '2026-09-30T00:00:00.000Z'
    const commandFingerprint = checksumCanonicalJson({
      characterId: input.characterId,
      userId: input.userId,
      ordinal: input.ordinal
    })
    function entry(summary: string) {
      const history = characterHistoryEntryDtoSchema.parse({
        eventId,
        occurredAt,
        actorId: input.userId,
        eventType: 'RECEIPT_LEDGER_PROOF',
        summary
      })
      const value = {
        id: eventId,
        characterId: input.characterId,
        commandId,
        actorId: input.userId,
        commandFingerprint,
        occurredAt,
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
    const byteLength = encoder.encode(canonicalizeJson([padded])).byteLength
    if (byteLength !== RECEIPT_LEDGER_MAX_BYTES)
      throw new Error('Receipt ledger fixture is not exactly maximal.')
    await createReceiptLedger(
      ctx,
      {
        id: ledgerId,
        scope: 'CHARACTER',
        scopeId: input.characterId,
        epoch: null,
        checkpointId: null,
        createdAt: occurredAt
      },
      [padded]
    )
    if (input.rollback) throw new ConvexError(SEED_ROLLBACK_MARKER)
    return developmentReceiptLedgerSeedResultSchema.parse({
      ledgerId,
      commandId,
      eventId,
      byteLength
    })
  }
})

export const verifySeedRollback = internalAction({
  args: zodToConvexFields(developmentReceiptLedgerEntryInputSchema.shape),
  returns: zodToConvex(developmentReceiptLedgerRemovalSchema),
  handler: async (ctx, args) => {
    const seedReference = makeFunctionReference<
      'mutation',
      DevelopmentReceiptLedgerSeedInput,
      DevelopmentReceiptLedgerSeedResult
    >('characters/developmentReceiptLedgers:seed')
    try {
      await ctx.runMutation(seedReference, {
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

export const keysetPage = internalQuery({
  args: zodToConvexFields(developmentReceiptLedgerKeysetInputSchema.shape),
  returns: zodToConvex(characterHistoryPageSchema),
  handler: async (ctx, args) => {
    const input = developmentReceiptLedgerKeysetInputSchema.parse(args)
    await requireFixtureCharacter(ctx, input)
    const result = await readCharacterHistoryHeaders(
      ctx,
      input.characterId,
      input.userId,
      input.paginationOpts
    )
    return characterHistoryPageSchema.parse({
      ...result,
      characterId: input.characterId,
      page: result.page.map(readCharacterReceiptHistory)
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
