import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { isImportRowVisible } from '../imports/visibility'

// Class list row reads stay apart from catalogue writes, so authoring source reads load no rules
// runtime (schemaBoundary.test.ts).

/**
 * A Spell's first Class list row from a finished import: an unfinished or failed import's rows can
 * sit beside the visible ones until cleanup. Null when the Spell has no such row.
 */
export async function readVisibleSpellClassRow(
  ctx: QueryCtx,
  spellId: string,
  isJobVisible: (importJobId: string | undefined) => Promise<boolean> = (importJobId) =>
    isImportRowVisible(ctx, importJobId)
) {
  for await (const row of ctx.db
    .query('authoredSpellClasses')
    .withIndex('by_spellId', (q) => q.eq('spellId', spellId)))
    if (await isJobVisible(row.importJobId)) return row
  return null
}

/** The visibility facts of the Spell root a Class list row was written from. */
export function spellClassRowRootFacts(row: Doc<'authoredSpellClasses'>) {
  return {
    systemId: row.source.systemId,
    contentSourceId: row.source.contentSourceId,
    importJobId: row.importJobId,
    ownerUserId: row.ownerUserId
  }
}
