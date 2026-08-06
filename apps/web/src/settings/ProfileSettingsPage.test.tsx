import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'

const mocks = vi.hoisted(() => ({
  getImage: vi.fn(),
  profile: vi.fn(),
  updateProfile: vi.fn()
}))

vi.mock('#app/lib/api', () => ({
  api: {
    account: {
      profile: mocks.profile,
      updateProfile: mocks.updateProfile
    },
    media: {
      getImage: mocks.getImage
    }
  }
}))

import { ProfileSettingsPage } from './ProfileSettingsPage'

describe('ProfileSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.profile.mockResolvedValue({
      username: 'morgan',
      bio: 'Forge keeper.'
    })
    mocks.getImage.mockResolvedValue(null)
  })

  it('keeps the account username fixed while saving the bio', async () => {
    mocks.updateProfile.mockResolvedValue({
      username: 'morgan',
      bio: 'Builds worlds.'
    })
    renderWithAppProviders(<ProfileSettingsPage userId='user-1' />)

    expect(await screen.findByRole('textbox', { name: /^username/i })).toHaveAttribute('readonly')
    expect(screen.queryByRole('textbox', { name: /^name/i })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: /^bio/i }), {
      target: { value: 'Builds worlds.' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))

    await waitFor(() =>
      expect(mocks.updateProfile).toHaveBeenCalledWith({
        bio: 'Builds worlds.'
      })
    )
  })

  it('lets a legacy account claim its missing username once', async () => {
    mocks.profile.mockResolvedValueOnce({ username: null, bio: null })
    mocks.updateProfile.mockResolvedValueOnce({ username: 'morgan', bio: null })
    renderWithAppProviders(<ProfileSettingsPage userId='user-1' />)

    const username = await screen.findByRole('textbox', { name: /^username/i })
    expect(username).not.toHaveAttribute('readonly')
    fireEvent.change(username, { target: { value: 'morgan' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))

    await waitFor(() =>
      expect(mocks.updateProfile).toHaveBeenCalledWith({ username: 'morgan', bio: '' })
    )
  })
})
