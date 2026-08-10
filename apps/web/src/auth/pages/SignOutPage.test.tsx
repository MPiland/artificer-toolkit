import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SignOutPage } from './SignOutPage'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  signOut: vi.fn()
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate
}))

vi.mock('../authClient', () => ({
  browserAuthClient: { signOut: mocks.signOut }
}))

vi.mock('../components', () => ({
  AuthPageShell: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

vi.mock('../auth.css', () => ({ transitionContent: 'transitionContent' }))

function renderSignOutPage(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <SignOutPage />
    </QueryClientProvider>
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

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: '/sign-in' }))
    expect(queryClient.getQueryData(['user'])).toBeUndefined()
  })

  it('does not clear cached user data or navigate after a failed sign out', async () => {
    mocks.signOut.mockResolvedValue({ ok: false })
    const queryClient = new QueryClient()
    queryClient.setQueryData(['user'], { id: 'user-1' })

    renderSignOutPage(queryClient)

    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1))
    expect(mocks.navigate).not.toHaveBeenCalled()
    expect(queryClient.getQueryData(['user'])).toEqual({ id: 'user-1' })
  })
})
