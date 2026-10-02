import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { RECEIPT_LEDGER_MAX_PARTS } from '@artificer-toolkit/schema/projections/receiptLedgerPersistence'
import { internalMutation } from '../lib/mutations'

/**
 * Scene command receipts and geometry saves back two readers only:
 * idempotent replay by command ID (client retries and Session outbox redelivery, which settle within
 * minutes of commit) and owner undo, which walks back through committed moves. Thirty days keeps
 * replay far beyond any retry horizon and bounds undo history to the last month of play.
 *
 * Receipts are packed into one Scene receipt ledger per checkpoint (`receiptLedgers`, scope SCENE)
 * and indexed by `sceneLiveCommands` headers. The ledger is the retention unit: it is removed once
 * its checkpoint time passes the cutoff, then the headers it left behind are removed oldest-first
 * together with their geometry save. An UNDO receipt is always newer than the move it reverses, so
 * a retained move never loses its undo marker. The room checkpoint writes only published saves.
 */
export const SCENE_COMMAND_RETENTION_MS = 30 * 86_400_000
const PURGE_BATCH_SIZE = 64
// A ledger deletion reads its payload parts, so fewer ledgers fit one transaction's read budget.
const LEDGER_PURGE_BATCH_SIZE = 8

const purgeReference = makeFunctionReference<'mutation', Record<string, never>, null>(
  'scenes/commandRetention:purge'
)

export const purge = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - SCENE_COMMAND_RETENTION_MS
    const ledgers = await ctx.db
      .query('receiptLedgers')
      .withIndex('by_scope_createdAt', (q) =>
        q.eq('scope', 'SCENE').lt('createdAt', new Date(cutoff).toISOString())
      )
      .take(LEDGER_PURGE_BATCH_SIZE)
    for (const ledger of ledgers) {
      const parts = await ctx.db
        .query('receiptLedgerParts')
        .withIndex('by_ledgerId_index', (q) => q.eq('ledgerId', ledger.id))
        .take(RECEIPT_LEDGER_MAX_PARTS)
      for (const part of parts) await ctx.db.delete(part._id)
      await ctx.db.delete(ledger._id)
    }

    // Headers are never newer than their ledger, so the first one whose ledger survives ends the pass.
    const headers = await ctx.db
      .query('sceneLiveCommands')
      .withIndex('by_creation_time', (q) => q.lt('_creationTime', cutoff))
      .take(PURGE_BATCH_SIZE)
    let headersDeleted = 0
    for (const header of headers) {
      const ledger = await ctx.db
        .query('receiptLedgers')
        .withIndex('by_publicId', (q) => q.eq('id', header.ledgerId))
        .unique()
      if (ledger) break
      const save = await ctx.db
        .query('sceneGeometrySaves')
        .withIndex('by_sceneId_commandId', (q) =>
          q.eq('sceneId', header.sceneId).eq('commandId', header.commandId)
        )
        .unique()
      if (save) await ctx.db.delete(save._id)
      await ctx.db.delete(header._id)
      headersDeleted++
    }

    // Saves without a receipt (expired staging, or orphaned) age out on their own. A save whose
    // receipt is still retained stops this pass; the receipt pass removes both once it ages out.
    const saves = await ctx.db
      .query('sceneGeometrySaves')
      .withIndex('by_creation_time', (q) => q.lt('_creationTime', cutoff))
      .take(PURGE_BATCH_SIZE)
    let savesDeleted = 0
    for (const save of saves) {
      if (save.status === 'RECEIVING') break
      const header = await ctx.db
        .query('sceneLiveCommands')
        .withIndex('by_sceneId_commandId', (q) =>
          q.eq('sceneId', save.sceneId).eq('commandId', save.commandId)
        )
        .unique()
      if (header) break
      await ctx.db.delete(save._id)
      savesDeleted++
    }

    if (
      ledgers.length === LEDGER_PURGE_BATCH_SIZE ||
      headersDeleted === PURGE_BATCH_SIZE ||
      savesDeleted === PURGE_BATCH_SIZE
    )
      await ctx.scheduler.runAfter(0, purgeReference, {})
    return null
  }
})
