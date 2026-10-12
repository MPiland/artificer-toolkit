import { Component, type ReactNode } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createControlledPromise,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  RouterProvider
} from '@tanstack/react-router'
import {
  authSessionSnapshotDtoSchema,
  type AuthSessionSnapshotDto
} from '@artificer-toolkit/schema/api/auth'
import type { AppRouterContext } from '#app/routerContext'
import { Route } from './__root'

const native = vi.hoisted(() => ({ snapshot: undefined as AuthSessionSnapshotDto | undefined }))
vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useConvex: () => ({ setAuth: () => {} }),
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useQuery: () => native.snapshot
}))

const renderErrors: unknown[] = []
class RenderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    renderErrors.push(error)
  }
  render() {
    return this.state.failed ? <p>Rendering failed</p> : this.props.children
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  renderErrors.length = 0
})

it('keeps authenticated navigation renderable when live session convergence overlaps a pending child', async () => {
  const guest = authSessionSnapshotDtoSchema.parse({
    user: null,
    featureFlags: { publicSignUpEnabled: false, libraryImportEnabled: false },
    isSuperAdmin: false
  })
  const owner = authSessionSnapshotDtoSchema.parse({
    ...guest,
    user: {
      userId: '018f4a3e-712b-7c0d-8f88-6a0e5ef00d11',
      role: 'user',
      email: 'fixture@example.invalid',
      username: 'fixture_user',
      registrationCompleted: true,
      authoringExperience: 'guided'
    }
  })
  native.snapshot = guest
  const navigationSession = createControlledPromise<void>()
  const convergenceSession = createControlledPromise<void>()
  const child = createControlledPromise<void>()
  const queryClient = new QueryClient()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  let refreshes = 0
  const root = createRootRouteWithContext<AppRouterContext>()({
    component: Route.options.component,
    beforeLoad: async () => {
      refreshes++
      if (refreshes === 1) return guest
      if (refreshes === 2) await navigationSession
      else await convergenceSession
      return owner
    }
  })
  const signIn = createRoute({
    getParentRoute: () => root,
    path: '/sign-in',
    component: () => <p>Sign in fixture</p>
  })
  const home = createRoute({
    getParentRoute: () => root,
    path: '/home',
    loader: () => child,
    component: () => <p>Authenticated home</p>
  })
  const router = createRouter({
    routeTree: root.addChildren([signIn, home]),
    context: { queryClient, user: null },
    history: createMemoryHistory({ initialEntries: ['/sign-in'] }),
    defaultPendingMs: 5,
    defaultPendingMinMs: 0,
    defaultPendingComponent: () => <p>Loading fixture</p>
  })
  const view = render(
    <RenderBoundary>
      <RouterProvider router={router} />
    </RenderBoundary>
  )
  let navigation: Promise<void> | undefined
  try {
    await screen.findByText('Sign in fixture')
    queryClient.setQueryData(['prior-identity'], { private: 'previous identity' })
    act(() => {
      navigation = router.navigate({ to: '/home' })
    })
    await waitFor(() => expect(refreshes).toBe(2))
    await act(async () => {
      navigationSession.resolve()
      await navigationSession
    })
    // The router offers the pending fallback once the beforeLoad chain settles and the loader runs.
    await screen.findByText('Loading fixture')
    await waitFor(() => expect(queryClient.getQueryData(['prior-identity'])).toBeUndefined())
    await act(async () => {
      child.resolve()
      await child
    })
    await waitFor(() => expect(refreshes).toBe(3))
    native.snapshot = owner
    await act(async () => {
      convergenceSession.resolve()
      await navigation
    })
    expect(renderErrors).toEqual([])
    await screen.findByText('Authenticated home')
    expect(consoleError).not.toHaveBeenCalled()
  } finally {
    navigationSession.resolve()
    child.resolve()
    convergenceSession.resolve()
    view.unmount()
    queryClient.clear()
  }
})
