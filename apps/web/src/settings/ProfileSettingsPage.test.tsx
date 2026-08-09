import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'

const mocks = vi.hoisted(() => ({
  getImage: vi.fn(),
  profile: vi.fn(),
  updateProfile: vi.fn(),
  usernameStatus: vi.fn()
}))

vi.mock('#app/lib/api', () => ({
  api: {
    account: {
      profile: mocks.profile,
      updateProfile: mocks.updateProfile,
      usernameStatus: mocks.usernameStatus
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
    mocks.usernameStatus.mockResolvedValue({ status: 'available' })
  })

  it('omits an unchanged username when saving the bio', async () => {
    mocks.updateProfile.mockResolvedValue({
      username: 'morgan',
      bio: 'Builds worlds.'
    })
    renderWithAppProviders(<ProfileSettingsPage userId='user-1' />)

    expect(await screen.findByRole('textbox', { name: /^username/i })).not.toHaveAttribute('readonly')
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
    expect(mocks.usernameStatus).not.toHaveBeenCalled()
  })

  it('submits a case-only username rename without an availability lookup', async () => {
    mocks.profile.mockResolvedValueOnce({ username: 'morgan', bio: null })
    mocks.updateProfile.mockResolvedValueOnce({ username: 'Morgan', bio: null })
    renderWithAppProviders(<ProfileSettingsPage userId='user-1' />)

    const username = await screen.findByRole('textbox', { name: /^username/i })
    fireEvent.change(username, { target: { value: 'Morgan' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))

    await waitFor(() =>
      expect(mocks.updateProfile).toHaveBeenCalledWith({ username: 'Morgan', bio: '' })
    )
    expect(mocks.usernameStatus).not.toHaveBeenCalled()
  })

  it('checks availability before an ordinary username rename', async () => {
    mocks.updateProfile.mockResolvedValueOnce({ username: 'new_morgan', bio: 'Forge keeper.' })
    renderWithAppProviders(<ProfileSettingsPage userId='user-1' />)

    fireEvent.change(await screen.findByRole('textbox', { name: /^username/i }), {
      target: { value: 'new_morgan' }
    })

    await waitFor(
      () => expect(mocks.usernameStatus).toHaveBeenCalledWith({ username: 'new_morgan' }),
      { timeout: 1000 }
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))

    await waitFor(() =>
      expect(mocks.updateProfile).toHaveBeenCalledWith({
        username: 'new_morgan',
        bio: 'Forge keeper.'
      })
    )
  })
})
