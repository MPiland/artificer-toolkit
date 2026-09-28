import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { convexQuery } from '@convex-dev/react-query'
import { useAction } from 'convex/react'
import { useMemo } from 'react'
import { createContentAccessCache } from './contentAccess'

/** The live snapshot heads a Character's Builder may read (ADR 0036 S4). */
export function getContentSnapshotManifest(systemId: string, characterId: string) {
  return convexQuery(convexApi.contentSnapshots.manifest.manifest, { systemId, characterId })
}

/** A cached content token getter for private snapshot objects. */
export function useContentSnapshotToken() {
  const issueAccess = useAction(convexApi.contentSnapshots.access.issueAccess)
  return useMemo(() => createContentAccessCache(() => issueAccess({})), [issueAccess])
}
