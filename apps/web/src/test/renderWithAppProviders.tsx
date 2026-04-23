import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement } from 'react'
import { AppProviders } from '#app/providers/AppProviders'

export function renderWithAppProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, {
    wrapper: ({ children }) => <AppProviders>{children}</AppProviders>,
    ...options
  })
}
