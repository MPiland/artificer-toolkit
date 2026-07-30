import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'

const mocks = vi.hoisted(() => ({
  profile: vi.fn(),
  updateProfile: vi.fn()
}))

vi.mock('#app/lib/api', () => ({
  ApiError: class ApiError extends Error {
    constructor(
      public readonly status: number,
      message: string
    ) {
      super(message)
    }
  },
  api: {
    account: {
      profile: mocks.profile,
      updateProfile: mocks.updateProfile
    }
  }
}))

import { ApiError } from '#app/lib/api'
import { ProfileSettingsPage } from './ProfileSettingsPage'

describe('ProfileSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.profile.mockResolvedValue({
      username: 'morgan',
      name: 'Morgan',
      bio: 'Forge keeper.'
    })
  })

  it('saves username, name, and bio atomically', async () => {
    mocks.updateProfile.mockResolvedValue({
      username: 'morgan_emberfall',
      name: 'Morgan Emberfall',
      bio: 'Builds worlds.'
    })
    renderWithAppProviders(<ProfileSettingsPage userId='user-1' />)

    fireEvent.change(await screen.findByRole('textbox', { name: /^username/i }), {
      target: { value: 'Morgan_Emberfall' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: /^name/i }), {
      target: { value: 'Morgan Emberfall' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: /^bio/i }), {
      target: { value: 'Builds worlds.' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))

    await waitFor(() =>
      expect(mocks.updateProfile).toHaveBeenCalledWith({
        username: 'Morgan_Emberfall',
        name: 'Morgan Emberfall',
        bio: 'Builds worlds.'
      })
    )
  })

  it('shows username conflicts on the username field', async () => {
    mocks.updateProfile.mockRejectedValue(new ApiError(409, 'That username is already taken.'))
    renderWithAppProviders(<ProfileSettingsPage userId='user-1' />)

    fireEvent.change(await screen.findByRole('textbox', { name: /^username/i }), {
      target: { value: 'taken_name' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(await screen.findByText('That username is already taken.')).toBeInTheDocument()
  })
})
