// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { ContentSnapshotHeader } from '@artificer-toolkit/schema/api/contentSnapshots'
import { buildContentSnapshotPart } from '@artificer-toolkit/rules-runtime/contentSnapshots'
import { ContentSnapshotLoadError, createContentSnapshotStore } from './contentSnapshotStore'
import type { ContentSnapshotLocation } from './manifestObjects'

const ORIGIN = 'https://session.example.test'
const SOURCE_ID = '00000000-0000-4000-8000-000000000001'

function snapshot(scope: ContentSnapshotHeader['scope'], label: string) {
  const header = {
    format: 2,
    scope,
    scopeId: SOURCE_ID,
    kind: 'FEAT',
    part: 'index'
  } as const satisfies ContentSnapshotHeader
  const built = buildContentSnapshotPart(header, [
    { id: '00000000-0000-4000-8000-00000000000a', label }
  ])
  return {
    json: built.json,
    location: (isPublic: boolean): ContentSnapshotLocation => ({
      header,
      ref: { sha256: built.sha256, byteLength: built.byteLength, rootCount: built.rootCount },
      isPublic
    })
  }
}

/** An in-memory Cache Storage with the calls the store makes. */
function memoryCaches() {
  const entries = new Map<string, Response>()
  const cache = {
    match: async (key: string) => entries.get(key)?.clone(),
    put: async (key: string, response: Response) => void entries.set(key, response),
    keys: async () => [...entries.keys()].map((url) => new Request(url)),
    delete: async (request: Request) => entries.delete(request.url)
  }
  return { entries, caches: { open: async () => cache } }
}

function serving(body: string, statuses: number[] = [200]) {
  const queue = [...statuses]
  return vi.fn(async (_url: string, _init?: RequestInit) => {
    const status = queue.length > 1 ? queue.shift()! : queue[0]!
    return new Response(status === 200 ? body : 'refused', { status })
  })
}

describe('content snapshot store', () => {
  it('reads public objects without a content token', async () => {
    const object = snapshot('SOURCE', 'Grappler')
    const fetch = serving(object.json)
    const getToken = vi.fn(async () => 'token')
    const store = createContentSnapshotStore({
      contentOrigin: ORIGIN,
      getToken,
      fetch,
      caches: null
    })

    await expect(store.read(object.location(true))).resolves.toMatchObject({
      kind: 'FEAT',
      roots: [{ label: 'Grappler' }]
    })
    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe(
      `${ORIGIN}/content/v2/source/${SOURCE_ID}/feat/index/${object.location(true).ref.sha256}.json`
    )
    expect(init?.headers).toEqual({})
    expect(getToken).not.toHaveBeenCalled()
  })

  it('sends the content token for private objects and refreshes it once when refused', async () => {
    const object = snapshot('CAMPAIGN', 'Shared feat')
    const fetch = serving(object.json, [403, 200])
    const getToken = vi.fn(async (refresh: boolean) => (refresh ? 'fresh' : 'stale'))
    const store = createContentSnapshotStore({
      contentOrigin: ORIGIN,
      getToken,
      fetch,
      caches: null
    })

    await expect(store.read(object.location(false))).resolves.toMatchObject({ scope: 'CAMPAIGN' })
    expect(getToken.mock.calls).toEqual([[false], [true]])
    expect(fetch.mock.calls.map(([, init]) => init?.headers)).toEqual([
      { authorization: 'Bearer stale' },
      { authorization: 'Bearer fresh' }
    ])
  })

  it('rejects an object whose bytes do not match the manifest hash and keeps nothing', async () => {
    const object = snapshot('SOURCE', 'Grappler')
    const { entries, caches } = memoryCaches()
    const store = createContentSnapshotStore({
      contentOrigin: ORIGIN,
      getToken: async () => 'token',
      fetch: serving(snapshot('SOURCE', 'Tampered').json),
      caches
    })

    const read = store.read(object.location(true))
    await expect(read).rejects.toBeInstanceOf(ContentSnapshotLoadError)
    await expect(read).rejects.toMatchObject({ kind: 'FEAT' })
    expect(entries.size).toBe(0)
  })

  it('keeps verified objects by hash and evicts hashes the manifest no longer names', async () => {
    const kept = snapshot('SOURCE', 'Grappler')
    const dropped = snapshot('SOURCE', 'Retired feat')
    const { entries, caches } = memoryCaches()
    const fetch = vi.fn(
      async (url: string) =>
        new Response(url.includes(kept.location(true).ref.sha256) ? kept.json : dropped.json)
    )
    const options = { contentOrigin: ORIGIN, getToken: async () => 'token', fetch, caches }
    const first = createContentSnapshotStore(options)
    await first.read(kept.location(true))
    await first.read(dropped.location(true))
    expect(entries.size).toBe(2)

    // A new page session reads from Cache Storage without the network.
    const second = createContentSnapshotStore(options)
    await expect(second.read(kept.location(true))).resolves.toMatchObject({
      roots: [{ label: 'Grappler' }]
    })
    expect(fetch).toHaveBeenCalledTimes(2)

    // Another consumer's parts are never evicted.
    await second.retain(new Set(), ['list'])
    expect(entries.size).toBe(2)
    await second.retain(new Set([kept.location(true).ref.sha256]), ['index'])
    expect([...entries.keys()]).toEqual([
      `${ORIGIN}/content-snapshot-sha256/index/${kept.location(true).ref.sha256}`
    ])
  })

  it('names the kind when the Worker refuses an object', async () => {
    const object = snapshot('SOURCE', 'Grappler')
    const store = createContentSnapshotStore({
      contentOrigin: ORIGIN,
      getToken: async () => 'token',
      fetch: serving(object.json, [404]),
      caches: null
    })

    await expect(store.read(object.location(true))).rejects.toMatchObject({
      name: 'ContentSnapshotLoadError',
      kind: 'FEAT'
    })
  })
})
