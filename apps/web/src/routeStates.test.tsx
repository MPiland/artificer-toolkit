import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { AuthSessionUserDto } from '@artificer-toolkit/schema/api/auth'
import { vi } from 'vitest'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { RouteErrorState, RouteLoadingState, RouteNotFound } from './routeStates'

const sentryMocks = vi.hoisted(() => ({
  captureClientException: vi.fn()
}))

vi.mock('#app/observability/sentry.client', () => sentryMocks)

const signedInUser = {
  userId: 'ee297ba9-fe47-4a57-a84b-470d4bd71ad7',
  role: 'user',
  email: 'user@example.invalid',
  username: 'test_user',
  registrationCompleted: true,
  authoringExperience: 'guided'
} satisfies AuthSessionUserDto

describe('route states', () => {
  it('routes authenticated error recovery to the workspace home', () => {
    renderRouteError({ user: signedInUser })

    expect(screen.getByRole('link', { name: /go to homepage/i })).toHaveAttribute('href', '/home')
  })

  it('routes guest error recovery to the marketing home', () => {
    renderRouteError({ user: null })

    expect(screen.getByRole('link', { name: /go to homepage/i })).toHaveAttribute('href', '/')
  })

  it('resets failed queries before retrying the route', async () => {
    const user = userEvent.setup()
    const reset = vi.fn()
    const resetQueries = vi.spyOn(QueryClient.prototype, 'resetQueries').mockResolvedValue()
    renderWithRouter(
      <RouteErrorState error={new Error('Campaign not found.')} reset={reset} />,
      signedInUser
    )

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(resetQueries).toHaveBeenCalledWith({ predicate: expect.any(Function) })
    await waitFor(() => expect(reset).toHaveBeenCalledOnce())
    resetQueries.mockRestore()
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

  it('renders the route loading state as a labelled skeleton', () => {
    renderWithRouter(<RouteLoadingState />, null)

    expect(screen.getByRole('status', { name: 'Loading...' })).toBeInTheDocument()
  })
})

function renderRouteError({ user }: { user: AuthSessionUserDto | null }) {
  const errorState = (
    <RouteErrorState error={new Error('The spells list failed to load.')} reset={() => undefined} />
  )

  return renderWithRouter(errorState, user)
}

function renderRouteNotFound({ user }: { user: AuthSessionUserDto | null }) {
  return renderWithRouter(<RouteNotFound />, user)
}

function renderWithRouter(children: ReactNode, user: AuthSessionUserDto | null) {
  return render(
    <TestRouterProvider initialPath='/spells' user={user}>
      {children}
    </TestRouterProvider>
  )
}
