import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@artificer-toolkit/apis/convex/api'
import type { CurrencySystemDto } from '@artificer-toolkit/schema/api/campaignInventory'
import { getFunctionName, type FunctionReference } from 'convex/server'
import { renderWithAppProviders } from '#test/renderWithAppProviders'

const mocks = vi.hoisted(() => ({ save: vi.fn(), remove: vi.fn() }))

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useMutation: (reference: FunctionReference<'mutation'>) =>
    getFunctionName(reference) === getFunctionName(api.campaigns.currencySystems.save)
      ? mocks.save
      : mocks.remove
}))

import { CurrencySystemEditor } from './CurrencySystemEditor'

const system = {
  id: '11111111-1111-4111-8111-111111111111',
  label: 'Silver Standard',
  isReference: true,
  version: 4,
  denominations: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      label: 'Silver',
      abbreviation: 'sp',
      scaleInReference: 1
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      label: 'Copper',
      abbreviation: 'cp',
      scaleInReference: 10
    }
  ]
} satisfies CurrencySystemDto

beforeEach(() => {
  vi.clearAllMocks()
  mocks.save.mockResolvedValue(system)
  mocks.remove.mockResolvedValue({ ok: true })
})

async function selectCurrent(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('combobox', { name: 'Edit currency system' }))
  await user.click(screen.getByRole('option', { name: system.label }))
}

describe('CurrencySystemEditor', () => {
  it('saves the selected system with its current version and complete draft', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <CurrencySystemEditor campaignId='44444444-4444-4444-8444-444444444444' systems={[system]} />
    )
    await selectCurrent(user)
    await user.click(screen.getByRole('button', { name: 'Save system' }))

    await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce())
    expect(mocks.save).toHaveBeenCalledWith({
      campaignId: '44444444-4444-4444-8444-444444444444',
      systemId: system.id,
      expectedVersion: system.version,
      label: system.label,
      isReference: true,
      denominations: system.denominations
    })
  })

  it('blocks every editor action while save is pending, including denomination text fields', async () => {
    const user = userEvent.setup()
    mocks.save.mockReturnValue(new Promise(() => undefined))
    renderWithAppProviders(
      <CurrencySystemEditor campaignId='44444444-4444-4444-8444-444444444444' systems={[system]} />
    )
    await selectCurrent(user)
    await user.click(screen.getByRole('button', { name: 'Save system' }))

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Edit currency system' })).toBeDisabled()
      expect(screen.getByRole('textbox', { name: 'System name' })).toBeDisabled()
      expect(screen.getByRole('checkbox', { name: 'Reference system' })).toBeDisabled()
      expect(
        screen
          .getAllByRole('textbox', { name: 'Denomination' })
          .every((input) => input.hasAttribute('disabled'))
      ).toBe(true)
      expect(
        screen
          .getAllByRole('textbox', { name: 'Abbreviation' })
          .every((input) => input.hasAttribute('disabled'))
      ).toBe(true)
      expect(
        screen
          .getAllByRole('textbox', { name: 'Scale' })
          .every((input) => input.hasAttribute('disabled'))
      ).toBe(true)
      expect(screen.getByRole('button', { name: 'Add denomination' })).toBeDisabled()
      expect(screen.getAllByRole('button', { name: 'Remove' })[0]).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Save system' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Delete system' })).toBeDisabled()
    })
  })

  it('cannot save a selected row that disappeared from reactive systems', async () => {
    const user = userEvent.setup()
    const view = renderWithAppProviders(
      <CurrencySystemEditor campaignId='44444444-4444-4444-8444-444444444444' systems={[system]} />
    )
    await selectCurrent(user)
    view.rerender(
      <CurrencySystemEditor campaignId='44444444-4444-4444-8444-444444444444' systems={[]} />
    )

    expect(screen.getByRole('button', { name: 'Save system' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Delete system' })).not.toBeInTheDocument()
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('deletes the selected system with its current version', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <CurrencySystemEditor campaignId='44444444-4444-4444-8444-444444444444' systems={[system]} />
    )
    await selectCurrent(user)
    await user.click(screen.getByRole('button', { name: 'Delete system' }))

    await waitFor(() => expect(mocks.remove).toHaveBeenCalledOnce())
    expect(mocks.remove).toHaveBeenCalledWith({
      campaignId: '44444444-4444-4444-8444-444444444444',
      systemId: system.id,
      expectedVersion: system.version
    })
  })
})
