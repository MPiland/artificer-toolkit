import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { getFunctionName } from 'convex/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  sceneRecipientHeaderSchema,
  type SceneRecipientHeader
} from '@artificer-toolkit/schema/api/sceneRecipient'
import type { CampaignScenePresentationDto } from '@artificer-toolkit/schema/api/vttScenes'
import { useCampaignPresentedScene } from './useCampaignPresentedScene'

const mocks = vi.hoisted(() => ({
  presentation: undefined as CampaignScenePresentationDto | undefined,
  headers: new Map<string, SceneRecipientHeader>(),
  read: vi.fn(),
  load: vi.fn(),
  action: vi.fn(),
  mutation: vi.fn()
}))

vi.mock('@convex-dev/react-query', () => ({
  convexQuery: (reference: unknown, args: unknown) => ({
    queryKey: ['convex', getFunctionName(reference as Parameters<typeof getFunctionName>[0]), args],
    queryFn: async () => mocks.read(reference, args),
    enabled: args !== 'skip'
  })
}))

vi.mock('convex/react', () => ({
  useConvex: () => ({ action: mocks.action, mutation: mocks.mutation })
}))

vi.mock('./liveScenes', () => ({
  loadCampaignLiveScene: mocks.load
}))

const campaignId = '00000000-0000-4000-8000-000000000001'
const sceneA = '00000000-0000-4000-8000-000000000003'
const definitionId = '00000000-0000-4000-8000-000000000005'

function header(id: string, revision: string): SceneRecipientHeader {
  return sceneRecipientHeaderSchema.parse({
    id,
    campaignId,
    definitionId,
    definitionVersion: 1,
    version: 1,
    name: 'Scene A',
    ambientIllumination: 'BRIGHT',
    fogMode: 'PER_PLAYER',
    visionRevealMode: 'ON_DRAG',
    grid: { kind: 'GRIDLESS', pixelsPerUnit: 50, unit: 'FEET' },
    map: {
      assetId: '00000000-0000-4000-8000-000000000006',
      width: 64,
      height: 64,
      tileManifestAssetId: null
    },
    recipientRevision: revision
  })
}

function compactHeader(id: string, revision: string): SceneRecipientHeader {
  const base = header(id, revision)
  const { recipientRevision: _recipientRevision, snapshot: _snapshot, ...scene } = base
  return sceneRecipientHeaderSchema.parse({
    ...base,
    snapshot: {
      ...scene,
      annotations: [],
      barriers: [],
      darknessZones: [],
      doorStates: {},
      fogLayers: [],
      lights: [],
      measurements: [],
      tokens: []
    }
  })
}

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe('useCampaignPresentedScene', () => {
  beforeEach(() => {
    mocks.presentation = { campaignId, sceneId: sceneA, version: 7 }
    mocks.headers = new Map([[sceneA, header(sceneA, 'a'.repeat(64))]])
    mocks.read.mockReset().mockImplementation((reference: unknown, args: unknown) => {
      const name = getFunctionName(reference as Parameters<typeof getFunctionName>[0])
      if (name === getFunctionName(api.scenes.presentations.get)) return mocks.presentation
      if (name === getFunctionName(api.scenes.recipientReads.header)) {
        return mocks.headers.get((args as { sceneId: string }).sceneId)
      }
      throw new Error(`Unexpected native read: ${name}`)
    })
    mocks.load.mockReset()
    mocks.action.mockReset().mockResolvedValue({
      commandId: '00000000-0000-4000-8000-000000000007',
      replayed: false,
      campaignId,
      sceneId: null,
      version: 8
    })
    mocks.mutation.mockReset()
  })

  it('renders a compact recipient snapshot without a second hydration query', async () => {
    const compact = compactHeader(sceneA, 'a'.repeat(64))
    mocks.headers.set(sceneA, compact)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const hook = renderHook(() => useCampaignPresentedScene(campaignId), {
      wrapper: wrapper(client)
    })

    await waitFor(() => expect(hook.result.current.scene).toEqual(compact.snapshot))
    expect(mocks.read).toHaveBeenCalledWith(api.scenes.recipientReads.header, { sceneId: sceneA })
    expect(mocks.load).not.toHaveBeenCalled()
  })

  it('requests metadata only and never returns a defensive compact snapshot', async () => {
    mocks.headers.set(sceneA, compactHeader(sceneA, 'a'.repeat(64)))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const hook = renderHook(() => useCampaignPresentedScene(campaignId, false), {
      wrapper: wrapper(client)
    })

    await waitFor(() => expect(hook.result.current.recipientHeader?.id).toBe(sceneA))
    expect(mocks.read).toHaveBeenCalledWith(api.scenes.recipientReads.header, {
      sceneId: sceneA,
      includeSnapshot: false
    })
    expect(hook.result.current.scene).toBeUndefined()
    expect(mocks.load).not.toHaveBeenCalled()
  })

  it('uses the recipient header without hydration and enables hydration when requested', async () => {
    mocks.load.mockResolvedValue({ id: sceneA, campaignId, version: 1, name: 'hydrated' })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const hook = renderHook(
      ({ hydrateScene }) => useCampaignPresentedScene(campaignId, hydrateScene),
      { initialProps: { hydrateScene: false }, wrapper: wrapper(client) }
    )

    await waitFor(() => expect(hook.result.current.recipientHeader?.id).toBe(sceneA))
    expect(mocks.read).toHaveBeenCalledWith(api.scenes.recipientReads.header, {
      sceneId: sceneA,
      includeSnapshot: false
    })
    expect(hook.result.current.isLoading).toBe(false)
    expect(hook.result.current.scene).toBeUndefined()
    expect(mocks.load).not.toHaveBeenCalled()

    client.setQueryData(
      [
        'convex',
        getFunctionName(api.scenes.recipientReads.header),
        { sceneId: sceneA, includeSnapshot: false }
      ],
      header(sceneA, 'b'.repeat(64))
    )
    await waitFor(() =>
      expect(hook.result.current.recipientHeader?.recipientRevision).toBe('b'.repeat(64))
    )
    expect(mocks.load).not.toHaveBeenCalled()

    hook.rerender({ hydrateScene: true })
    await waitFor(() =>
      expect(mocks.read).toHaveBeenCalledWith(api.scenes.recipientReads.header, {
        sceneId: sceneA
      })
    )
    await waitFor(() => expect(mocks.load).toHaveBeenCalledOnce())
    await waitFor(() => expect(hook.result.current.scene?.id).toBe(sceneA))
  })

  it('rejects an inconsistent recipient header in header-only mode', async () => {
    mocks.headers.set(sceneA, header('00000000-0000-4000-8000-000000000008', 'a'.repeat(64)))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const hook = renderHook(() => useCampaignPresentedScene(campaignId, false), {
      wrapper: wrapper(client)
    })

    await waitFor(() =>
      expect(hook.result.current.error?.message).toBe('Presented Scene identity is inconsistent.')
    )
    expect(hook.result.current.recipientHeader).toBeNull()
    expect(hook.result.current.scene).toBeUndefined()
    expect(mocks.load).not.toHaveBeenCalled()
  })

  it('hides the old Scene while a changed recipient revision hydrates', async () => {
    let resolveInitial: ((value: unknown) => void) | undefined
    let resolveReplacement: ((value: unknown) => void) | undefined
    mocks.load
      .mockImplementationOnce(() => new Promise((resolve) => (resolveInitial = resolve)))
      .mockImplementationOnce(() => new Promise((resolve) => (resolveReplacement = resolve)))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const hook = renderHook(() => useCampaignPresentedScene(campaignId), {
      wrapper: wrapper(client)
    })

    await waitFor(() => expect(mocks.load).toHaveBeenCalledOnce())
    resolveInitial?.({ id: sceneA, campaignId, version: 1, name: 'current before revision' })
    await waitFor(() => expect(hook.result.current.scene?.id).toBe(sceneA))

    mocks.headers.set(sceneA, header(sceneA, 'b'.repeat(64)))
    client.setQueryData(
      ['convex', getFunctionName(api.scenes.recipientReads.header), { sceneId: sceneA }],
      mocks.headers.get(sceneA)
    )
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(2))
    expect(hook.result.current.scene).toBeUndefined()

    resolveReplacement?.({ id: sceneA, campaignId, version: 1, name: 'current after revision' })
    await waitFor(() => expect(hook.result.current.scene?.id).toBe(sceneA))
  })

  it('sends the live presentation action with the current version and clears null presentations', async () => {
    mocks.load.mockResolvedValue({ id: sceneA, campaignId, version: 1, name: 'current' })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const hook = renderHook(() => useCampaignPresentedScene(campaignId), {
      wrapper: wrapper(client)
    })

    await waitFor(() => expect(hook.result.current.canPresent).toBe(true))
    await waitFor(() => expect(hook.result.current.scene?.id).toBe(sceneA))
    hook.result.current.present(null)

    await waitFor(() => expect(mocks.action).toHaveBeenCalledOnce())
    expect(mocks.mutation).not.toHaveBeenCalled()
    expect(getFunctionName(mocks.action.mock.calls[0]![0])).toBe(
      getFunctionName(api.scenes.presentations.setLive)
    )
    expect(mocks.action.mock.calls[0]![1]).toMatchObject({
      commandId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      expectedPresentationVersion: 7,
      campaignId,
      sceneId: null,
      type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
    })

    client.setQueryData(['convex', getFunctionName(api.scenes.presentations.get), { campaignId }], {
      campaignId,
      sceneId: null,
      version: 8
    })
    await waitFor(() => expect(hook.result.current.scene).toBeUndefined())
  })

  it('retries a transient Convex action disconnect without changing the recipient revision', async () => {
    mocks.load
      .mockRejectedValueOnce(new Error('Connection lost while action was in flight'))
      .mockResolvedValueOnce({ id: sceneA, campaignId, version: 1, name: 'reconnected' })
    const client = new QueryClient({
      defaultOptions: { queries: { retryDelay: 0 } }
    })
    const hook = renderHook(() => useCampaignPresentedScene(campaignId), {
      wrapper: wrapper(client)
    })

    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(hook.result.current.scene?.id).toBe(sceneA))
  })

  it('does not retry ordinary recipient authorization or fence failures', async () => {
    mocks.load.mockRejectedValue(
      new Error('Scene recipient authority changed before hydration completed.')
    )
    const client = new QueryClient({
      defaultOptions: { queries: { retryDelay: 0 } }
    })
    const hook = renderHook(() => useCampaignPresentedScene(campaignId), {
      wrapper: wrapper(client)
    })

    await waitFor(() =>
      expect(hook.result.current.error?.message).toBe(
        'Scene recipient authority changed before hydration completed.'
      )
    )
    expect(mocks.load).toHaveBeenCalledOnce()
  })
})
