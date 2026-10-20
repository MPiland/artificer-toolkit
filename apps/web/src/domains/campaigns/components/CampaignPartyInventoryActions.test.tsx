import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@artificer-toolkit/apis/convex/api'
import { inventoryDtoSchema } from '@artificer-toolkit/schema/api/campaignInventory'
import { getFunctionName, type FunctionReference } from 'convex/server'
import { renderWithAppProviders } from '#test/renderWithAppProviders'

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  equipment: {
    results: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', label: 'Torch' }],
    status: 'Exhausted' as const,
    loadMore: vi.fn()
  },
  shares: { results: [], status: 'Exhausted' as const, loadMore: vi.fn() }
}))

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useMutation: () => mocks.mutate
}))
vi.mock('convex-helpers/react', () => ({
  usePaginatedQuery: (reference: FunctionReference<'query'>) =>
    getFunctionName(reference) === getFunctionName(api.campaigns.partyInventory.equipmentOptions)
      ? mocks.equipment
      : mocks.shares
}))

import { CampaignPartyInventoryActions } from './CampaignPartyInventoryActions'

const campaignId = '11111111-1111-4111-8111-111111111111'
const rulesetCurrency = {
  kind: 'RULESET' as const,
  denominationId: '99999999-9999-4999-8999-999999999999',
  label: 'Copper (Rules)',
  abbreviation: 'cp',
  amount: 0,
  containerId: null
}
const campaignCurrency = {
  ...rulesetCurrency,
  kind: 'CAMPAIGN' as const,
  campaignCurrencySystemId: '22222222-2222-4222-8222-222222222222',
  label: 'Copper (Campaign)'
}
const emptyInventory = inventoryDtoSchema.parse({
  owner: { kind: 'CAMPAIGN', campaignId },
  version: 7,
  items: [],
  currencies: []
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.mutate.mockResolvedValue({ eventId: '33333333-3333-4333-8333-333333333333' })
})

describe('CampaignPartyInventoryActions', () => {
  const bagId = '44444444-4444-4444-8444-444444444444'
  const torchId = '55555555-5555-4555-8555-555555555555'
  const bag = { id: bagId, label: 'Backpack', quantity: 1, containerId: null, isContainer: true }

  it('adds into the selected Vehicle container using that owner fence', async () => {
    const user = userEvent.setup()
    const vehicleId = '66666666-6666-4666-8666-666666666666'
    renderWithAppProviders(
      <CampaignPartyInventoryActions
        campaignId={campaignId}
        inventory={{ ...emptyInventory, owner: { kind: 'VEHICLE', vehicleId }, items: [bag] }}
      />
    )
    await user.click(screen.getByRole('combobox', { name: 'Add to' }))
    await user.click(screen.getByRole('option', { name: 'Backpack' }))
    await user.click(screen.getByRole('combobox', { name: 'Equipment' }))
    await user.keyboard('{ArrowDown}{Enter}')
    await user.click(screen.getByRole('button', { name: 'Add item' }))
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledOnce())
    expect(mocks.mutate.mock.calls[0]![0].input).toMatchObject({
      kind: 'ITEM_ADD',
      campaignId,
      vehicleId,
      containerId: bagId,
      expectedOwnerVersion: 7
    })
  })

  it('moves an existing item out of its container without changing its quantity', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <CampaignPartyInventoryActions
        campaignId={campaignId}
        inventory={{
          ...emptyInventory,
          items: [
            bag,
            {
              id: torchId,
              label: 'Torch',
              quantity: 2,
              containerId: bagId,
              isContainer: false
            }
          ]
        }}
      />
    )
    await user.click(screen.getByRole('combobox', { name: 'Torch location' }))
    await user.click(screen.getByRole('option', { name: 'Loose' }))
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledOnce())
    expect(mocks.mutate.mock.calls[0]![0].input).toMatchObject({
      kind: 'ITEM_UPDATE',
      itemId: torchId,
      quantity: 2,
      containerId: null,
      expectedOwnerVersion: 7
    })
  })

  it('follows the stored quantity when the inventory changes under an open row', async () => {
    const user = userEvent.setup()
    const torchAt = (quantity: number) => (
      <CampaignPartyInventoryActions
        campaignId={campaignId}
        inventory={{
          ...emptyInventory,
          items: [
            bag,
            { id: torchId, label: 'Torch', quantity, containerId: bagId, isContainer: false }
          ]
        }}
      />
    )
    const { rerender } = renderWithAppProviders(torchAt(2))
    rerender(torchAt(5))
    await user.click(screen.getByRole('combobox', { name: 'Torch location' }))
    await user.click(screen.getByRole('option', { name: 'Loose' }))
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledOnce())
    expect(mocks.mutate.mock.calls[0]![0].input).toMatchObject({ itemId: torchId, quantity: 5 })
  })

  it('moves only the selected qualified currency from its displayed placement', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <CampaignPartyInventoryActions
        campaignId={campaignId}
        inventory={{
          ...emptyInventory,
          items: [bag],
          currencies: [
            { ...rulesetCurrency, amount: 5, containerId: bagId },
            { ...campaignCurrency, amount: 9, containerId: bagId }
          ]
        }}
      />
    )
    await user.click(screen.getByRole('combobox', { name: 'Copper (Campaign) move to' }))
    await user.click(screen.getByRole('option', { name: 'Loose' }))
    const amount = screen.getByRole('textbox', { name: 'Copper (Campaign) adjustment' })
    await user.clear(amount)
    await user.type(amount, '3')
    await user.click(screen.getAllByRole('button', { name: 'Move' })[1]!)
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledOnce())
    expect(mocks.mutate.mock.calls[0]![0].input).toMatchObject({
      kind: 'CURRENCY_MOVE',
      campaignCurrencySystemId: campaignCurrency.campaignCurrencySystemId,
      denominationId: campaignCurrency.denominationId,
      fromContainerId: bagId,
      toContainerId: null,
      amount: 3,
      expectedOwnerVersion: 7
    })
  })

  it('captures one native command and retries the exact input after inventory changes', async () => {
    const user = userEvent.setup()
    const firstError = new Error('stale inventory')
    mocks.mutate.mockRejectedValueOnce(firstError).mockResolvedValueOnce({ eventId: 'event-2' })
    const view = renderWithAppProviders(
      <CampaignPartyInventoryActions campaignId={campaignId} inventory={emptyInventory} />
    )

    await user.click(screen.getByRole('combobox', { name: 'Equipment' }))
    await user.keyboard('{ArrowDown}{Enter}')
    await user.click(screen.getByRole('button', { name: 'Add item' }))
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledOnce())
    const firstInput = mocks.mutate.mock.calls[0]![0].input
    expect(firstInput).toMatchObject({
      campaignId,
      equipmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      expectedOwnerVersion: 7,
      kind: 'ITEM_ADD',
      quantity: 1
    })
    expect(firstInput.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)

    view.rerender(
      <CampaignPartyInventoryActions
        campaignId={campaignId}
        inventory={{ ...emptyInventory, version: 8 }}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(2))
    expect(mocks.mutate.mock.calls[1]![0].input).toEqual(firstInput)
  })

  it('uses distinct currency namespaces for zero-balance acquisition options', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <CampaignPartyInventoryActions
        campaignId={campaignId}
        currencyOptions={[rulesetCurrency, campaignCurrency]}
        inventory={emptyInventory}
      />
    )

    const currencySelect = screen.getByRole('combobox', { name: 'Currency' })
    await user.click(currencySelect)
    await user.keyboard('{ArrowDown}{Enter}')
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledOnce())
    expect(mocks.mutate.mock.calls[0]![0].input).toMatchObject({
      campaignCurrencySystemId: null,
      denominationId: rulesetCurrency.denominationId,
      kind: 'CURRENCY_ADJUST'
    })

    await waitFor(() => expect(screen.getByRole('button', { name: 'Apply' })).not.toBeDisabled())
    await user.click(currencySelect)
    await user.click(screen.getByRole('option', { name: 'Copper (Campaign)' }))
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(2))
    expect(mocks.mutate.mock.calls[1]![0].input).toMatchObject({
      campaignCurrencySystemId: campaignCurrency.campaignCurrencySystemId,
      denominationId: campaignCurrency.denominationId,
      kind: 'CURRENCY_ADJUST'
    })
  })

  it('keeps large held totals exact when rows share a currency identity', () => {
    renderWithAppProviders(
      <CampaignPartyInventoryActions
        campaignId={campaignId}
        inventory={{
          ...emptyInventory,
          currencies: [
            { ...rulesetCurrency, amount: Number.MAX_SAFE_INTEGER },
            { ...rulesetCurrency, amount: Number.MAX_SAFE_INTEGER }
          ]
        }}
      />
    )

    expect(screen.getByText(`${BigInt(Number.MAX_SAFE_INTEGER) * 2n} cp loose`)).toBeVisible()
  })
  it('disables inventory controls while the native command is pending', async () => {
    const user = userEvent.setup()
    let resolvePending: ((value: { eventId: string }) => void) | undefined
    mocks.mutate.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePending = resolve
        })
    )
    renderWithAppProviders(
      <CampaignPartyInventoryActions campaignId={campaignId} inventory={emptyInventory} />
    )

    await user.click(screen.getByRole('combobox', { name: 'Equipment' }))
    await user.keyboard('{ArrowDown}{Enter}')
    await user.click(screen.getByRole('button', { name: 'Add item' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add item' })).toBeDisabled()
      expect(screen.getByRole('textbox', { name: 'Quantity' })).toBeDisabled()
      expect(screen.getByRole('combobox', { name: 'Equipment' })).toBeDisabled()
    })
    resolvePending?.({ eventId: 'pending-complete' })
  })
})
