import { describe, expect, it } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { PublicShellFrame } from './PublicShellFrame'

describe('PublicShellFrame browser', () => {
  it('renders the hero copy and supporting review details in a real browser', async () => {
    const screen = renderWithAppProviders(
      <PublicShellFrame
        eyebrow='Phase 9 platform foundation'
        title='Modern frontend infrastructure'
        description='Shared shells, SSR-ready routing, and test tooling all start here.'
        highlights={[
          'Storybook review gates',
          'Playwright validation',
          'Mantine plus vanilla-extract foundation'
        ]}
      >
        <div>Component checkpoint review</div>
      </PublicShellFrame>
    )

    await expect.element(
      screen.getByRole('heading', { name: 'Modern frontend infrastructure' })
    ).toBeInTheDocument()
    await expect.element(screen.getByText('Storybook review gates')).toBeInTheDocument()
    await expect.element(screen.getByText('Playwright validation')).toBeInTheDocument()
    await expect.element(screen.getByText('Component checkpoint review')).toBeInTheDocument()
  })
})
