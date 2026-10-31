import {
  authoredSourceKindsByTable,
  sortAuthoredSourceRows
} from '@artificer-toolkit/authoring/nodeRuntime'
import type {
  AuthoredNodeRuntimeSourceFacts,
  NodeRuntimeSourceTable
} from '@artificer-toolkit/schema/api/nodeRuntimeSources'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { readSourceFacts } from '../content/sourceFacts'
import { readAuthoringSources } from '../content/sources'
import { contentStream } from '../content/streams'
import { isImportRowVisible } from '../imports/visibility'

export function createAuthoredSourceReader(ctx: QueryCtx, systemId: string, userId: string) {
  // Request-local sharing only: never retain private facts between users or mutations.
  let sources: ReturnType<typeof readAuthoringSources> | undefined
  const rootsByKind = new Map<
    Doc<'authoredRoots'>['subjectKind'],
    Promise<AuthoredNodeRuntimeSourceFacts[]>
  >()

  async function readKind(kind: Doc<'authoredRoots'>['subjectKind']) {
    const facts: AuthoredNodeRuntimeSourceFacts[] = []
    // ponytail: current inline selectors require the complete <=500 visible roots per
    // kind. Add paginated source selection before raising this limit, never truncate.
    for (const source of await (sources ??= readAuthoringSources(ctx, systemId, userId))) {
      const roots = await contentStream(ctx.db)
        .query('authoredRoots')
        .withIndex('by_contentSourceId_subjectKind_ownerUserId', (q) =>
          q
            .eq('contentSourceId', source.id)
            .eq('subjectKind', kind)
            .eq('ownerUserId', source.kind === 'USER' ? source.ownerUserId : undefined)
        )
        .filterWith((root) => isImportRowVisible(ctx, root.importJobId))
        .take(501 - facts.length)
      if (facts.length + roots.length > 500)
        throw new Error('Authoring options require paginated search.')
      for (const root of roots) {
        if (root.systemId !== systemId) throw new Error('Stored authoring System mismatch.')
        facts.push(await readSourceFacts(ctx, root))
      }
    }
    return facts
  }

  return async (table: NodeRuntimeSourceTable) => {
    const kinds = authoredSourceKindsByTable[table]
    if (!kinds) throw new Error(`Authoring source is not migrated: ${table}.`)
    const rows = []
    for (const kind of kinds) {
      let pending = rootsByKind.get(kind)
      if (!pending) {
        pending = readKind(kind)
        rootsByKind.set(kind, pending)
      }
      for (const facts of await pending) rows.push(...(facts.rows[table] ?? []))
    }
    return sortAuthoredSourceRows(rows)
  }
}
