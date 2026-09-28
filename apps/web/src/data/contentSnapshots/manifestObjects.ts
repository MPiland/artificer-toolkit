import type {
  ContentSnapshotHead,
  ContentSnapshotHeader,
  ContentSnapshotManifestDto,
  ContentSnapshotObjectRef
} from '@artificer-toolkit/schema/api/contentSnapshots'

/** One object a manifest names, and whether the Worker serves it without a content token. */
export type ContentSnapshotLocation = {
  header: ContentSnapshotHeader
  ref: ContentSnapshotObjectRef
  isPublic: boolean
}

function headLocations(head: ContentSnapshotHead, isPublic: boolean): ContentSnapshotLocation[] {
  return Object.entries(head.kinds).flatMap(([kind, parts]) =>
    parts
      ? (['index', 'documents'] as const).map((part) => ({
          // `kinds` is keyed by the kind enum; `Object.entries` widens the key to string.
          header: {
            format: 1 as const,
            scope: head.scope,
            scopeId: head.scopeId,
            kind: kind as ContentSnapshotHeader['kind'],
            part
          },
          ref: parts[part],
          isPublic
        }))
      : []
  )
}

/**
 * Every object of a manifest's built heads. PLATFORM sources are public (ADR 0036 S3); USER
 * sources and the Campaign need the caller's content token.
 */
export function listContentSnapshotManifestObjects(
  manifest: ContentSnapshotManifestDto
): ContentSnapshotLocation[] {
  return [
    ...manifest.sources.flatMap((source) =>
      source.head ? headLocations(source.head, source.kind === 'PLATFORM') : []
    ),
    ...(manifest.campaign?.head ? headLocations(manifest.campaign.head, false) : [])
  ]
}

/** A head whose `revision` is ahead of `builtRevision` still serves its previous build. */
export function isContentSnapshotManifestUpdating(manifest: ContentSnapshotManifestDto): boolean {
  return [...manifest.sources.map((source) => source.head), manifest.campaign?.head].some(
    (head) => head !== null && head !== undefined && head.revision > head.builtRevision
  )
}
