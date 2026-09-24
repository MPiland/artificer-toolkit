import { QueryClient } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRoute,
  createRouter,
  RouterProvider
} from '@tanstack/react-router'
import { renderToString } from 'react-dom/server'
import { loadCurrentSessionFn } from '#app/server/auth/sessionFn'
import { Route } from './__root'

vi.mock('#app/server/auth/sessionFn', () => ({ loadCurrentSessionFn: vi.fn() }))
vi.mock('@tanstack/react-router-devtools', () => ({ TanStackRouterDevtools: () => null }))
vi.mock('@tanstack/react-query-devtools', () => ({ ReactQueryDevtools: () => null }))

it('keeps the document and UI providers around a failed root session load', async () => {
  vi.mocked(loadCurrentSessionFn).mockRejectedValue(new Error('Session unavailable'))
  const index = createRoute({ getParentRoute: () => Route, path: '/', component: () => null })
  const router = createRouter({
    routeTree: Route.addChildren([index]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
    context: { queryClient: new QueryClient(), user: null },
    isServer: true
  })
  await router.load()
  const markup = renderToString(<RouterProvider router={router} />)
  expect(markup).toContain('<html')
  expect(markup).toContain('This page couldn&#x27;t load')
  expect(markup).toContain('Go to homepage')
})

it('reads browser route authority from its shared native client without an HTTP server function', async () => {
  vi.mocked(loadCurrentSessionFn).mockRejectedValue(new Error('HTTP must not be used'))
  const snapshot = {
    user: null,
    featureFlags: { publicSignUpEnabled: true, libraryImportEnabled: false },
    isSuperAdmin: false
  }
  const loadCurrentSession = vi.fn().mockResolvedValue(snapshot)
  const index = createRoute({ getParentRoute: () => Route, path: '/', component: () => null })
  const router = createRouter({
    routeTree: Route.addChildren([index]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
    context: { queryClient: new QueryClient(), user: null, loadCurrentSession },
    isServer: false
  })
  vi.mocked(loadCurrentSessionFn).mockClear()
  await router.load()
  expect(loadCurrentSession).toHaveBeenCalledOnce()
  expect(loadCurrentSessionFn).not.toHaveBeenCalled()
  expect(router.state.matches[0]?.context).toMatchObject(snapshot)
})
