import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement } from 'react'
import type { ConvexReactClient } from 'convex/react'
import { TestRouterProvider } from '#test/TestRouterProvider'

interface RenderWithAppProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  initialPath?: string
  convexClient?: ConvexReactClient
}

export function renderWithAppProviders(
  ui: ReactElement,
  options: RenderWithAppProvidersOptions = {}
) {
  const { initialPath, convexClient, ...renderOptions } = options

  return render(ui, {
    wrapper: ({ children }) => (
      <TestRouterProvider initialPath={initialPath} convexClient={convexClient}>
        {children}
      </TestRouterProvider>
    ),
    ...renderOptions
  })
}
