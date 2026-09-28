import { R2 } from '@convex-dev/r2'
import { components } from '../_generated/api'
import { createMediaStorage } from '../media/storage'

/**
 * The private content snapshot bucket (ADR 0036), reached with the media provider's validated
 * endpoint and credentials. Local mode uses the local R2 fixture's content snapshot bucket.
 */
export function createContentSnapshotStorage(): R2 {
  const media = createMediaStorage()
  const bucket =
    process.env.MEDIA_STORAGE_MODE === 'local'
      ? 'artificer-local-content-snapshots'
      : process.env.CONTENT_SNAPSHOT_R2_BUCKET
  if (
    !bucket ||
    !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket) ||
    bucket === media.config.bucket
  )
    throw new Error('CONTENT_SNAPSHOT_R2_BUCKET must name a separate private bucket.')
  return new R2(components.r2, { ...media.config, bucket })
}
