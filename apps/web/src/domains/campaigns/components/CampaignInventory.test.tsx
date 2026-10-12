import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getFunctionName } from 'convex/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@artificer-toolkit/apis/convex/api'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { createCampaignDetail } from '../campaignDetail.fixtures'
import { CampaignInventory } from './CampaignInventory'

const mocks = vi.hoisted(() => ({
  pending: {
    results: [] as { jobId: string; status: 'RUNNING' | 'FAILED'; retryReady: boolean }[],
    status: 'Exhausted' as 'Exhausted' | 'CanLoadMore' | 'LoadingMore',
    loadMore: vi.fn()
  },
  empty: { results: [], status: 'Exhausted', loadMore: vi.fn() },
  vehicles: {
    results: [{ id: '66666666-6666-4666-8666-666666666666', label: 'Cart' }],
    status: 'Exhausted',
    loadMore: vi.fn()
  },
  items: {
    results: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        label: 'Backpack',
        quantity: 1,
        containerId: null,
        isContainer: true
      },
      {
        id: '55555555-5555-4555-8555-555555555555',
        label: 'Torch',
        quantity: 2,
        containerId: null,
        isContainer: false
      }
    ],
    status: 'Exhausted',
    loadMore: vi.fn()
  },
  currencies: {
    results: [
      {
        kind: 'RULESET',
        denominationId: '99999999-9999-4999-8999-999999999999',
        label: 'Gold',
        abbreviation: 'gp',
        amount: 5,
        containerId: null
      }
    ],
    status: 'Exhausted',
    loadMore: vi.fn()
  },
  pendingCalls: vi.fn(),
  retry: vi.fn(),
  edit: vi.fn(),
  transfer: vi.fn(),
  query: vi.fn()
}))

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useConvex: () => ({ query: mocks.query }),
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    switch (getFunctionName(reference)) {
      case getFunctionName(api.campaigns.inventoryCleanup.retry):
        return mocks.retry
      case getFunctionName(api.campaigns.partyInventoryCommands.mutate):
        return mocks.edit
      case getFunctionName(api.campaigns.inventoryTransfers.transfer):
        return mocks.transfer
      default:
        throw new Error('Unexpected inventory mutation')
    }
  },
  useQuery: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference) === getFunctionName(api.campaigns.inventoryOwners.version)
      ? { version: 7 }
      : null
}))
vi.mock('convex-helpers/react', () => ({
  usePaginatedQuery: (
    reference: Parameters<typeof getFunctionName>[0],
    args: unknown,
    options: unknown
  ) => {
    const name = getFunctionName(reference)
    if (name === getFunctionName(api.campaigns.inventoryCleanup.pending)) {
      mocks.pendingCalls(args, options)
      return args === 'skip' ? mocks.empty : mocks.pending
    }
    if (args === 'skip') return mocks.empty
    switch (name) {
      case getFunctionName(api.campaigns.vehicles.list):
        return mocks.vehicles
      case getFunctionName(api.campaigns.partyInventory.items):
      case getFunctionName(api.campaigns.vehicleInventory.items):
        return mocks.items
      case getFunctionName(api.campaigns.partyInventory.currencies):
      case getFunctionName(api.campaigns.vehicleInventory.currencies):
        return mocks.currencies
      case getFunctionName(api.campaigns.currencySystems.list):
      case getFunctionName(api.campaigns.partyInventory.equipmentOptions):
      case getFunctionName(api.campaigns.contentShares.list):
        return mocks.empty
      default:
        throw new Error('Unexpected inventory page')
    }
  }
}))
vi.mock('./CurrencySystemEditor', () => ({ CurrencySystemEditor: () => null }))
vi.mock('./CampaignInventoryAudit', () => ({ CampaignInventoryAudit: () => null }))

const campaign = createCampaignDetail()
const currentUserId = '22222222-2222-4222-8222-222222222222'
const jobId = '77777777-7777-4777-8777-777777777777'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.vehicles.results = [{ id: '66666666-6666-4666-8666-666666666666', label: 'Cart' }]
  mocks.pending.status = 'Exhausted'
  mocks.pending.results = [{ jobId, status: 'RUNNING', retryReady: false }]
  mocks.retry.mockResolvedValue({ ok: true })
  mocks.edit.mockResolvedValue({ eventId: '88888888-8888-4888-8888-888888888888' })
})

describe('CampaignInventory cleanup notices', () => {
  it('shows one Party spinner while unrelated bags, items and qualified coins stay editable', async () => {
    const user = userEvent.setup()
    mocks.pending.results.push({ ...mocks.pending.results[0]! })
    renderWithAppProviders(<CampaignInventory campaign={campaign} currentUserId={currentUserId} />)

    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status').querySelector('[aria-hidden="true"]')).toBeVisible()
    expect(screen.getByText('Updating incoming inventory')).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Backpack location' })).toBeEnabled()
    expect(screen.getByRole('combobox', { name: 'Torch location' })).toBeEnabled()
    expect(screen.getByRole('textbox', { name: 'Gold adjustment' })).toBeEnabled()
    expect(screen.getByRole('combobox', { name: 'Item or currency' })).toBeEnabled()
    expect(mocks.pendingCalls).toHaveBeenLastCalledWith(
      { campaignId: campaign.id },
      { initialNumItems: 48 }
    )

    const quantity = screen.getByRole('textbox', { name: 'Torch quantity' })
    await user.click(quantity)
    await user.keyboard('{Control>}a{/Control}3')
    expect(quantity).toHaveValue('3')
    await user.tab()
    await waitFor(() =>
      expect(mocks.edit).toHaveBeenCalledWith({
        input: expect.objectContaining({
          campaignId: campaign.id,
          kind: 'ITEM_UPDATE',
          itemId: mocks.items.results[1]!.id,
          quantity: 3
        })
      })
    )
    expect(screen.getByText('Updating incoming inventory')).toBeVisible()
  })

  it('withholds only selected Vehicle edits and source transfer while the owner selector remains usable', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(<CampaignInventory campaign={campaign} currentUserId={currentUserId} />)
    await user.click(screen.getByRole('combobox', { name: 'Inventory owner' }))
    await user.click(screen.getByRole('option', { name: 'Cart' }))

    expect(screen.getByText('Updating Vehicle cargo')).toBeVisible()
    expect(screen.queryByRole('textbox', { name: 'Torch quantity' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add item' })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Item or currency' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Transfer', exact: true })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Inventory owner' })).toBeEnabled()
    expect(mocks.pendingCalls).toHaveBeenLastCalledWith(
      { campaignId: campaign.id, vehicleId: mocks.vehicles.results[0]!.id },
      { initialNumItems: 48 }
    )

    await user.click(screen.getByRole('combobox', { name: 'Inventory owner' }))
    await user.click(screen.getByRole('option', { name: 'Party inventory' }))
    expect(screen.getByRole('textbox', { name: 'Torch quantity' })).toBeEnabled()
    expect(screen.getByRole('combobox', { name: 'Item or currency' })).toBeEnabled()
  })

  it('keeps the Party fallback after a selected Vehicle disappears and returns', async () => {
    const user = userEvent.setup()
    const vehicle = mocks.vehicles.results[0]!
    mocks.pending.results = []
    const view = renderWithAppProviders(
      <CampaignInventory campaign={campaign} currentUserId={currentUserId} />
    )
    const owner = screen.getByRole('combobox', { name: 'Inventory owner' })

    await user.click(owner)
    await user.click(screen.getByRole('option', { name: 'Cart' }))
    expect(owner).toHaveValue('Cart')

    mocks.vehicles.results = []
    view.rerender(<CampaignInventory campaign={campaign} currentUserId={currentUserId} />)
    await waitFor(() => expect(owner).toHaveValue('Party inventory'))

    mocks.vehicles.results = [vehicle]
    view.rerender(<CampaignInventory campaign={campaign} currentUserId={currentUserId} />)
    expect(owner).toHaveValue('Party inventory')
  })

  it('removes the spinner when completed notices disappear from the native result', () => {
    const view = renderWithAppProviders(
      <CampaignInventory campaign={campaign} currentUserId={currentUserId} />
    )
    expect(screen.getByRole('status')).toBeVisible()
    mocks.pending.results = []
    view.rerender(<CampaignInventory campaign={campaign} currentUserId={currentUserId} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Torch quantity' })).toBeEnabled()
  })

  it('loads native cleanup continuations even when the current page has no notices', () => {
    mocks.pending.results = []
    mocks.pending.status = 'CanLoadMore'
    renderWithAppProviders(<CampaignInventory campaign={campaign} currentUserId={currentUserId} />)
    expect(mocks.pending.loadMore).toHaveBeenCalledWith(48)
    expect(screen.getByRole('combobox', { name: 'Item or currency' })).toBeEnabled()
  })

  it('keeps failed notices generic and denies Player retry controls', () => {
    mocks.pending.results = [{ jobId, status: 'FAILED', retryReady: true }]
    renderWithAppProviders(
      <CampaignInventory
        campaign={createCampaignDetail({ role: 'PLAYER' })}
        currentUserId={currentUserId}
      />
    )
    expect(screen.getByText('Inventory update needs a retry.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Retry update' })).not.toBeInTheDocument()
  })

  it.each(['ACTIVE', 'ARCHIVED'] as const)(
    'sends only the exact safe OWNER retry scope in an %s Campaign',
    async (status) => {
      const user = userEvent.setup()
      mocks.pending.results = [{ jobId, status: 'FAILED', retryReady: true }]
      mocks.retry.mockRejectedValue(new Error('private failure details'))
      renderWithAppProviders(
        <CampaignInventory
          campaign={createCampaignDetail({ status })}
          currentUserId={currentUserId}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Retry update' }))
      await waitFor(() =>
        expect(mocks.retry).toHaveBeenCalledWith({ campaignId: campaign.id, jobId })
      )
      await waitFor(() =>
        expect(screen.getByText('Inventory update could not be retried.')).toBeVisible()
      )
      expect(screen.queryByText('private failure details')).not.toBeInTheDocument()
    }
  )

  it('withholds OWNER retry until the backend reports retryReady', () => {
    mocks.pending.results = [{ jobId, status: 'FAILED', retryReady: false }]
    renderWithAppProviders(<CampaignInventory campaign={campaign} currentUserId={currentUserId} />)
    expect(screen.queryByRole('button', { name: 'Retry update' })).not.toBeInTheDocument()
  })
})
