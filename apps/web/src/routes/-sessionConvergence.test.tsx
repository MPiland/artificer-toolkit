import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import type { AuthSessionSnapshotDto } from '@artificer-toolkit/schema/api/auth'
import { Route } from './__root'
import { AuthSessionGate } from '#app/auth/AuthSessionGate'

const mocks = vi.hoisted(() => ({
  auth: { isLoading: true, isAuthenticated: false },
  snapshot: undefined as AuthSessionSnapshotDto | undefined,
  setAuth: vi.fn(),
  invalidate: vi.fn(),
  isNavigating: false,
  query: vi.fn()
}))
const client = { setAuth: mocks.setAuth }

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useConvex: () => client,
  useConvexAuth: () => mocks.auth,
  useQuery: (_reference: unknown, args: unknown) => {
    mocks.query(args)
    return mocks.snapshot
  }
}))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useRouter: () => ({ invalidate: mocks.invalidate }),
  useRouterState: () => mocks.isNavigating,
  Outlet: () => null
}))

describe('initial session convergence', () => {
  const queryClient = new QueryClient()
  const user = {
    userId: '018f4a3e-712b-7c0d-8f88-6a0e5ef00d11',
    role: 'user' as const,
    email: 'fixture@example.invalid',
    username: 'fixture_user',
    registrationCompleted: true,
    authoringExperience: 'guided' as const
  }
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth = { isLoading: true, isAuthenticated: false }
    mocks.snapshot = undefined
    mocks.isNavigating = false
    vi.spyOn(Route, 'useRouteContext').mockReturnValue({ queryClient, user: null })
  })
  afterEach(() => {
    queryClient.clear()
    vi.restoreAllMocks()
  })

  function mountRoot() {
    const Component = Route.options.component
    if (!Component) throw new Error('The root component must be registered.')
    return render(
      <>
        <AuthSessionGate />
        <Component />
      </>
    )
  }

  it('releases guest startup before the root component can mount', async () => {
    const view = render(<AuthSessionGate />)
    expect(mocks.setAuth).not.toHaveBeenCalled()
    expect(mocks.query).not.toHaveBeenCalled()
    mocks.auth = { isLoading: false, isAuthenticated: false }
    view.rerender(<AuthSessionGate />)
    expect(mocks.setAuth).toHaveBeenCalledOnce()
    expect(await mocks.setAuth.mock.calls[0]?.[0]()).toBeNull()
    expect(mocks.query).not.toHaveBeenCalled()
  })

  it('keeps startup paused until authentication is resolved', () => {
    mountRoot()
    expect(mocks.setAuth).not.toHaveBeenCalled()
    expect(mocks.query).toHaveBeenCalledWith('skip')
  })

  it('releases confirmed anonymous startup and clears a revoked SSR identity', async () => {
    vi.spyOn(Route, 'useRouteContext').mockReturnValue({ queryClient, user })
    queryClient.setQueryData(['private-draft'], { label: 'Private draft' })
    mocks.auth = { isLoading: false, isAuthenticated: false }
    const view = mountRoot()
    expect(mocks.setAuth).toHaveBeenCalledOnce()
    const tokenFetcher = mocks.setAuth.mock.calls[0]?.[0]
    expect(await tokenFetcher()).toBeNull()
    expect(mocks.query).toHaveBeenCalledWith({})

    mocks.snapshot = {
      user: null,
      featureFlags: { publicSignUpEnabled: false, libraryImportEnabled: false },
      isSuperAdmin: false
    }
    const Component = Route.options.component
    if (!Component) throw new Error('The root component must be registered.')
    view.rerender(
      <>
        <AuthSessionGate />
        <Component />
      </>
    )
    await waitFor(() => expect(mocks.invalidate).toHaveBeenCalled())
    expect(queryClient.getQueryData(['private-draft'])).toBeUndefined()
  })

  it.each(['revocation', 'preference'] as const)(
    'defers %s refresh during navigation without delaying identity-cache clearing',
    async (change) => {
      vi.spyOn(Route, 'useRouteContext').mockReturnValue({ queryClient, user })
      queryClient.setQueryData(['private-draft'], { label: 'Private draft' })
      mocks.isNavigating = true
      mocks.auth = { isLoading: false, isAuthenticated: true }
      mocks.snapshot = {
        user: change === 'revocation' ? null : { ...user, authoringExperience: 'advanced' },
        featureFlags: { publicSignUpEnabled: false, libraryImportEnabled: false },
        isSuperAdmin: false
      }
      const view = mountRoot()
      expect(mocks.invalidate).not.toHaveBeenCalled()
      expect(queryClient.getQueryData(['private-draft'])).toEqual(
        change === 'revocation' ? undefined : { label: 'Private draft' }
      )
      mocks.isNavigating = false
      const Component = Route.options.component
      if (!Component) throw new Error('The root component must be registered.')
      view.rerender(
        <>
          <AuthSessionGate />
          <Component />
        </>
      )
      await waitFor(() => expect(mocks.invalidate).toHaveBeenCalledOnce())
    }
  )

  it('does not replace an authenticated provider token with anonymous auth', () => {
    mocks.auth = { isLoading: false, isAuthenticated: true }
    mountRoot()
    expect(mocks.setAuth).not.toHaveBeenCalled()
    expect(mocks.query).toHaveBeenCalledWith({})
  })
})
