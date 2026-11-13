import { Component, Suspense, type ReactNode } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query'
import { ConvexQueryClient, convexQuery } from '@convex-dev/react-query'
import { ConvexReactClient } from 'convex/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '@artificer-toolkit/apis/convex/api'
import type { AuthSessionSnapshotDto } from '@artificer-toolkit/schema/api/auth'
import { createAppQueryClient } from '#app/query/createAppQueryClient'
import { Route } from './__root'

const mocks = vi.hoisted(() => ({
  snapshot: undefined as AuthSessionSnapshotDto | undefined,
  invalidate: vi.fn<() => Promise<void>>(),
  signedInTree: null as ReactNode
}))

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useQuery: () => mocks.snapshot
}))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useRouter: () => ({
    invalidate: mocks.invalidate,
    subscribe: vi.fn(),
    state: { isLoading: false, status: 'idle' }
  }),
  Outlet: () => mocks.signedInTree
}))

class BoundaryProbe extends Component<{ children: ReactNode }, { failure?: Error }> {
  override state: { failure?: Error } = {}
  static getDerivedStateFromError(failure: Error) {
    return { failure }
  }
  override render() {
    return this.state.failure ? <p>boundary: {this.state.failure.message}</p> : this.props.children
  }
}

function SettingsRoute() {
  const { data } = useSuspenseQuery(convexQuery(api.accountEntitlements.get, {}))
  return <p>tier: {String(data)}</p>
}

const user = {
  userId: '018f4a3e-712b-7c0d-8f88-6a0e5ef00d11',
  role: 'user' as const,
  email: 'fixture@example.invalid',
  username: 'fixture_user',
  registrationCompleted: true,
  authoringExperience: 'guided' as const
}
const featureFlags = { publicSignUpEnabled: false, libraryImportEnabled: false }

describe('session revocation convergence', () => {
  afterEach(() => vi.restoreAllMocks())

  it('keeps the signed-in route mounted on its cached data until the router has left it', async () => {
    const client = new ConvexReactClient('https://example.convex.cloud')
    const denied = new Error('Unauthenticated')
    const callbacks = new Set<() => void>()
    let revoked = false
    vi.spyOn(client, 'watchQuery').mockReturnValue({
      localQueryResult: () => {
        if (revoked) throw denied
        return 'FREE'
      },
      journal: () => undefined,
      onUpdate: (callback) => {
        callbacks.add(callback)
        return () => callbacks.delete(callback)
      }
    })
    vi.spyOn(client, 'query').mockImplementation(async () => {
      if (revoked) throw denied
      return 'FREE'
    })
    const queryClient = createAppQueryClient(new ConvexQueryClient(client))
    vi.spyOn(Route, 'useRouteContext').mockReturnValue({ queryClient, user })
    let finishNavigation: () => void = () => {}
    mocks.invalidate.mockReturnValue(
      new Promise<void>((resolve) => {
        finishNavigation = resolve
      })
    )
    mocks.snapshot = { user, featureFlags, isSuperAdmin: false }
    mocks.signedInTree = (
      <BoundaryProbe>
        <Suspense fallback={<p>loading</p>}>
          <SettingsRoute />
        </Suspense>
      </BoundaryProbe>
    )
    const Root = Route.options.component
    if (!Root) throw new Error('The root component must be registered.')
    const tree = () => (
      <QueryClientProvider client={queryClient}>
        <Root />
      </QueryClientProvider>
    )
    const view = render(tree())
    await screen.findByText('tier: FREE')

    await act(async () => {
      revoked = true
      for (const callback of callbacks) callback()
    })
    mocks.snapshot = { user: null, featureFlags, isSuperAdmin: false }
    view.rerender(tree())
    await waitFor(() => expect(mocks.invalidate).toHaveBeenCalledOnce())

    await act(async () => {})
    expect(screen.queryByText(/^boundary:/)).toBeNull()
    expect(screen.getByText('tier: FREE')).toBeTruthy()

    mocks.signedInTree = null
    view.rerender(tree())
    await act(async () => finishNavigation())
    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(0))
    expect(screen.queryByText(/^boundary:/)).toBeNull()
  })
})
