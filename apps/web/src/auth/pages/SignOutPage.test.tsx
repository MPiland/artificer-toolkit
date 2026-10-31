import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SignOutPage } from './SignOutPage'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  invalidate: vi.fn(),
  signOut: vi.fn()
}))

vi.mock('@tanstack/react-router', () => {
  // The real router instance is stable across renders; a fresh object per call would re-run effects.
  const router = { invalidate: mocks.invalidate }
  return { useNavigate: () => mocks.navigate, useRouter: () => router }
})

vi.mock('../authClient', () => ({
  browserAuthClient: { signOut: mocks.signOut }
}))

vi.mock('../components/AuthPageShell', () => ({
  AuthPageShell: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

vi.mock('../auth.css', () => ({
  transitionContent: 'transitionContent',
  authButton: 'authButton',
  authFormMessage: 'authFormMessage',
  authFormMessageError: 'authFormMessageError'
}))

function renderSignOutPage(queryClient: QueryClient) {
  return render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <SignOutPage />
      </QueryClientProvider>
    </MantineProvider>
  )
}

describe('SignOutPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.navigate.mockResolvedValue(undefined)
  })

  it('clears cached user data and navigates after a successful sign out', async () => {
    mocks.signOut.mockResolvedValue({ ok: true })
    const queryClient = new QueryClient()
    queryClient.setQueryData(['user'], { id: 'user-1' })

    renderSignOutPage(queryClient)

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({ to: '/sign-in', reloadDocument: true })
    )
    expect(queryClient.getQueryData(['user'])).toBeUndefined()
    expect(mocks.invalidate).toHaveBeenCalledOnce()
  })

  it('does not clear cached user data or navigate after a failed sign out', async () => {
    mocks.signOut.mockResolvedValue({ ok: false })
    const queryClient = new QueryClient()
    queryClient.setQueryData(['user'], { id: 'user-1' })

    renderSignOutPage(queryClient)

    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1))
    expect(mocks.navigate).not.toHaveBeenCalled()
    expect(mocks.invalidate).not.toHaveBeenCalled()
    expect(queryClient.getQueryData(['user'])).toEqual({ id: 'user-1' })
  })

  it('shows the failure with a retry; a successful retry then clears cached data and navigates', async () => {
    const user = userEvent.setup()
    mocks.signOut
      .mockResolvedValueOnce({ ok: false, message: 'Could not sign out. Try again.' })
      .mockResolvedValueOnce({ ok: true })
    const queryClient = new QueryClient()
    queryClient.setQueryData(['user'], { id: 'user-1' })

    renderSignOutPage(queryClient)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign out. Try again.')
    expect(queryClient.getQueryData(['user'])).toEqual({ id: 'user-1' })
    expect(mocks.navigate).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({ to: '/sign-in', reloadDocument: true })
    )
    expect(mocks.signOut).toHaveBeenCalledTimes(2)
    expect(queryClient.getQueryData(['user'])).toBeUndefined()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('clears nothing when sign-out resolves after the page unmounted', async () => {
    let finishSignOut: (result: { ok: boolean }) => void = () => undefined
    const signOutResult = new Promise<{ ok: boolean }>((resolve) => {
      finishSignOut = resolve
    })
    mocks.signOut.mockReturnValue(signOutResult)
    const queryClient = new QueryClient()
    queryClient.setQueryData(['user'], { id: 'user-1' })

    const { unmount } = renderSignOutPage(queryClient)
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1))
    unmount()
    finishSignOut({ ok: true })
    // The page awaited this promise first, so its continuation has run once this await returns.
    await signOutResult

    expect(queryClient.getQueryData(['user'])).toEqual({ id: 'user-1' })
    expect(mocks.invalidate).not.toHaveBeenCalled()
    expect(mocks.navigate).not.toHaveBeenCalled()
  })
})
