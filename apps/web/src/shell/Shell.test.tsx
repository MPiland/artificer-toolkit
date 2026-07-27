import { screen } from '@testing-library/react'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { Shell } from './Shell'

describe('Shell', () => {
  it('wraps normal authed pages in the scrollable content area', () => {
    renderShell('/home')

    expect(screen.getByTestId('app-shell-main')).toContainElement(screen.getByTestId('normal-page'))
    expect(screen.getByTestId('app-shell-content')).toContainElement(
      screen.getByTestId('normal-page')
    )
  })

  it('leaves authoring routes out of the padded page content wrapper', () => {
    renderShell('/classes/new')

    expect(screen.getByTestId('app-shell-main')).toContainElement(screen.getByTestId('normal-page'))
    expect(screen.queryByTestId('app-shell-content')).not.toBeInTheDocument()
  })

  it('hides public registration from signed-out actions unless enabled', () => {
    const { rerender } = renderWithAppProviders(
      <Shell currentPath='/' isAuthenticated={false} navigation={[]}>
        <div>Page content</div>
      </Shell>
    )

    expect(screen.queryByRole('link', { name: 'Create account' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument()

    rerender(
      <Shell currentPath='/' isAuthenticated={false} navigation={[]} publicSignUpEnabled>
        <div>Page content</div>
      </Shell>
    )

    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/sign-up')
  })
})

function renderShell(currentPath: string) {
  return renderWithAppProviders(
    <Shell currentPath={currentPath} isAuthenticated navigation={[]} userEmail='test@example.com'>
      <div data-testid='normal-page'>Page content</div>
    </Shell>,
    { initialPath: currentPath }
  )
}
