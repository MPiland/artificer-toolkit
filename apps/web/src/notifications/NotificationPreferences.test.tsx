import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { NotificationAvailabilityContext } from './notificationContext'
import { socialWorkflowIdentifiers } from './notificationPreferencesModel'

const mocks = vi.hoisted(() => ({
  bulkUpdate: vi.fn(),
  refetch: vi.fn(),
  usePreferences: vi.fn()
}))

vi.mock('@novu/react', () => ({
  useNovu: () => ({ preferences: { bulkUpdate: mocks.bulkUpdate } }),
  usePreferences: mocks.usePreferences
}))

import { NotificationPreferences } from './NotificationPreferences'

describe('NotificationPreferences', () => {
  const enabledPreferences = socialWorkflowIdentifiers.map((identifier) => ({
    workflow: { identifier },
    channels: { email: true, in_app: true }
  }))

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.usePreferences.mockReturnValue({
      isLoading: false,
      refetch: mocks.refetch,
      preferences: enabledPreferences
    })
  })

  it('rolls an optimistic channel update back and announces the save failure', async () => {
    mocks.bulkUpdate.mockResolvedValueOnce({ error: new Error('unavailable') })
    renderWithAppProviders(
      <NotificationAvailabilityContext value='ready'>
        <NotificationPreferences />
      </NotificationAvailabilityContext>
    )

    const inApp = screen.getByRole('switch', { name: 'In-app notifications' })
    const email = screen.getByRole('switch', { name: 'Email notifications' })
    expect(inApp).toBeChecked()
    expect(email).toBeChecked()

    fireEvent.click(email)

    await waitFor(() => {
      expect(email).toBeChecked()
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Notification preferences could not be saved.'
      )
    })
    expect(mocks.bulkUpdate).toHaveBeenCalledWith(
      socialWorkflowIdentifiers.map((workflowId) => ({
        workflowId,
        channels: { email: false, in_app: true }
      }))
    )
  })

  it('blocks edits after a load failure and restores them after a successful retry', async () => {
    const staleError = new Error('unavailable')
    mocks.usePreferences.mockReturnValue({
      error: staleError,
      isLoading: false,
      preferences: undefined,
      refetch: mocks.refetch
    })
    mocks.refetch.mockImplementationOnce(async () => {
      mocks.usePreferences.mockReturnValue({
        error: staleError,
        isLoading: false,
        preferences: enabledPreferences,
        refetch: mocks.refetch
      })
    })
    renderWithAppProviders(
      <NotificationAvailabilityContext value='ready'>
        <NotificationPreferences />
      </NotificationAvailabilityContext>
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load notification preferences.')
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => {
      expect(mocks.refetch).toHaveBeenCalledOnce()
      expect(screen.getAllByRole('switch')).toHaveLength(2)
    })
    expect(mocks.bulkUpdate).not.toHaveBeenCalled()
  })
})
