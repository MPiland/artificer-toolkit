import { Button } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConvexReactClient, usePaginatedQuery } from 'convex/react'
import { getFunctionName } from 'convex/server'
import { loadSceneDefinition, saveSceneDefinition } from '#app/data/campaigns/scenes'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { tabletopSceneDefinition, tabletopMapDelivery } from './CampaignTabletop.stories.fixtures'
import { CampaignScenePreparation } from './CampaignScenePreparation'

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  usePaginatedQuery: vi.fn()
}))
vi.mock('#app/data/campaigns/scenes', () => ({
  loadSceneDefinition: vi.fn(),
  saveSceneDefinition: vi.fn()
}))
const { annotations, barriers, darknessZones, lights, tokens, ...sceneSettings } =
  tabletopSceneDefinition
const sceneHeader = {
  ...sceneSettings,
  saveId: '99999999-9999-4999-8999-999999999999',
  counts: {
    annotations: annotations.length,
    barriers: barriers.length,
    darknessZones: darknessZones.length,
    lights: lights.length,
    tokens: tokens.length
  },
  createdAt: '2026-09-10T00:00:00.000Z',
  updatedAt: '2026-09-10T00:00:00.000Z'
}

vi.mock('./CampaignSceneEditor', () => ({
  CampaignSceneEditor: ({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) => (
    <Button onClick={() => onDirtyChange(true)}>Change scene</Button>
  )
}))

describe('CampaignScenePreparation unsaved navigation', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  it('keeps a dirty scene editor mounted when the GM stays', async () => {
    const { user } = await renderDirtySceneEditor()
    await user.click(await screen.findByRole('button', { name: 'Change scene' }))
    await user.click(screen.getByRole('button', { name: 'Open spells' }))

    expect(await screen.findByRole('dialog', { name: 'Leave without saving?' })).toBeInTheDocument()
    expect(screen.getByTestId('pathname')).toHaveTextContent('/backgrounds')

    await user.click(screen.getByRole('button', { name: 'Stay' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Leave without saving?' })
      ).not.toBeInTheDocument()
    )
    expect(screen.getByTestId('pathname')).toHaveTextContent('/backgrounds')
  })

  it('loads another bounded Scene list page without loading every definition', async () => {
    const { user } = await renderDirtySceneEditor('CanLoadMore')
    await user.click(await screen.findByRole('button', { name: 'Load more scenes' }))
    expect(vi.mocked(usePaginatedQuery).mock.results[0]?.value.loadMore).toHaveBeenCalledWith(8)
    expect(loadSceneDefinition).toHaveBeenCalledWith(
      expect.anything(),
      {
        campaignId: sceneHeader.campaignId,
        sceneId: sceneHeader.id
      },
      expect.any(AbortSignal)
    )
  })

  it('keeps the dirty selection when a refreshed list page no longer contains its header', async () => {
    const { user, rerender } = await renderDirtySceneEditor()
    await user.click(await screen.findByRole('button', { name: 'Change scene' }))
    vi.mocked(usePaginatedQuery).mockReturnValue({
      results: [
        { ...sceneHeader, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Another Scene' }
      ],
      status: 'CanLoadMore',
      isLoading: false,
      loadMore: vi.fn()
    })
    rerender(
      <TestRouterProvider initialPath='/backgrounds'>
        <CampaignScenePreparation
          campaignId={sceneHeader.campaignId}
          currentUserId='22222222-2222-4222-8222-222222222222'
          memberships={[]}
        />
        <NavigationProbe />
      </TestRouterProvider>
    )
    expect(screen.getByRole('button', { name: /Another Scene/ })).toBeDisabled()
    expect(loadSceneDefinition).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Change scene' })).toBeInTheDocument()
  })

  it('retries finalization of the uploaded asset without creating or sending another upload', async () => {
    vi.mocked(usePaginatedQuery).mockReturnValue({
      results: [],
      status: 'Exhausted',
      isLoading: false,
      loadMore: vi.fn()
    })
    vi.mocked(saveSceneDefinition).mockResolvedValue(tabletopSceneDefinition)
    const client = new ConvexReactClient('https://unit-test.convex.cloud', { logger: false })
    const createUpload = vi.spyOn(client, 'mutation').mockResolvedValue({
      assetId: tabletopMapDelivery.assetId,
      method: 'PUT',
      url: 'https://storage.example/map',
      expiresAt: '2026-09-11T02:00:00.000Z'
    })
    let finalizations = 0
    const action = vi.spyOn(client, 'action').mockImplementation(async (...[reference]) => {
      if (getFunctionName(reference) === 'media/vttMapActions:finalize') {
        if (++finalizations === 1) throw new Error('Try finalization again.')
        return { assetId: tabletopMapDelivery.assetId, status: 'READY' }
      }
      if (getFunctionName(reference) === 'media/vttMapActions:getDelivery')
        return tabletopMapDelivery
      throw new Error('Unexpected action')
    })
    const send = vi.fn()
    vi.stubGlobal(
      'XMLHttpRequest',
      class {
        status = 200
        upload = { onprogress: null }
        onload: (() => void) | null = null
        open = vi.fn()
        setRequestHeader = vi.fn()
        send(file: File) {
          send(file)
          queueMicrotask(() => this.onload?.())
        }
      }
    )
    const { container } = render(
      <TestRouterProvider convexClient={client}>
        <CampaignScenePreparation
          campaignId={sceneHeader.campaignId}
          currentUserId='22222222-2222-4222-8222-222222222222'
          memberships={[]}
        />
      </TestRouterProvider>
    )
    const user = userEvent.setup()
    await user.upload(
      container.querySelector<HTMLInputElement>('input[type="file"]')!,
      new File(['map'], 'courtyard.png', { type: 'image/png' })
    )
    await user.click(screen.getByRole('button', { name: 'Upload map' }))
    expect(await screen.findByText('Try finalization again.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Upload map' }))
    await screen.findByRole('img', { name: 'Uploaded map calibration preview' })
    expect(createUpload).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledTimes(1)
    expect(action).toHaveBeenCalledTimes(3)
    await user.click(screen.getByRole('button', { name: 'Save scene' }))
    await waitFor(() =>
      expect(saveSceneDefinition).toHaveBeenCalledWith(
        client,
        expect.objectContaining({
          name: 'courtyard',
          map: expect.objectContaining({ assetId: tabletopMapDelivery.assetId })
        }),
        expect.any(String)
      )
    )
    await client.close()
  })
})

async function renderDirtySceneEditor(status: 'Exhausted' | 'CanLoadMore' = 'Exhausted') {
  vi.mocked(loadSceneDefinition).mockResolvedValue(tabletopSceneDefinition)
  vi.mocked(usePaginatedQuery).mockReturnValue({
    results: [sceneHeader],
    status,
    isLoading: false,
    loadMore: vi.fn()
  })
  const { rerender } = render(
    <TestRouterProvider initialPath='/backgrounds'>
      <CampaignScenePreparation
        campaignId='11111111-1111-4111-8111-111111111111'
        currentUserId='22222222-2222-4222-8222-222222222222'
        memberships={[]}
      />
      <NavigationProbe />
    </TestRouterProvider>
  )
  return { user: userEvent.setup(), rerender }
}

function NavigationProbe() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  return (
    <>
      <Button onClick={() => void navigate({ to: '/spells' })}>Open spells</Button>
      <span data-testid='pathname'>{pathname}</span>
    </>
  )
}
