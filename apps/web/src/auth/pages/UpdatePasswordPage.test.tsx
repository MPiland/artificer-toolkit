import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UpdatePasswordPage } from './UpdatePasswordPage'

const mocks = vi.hoisted(() => ({
  invalidate: vi.fn(),
  navigate: vi.fn()
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useRouter: () => ({ invalidate: mocks.invalidate })
}))

vi.mock('../components/AuthPageShell', () => ({
  AuthPageShell: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <>
      <h1>{title}</h1>
      {children}
    </>
  )
}))

vi.mock('../components/UpdatePasswordForm', () => ({
  UpdatePasswordForm: ({
    invitationCredentials,
    onSuccess
  }: {
    invitationCredentials?: { email: string; token: string }
    onSuccess?: () => Promise<void>
  }) => (
    <>
      <span data-testid='invitation-email'>{invitationCredentials?.email}</span>
      <button disabled={!invitationCredentials} onClick={() => void onSuccess?.()}>
        Complete registration
      </button>
    </>
  )
}))

vi.mock('./InviteLinkErrorPage', () => ({
  InviteLinkErrorPage: () => <p>This invitation link is unavailable</p>
}))

describe('UpdatePasswordPage invitation flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.navigate.mockResolvedValue(undefined)
    window.history.replaceState({}, '', '/update-password?flow=invite')
  })

  it('server renders the registration form without exposing fragment credentials', () => {
    const token = 'a'.repeat(64)
    window.history.replaceState(
      {},
      '',
      `/update-password?flow=invite#email=player%40example.com&token=${token}`
    )
    const html = renderToString(<UpdatePasswordPage invitation />)

    expect(html).toContain('Complete your account')
    expect(html).toContain('<button disabled="">Complete registration</button>')
    expect(html).not.toContain(token)
    expect(html).not.toContain('player@example.com')
    expect(html).not.toContain('Preparing secure registration')
  })

  it('rejects an absent invitation fragment', async () => {
    render(
      <StrictMode>
        <UpdatePasswordPage invitation />
      </StrictMode>
    )

    expect(await screen.findByText('This invitation link is unavailable')).toBeInTheDocument()
  })

  it('rejects an invalid invitation fragment and removes it from the address bar', async () => {
    window.history.replaceState(
      {},
      '',
      '/update-password?flow=invite#email=player%40example.com&token=bad'
    )

    render(
      <StrictMode>
        <UpdatePasswordPage invitation />
      </StrictMode>
    )

    expect(await screen.findByText('This invitation link is unavailable')).toBeInTheDocument()
    expect(window.location.hash).toBe('')
  })

  it('keeps valid credentials in memory, clears the fragment, and returns to sign in after redemption', async () => {
    const token = 'a'.repeat(64)
    window.history.replaceState(
      {},
      '',
      `/update-password?flow=invite#email=PLAYER%40example.com&token=${token}`
    )

    render(
      <StrictMode>
        <UpdatePasswordPage invitation />
      </StrictMode>
    )

    await waitFor(() =>
      expect(screen.getByTestId('invitation-email')).toHaveTextContent('player@example.com')
    )
    expect(window.location.hash).toBe('')

    fireEvent.click(screen.getByRole('button', { name: 'Complete registration' }))

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: '/sign-in' }))
    expect(mocks.invalidate).not.toHaveBeenCalled()
  })
})
