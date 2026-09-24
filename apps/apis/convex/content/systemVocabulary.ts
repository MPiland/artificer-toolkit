import { systemVocabularySnapshotSchema } from '@artificer-toolkit/schema/projections/systemVocabulary'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { requireSystem } from './systemDocuments'

export async function readSystemVocabularySnapshot(ctx: QueryCtx, document: SystemAuthoredDto) {
  const current = await ctx.db
    .query('systemVocabularySnapshots')
    .withIndex('by_systemId_snapshotVersion', (q) => q.eq('systemId', document.id))
    .order('desc')
    .first()
  if (current) {
    const { _id, _creationTime, ...stored } = current
    const snapshot = systemVocabularySnapshotSchema.parse(stored)
    const { checksum, ...checksummed } = snapshot
    if (checksumCanonicalJson(checksummed) !== checksum) {
      throw new Error('Stored System vocabulary snapshot checksum mismatch.')
    }
    // System imports are immutable; changed vocabulary requires an explicit publication flow.
    if (checksumCanonicalJson(document) !== checksumCanonicalJson(snapshot.document)) {
      throw new Error('Stored System vocabulary snapshot does not match the current System.')
    }
    return snapshot
  }
  return null
}

export async function ensureSystemVocabularySnapshot(ctx: MutationCtx, systemId: string) {
  const document = await requireSystem(ctx, systemId)
  const current = await readSystemVocabularySnapshot(ctx, document)
  if (current) return current
  const snapshot = {
    snapshotId: crypto.randomUUID(),
    systemId,
    snapshotVersion: 1,
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
