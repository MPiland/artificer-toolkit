import type { CharacterSheetState } from '@artificer-toolkit/schema/projections/characterSheetState'
import type { CharacterDocument } from '@artificer-toolkit/schema/projections/characterStoredState'
import type { MutationCtx } from '../../convex/_generated/server'
import { writeCharacterRecord as writeStoredCharacterRecord } from '../../convex/characters/characterWrites'
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
    speeds?: CharacterRow['play']['speeds']
    status?: 'ACTIVE' | 'DRAFT'
    portraitAssetId?: string
    portraitRevision?: number
    /** Reassigns the Character's owner across its document, structure row and play record. */
    userId?: string
  }
) {
  const status = next.status ?? next.document.status ?? row.status
  await writeStoredCharacterRecord(ctx, {
    current: row,
    fields: {
      label: next.document.label,
      status,
      userId: next.userId ?? row.userId,
      ...(next.portraitAssetId === undefined ? {} : { portraitAssetId: next.portraitAssetId }),
      ...(next.portraitRevision === undefined ? {} : { portraitRevision: next.portraitRevision }),
      streamVersion: next.streamVersion ?? row.play.streamVersion,
      updatedAt: next.updatedAt ?? row.updatedAt
    },
    document: { ...next.document, status, userId: next.userId ?? next.document.userId },
    sheetState: next.sheetState,
    stats: {
      maximumHitPoints: next.maximumHitPoints ?? row.play.maximumHitPoints,
      speeds: next.speeds ?? row.play.speeds
    }
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
