import { R2 } from '@convex-dev/r2'
import { components } from '../_generated/api'
import { createMediaStorage } from '../media/storage'

/**
 * The private content snapshot bucket (ADR 0036), reached with the media provider's validated
 * endpoint and credentials. The local R2 fixture serves one bucket, so local snapshots share it
 * under their `v1/` prefix.
 */
export function createContentSnapshotStorage(): R2 {
  const media = createMediaStorage()
  if (process.env.MEDIA_STORAGE_MODE === 'local') return media
  const bucket = process.env.CONTENT_SNAPSHOT_R2_BUCKET
  if (
    !bucket ||
    !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket) ||
    bucket === media.config.bucket
  )
    throw new Error('CONTENT_SNAPSHOT_R2_BUCKET must name a separate private bucket.')
  return new R2(components.r2, { ...media.config, bucket })
}
