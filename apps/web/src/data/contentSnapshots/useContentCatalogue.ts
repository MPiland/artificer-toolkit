import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import type { ContentSnapshotKind } from '@artificer-toolkit/schema/api/contentSnapshots'
import {
  buildContentCatalogueItems,
  sortContentCatalogueItems,
  summarizeContentCatalogue,
  toContentCatalogueSource
} from '@artificer-toolkit/rules-runtime/contentCatalogue'
import { contentOrigin } from './contentOrigin'
import { createContentSnapshotStore } from './contentSnapshotStore'
import {
  isContentSnapshotManifestUpdating,
  listContentSnapshotManifestObjects
} from './manifestObjects'
import { getContentCatalogueManifest, useContentSnapshotToken } from './queries'

type ContentCatalogueOptions = {
  enabled?: boolean
  systemId?: string
  source?: 'MASTER' | 'OWNED'
}

/** The objects are immutable per sha, so the shas and the viewer fully identify the fetched rows. */
export const contentCatalogueQueryKey = (
  userId: string | undefined,
  subjectKind: ContentSnapshotKind,
  sha256s: readonly string[]
) => ['content-catalogue', userId, subjectKind, [...sha256s].sort()] as const

// A Spell's Classes resolve to labels from the visible Class list.
const kindsRead = (subjectKind: ContentSnapshotKind): readonly ContentSnapshotKind[] =>
  subjectKind === 'SPELL' ? ['SPELL', 'CLASS'] : [subjectKind]

/**
 * The visible rows and summary of one authored kind, read from the ADR 0036 `list` parts: no
 * Convex read beyond the live manifest. The manifest subscription is the reactivity: a publish
 * re-points the heads and the new parts replace the old, and `updating` covers the window in which
 * a head still serves its previous build.
 *
 * `systemId` and `source` narrow the rows for pickers; `enabled: false` reads nothing. The summary
 * always covers every visible row of the kind.
 */
export function useContentCatalogue(
  subjectKind: ContentSnapshotKind,
  { enabled = true, systemId, source }: ContentCatalogueOptions = {}
) {
  const manifest = useQuery({ ...getContentCatalogueManifest(), enabled })
  const getToken = useContentSnapshotToken()
  const store = useMemo(
    () => (contentOrigin ? createContentSnapshotStore({ contentOrigin, getToken }) : null),
    [getToken]
  )
  const manifestData = manifest.data
  const locations = useMemo(
    () => (manifestData ? listContentSnapshotManifestObjects(manifestData, ['list']) : []),
    [manifestData]
  )
  const wanted = useMemo(
    () => locations.filter((location) => kindsRead(subjectKind).includes(location.header.kind)),
    [locations, subjectKind]
  )

  useEffect(() => {
    // Eviction is housekeeping; a failure only leaves unused objects cached.
    store
      ?.retain(new Set(locations.map((location) => location.ref.sha256)), ['list'])
      .catch(() => undefined)
  }, [locations, store])

  const objects = useQuery({
    queryKey: contentCatalogueQueryKey(
      manifestData?.userId,
      subjectKind,
      wanted.map((location) => location.ref.sha256)
    ),
    queryFn:
      enabled && manifestData && store
        ? () => Promise.all(wanted.map((location) => store.read(location)))
        : skipToken,
    staleTime: Infinity,
    placeholderData: keepPreviousData
  })

  const items = useMemo(() => {
    if (!manifestData || !objects.data) return undefined
    const sourceById = new Map(
      manifestData.sources.map((source) => [source.contentSourceId, source])
    )
    const sources = objects.data.flatMap((object) => {
      const head = sourceById.get(object.scopeId)
      const source = head && toContentCatalogueSource(object, head)
      return source ? [source] : []
    })
    return sortContentCatalogueItems(
      buildContentCatalogueItems(subjectKind, sources, manifestData.userId),
      'name'
    )
  }, [manifestData, objects.data, subjectKind])
  const summary = useMemo(
    () => (items ? summarizeContentCatalogue(subjectKind, items) : undefined),
    [items, subjectKind]
  )
  const visibleItems = useMemo(
    () =>
      systemId || source
        ? items?.filter(
            (item) =>
              (!systemId || item.systemId === systemId) &&
              (!source || item.provenance.kind === source)
          )
        : items,
    [items, source, systemId]
  )

  const isError = manifest.isError || objects.isError || !store
  return {
    items: visibleItems,
    summary,
    updating: manifestData ? isContentSnapshotManifestUpdating(manifestData) : false,
    isPending: !isError && (manifest.isPending || objects.isPending),
    isError
  }
}
