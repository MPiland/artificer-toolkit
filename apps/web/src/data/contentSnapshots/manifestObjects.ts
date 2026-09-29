import type {
  ContentSnapshotHead,
  ContentSnapshotHeader,
  ContentSnapshotObjectRef,
  ContentSnapshotPart
} from '@artificer-toolkit/schema/api/contentSnapshots'

/** One object a manifest names, and whether the Worker serves it without a content token. */
export type ContentSnapshotLocation = {
  header: ContentSnapshotHeader
  ref: ContentSnapshotObjectRef
  isPublic: boolean
}

/** The heads both the Builder manifest and the catalogue manifest name. */
export type ContentSnapshotManifestHeads = {
  sources: readonly { kind: 'PLATFORM' | 'USER'; head: ContentSnapshotHead | null }[]
  campaign?: { head: ContentSnapshotHead | null } | null
}

function headLocations(
  head: ContentSnapshotHead,
  isPublic: boolean,
  parts: readonly ContentSnapshotPart[]
): ContentSnapshotLocation[] {
  return Object.entries(head.kinds).flatMap(([kind, refs]) =>
    refs
      ? parts.map((part) => ({
          // `kinds` is keyed by the kind enum; `Object.entries` widens the key to string.
          header: {
            format: 1 as const,
            scope: head.scope,
            scopeId: head.scopeId,
            kind: kind as ContentSnapshotHeader['kind'],
            part
          },
          ref: refs[part],
          isPublic
        }))
      : []
  )
}

/**
 * The `parts` objects of a manifest's built heads: the Builder reads index and documents, the
 * lists their list parts. PLATFORM sources are public (ADR 0036 S3); USER sources and the Campaign
 * need the caller's content token.
 */
export function listContentSnapshotManifestObjects(
  manifest: ContentSnapshotManifestHeads,
  parts: readonly ContentSnapshotPart[]
): ContentSnapshotLocation[] {
  return [
    ...manifest.sources.flatMap((source) =>
      source.head ? headLocations(source.head, source.kind === 'PLATFORM', parts) : []
    ),
    ...(manifest.campaign?.head ? headLocations(manifest.campaign.head, false, parts) : [])
  ]
}

/** A head whose `revision` is ahead of `builtRevision` still serves its previous build. */
export function isContentSnapshotManifestUpdating(manifest: ContentSnapshotManifestHeads): boolean {
  return [...manifest.sources.map((source) => source.head), manifest.campaign?.head].some(
    (head) => head !== null && head !== undefined && head.revision > head.builtRevision
  )
}
