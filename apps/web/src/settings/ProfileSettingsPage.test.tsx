import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { notifications } from '@mantine/notifications'
import { getFunctionName } from 'convex/server'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  accountProfileDtoSchema,
  type AccountProfileDto
} from '@artificer-toolkit/schema/api/account'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'

const mocks = vi.hoisted(() => ({
  profile: vi.fn(),
  updateProfile: vi.fn(),
  setVisibility: vi.fn(),
  usernameStatus: vi.fn(),
  useQueries: vi.fn(),
  useMutation: vi.fn(),
  useConvexAuth: vi.fn()
}))

vi.mock('#app/data/media', () => ({
  useMediaImage: () => ({ data: null }),
  useMediaImageActions: vi.fn()
}))

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useConvexAuth: mocks.useConvexAuth,
  useQueries: mocks.useQueries,
  useMutation: mocks.useMutation
}))

vi.mock('#app/auth/betterAuthClient', () => ({
  betterAuthClient: { isUsernameAvailable: mocks.usernameStatus }
}))

import { ProfileSettingsPage } from './ProfileSettingsPage'

function profileFixture(overrides: Partial<AccountProfileDto> = {}) {
  return accountProfileDtoSchema.parse({
    username: 'morgan',
    bio: 'Forge keeper.',
    visibility: 'PRIVATE',
    ...overrides
  })
}

describe('ProfileSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.profile.mockReturnValue(profileFixture())
    mocks.usernameStatus.mockResolvedValue({ data: { available: true }, error: null })
    mocks.useQueries.mockImplementation(() => ({ profile: mocks.profile() }))
    mocks.useMutation.mockImplementation((reference) =>
      getFunctionName(reference) === getFunctionName(api.account.setProfileVisibility)
        ? mocks.setVisibility
        : mocks.updateProfile
    )
    mocks.useConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })
    vi.spyOn(notifications, 'show').mockReturnValue('profile-notification')
  })

  it('renders and updates with the real Convex subscription hook without a render loop', async () => {
    const { ConvexProvider, ConvexReactClient, useQueries } =
      await vi.importActual<typeof import('convex/react')>('convex/react')
    mocks.useQueries.mockImplementation(useQueries)
    const client = new ConvexReactClient('https://profile-test.convex.cloud', { logger: false })
    const listeners = new Set<() => void>()
    vi.spyOn(client, 'watchQuery').mockImplementation(() => ({
      onUpdate: (callback) => {
        listeners.add(callback)
        return () => listeners.delete(callback)
      },
      localQueryResult: () => mocks.profile(),
      localQueryLogs: () => undefined,
      journal: () => undefined
    }))
    let view: ReturnType<typeof renderWithAppProviders> | undefined
    try {
      view = renderWithAppProviders(
        <ConvexProvider client={client}>
          <ProfileSettingsPage userId='user-1' />
        </ConvexProvider>
      )
      expect(screen.getByRole('textbox', { name: /^bio/i })).toHaveValue('Forge keeper.')
      act(() => {
        mocks.profile.mockReturnValue(profileFixture({ bio: 'Received a subscription update.' }))
        for (const listener of listeners) listener()
      })
      expect(screen.getByRole('textbox', { name: /^bio/i })).toHaveValue(
        'Received a subscription update.'
      )
      mocks.useConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false })
      view.rerender(
        <ConvexProvider client={client}>
          <ProfileSettingsPage userId='user-1' />
        </ConvexProvider>
      )
      expect(screen.queryByRole('textbox', { name: /^bio/i })).not.toBeInTheDocument()
      expect(listeners.size).toBe(0)
    } finally {
      view?.unmount()
      await client.close()
    }
  })

  it('omits an unchanged username when saving the bio', async () => {
    mocks.updateProfile.mockResolvedValue(profileFixture({ bio: 'Builds worlds.' }))
    renderWithAppProviders(<ProfileSettingsPage userId='user-1' />)

    expect(await screen.findByRole('textbox', { name: /^username/i })).not.toHaveAttribute(
      'readonly'
    )
    expect(screen.queryByRole('textbox', { name: /^name/i })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: /^bio/i }), {
      target: { value: 'Builds worlds.' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))

    await waitFor(() =>
      expect(mocks.updateProfile.mock.lastCall?.[0]).toEqual({
        bio: 'Builds worlds.'
      })
    )
    expect(mocks.usernameStatus).not.toHaveBeenCalled()
    const [queries] = mocks.useQueries.mock.lastCall ?? []
    expect(queries.profile.args).toEqual({})
    expect(getFunctionName(queries.profile.query)).toBe(getFunctionName(api.account.profile))
    expect(mocks.useMutation.mock.calls.map(([reference]) => getFunctionName(reference))).toContain(
      getFunctionName(api.account.updateProfile)
    )
  })

  it('submits a case-only username rename without an availability lookup', async () => {
    mocks.profile.mockReturnValue(profileFixture({ bio: null }))
    mocks.updateProfile.mockResolvedValueOnce(profileFixture({ username: 'Morgan', bio: null }))
    renderWithAppProviders(<ProfileSettingsPage userId='user-1' />)

    const username = await screen.findByRole('textbox', { name: /^username/i })
    fireEvent.change(username, { target: { value: 'Morgan' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))

    await waitFor(() =>
      expect(mocks.updateProfile.mock.lastCall?.[0]).toEqual({ username: 'Morgan', bio: '' })
    )
    expect(mocks.usernameStatus).not.toHaveBeenCalled()
  })

  it('checks availability before an ordinary username rename', async () => {
    mocks.updateProfile.mockResolvedValueOnce(profileFixture({ username: 'new_morgan' }))
    renderWithAppProviders(<ProfileSettingsPage userId='user-1' />)

    fireEvent.change(await screen.findByRole('textbox', { name: /^username/i }), {
      target: { value: 'new_morgan' }
    })

    await waitFor(
      () => expect(mocks.usernameStatus).toHaveBeenCalledWith({ username: 'new_morgan' }),
      { timeout: 1000 }
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save profile' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))

    await waitFor(() =>
      expect(mocks.updateProfile.mock.lastCall?.[0]).toEqual({
        username: 'new_morgan',
        bio: 'Forge keeper.'
      })
    )
  })

  it('shows a taken username, then clears the notice and re-enables Save once it is edited back', async () => {
    mocks.usernameStatus.mockResolvedValue({ data: { available: false }, error: null })
    renderWithAppProviders(<ProfileSettingsPage userId='user-1' />)

    const username = await screen.findByRole('textbox', { name: /^username/i })
    fireEvent.change(username, { target: { value: 'taken_name' } })

    expect(
      await screen.findByText('That username is already taken.', {}, { timeout: 1000 })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeDisabled()

    fireEvent.change(username, { target: { value: 'morgan' } })

    expect(screen.queryByText('That username is already taken.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeEnabled()
  })

  it('disables Save for a username that fails the format check, without a lookup', async () => {
    renderWithAppProviders(<ProfileSettingsPage userId='user-1' />)

    fireEvent.change(await screen.findByRole('textbox', { name: /^username/i }), {
      target: { value: 'a' }
    })

    expect(screen.getByRole('button', { name: 'Save profile' })).toBeDisabled()
    expect(mocks.usernameStatus).not.toHaveBeenCalled()
  })

  it('explains the format rule instead of a stale taken notice once the username stops matching it', async () => {
    mocks.usernameStatus.mockResolvedValue({ data: { available: false }, error: null })
    renderWithAppProviders(<ProfileSettingsPage userId='user-1' />)

    const username = await screen.findByRole('textbox', { name: /^username/i })
    fireEvent.change(username, { target: { value: 'taken_name' } })
    await screen.findByText('That username is already taken.', {}, { timeout: 1000 })

    fireEvent.change(username, { target: { value: 'a' } })

    expect(
      screen.getByText(/Use 3–30 letters, numbers, and single underscores/)
    ).toBeInTheDocument()
    expect(screen.queryByText('That username is already taken.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeDisabled()
  })

  it('unsubscribes and hides the private form when authentication is lost', () => {
    const view = renderWithAppProviders(<ProfileSettingsPage userId='user-1' />)
    expect(screen.getByRole('textbox', { name: /^bio/i })).toHaveValue('Forge keeper.')

    mocks.useConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false })
    view.rerender(<ProfileSettingsPage userId='user-1' />)

    expect(mocks.useQueries).toHaveBeenLastCalledWith({})
    expect(screen.queryByRole('textbox', { name: /^bio/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Loading profile')).toBeInTheDocument()
  })

  it.each([
    new Error('private backend details'),
    { username: 'morgan', bio: null, visibility: 'PRIVATE', email: 'private@example.com' }
  ])('shows a safe error instead of rendering a failed or malformed profile', (result) => {
    mocks.profile.mockReturnValue(result)
    renderWithAppProviders(<ProfileSettingsPage userId='user-1' />)
    expect(screen.getByRole('alert')).toHaveTextContent('Profile unavailable')
    expect(screen.queryByText(/private backend|private@example/)).not.toBeInTheDocument()
  })

  it('reflects reactive updates in clean fields without overwriting an edited field', () => {
    const view = renderWithAppProviders(<ProfileSettingsPage userId='user-1' />)
    mocks.profile.mockReturnValue(profileFixture({ bio: 'Updated on another device.' }))
    view.rerender(<ProfileSettingsPage userId='user-1' />)
    expect(screen.getByRole('textbox', { name: /^bio/i })).toHaveValue('Updated on another device.')

    fireEvent.change(screen.getByRole('textbox', { name: /^bio/i }), {
      target: { value: 'My unsaved edit.' }
    })
    mocks.profile.mockReturnValue(
      profileFixture({ username: 'Morgan', bio: 'Another server update.' })
    )
    view.rerender(<ProfileSettingsPage userId='user-1' />)
    expect(screen.getByRole('textbox', { name: /^username/i })).toHaveValue('Morgan')
    expect(screen.getByRole('textbox', { name: /^bio/i })).toHaveValue('My unsaved edit.')

    mocks.profile.mockReturnValue(profileFixture({ username: 'another_user', bio: null }))
    view.rerender(<ProfileSettingsPage userId='user-2' />)
    expect(screen.getByRole('textbox', { name: /^username/i })).toHaveValue('another_user')
    expect(screen.getByRole('textbox', { name: /^bio/i })).toHaveValue('')
  })

  it('retains edits and gives a safe error when the authoritative save rejects', async () => {
    mocks.updateProfile.mockRejectedValueOnce(new Error('private backend details'))
    renderWithAppProviders(<ProfileSettingsPage userId='user-1' />)
    fireEvent.change(screen.getByRole('textbox', { name: /^bio/i }), {
      target: { value: 'Keep this draft.' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))
    await waitFor(() =>
      expect(notifications.show).toHaveBeenCalledWith({
        color: 'red',
        message: 'Could not save your profile. Try again.'
      })
    )
    expect(screen.getByRole('textbox', { name: /^bio/i })).toHaveValue('Keep this draft.')
  })

  it('keeps newer edits made while a save is pending', async () => {
    let completeSave: ((profile: AccountProfileDto) => void) | undefined
    const pending = new Promise<AccountProfileDto>((resolve) => {
      completeSave = resolve
    })
    mocks.updateProfile.mockReturnValueOnce(pending)
    renderWithAppProviders(<ProfileSettingsPage userId='user-1' />)
    const bio = screen.getByRole('textbox', { name: /^bio/i })
    fireEvent.change(bio, { target: { value: 'First edit.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))
    await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledOnce())
    fireEvent.change(bio, { target: { value: 'Second edit.' } })

    await act(async () => {
      const committed = profileFixture({ bio: 'First edit.' })
      mocks.profile.mockReturnValue(committed)
      if (!completeSave) throw new Error('Save resolver was not initialized')
      completeSave(committed)
      await pending
    })
    await waitFor(() =>
      expect(notifications.show).toHaveBeenCalledWith({ color: 'green', message: 'Profile saved.' })
    )
    expect(bio).toHaveValue('Second edit.')
  })

  it.each([
    [{ data: { available: false }, error: null }, 'That username is already taken.'],
    [
      { data: null, error: { message: 'private backend details' } },
      'Could not check that username. Try again.'
    ]
  ])('blocks saving when availability fails', async (result, message) => {
    mocks.usernameStatus.mockResolvedValue(result)
    renderWithAppProviders(<ProfileSettingsPage userId='user-1' />)
    fireEvent.change(screen.getByRole('textbox', { name: /^username/i }), {
      target: { value: 'new_morgan' }
    })
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeDisabled()
    expect(mocks.updateProfile).not.toHaveBeenCalled()
  })

  describe('profile visibility', () => {
    it('shows the current visibility and no public link while Private', async () => {
      renderWithAppProviders(<ProfileSettingsPage userId='user-1' />)

      expect(await screen.findByRole('radio', { name: 'Private' })).toBeChecked()
      expect(screen.getByRole('radio', { name: 'Public' })).not.toBeChecked()
      expect(screen.queryByRole('link', { name: 'View public profile' })).not.toBeInTheDocument()
    })

    it('saves the chosen visibility immediately, independent of the bio form', async () => {
      mocks.setVisibility.mockResolvedValue(null)
      renderWithAppProviders(<ProfileSettingsPage userId='user-1' />)

      fireEvent.click(await screen.findByRole('radio', { name: 'Public' }))

      await waitFor(() => expect(mocks.setVisibility).toHaveBeenCalledTimes(1))
      expect(mocks.setVisibility.mock.lastCall?.[0]).toEqual({ visibility: 'PUBLIC' })
      expect(mocks.updateProfile).not.toHaveBeenCalled()
    })

    it('links to the public profile only while Public and follows the subscription', async () => {
      mocks.profile.mockReturnValue(profileFixture({ visibility: 'PUBLIC' }))
      const view = renderWithAppProviders(<ProfileSettingsPage userId='user-1' />)

      expect(await screen.findByRole('radio', { name: 'Public' })).toBeChecked()
      expect(screen.getByRole('link', { name: 'View public profile' })).toHaveAttribute(
        'href',
        '/profiles/morgan'
      )

      mocks.profile.mockReturnValue(profileFixture({ visibility: 'PRIVATE' }))
      view.rerender(<ProfileSettingsPage userId='user-1' />)
      expect(screen.getByRole('radio', { name: 'Private' })).toBeChecked()
      expect(screen.queryByRole('link', { name: 'View public profile' })).not.toBeInTheDocument()
    })

    it('disables the control while saving and reports a failed save', async () => {
      let rejectSave: ((error: Error) => void) | undefined
      mocks.setVisibility.mockReturnValueOnce(
        new Promise((_, reject) => {
          rejectSave = reject
        })
      )
      renderWithAppProviders(<ProfileSettingsPage userId='user-1' />)

      fireEvent.click(await screen.findByRole('radio', { name: 'Public' }))
      await waitFor(() => expect(screen.getByRole('radio', { name: 'Public' })).toBeDisabled())
      await act(async () => {
        rejectSave?.(new Error('private backend details'))
      })

      await waitFor(() =>
        expect(notifications.show).toHaveBeenCalledWith({
          color: 'red',
          message: 'Could not change your profile visibility. Try again.'
        })
      )
      expect(screen.getByRole('radio', { name: 'Private' })).toBeChecked()
      expect(screen.getByRole('radio', { name: 'Public' })).toBeEnabled()
    })
  })
})
