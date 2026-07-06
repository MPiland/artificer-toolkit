import { screen } from '@testing-library/react'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { Shell } from './Shell'

describe('Shell', () => {
  it('wraps normal authed pages in the scrollable content area', () => {
    renderShell('/home')

    expect(screen.getByTestId('app-shell-main')).toContainElement(screen.getByTestId('normal-page'))
    expect(screen.getByTestId('app-shell-content')).toContainElement(screen.getByTestId('normal-page'))
  })

  it('leaves authoring routes out of the padded page content wrapper', () => {
    renderShell('/classes/new')

    expect(screen.getByTestId('app-shell-main')).toContainElement(screen.getByTestId('normal-page'))
    expect(screen.queryByTestId('app-shell-content')).not.toBeInTheDocument()
  })
})

function renderShell(currentPath: string) {
  return renderWithAppProviders(
    <Shell
      currentPath={currentPath}
      isAuthenticated
      navigation={[]}
      userEmail='test@example.com'
    >
      <div data-testid='normal-page'>Page content</div>
    </Shell>,
    { initialPath: currentPath }
  )
}
