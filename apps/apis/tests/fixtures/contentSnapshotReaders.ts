import {
  contentSnapshotDocumentsObjectSchema,
  contentSnapshotIndexObjectSchema,
  contentSnapshotKindSchema,
  contentSnapshotListObjectSchema,
  type ContentSnapshotIndexObject,
  type ContentSnapshotKind,
  type ContentSnapshotObject
} from '@artificer-toolkit/schema/api/contentSnapshots'
import {
  buildContentCatalogueItems,
  sortContentCatalogueItems,
  toContentCatalogueSource,
  type ContentCatalogueSource
} from '@artificer-toolkit/rules-runtime/contentCatalogue'
import { createLazySnapshotReaders } from '@artificer-toolkit/rules-runtime/character/snapshotReaders'
import {
  buildContentSnapshotKind,
  type ContentSnapshotListSource
} from '@artificer-toolkit/rules-runtime/contentSnapshots'
import { api, internal } from '../../convex/_generated/api'
import type { ContentSnapshotScopeRef } from '../../convex/contentSnapshots/marking'
import type { fixture } from './characters'

type Test = Awaited<ReturnType<typeof fixture>>['t']

/** The S2 build's objects for one scope, parsed back as a browser would read them. */
export async function readScopeObjects(t: Pick<Test, 'query'>, ref: ContentSnapshotScopeRef) {
  const objects: ContentSnapshotObject[] = []
  for (const kind of contentSnapshotKindSchema.options) {
    const sources: ContentSnapshotListSource[] = []
    let cursor: string | null = null
    for (let isDone = false; !isDone;) {
      const page:
        | { sources: string[]; continueCursor: string; isDone: boolean }
        | { pendingCompilation: true } = await t.query(
        internal.contentSnapshots.heads.readScopeKind,
        {
          ...ref,
          kind,
          paginationOpts: { numItems: 100, cursor }
        }
      )
      if ('pendingCompilation' in page) throw new Error('A root compilation is pending.')
      for (const json of page.sources) sources.push(JSON.parse(json) as ContentSnapshotListSource)
      cursor = page.continueCursor
      isDone = page.isDone
    }
    if (sources.length === 0) continue
    const { index, list, documents } = buildContentSnapshotKind(
      { format: 3, ...ref, kind },
      sources
    )
    objects.push(
      contentSnapshotIndexObjectSchema.parse(JSON.parse(index.json)),
      contentSnapshotListObjectSchema.parse(JSON.parse(list.json)),
      contentSnapshotDocumentsObjectSchema.parse(JSON.parse(documents.json))
    )
  }
  return objects
}

/** The browser's readers: every index object up front, documents per kind when a read needs them. */
export function createBrowserReaders(objects: readonly ContentSnapshotObject[]) {
  const loadedKinds: string[] = []
  const readers = createLazySnapshotReaders(
    objects.filter((object): object is ContentSnapshotIndexObject => object.part === 'index'),
    async (kinds) => {
      loadedKinds.push(...kinds)
      return objects.filter((object) => object.part === 'documents' && kinds.includes(object.kind))
    }
  )
  return { readers, loadedKinds }
}

/**
 * The authored-content list rows a browser derives for one caller: every visible source's list
 * part, in name order, optionally narrowed to one System or to master or owned rows.
 */
export async function readVisibleCatalogue(
  t: Test,
  caller: Pick<Test, 'query'>,
  subjectKind: ContentSnapshotKind,
  { systemId, source }: { systemId?: string; source?: 'MASTER' | 'OWNED' } = {}
) {
  const manifest = await caller.query(api.contentSnapshots.manifest.catalogue, {})
  const sources: ContentCatalogueSource[] = []
  for (const contentSource of manifest.sources)
    for (const object of await readScopeObjects(t, {
      scope: 'SOURCE',
      scopeId: contentSource.contentSourceId
    })) {
      const source = toContentCatalogueSource(object, contentSource)
      if (source) sources.push(source)
    }
  return sortContentCatalogueItems(
    buildContentCatalogueItems(subjectKind, sources, manifest.userId).filter(
      (item) =>
        (systemId === undefined || item.systemId === systemId) &&
        (source === undefined || item.provenance.kind === source)
    ),
    'name'
  )
}
