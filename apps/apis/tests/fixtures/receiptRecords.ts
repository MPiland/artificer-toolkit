import {
  encodeReceiptLedgerPayload,
  projectReceiptHeader
} from '@artificer-toolkit/encounter-persistence/receiptLedger'
import {
  liveSessionCheckpointHistoryEntrySchema,
  liveSessionCheckpointHistoryKeyFields
} from '@artificer-toolkit/schema/api/liveSessionCheckpointRecords'
import type { liveSessionCheckpointSceneSchemas } from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import {
  encounterStoreSchemas,
  type EncounterStoreDocuments
} from '@artificer-toolkit/schema/projections/encounterStore'
import {
  receiptHeaderSchemas,
  type ReceiptHeaderTable
} from '@artificer-toolkit/schema/projections/receiptHeaderPersistence'
import { canonicalJsonRecordSchema } from '@artificer-toolkit/schema/shared/jsonDelta'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { z } from 'zod'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import type { MutationCtx } from '../../convex/_generated/server'
import {
  createReceiptLedger,
  readReceiptHeader,
  readReceiptLedger
} from '../../convex/lib/receiptLedgers'

/** Changes logical history while keeping its physical envelope and stable header slot valid. */
export async function replaceReceiptRecord<Table extends ReceiptHeaderTable>(
  ctx: MutationCtx,
  table: Table,
  headerNativeId: Id<Table>,
  logicalPatch: Partial<EncounterStoreDocuments[Table]>
) {
  const header = await ctx.db.get(headerNativeId)
  if (!header) throw new Error('Receipt fixture header is unavailable.')
  const { _id, _creationTime, ...logical } = await readReceiptHeader(ctx, table, header)
  const stored = encounterStoreSchemas[table].parse({ ...logical, ...logicalPatch })
  const value = canonicalJsonRecordSchema.parse(
    Object.fromEntries(
      Object.entries(stored)
        .filter(([, value]) => value !== undefined)
        .map(([field, value]) => {
          if (!field.endsWith('Json') || value === null) return [field, value]
          if (typeof value !== 'string') throw new Error('Receipt fixture JSON field is invalid.')
          const decoded: unknown = JSON.parse(value)
          return [field, decoded]
        })
    )
  )
  const entry = liveSessionCheckpointHistoryEntrySchema.parse({
    table,
    key: liveSessionCheckpointHistoryKeyFields[table].map((field) => value[field]),
    value,
    checksum: checksumCanonicalJson(value)
  })
  const ledger = await readReceiptLedger(ctx, header.ledgerId)
  const entries = [...ledger.entries]
  entries[header.entryIndex] = entry
  const { payload, parts, ...metadata } = encodeReceiptLedgerPayload(entries)
  const replacementHead = { ...ledger.metadata, ...metadata, payload }
  await ctx.db.replace(ledger.head._id, replacementHead)
  for (const part of ledger.parts) await ctx.db.delete(part._id)
  const replacementParts: Doc<'receiptLedgerParts'>[] = []
  for (const [index, bytes] of parts.entries()) {
    const id = await ctx.db.insert('receiptLedgerParts', {
      ledgerId: header.ledgerId,
      index,
      bytes
    })
    const part = await ctx.db.get(id)
    if (!part) throw new Error('Receipt fixture part is unavailable.')
    replacementParts.push(part)
  }
  const projected = projectReceiptHeader(entry, {
    ledgerId: header.ledgerId,
    entryIndex: header.entryIndex,
    entryChecksum: entry.checksum
  })
  switch (table) {
    case 'characterCommandReceipts': {
      const id = ctx.db.normalizeId('characterCommandReceipts', headerNativeId)
      if (!id) throw new Error('Receipt fixture header identity is invalid.')
      await ctx.db.replace(id, receiptHeaderSchemas.characterCommandReceipts.parse(projected))
      break
    }
    case 'encounterRunCommands': {
      const id = ctx.db.normalizeId('encounterRunCommands', headerNativeId)
      if (!id) throw new Error('Receipt fixture header identity is invalid.')
      await ctx.db.replace(id, receiptHeaderSchemas.encounterRunCommands.parse(projected))
      break
    }
    case 'encounterRuleReceipts': {
      const id = ctx.db.normalizeId('encounterRuleReceipts', headerNativeId)
      if (!id) throw new Error('Receipt fixture header identity is invalid.')
      await ctx.db.replace(id, receiptHeaderSchemas.encounterRuleReceipts.parse(projected))
      break
    }
    case 'encounterEvidenceRolls': {
      const id = ctx.db.normalizeId('encounterEvidenceRolls', headerNativeId)
      if (!id) throw new Error('Receipt fixture header identity is invalid.')
      await ctx.db.replace(id, receiptHeaderSchemas.encounterEvidenceRolls.parse(projected))
    }
  }
  // Multiple deliberate edits in one fixture transaction may share the same ledger.
  ledger.entries = entries
  ledger.metadata = { ...ledger.metadata, ...metadata }
  ledger.head = { ...ledger.head, ...replacementHead }
  ledger.parts = replacementParts
}

type SceneStoredCommand = z.infer<typeof liveSessionCheckpointSceneSchemas.sceneLiveCommands>

/** Packs already-validated stored Scene commands into one SCENE ledger and indexes their headers. */
export async function insertSceneCommandLedger(
  ctx: MutationCtx,
  commands: readonly SceneStoredCommand[],
  options: { createdAt?: string } = {}
) {
  const [first] = commands
  if (!first) throw new Error('A Scene command ledger needs at least one command.')
  return createReceiptLedger(
    ctx,
    {
      id: crypto.randomUUID(),
      scope: 'SCENE',
      scopeId: first.sceneId,
      epoch: crypto.randomUUID(),
      checkpointId: crypto.randomUUID(),
      createdAt: options.createdAt ?? new Date().toISOString()
    },
    commands.map((command) => {
      const value = canonicalJsonRecordSchema.parse(JSON.parse(JSON.stringify(command)))
      return {
        table: 'sceneLiveCommands' as const,
        key: [command.sceneId, command.commandId],
        value,
        checksum: checksumCanonicalJson(value)
      }
    })
  )
}

/** A minimal valid UNDO receipt; scalar checksums are opaque to ledger storage. */
export function undoSceneCommand(sceneId: string, actorUserId: string): SceneStoredCommand {
  const commandId = crypto.randomUUID()
  return {
    encoding: 'UNDO',
    sceneId,
    commandId,
    actorUserId,
    input: {
      type: 'UNDO_LAST_SCENE_MOVE',
      commandId,
      sceneId,
      expectedSceneVersion: 1
    },
    inputChecksum: 'a'.repeat(64),
    result: {
      commandId,
      sceneId,
      version: 2,
      replayed: false,
      occurrence: null,
      delta: {
        kind: 'TOKEN_MOVE_UNDONE',
        tokenId: crypto.randomUUID(),
        position: { x: 1, y: 2 },
        undoneCommandId: crypto.randomUUID()
      },
      restoredFogOwners: []
    },
    resultChecksum: 'a'.repeat(64)
  }
}
