import { describe, expect, it } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { AppShellFrame } from './AppShellFrame'

describe('AppShellFrame browser', () => {
  it('renders navigation and the main content region in a real browser', async () => {
    const screen = renderWithAppProviders(
      <AppShellFrame
        title='Workspace'
        description='App shell foundation'
        navigation={[
          {
            label: 'Home',
            note: 'Current surface',
            active: true
          },
          {
            label: 'Characters',
            note: 'Upcoming'
          }
        ]}
      >
        <div>Phase 9 workspace home</div>
      </AppShellFrame>
    )

    await expect.element(screen.getByText('Characters')).toBeInTheDocument()
    await expect.element(screen.getByText('Phase 9 workspace home')).toBeInTheDocument()
    await expect.element(screen.getByText('App shell foundation')).toBeInTheDocument()
  })
})
