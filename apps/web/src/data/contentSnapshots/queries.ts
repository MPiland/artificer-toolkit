import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { convexQuery } from '@convex-dev/react-query'
import { useAction } from 'convex/react'
import { useEffect, useMemo } from 'react'
import { createContentAccessCache } from './contentAccess'
import { holdPrivateContentSnapshots } from './privateContent'

/** The live snapshot heads a Character's Builder may read (ADR 0036 S4). */
export function getContentSnapshotManifest(systemId: string, characterId: string) {
  return convexQuery(convexApi.contentSnapshots.manifest.manifest, { systemId, characterId })
}

/** A cached content token getter for private snapshot objects, dropped at sign-out. */
export function useContentSnapshotToken() {
  const issueAccess = useAction(convexApi.contentSnapshots.access.issueAccess)
  const access = useMemo(() => createContentAccessCache(() => issueAccess({})), [issueAccess])
  useEffect(() => holdPrivateContentSnapshots(access.clear), [access])
  return access.getToken
}
