import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  contentSnapshotAccessDtoSchema,
  type ContentSnapshotCatalogueManifestDto,
  type ContentSnapshotHead
} from '@artificer-toolkit/schema/api/contentSnapshots'
import { buildContentSnapshotPart } from '@artificer-toolkit/rules-runtime/contentSnapshots'
import { clearPrivateContentSnapshots } from './privateContent'
import { useContentCatalogue } from './useContentCatalogue'

const catalogue = vi.hoisted(() => ({
  manifest: vi.fn(),
  issueAccess: vi.fn()
}))

vi.mock('./contentOrigin', () => ({ contentOrigin: 'https://session.example.test' }))

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useAction: () => catalogue.issueAccess
}))

// Only the manifest read is replaced; the token wiring is the real `useContentSnapshotToken`.
vi.mock('./queries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./queries')>()),
  getContentCatalogueManifest: () => ({
    queryKey: ['content-catalogue-manifest'],
    queryFn: () => catalogue.manifest()
  })
}))

const USER_ID = '00000000-0000-4000-8000-0000000000b1'
const SYSTEM_ID = '00000000-0000-4000-8000-0000000000a1'
const OTHER_SYSTEM_ID = '00000000-0000-4000-8000-0000000000a2'
const PLATFORM_SOURCE_ID = '00000000-0000-4000-8000-0000000000c1'
const OTHER_PLATFORM_SOURCE_ID = '00000000-0000-4000-8000-0000000000c2'
const USER_SOURCE_ID = '00000000-0000-4000-8000-0000000000c3'
const id = (suffix: number) => `00000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`

function listPart(scopeId: string, firstId: number, labels: readonly string[]) {
  const roots = labels.map((label, index) => ({
    id: id(firstId + index),
    label,
    publicId: label.toLowerCase().replaceAll(' ', '-')
  }))
  return buildContentSnapshotPart(
    { format: 3, scope: 'SOURCE', scopeId, kind: 'FEAT', part: 'list' },
    roots
  )
}

/** The index and documents refs are never fetched by a list, so any well-formed ref serves. */
const unusedRef = { sha256: '0'.repeat(64), byteLength: 1, rootCount: 0 }

function head(
  scopeId: string,
  list: ReturnType<typeof listPart>,
  revisions: { revision: number; builtRevision: number } = { revision: 1, builtRevision: 1 }
): ContentSnapshotHead {
  return {
    scope: 'SOURCE',
    scopeId,
    ...revisions,
    kinds: {
      FEAT: {
        index: unusedRef,
        list: { sha256: list.sha256, byteLength: list.byteLength, rootCount: list.rootCount },
        documents: unusedRef
      }
    }
  }
}

function manifestOf(
  sources: ContentSnapshotCatalogueManifestDto['sources']
): ContentSnapshotCatalogueManifestDto {
  return { userId: USER_ID, sources }
}

const platform = listPart(PLATFORM_SOURCE_ID, 100, ['Tough', 'Alert'])
const otherPlatform = listPart(OTHER_PLATFORM_SOURCE_ID, 200, ['Lucky'])
const homebrew = listPart(USER_SOURCE_ID, 300, ['Homebrew Feat'])

const served = new Map<string, string>()

function serve(...parts: ReturnType<typeof listPart>[]) {
  for (const part of parts) served.set(part.sha256, part.json)
}

const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
  const sha256 = /([0-9a-f]{64})\.json$/.exec(url)?.[1]
  const body = sha256 ? served.get(sha256) : undefined
  return new Response(body ?? 'missing', { status: body === undefined ? 404 : 200 })
})

function createClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function wrapper(client = createClient()) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

const platformSource = (
  contentSourceId: string,
  systemId: string,
  part: ReturnType<typeof listPart>,
  revisions?: { revision: number; builtRevision: number }
) => ({
  contentSourceId,
  systemId,
  kind: 'PLATFORM' as const,
  head: head(contentSourceId, part, revisions)
})

beforeEach(() => {
  served.clear()
  fetchMock.mockClear()
  catalogue.manifest.mockReset()
  catalogue.issueAccess.mockReset().mockResolvedValue(
    contentSnapshotAccessDtoSchema.parse({
      token: 'content-token',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString()
    })
  )
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

describe('useContentCatalogue', () => {
  it('reads only list parts, in name order with a summary, and no Convex read beyond the manifest', async () => {
    serve(platform)
    catalogue.manifest.mockResolvedValue(
      manifestOf([platformSource(PLATFORM_SOURCE_ID, SYSTEM_ID, platform)])
    )

    const { result } = renderHook(() => useContentCatalogue('FEAT'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isPending).toBe(false))

    expect(result.current.items?.map((item) => item.label)).toEqual(['Alert', 'Tough'])
    expect(result.current.summary).toEqual({
      activeCount: 2,
      masterCount: 2,
      ownedCount: 0,
      categories: []
    })
    expect(result.current.updating).toBe(false)
    expect(catalogue.manifest).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `https://session.example.test/content/v3/source/${PLATFORM_SOURCE_ID}/feat/list/${platform.sha256}.json`
    ])
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({})
    expect(catalogue.issueAccess).not.toHaveBeenCalled()
  })

  it('fetches own homebrew with the content token and drops the token at sign-out', async () => {
    serve(platform, homebrew)
    catalogue.manifest.mockResolvedValue(
      manifestOf([
        platformSource(PLATFORM_SOURCE_ID, SYSTEM_ID, platform),
        {
          contentSourceId: USER_SOURCE_ID,
          systemId: SYSTEM_ID,
          kind: 'USER',
          head: head(USER_SOURCE_ID, homebrew)
        }
      ])
    )

    const client = createClient()
    const { result } = renderHook(() => useContentCatalogue('FEAT'), { wrapper: wrapper(client) })
    await waitFor(() => expect(result.current.isPending).toBe(false))

    const own = result.current.items?.find((item) => item.label === 'Homebrew Feat')
    expect(own).toMatchObject({
      provenance: { kind: 'OWNED', ownerUserId: USER_ID },
      permissions: { canEdit: true, canDelete: true }
    })
    const privateRequest = fetchMock.mock.calls.find(([url]) => url.includes(homebrew.sha256))
    expect(privateRequest?.[1]?.headers).toEqual({ authorization: 'Bearer content-token' })
    expect(catalogue.issueAccess).toHaveBeenCalledTimes(1)

    await clearPrivateContentSnapshots(null)
    const republished = listPart(USER_SOURCE_ID, 300, ['Homebrew Feat', 'Second Feat'])
    serve(republished)
    catalogue.manifest.mockResolvedValue(
      manifestOf([
        platformSource(PLATFORM_SOURCE_ID, SYSTEM_ID, platform),
        {
          contentSourceId: USER_SOURCE_ID,
          systemId: SYSTEM_ID,
          kind: 'USER',
          head: head(USER_SOURCE_ID, republished, { revision: 2, builtRevision: 2 })
        }
      ])
    )
    await client.invalidateQueries({ queryKey: ['content-catalogue-manifest'] })
    await waitFor(() => expect(result.current.items).toHaveLength(4))

    // The cleared cache issues a fresh token instead of reusing the signed-out one.
    expect(catalogue.issueAccess).toHaveBeenCalledTimes(2)
  })

  it('keeps serving the previous build and reports updating while a head is rebuilding', async () => {
    serve(platform)
    catalogue.manifest.mockResolvedValue(
      manifestOf([
        platformSource(PLATFORM_SOURCE_ID, SYSTEM_ID, platform, { revision: 3, builtRevision: 2 })
      ])
    )

    const { result } = renderHook(() => useContentCatalogue('FEAT'), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isPending).toBe(false))

    expect(result.current.updating).toBe(true)
    expect(result.current.items).toHaveLength(2)
  })

  it('narrows the rows to a System and a source without narrowing the summary', async () => {
    serve(platform, otherPlatform, homebrew)
    catalogue.manifest.mockResolvedValue(
      manifestOf([
        platformSource(PLATFORM_SOURCE_ID, SYSTEM_ID, platform),
        platformSource(OTHER_PLATFORM_SOURCE_ID, OTHER_SYSTEM_ID, otherPlatform),
        {
          contentSourceId: USER_SOURCE_ID,
          systemId: SYSTEM_ID,
          kind: 'USER',
          head: head(USER_SOURCE_ID, homebrew)
        }
      ])
    )

    const system = renderHook(() => useContentCatalogue('FEAT', { systemId: SYSTEM_ID }), {
      wrapper: wrapper()
    })
    await waitFor(() => expect(system.result.current.isPending).toBe(false))
    expect(system.result.current.items?.map((item) => item.label)).toEqual([
      'Alert',
      'Homebrew Feat',
      'Tough'
    ])

    const owned = renderHook(() => useContentCatalogue('FEAT', { source: 'OWNED' }), {
      wrapper: wrapper()
    })
    await waitFor(() => expect(owned.result.current.isPending).toBe(false))
    expect(owned.result.current.items?.map((item) => item.label)).toEqual(['Homebrew Feat'])
    expect(owned.result.current.summary?.activeCount).toBe(4)
  })

  it('reads nothing while disabled', async () => {
    catalogue.manifest.mockResolvedValue(manifestOf([]))

    renderHook(() => useContentCatalogue('FEAT', { enabled: false }), { wrapper: wrapper() })
    await Promise.resolve()

    expect(catalogue.manifest).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
