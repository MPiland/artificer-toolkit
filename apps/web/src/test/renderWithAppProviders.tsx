import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement } from 'react'
import { TestRouterProvider } from '#test/TestRouterProvider'

interface RenderWithAppProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  initialPath?: string
}

export function renderWithAppProviders(
  ui: ReactElement,
  options: RenderWithAppProvidersOptions = {}
) {
  const { initialPath, ...renderOptions } = options

  return render(ui, {
    wrapper: ({ children }) => (
      <TestRouterProvider initialPath={initialPath}>
        {children}
      </TestRouterProvider>
    ),
    ...renderOptions
  })
}
