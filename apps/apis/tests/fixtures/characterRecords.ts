import type { CharacterSheetState } from '@artificer-toolkit/schema/projections/characterSheetState'
import {
  encodeCharacterRecord,
  type CharacterDocument
} from '@artificer-toolkit/schema/projections/characterStoredState'
import type { MutationCtx } from '../../convex/_generated/server'
import {
  readCharacterRecord,
  readCharacterRow,
  type CharacterRow
} from '../../convex/characters/stateDocuments'

/**
 * Rewrites a stored Character in place the way its writer would encode it: structure and play state
 * are re-encoded into their own records, and each clock advances only when its record changes.
 * Fixtures use it to seed states the public mutations cannot reach.
 */
export async function writeCharacterRecord(
  ctx: MutationCtx,
  row: CharacterRow,
  next: {
    document: CharacterDocument
    sheetState?: CharacterSheetState
    streamVersion?: number
    updatedAt?: string
    maximumHitPoints?: number
    /** Reassigns the Character's owner across its document, structure row and play record. */
    userId?: string
  }
) {
  const encoded = encodeCharacterRecord(row, {
    document: next.userId ? { ...next.document, userId: next.userId } : next.document,
    sheetState: next.sheetState,
    streamVersion: next.streamVersion ?? row.play.streamVersion,
    updatedAt: next.updatedAt ?? row.updatedAt
  })
  await ctx.db.patch(row._id, {
    label: next.document.label,
    documentJson: encoded.documentJson,
    checksum: encoded.checksum,
    sheetState: encoded.sheetState,
    updatedAt: encoded.updatedAt,
    userId: next.userId ?? row.userId
  })
  await ctx.db.patch(row.play._id, {
    playJson: encoded.play.playJson,
    checksum: encoded.play.checksum,
    streamVersion: encoded.play.streamVersion,
    updatedAt: encoded.play.updatedAt,
    maximumHitPoints: next.maximumHitPoints ?? row.play.maximumHitPoints,
    userId: next.userId ?? row.play.userId
  })
}

/** Reads a Character's merged document, lets `edit` return its replacement, and writes it back. */
export async function editCharacterRecord(
  ctx: MutationCtx,
  characterId: string,
  edit: (document: CharacterDocument, row: CharacterRow) => CharacterDocument,
  options: Omit<Parameters<typeof writeCharacterRecord>[2], 'document'> = {}
) {
  const row = await readCharacterRow(ctx, characterId)
  if (!row) throw new Error('Missing Character fixture.')
  await writeCharacterRecord(ctx, row, {
    document: edit(readCharacterRecord(row), row),
    ...options
  })
}
