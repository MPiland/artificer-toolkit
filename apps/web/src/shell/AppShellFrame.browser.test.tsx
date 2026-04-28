import { describe, expect, it } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { AppShellFrame } from './AppShellFrame'
import { platformNavigation } from './navigation'

describe('AppShellFrame browser', () => {
  it('renders navigation and the main content region in a real browser', async () => {
    const screen = renderWithAppProviders(
      <AppShellFrame
        navigation={platformNavigation}
        currentPath='/home'
        userEmail='creator@example.com'
      >
        <div>Phase 9 workspace home</div>
      </AppShellFrame>
    )

    await expect.element(screen.getByRole('link', { name: 'Spells' })).toBeInTheDocument()
    await expect.element(screen.getByText('Phase 9 workspace home')).toBeInTheDocument()
    await expect.element(screen.getByLabelText('creator@example.com')).toBeInTheDocument()
  })
})
