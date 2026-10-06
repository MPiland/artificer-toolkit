import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { getFunctionName } from 'convex/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@artificer-toolkit/apis/convex/api'
import type { CampaignScenePresentationDto } from '@artificer-toolkit/schema/api/vttScenes'
import { useCampaignPresentedScene } from './useCampaignPresentedScene'

const mocks = vi.hoisted(() => ({
  presentation: undefined as CampaignScenePresentationDto | undefined,
  read: vi.fn(),
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

const campaignId = '00000000-0000-4000-8000-000000000001'
const sceneA = '00000000-0000-4000-8000-000000000003'

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe('useCampaignPresentedScene', () => {
  beforeEach(() => {
    mocks.presentation = { campaignId, sceneId: sceneA, version: 7 }
    mocks.read.mockReset().mockImplementation((reference: unknown) => {
      const name = getFunctionName(reference as Parameters<typeof getFunctionName>[0])
      if (name === getFunctionName(api.scenes.presentations.get)) return mocks.presentation
      throw new Error(`Unexpected native read: ${name}`)
    })
    mocks.action.mockReset().mockResolvedValue({
      commandId: '00000000-0000-4000-8000-000000000007',
      replayed: false,
      campaignId,
      sceneId: null,
      version: 8
    })
    mocks.mutation.mockReset()
  })

  it('reads only the presentation pointer, never the Scene header or recipient reads', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const hook = renderHook(() => useCampaignPresentedScene(campaignId, null), {
      wrapper: wrapper(client)
    })

    await waitFor(() => expect(hook.result.current.sceneId).toBe(sceneA))
    expect(hook.result.current.isLoading).toBe(false)
    expect(mocks.read).toHaveBeenCalledOnce()
    expect(mocks.read).toHaveBeenCalledWith(api.scenes.presentations.get, { campaignId })
  })

  it('sends the live presentation action with the current version and follows a cleared presentation', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const hook = renderHook(() => useCampaignPresentedScene(campaignId, null), {
      wrapper: wrapper(client)
    })

    await waitFor(() => expect(hook.result.current.canPresent).toBe(true))
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
    await waitFor(() => expect(hook.result.current.sceneId).toBeNull())
  })

  it('follows the room Scene and version without reading the Convex pointer while the room holds authority', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const roomState = { presentationVersion: 12, scene: { id: sceneA } }
    const hook = renderHook(() => useCampaignPresentedScene(campaignId, roomState), {
      wrapper: wrapper(client)
    })

    expect(hook.result.current.sceneId).toBe(sceneA)
    expect(hook.result.current.isLoading).toBe(false)
    expect(hook.result.current.canPresent).toBe(true)
    hook.result.current.present(null)

    await waitFor(() => expect(mocks.action).toHaveBeenCalledOnce())
    expect(mocks.action.mock.calls[0]![1]).toMatchObject({ expectedPresentationVersion: 12 })
    expect(mocks.read).not.toHaveBeenCalled()
  })

  it('reports a presentation read failure without a Scene', async () => {
    mocks.read.mockRejectedValue(new Error('Presentation unavailable.'))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const hook = renderHook(() => useCampaignPresentedScene(campaignId, null), {
      wrapper: wrapper(client)
    })

    await waitFor(() =>
      expect(hook.result.current.error?.message).toBe('Presentation unavailable.')
    )
    expect(hook.result.current.sceneId).toBeNull()
  })
})
