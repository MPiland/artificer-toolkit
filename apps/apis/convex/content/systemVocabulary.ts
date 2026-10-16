import { systemVocabularySnapshotSchema } from '@artificer-toolkit/schema/projections/systemVocabulary'
import { checksumCanonicalJson, equalCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { requireSystem } from './systemDocuments'

function latestSnapshotRow(ctx: QueryCtx, systemId: string) {
  return ctx.db
    .query('systemVocabularySnapshots')
    .withIndex('by_systemId_snapshotVersion', (q) => q.eq('systemId', systemId))
    .order('desc')
    .first()
}

export async function readSystemVocabularySnapshot(ctx: QueryCtx, document: SystemAuthoredDto) {
  const current = await latestSnapshotRow(ctx, document.id)
  if (current) {
    const { _id, _creationTime, ...stored } = current
    const snapshot = systemVocabularySnapshotSchema.parse(stored)
    const { checksum, ...checksummed } = snapshot
    if (checksumCanonicalJson(checksummed) !== checksum) {
      throw new Error('Stored System vocabulary snapshot checksum mismatch.')
    }
    // Only a canonical System replacement advances the snapshot; a drifted System must not be served.
    if (!equalCanonicalJson(document, snapshot.document)) {
      throw new Error('Stored System vocabulary snapshot does not match the current System.')
    }
    return snapshot
  }
  return null
}

async function insertSnapshot(
  ctx: MutationCtx,
  document: SystemAuthoredDto,
  snapshotVersion: number
) {
  const snapshot = {
    snapshotId: crypto.randomUUID(),
    systemId: document.id,
    snapshotVersion,
    schemaVersion: 1,
    document
  }
  const stored = systemVocabularySnapshotSchema.parse({
    ...snapshot,
    checksum: checksumCanonicalJson(snapshot)
  })
  await ctx.db.insert('systemVocabularySnapshots', stored)
  return stored
}

export async function ensureSystemVocabularySnapshot(ctx: MutationCtx, systemId: string) {
  const document = await requireSystem(ctx, systemId)
  return (await readSystemVocabularySnapshot(ctx, document)) ?? insertSnapshot(ctx, document, 1)
}

/** Appends the next version after a canonical System replacement; Encounters keep naming earlier ones. */
export async function advanceSystemVocabularySnapshot(
  ctx: MutationCtx,
  document: SystemAuthoredDto
) {
  const latest = await latestSnapshotRow(ctx, document.id)
  return insertSnapshot(ctx, document, (latest?.snapshotVersion ?? 0) + 1)
}

// Stored Characters and Encounters name vocabulary entries by `id`.
function vocabularyIds(value: unknown, ids = new Set<string>()) {
  if (Array.isArray(value)) for (const item of value) vocabularyIds(item, ids)
  else if (typeof value === 'object' && value !== null)
    for (const [key, item] of Object.entries(value))
      if (key === 'id' && typeof item === 'string') ids.add(item)
      else vocabularyIds(item, ids)
  return ids
}

/** The entry ids a replacement System would drop, which stored play data may still name. */
export function removedVocabularyIds(current: SystemAuthoredDto, next: SystemAuthoredDto) {
  const kept = vocabularyIds(next)
  return [...vocabularyIds(current)].filter((id) => !kept.has(id))
}
