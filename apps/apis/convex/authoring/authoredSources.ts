import {
  authoredSourceKindsByTable,
  readsRootCatalogueOnly,
  sortAuthoredSourceRows,
  type NodeRuntimeQueryRow
} from '@artificer-toolkit/authoring/nodeRuntime'
import type {
  AuthoredNodeRuntimeSourceFacts,
  AuthoredSourceRoots,
  NodeRuntimeSourceTable
} from '@artificer-toolkit/schema/api/nodeRuntimeSources'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { readSourceFacts } from '../content/sourceFacts'
import { readAuthoringSources } from '../content/sources'
import { contentStream } from '../content/streams'
import { isImportRowVisible } from '../imports/visibility'

type AuthoredRoot = Doc<'authoredRoots'>

export function createAuthoredSourceReader(ctx: QueryCtx, systemId: string, userId: string) {
  // Request-local sharing only: never retain private facts between users or mutations.
  let sources: ReturnType<typeof readAuthoringSources> | undefined
  const visibleSources = () => (sources ??= readAuthoringSources(ctx, systemId, userId))
  const rootsById = new Map<string, Promise<AuthoredRoot[]>>()
  const factsByRead = new Map<string, Promise<AuthoredNodeRuntimeSourceFacts[]>>()

  async function readKind(kind: AuthoredRoot['subjectKind']) {
    const facts: AuthoredNodeRuntimeSourceFacts[] = []
    // ponytail: current inline selectors require the complete <=500 visible roots per
    // kind. Add paginated source selection before raising this limit, never truncate.
    for (const source of await visibleSources()) {
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
      facts.push(...(await readFacts(roots.map(assertSystem))))
    }
    return facts
  }

  // The same visibility as the per-kind scan: a readable source, its owner and a completed import.
  async function readVisible(roots: readonly AuthoredRoot[]) {
    const bySource = new Map((await visibleSources()).map((source) => [source.id, source]))
    const visible: AuthoredRoot[] = []
    for (const root of roots) {
      const source = bySource.get(root.contentSourceId)
      if (
        source &&
        root.ownerUserId === (source.kind === 'USER' ? source.ownerUserId : undefined) &&
        (await isImportRowVisible(ctx, root.importJobId))
      )
        visible.push(assertSystem(root))
    }
    return visible
  }

  function assertSystem(root: AuthoredRoot) {
    if (root.systemId !== systemId) throw new Error('Stored authoring System mismatch.')
    return root
  }

  async function readFacts(roots: readonly AuthoredRoot[]) {
    const facts: AuthoredNodeRuntimeSourceFacts[] = []
    for (const root of roots) facts.push(await readSourceFacts(ctx, root))
    return facts
  }

  function readRoot(id: string) {
    return memo(rootsById, id, async () =>
      readVisible(
        await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', id))
          .collect()
      )
    )
  }

  // Every write keeps `catalogue.category` equal to the document category the facts project.
  async function readCategory(kind: AuthoredRoot['subjectKind'], category: string) {
    const roots: AuthoredRoot[] = []
    for (const ownerUserId of [undefined, userId])
      roots.push(
        ...(await ctx.db
          .query('authoredRoots')
          .withIndex('by_system_kind_owner_category_name_id', (q) =>
            q
              .eq('systemId', systemId)
              .eq('subjectKind', kind)
              .eq('ownerUserId', ownerUserId)
              .eq('catalogue.category', category)
          )
          .take(501 - roots.length))
      )
    if (roots.length > 500) throw new Error('Authoring options require paginated search.')
    return readFacts(await readVisible(roots))
  }

  async function readTableFacts(
    kinds: readonly AuthoredRoot['subjectKind'][],
    roots: AuthoredSourceRoots
  ) {
    const facts: AuthoredNodeRuntimeSourceFacts[] = []
    if (roots.by === 'ID')
      for (const id of roots.ids)
        facts.push(
          ...(await memo(factsByRead, `ID ${id}`, async () => readFacts(await readRoot(id))))
        )
    else
      for (const kind of kinds)
        if (roots.by === 'KIND')
          facts.push(...(await memo(factsByRead, kind, () => readKind(kind))))
        else
          for (const category of roots.categories)
            facts.push(
              ...(await memo(factsByRead, `${kind} ${category}`, () =>
                readCategory(kind, category)
              ))
            )
    return facts
  }

  return async (
    table: NodeRuntimeSourceTable,
    roots: AuthoredSourceRoots,
    columns: readonly string[]
  ) => {
    const kinds = authoredSourceKindsByTable[table]
    if (!kinds) throw new Error(`Authoring source is not migrated: ${table}.`)
    // A root's own id and label are on its root document, so those reads skip its facts.
    if (roots.by === 'ID' && readsRootCatalogueOnly(table, columns)) {
      const rows: NodeRuntimeQueryRow[] = []
      for (const id of roots.ids)
        for (const root of await readRoot(id))
          if (kinds.includes(root.subjectKind)) rows.push({ id: root.id, label: root.label })
      return sortAuthoredSourceRows(rows)
    }
    const facts = await readTableFacts(kinds, roots)
    return sortAuthoredSourceRows(facts.flatMap((root) => root.rows[table] ?? []))
  }
}

function memo<T>(cache: Map<string, Promise<T>>, key: string, read: () => Promise<T>) {
  let pending = cache.get(key)
  if (!pending) {
    pending = read()
    cache.set(key, pending)
  }
  return pending
}
