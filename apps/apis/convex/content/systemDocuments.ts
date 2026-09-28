import { systemAuthoredDtoSchema } from '@artificer-toolkit/schema/vocabulary/system'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { deriveOnce } from '@artificer-toolkit/encounter-persistence/transactionReads'

export function readSystem(record: Doc<'systems'>) {
  if (checksumRuleDocument(record.document) !== record.checksum) {
    throw new Error('Stored System checksum mismatch.')
  }
  const document = systemAuthoredDtoSchema.parse(record.document)
  if (document.id !== record.id) throw new Error('Stored System identity mismatch.')
  return document
}

export async function requireSystem(ctx: QueryCtx, systemId: string) {
  const record = await ctx.db
    .query('systems')
    .withIndex('by_publicId', (q) => q.eq('id', systemId))
    .unique()
  if (!record) throw new Error('The selected Game System is unavailable.')
  return deriveOnce(record, readSystem)
}
