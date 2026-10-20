import { Suspense } from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { useQueryClient } from '@tanstack/react-query'
import type { CampaignSessionDto } from '@artificer-toolkit/schema/api/campaignSessions'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { createTabletopCampaign } from './vtt/CampaignTabletop.stories.fixtures'
import { CampaignSessionWorkspace } from './CampaignSessionWorkspace'

const server = vi.hoisted(() => ({
  campaignRole: 'OWNER' as 'OWNER' | 'PLAYER',
  encounters: [] as Array<{ status: string }>,
  fetches: 0,
  session: { status: 'OPEN' } as Pick<CampaignSessionDto, 'status'>
}))

vi.mock('#app/data/campaigns/queries', async () => {
  const { createTabletopCampaign: createCampaign } =
    await import('./vtt/CampaignTabletop.stories.fixtures')
  return {
    getCampaignSession: () => ({
      queryKey: ['workspace-test', 'session'],
      queryFn: async () => {
        server.fetches += 1
        return { ...server.session, id: 'session-1', sessionNumber: 3 }
      }
    }),
    useCampaignDetail: () => createCampaign(server.campaignRole)
  }
})
vi.mock('#app/data/encounters/queries', () => ({
  getCampaignEncounters: () => ({
    queryKey: ['workspace-test', 'encounters'],
    queryFn: async () => {
      server.fetches += 1
      return server.encounters
    }
  })
}))
vi.mock('./components/CampaignGmRoller', () => ({ CampaignGmRoller: () => null }))
vi.mock('./components/session-workspace/CampaignSessionHeader', () => ({
  CampaignSessionHeader: () => null
}))
vi.mock('./components/session-workspace/CampaignSessionPrepareView', () => ({
  CampaignSessionPrepareView: () => <div data-testid='view-prepare' />
}))
vi.mock('./components/session-workspace/CampaignSessionRunView', () => ({
  CampaignSessionRunView: () => <div data-testid='view-run' />
}))
vi.mock('./components/session-workspace/CampaignSessionCloseoutView', () => ({
  CampaignSessionCloseoutView: () => <div data-testid='view-closeout' />
}))

function RefetchServerData() {
  const queryClient = useQueryClient()
  return (
    <button onClick={() => void queryClient.invalidateQueries({ queryKey: ['workspace-test'] })}>
      refetch
    </button>
  )
}

async function renderWorkspace() {
  renderWithAppProviders(
    <Suspense fallback={null}>
      <CampaignSessionWorkspace
        campaignId={createTabletopCampaign('OWNER').id}
        currentUserId='user-1'
        sessionNumber={3}
      />
      <RefetchServerData />
    </Suspense>
  )
  await screen.findByRole('button', { name: 'refetch' })
}

/** Refetches both queries (the Encounter list only for a GM) and lets React Query notify the tree. */
async function refetch() {
  const fetchesBefore = server.fetches
  const queriesPerRefetch = server.campaignRole === 'OWNER' ? 2 : 1
  fireEvent.click(screen.getByRole('button', { name: 'refetch' }))
  await waitFor(() => expect(server.fetches).toBe(fetchesBefore + queriesPerRefetch))
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50))
  })
}

describe('CampaignSessionWorkspace view state', () => {
  beforeEach(() => {
    server.campaignRole = 'OWNER'
    server.encounters = []
    server.session = { status: 'OPEN' }
  })

  it('promotes Prepare to Run when an Encounter becomes active', async () => {
    await renderWorkspace()
    expect(await screen.findByTestId('view-prepare')).toBeInTheDocument()

    server.encounters = [{ status: 'ACTIVE' }]
    await refetch()

    expect(await screen.findByTestId('view-run')).toBeInTheDocument()
    expect(screen.queryByTestId('view-prepare')).not.toBeInTheDocument()
  })

  it('leaves a GM on Closeout when an Encounter becomes active', async () => {
    await renderWorkspace()
    fireEvent.click(await screen.findByRole('tab', { name: 'Closeout' }))
    expect(await screen.findByTestId('view-closeout')).toBeInTheDocument()

    server.encounters = [{ status: 'ACTIVE' }]
    await refetch()

    expect(screen.getByTestId('view-closeout')).toBeInTheDocument()
  })

  it('lets the GM return to Prepare while the Encounter stays active', async () => {
    server.encounters = [{ status: 'ACTIVE' }]
    await renderWorkspace()
    await waitFor(() => expect(screen.getByTestId('view-run')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('tab', { name: 'Prepare' }))
    await refetch()

    expect(screen.getByTestId('view-prepare')).toBeInTheDocument()
  })

  it('promotes again after the Encounter ends and a new one starts', async () => {
    server.encounters = [{ status: 'ACTIVE' }]
    await renderWorkspace()
    await waitFor(() => expect(screen.getByTestId('view-run')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('tab', { name: 'Prepare' }))
    server.encounters = [{ status: 'ENDED' }]
    await refetch()
    expect(screen.getByTestId('view-prepare')).toBeInTheDocument()

    server.encounters = [{ status: 'ACTIVE' }]
    await refetch()

    expect(await screen.findByTestId('view-run')).toBeInTheDocument()
  })

  it('falls back to the first available view when the Session finish removes the active one', async () => {
    server.campaignRole = 'PLAYER'
    await renderWorkspace()
    expect(await screen.findByTestId('view-run')).toBeInTheDocument()

    server.session = { status: 'FINISHED' }
    await refetch()

    expect(await screen.findByTestId('view-closeout')).toBeInTheDocument()
    expect(screen.queryByTestId('view-run')).not.toBeInTheDocument()
  })
})
