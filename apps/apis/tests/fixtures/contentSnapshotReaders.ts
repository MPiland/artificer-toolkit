import {
  contentSnapshotDocumentsObjectSchema,
  contentSnapshotIndexObjectSchema,
  contentSnapshotKindSchema,
  type ContentSnapshotIndexObject,
  type ContentSnapshotObject
} from '@artificer-toolkit/schema/api/contentSnapshots'
import { createLazySnapshotReaders } from '@artificer-toolkit/rules-runtime/character/snapshotReaders'
import {
  buildContentSnapshotKind,
  type ContentSnapshotIndexSource
} from '@artificer-toolkit/rules-runtime/contentSnapshots'
import { internal } from '../../convex/_generated/api'
import type { ContentSnapshotScopeRef } from '../../convex/contentSnapshots/marking'
import type { fixture } from './characters'

type Test = Awaited<ReturnType<typeof fixture>>['t']

/** The S2 build's objects for one scope, parsed back as a browser would read them. */
export async function readScopeObjects(t: Test, ref: ContentSnapshotScopeRef) {
  const objects: ContentSnapshotObject[] = []
  for (const kind of contentSnapshotKindSchema.options) {
    const sources: ContentSnapshotIndexSource[] = []
    let cursor: string | null = null
    for (let isDone = false; !isDone; ) {
      const page: { sources: string[]; continueCursor: string; isDone: boolean } = await t.query(
        internal.contentSnapshots.heads.readScopeKind,
        { ...ref, kind, paginationOpts: { numItems: 100, cursor } }
      )
      for (const json of page.sources) sources.push(JSON.parse(json) as ContentSnapshotIndexSource)
      cursor = page.continueCursor
      isDone = page.isDone
    }
    if (sources.length === 0) continue
    const { index, documents } = buildContentSnapshotKind({ format: 1, ...ref, kind }, sources)
    objects.push(
      contentSnapshotIndexObjectSchema.parse(JSON.parse(index.json)),
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
