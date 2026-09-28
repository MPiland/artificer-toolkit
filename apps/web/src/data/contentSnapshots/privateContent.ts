import { CONTENT_SNAPSHOT_CACHE_NAME } from './contentSnapshotStore'

// In-memory holders of a signed-in user's private content: content tokens and Builder workers.
const holders = new Set<() => void>()

/** Registers a drop callback for in-memory private content; returns its unregistration. */
export function holdPrivateContentSnapshots(drop: () => void): () => void {
  holders.add(drop)
  return () => {
    holders.delete(drop)
  }
}

/**
 * Drops every private content snapshot this browser holds (ADR 0036): cached content tokens,
 * Builder workers with parsed objects, and the snapshot Cache Storage, which is cleared whole since
 * it keeps objects by hash alone. Called at sign-out and whenever the signed-in identity changes.
 */
export async function clearPrivateContentSnapshots(
  cacheStorage: Pick<CacheStorage, 'delete'> | null = typeof caches === 'undefined' ? null : caches
): Promise<void> {
  for (const drop of [...holders]) drop()
  await cacheStorage?.delete(CONTENT_SNAPSHOT_CACHE_NAME)
}
