import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { vi } from 'vitest'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { RouteErrorState, RouteLoadingState, RouteNotFound } from './routeStates'

const sentryMocks = vi.hoisted(() => ({
  captureClientException: vi.fn()
}))

vi.mock('#app/observability/sentry.client', () => sentryMocks)

const signedInUser = {
  id: 'user-1',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z'
} satisfies User

describe('route states', () => {
  it('routes authenticated error recovery to the workspace home', () => {
    renderRouteError({ user: signedInUser })

    expect(screen.getByRole('link', { name: /go to homepage/i })).toHaveAttribute('href', '/home')
  })

  it('routes guest error recovery to the marketing home', () => {
    renderRouteError({ user: null })

    expect(screen.getByRole('link', { name: /go to homepage/i })).toHaveAttribute('href', '/')
  })

  it('reports handled route errors to client observability', async () => {
    const error = new Error('The spells list failed to load.')

    renderWithRouter(<RouteErrorState error={error} reset={() => undefined} />, signedInUser)

    await waitFor(() => expect(sentryMocks.captureClientException).toHaveBeenCalledWith(error))
  })

  it('routes authenticated not-found recovery to the workspace home', () => {
    renderRouteNotFound({ user: signedInUser })

    expect(screen.getByRole('link', { name: /return home/i })).toHaveAttribute('href', '/home')
  })

  it('renders the route loading state with live progress copy', () => {
    renderWithRouter(<RouteLoadingState />, null)

    expect(screen.getByRole('status')).toHaveTextContent('Loading...')
  })
})

function renderRouteError({ user }: { user: User | null }) {
  const errorState = (
    <RouteErrorState error={new Error('The spells list failed to load.')} reset={() => undefined} />
  )

  return renderWithRouter(errorState, user)
}

function renderRouteNotFound({ user }: { user: User | null }) {
  return renderWithRouter(<RouteNotFound />, user)
}

function renderWithRouter(children: ReactNode, user: User | null) {
  return render(
    <TestRouterProvider initialPath='/spells' user={user}>
      {children}
    </TestRouterProvider>
  )
}
