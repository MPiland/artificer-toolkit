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
import { readVisibleSpellClassRow, spellClassRowRootFacts } from '../content/spellClassRows'
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
  const labelsById = new Map<string, Promise<NodeRuntimeQueryRow[]>>()
  // Per reader, not `memoizeTransactionReads`: the commit's mutation replays these same reads.
  const visibleJobs = new Map<string, Promise<boolean>>()
  const isJobVisible = async (importJobId: string | undefined) =>
    importJobId === undefined ||
    memo(visibleJobs, importJobId, () => isImportRowVisible(ctx, importJobId))
  const factsByRoot = new Map<string, Promise<AuthoredNodeRuntimeSourceFacts>>()
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
        .filterWith((root) => isJobVisible(root.importJobId))
        .take(501 - facts.length)
      if (facts.length + roots.length > 500)
        throw new Error('Authoring options require paginated search.')
      facts.push(...(await readFacts(roots.map(assertSystem))))
    }
    return facts
  }

  // The same visibility as the per-kind scan: a readable source, its owner and a completed import.
  async function isVisible(
    root: Pick<AuthoredRoot, 'contentSourceId' | 'importJobId' | 'ownerUserId' | 'systemId'>
  ) {
    const source = (await visibleSources()).find(({ id }) => id === root.contentSourceId)
    if (
      !source ||
      root.ownerUserId !== (source.kind === 'USER' ? source.ownerUserId : undefined) ||
      !(await isJobVisible(root.importJobId))
    )
      return false
    assertSystem(root)
    return true
  }

  async function readVisible(roots: readonly AuthoredRoot[]) {
    const visible: AuthoredRoot[] = []
    for (const root of roots) if (await isVisible(root)) visible.push(root)
    return visible
  }

  function assertSystem<Root extends Pick<AuthoredRoot, 'systemId'>>(root: Root) {
    if (root.systemId !== systemId) throw new Error('Stored authoring System mismatch.')
    return root
  }

  function readFacts(roots: readonly AuthoredRoot[]) {
    return Promise.all(
      roots.map((root) => memo(factsByRoot, root._id, () => readSourceFacts(ctx, root)))
    )
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

  // A Spell's Class list rows carry its label and visibility facts and are smaller than its root;
  // a Spell on no Class list reads its root.
  function readLabel(kinds: readonly AuthoredRoot['subjectKind'][], id: string) {
    return memo(labelsById, `${kinds.join()} ${id}`, async (): Promise<NodeRuntimeQueryRow[]> => {
      const row = kinds.includes('SPELL')
        ? await readVisibleSpellClassRow(ctx, id, isJobVisible)
        : null
      if (row)
        return (await isVisible(spellClassRowRootFacts(row)))
          ? [{ id, label: row.entry.label }]
          : []
      return (await readNamedRoots(kinds, [id])).map((root) => ({ id: root.id, label: root.label }))
    })
  }

  async function readNamedRoots(
    kinds: readonly AuthoredRoot['subjectKind'][],
    ids: readonly string[]
  ) {
    const roots = (await Promise.all(ids.map(readRoot))).flat()
    return roots.filter((root) => kinds.includes(root.subjectKind))
  }

  async function readTableFacts(
    kinds: readonly AuthoredRoot['subjectKind'][],
    roots: AuthoredSourceRoots
  ) {
    if (roots.by === 'ID') return readFacts(await readNamedRoots(kinds, roots.ids))
    const reads = kinds.flatMap((kind) =>
      roots.by === 'KIND'
        ? [memo(factsByRead, kind, () => readKind(kind))]
        : roots.categories.map((category) =>
            memo(factsByRead, `${kind} ${category}`, () => readCategory(kind, category))
          )
    )
    return (await Promise.all(reads)).flat()
  }

  return async (
    table: NodeRuntimeSourceTable,
    roots: AuthoredSourceRoots,
    columns: readonly string[]
  ) => {
    const kinds = authoredSourceKindsByTable[table]
    if (!kinds) throw new Error(`Authoring source is not migrated: ${table}.`)
    // A root's own id and label are on its root document, so those reads skip its facts.
    if (roots.by === 'ID' && readsRootCatalogueOnly(table, columns))
      return sortAuthoredSourceRows(
        (await Promise.all(roots.ids.map((id) => readLabel(kinds, id)))).flat()
      )
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
