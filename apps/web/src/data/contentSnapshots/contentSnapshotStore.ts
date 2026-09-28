import {
  CONTENT_SNAPSHOT_PATH_PREFIX,
  type ContentSnapshotKind,
  type ContentSnapshotObject
} from '@artificer-toolkit/schema/api/contentSnapshots'
import { contentSnapshotObjectKey } from '@artificer-toolkit/rules-runtime/contentSnapshots'
import type { ContentSnapshotLocation } from './manifestObjects'

const CACHE_NAME = 'artificer-content-snapshots-v1'
const CACHE_KEY_PATH = '/content-snapshot-sha256/'

/** A manifest object that could not be read; `kind` lets the Builder say which content failed. */
export class ContentSnapshotLoadError extends Error {
  readonly kind: ContentSnapshotKind

  constructor(kind: ContentSnapshotKind, message: string) {
    super(message)
    this.name = 'ContentSnapshotLoadError'
    this.kind = kind
  }
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Reads content snapshot objects (ADR 0036) from the session Worker's `GET /content/{key}`. Every
 * object is verified against the manifest's SHA-256 before it is parsed or kept, and verified bytes
 * are kept in Cache Storage by hash, so an unchanged object is fetched once per browser. Private
 * objects carry the caller's content token; a refused token is refreshed once, because a token
 * names the scopes granted when it was issued.
 */
export function createContentSnapshotStore(options: {
  contentOrigin: string
  getToken: (refresh: boolean) => Promise<string>
  fetch?: typeof fetch
  caches?: {
    open(name: string): Promise<Pick<Cache, 'match' | 'put' | 'keys' | 'delete'>>
  } | null
}) {
  const fetchObject = options.fetch ?? ((input, init) => fetch(input, init))
  const cacheStorage =
    options.caches === undefined ? (typeof caches === 'undefined' ? null : caches) : options.caches
  const cacheKey = (sha256: string) => `${options.contentOrigin}${CACHE_KEY_PATH}${sha256}`
  const parsed = new Map<string, Promise<ContentSnapshotObject>>()

  async function download({ header, ref, isPublic }: ContentSnapshotLocation) {
    const url = `${options.contentOrigin}${CONTENT_SNAPSHOT_PATH_PREFIX}${contentSnapshotObjectKey(header, ref.sha256)}`
    const request = async (refresh: boolean) =>
      fetchObject(url, {
        cache: 'no-store',
        credentials: 'omit',
        headers: isPublic ? {} : { authorization: `Bearer ${await options.getToken(refresh)}` }
      })
    let response = await request(false)
    if (!isPublic && (response.status === 401 || response.status === 403))
      response = await request(true)
    if (!response.ok)
      throw new ContentSnapshotLoadError(
        header.kind,
        `Content request failed with status ${response.status}.`
      )
    return response.arrayBuffer()
  }

  async function verifiedRead(location: ContentSnapshotLocation): Promise<ContentSnapshotObject> {
    const { header, ref } = location
    const cache = cacheStorage ? await cacheStorage.open(CACHE_NAME) : null
    const cached = await cache?.match(cacheKey(ref.sha256))
    let bytes = cached ? await cached.arrayBuffer() : null
    if (!bytes || (await sha256Hex(bytes)) !== ref.sha256) {
      bytes = await download(location)
      if ((await sha256Hex(bytes)) !== ref.sha256)
        throw new ContentSnapshotLoadError(header.kind, 'Content failed its integrity check.')
      await cache?.put(
        cacheKey(ref.sha256),
        new Response(bytes, { headers: { 'content-type': 'application/json' } })
      )
    }
    const object = JSON.parse(new TextDecoder().decode(bytes)) as ContentSnapshotObject
    // The hash already binds the header; this guards a manifest that names the wrong location.
    if (
      object.scope !== header.scope ||
      object.scopeId !== header.scopeId ||
      object.kind !== header.kind ||
      object.part !== header.part
    )
      throw new ContentSnapshotLoadError(header.kind, 'Content does not match its manifest entry.')
    return object
  }

  async function load(location: ContentSnapshotLocation): Promise<ContentSnapshotObject> {
    try {
      return await verifiedRead(location)
    } catch (error) {
      if (error instanceof ContentSnapshotLoadError) throw error
      throw new ContentSnapshotLoadError(location.header.kind, 'Content could not be loaded.')
    }
  }

  return {
    /** The parsed object, read once per hash for the store's lifetime. */
    read(location: ContentSnapshotLocation): Promise<ContentSnapshotObject> {
      const existing = parsed.get(location.ref.sha256)
      if (existing) return existing
      const reading = load(location)
      parsed.set(location.ref.sha256, reading)
      reading.catch(() => parsed.delete(location.ref.sha256))
      return reading
    },
    /** Drops every kept object whose hash the current manifest no longer names. */
    async retain(sha256s: ReadonlySet<string>): Promise<void> {
      for (const sha256 of parsed.keys()) if (!sha256s.has(sha256)) parsed.delete(sha256)
      const cache = cacheStorage ? await cacheStorage.open(CACHE_NAME) : null
      if (!cache) return
      for (const request of await cache.keys()) {
        const sha256 = new URL(request.url).pathname.slice(CACHE_KEY_PATH.length)
        if (!sha256s.has(sha256)) await cache.delete(request)
      }
    }
  }
}

export type ContentSnapshotStore = ReturnType<typeof createContentSnapshotStore>
