import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { NotificationAvailabilityContext } from './notificationContext'

const mocks = vi.hoisted(() => ({
  preferences: vi.fn(),
  updatePreferences: vi.fn()
}))

vi.mock('#app/data/notifications', () => ({
  notificationPreferencesQuery: {
    queryKey: ['native-notification-preferences'],
    queryFn: () => mocks.preferences()
  }
}))

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useMutation: () => mocks.updatePreferences
}))

import { NotificationPreferences } from './NotificationPreferences'

describe('NotificationPreferences', () => {
  it('rolls an optimistic channel update back and announces the save failure', async () => {
    mocks.preferences.mockResolvedValue({
      campaign: { email: true, inApp: true },
      social: { email: true, inApp: true }
    })
    mocks.updatePreferences.mockRejectedValueOnce(new Error('unavailable'))
    renderWithAppProviders(
      <NotificationAvailabilityContext value='ready'>
        <NotificationPreferences />
      </NotificationAvailabilityContext>
    )

    const inApp = await screen.findByRole('switch', { name: 'Social Hub in-app notifications' })
    const email = screen.getByRole('switch', { name: 'Social Hub email notifications' })
    expect(inApp).toBeChecked()
    expect(email).toBeChecked()

    fireEvent.click(email)

    await waitFor(() => {
      expect(email).toBeChecked()
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Notification preferences could not be saved.'
      )
    })
    expect(mocks.updatePreferences).toHaveBeenCalledWith({
      category: 'SOCIAL',
      email: false,
      inApp: true
    })
  })

  it('updates Campaign delivery independently', async () => {
    mocks.preferences.mockResolvedValue({
      campaign: { email: true, inApp: true },
      social: { email: true, inApp: true }
    })
    mocks.updatePreferences.mockResolvedValue({
      campaign: { email: true, inApp: false },
      social: { email: true, inApp: true }
    })
    renderWithAppProviders(
      <NotificationAvailabilityContext value='ready'>
        <NotificationPreferences />
      </NotificationAvailabilityContext>
    )

    fireEvent.click(await screen.findByRole('switch', { name: 'Campaign in-app notifications' }))

    await waitFor(() => {
      expect(mocks.updatePreferences).toHaveBeenCalledWith({
        category: 'CAMPAIGN',
        email: true,
        inApp: false
      })
    })
  })
})
