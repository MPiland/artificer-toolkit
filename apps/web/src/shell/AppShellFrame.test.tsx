import { screen, within } from '@testing-library/react'
import { AppShellFrame } from './AppShellFrame'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { platformNavigation } from './navigation'

describe('AppShellFrame', () => {
  it('renders the navigation and content region', () => {
    renderWithAppProviders(
      <AppShellFrame
        navigation={platformNavigation}
        currentPath='/home'
        userEmail='creator@example.com'
      >
        <div>Inner content</div>
      </AppShellFrame>
    )

    expect(screen.getByTestId('app-shell')).toBeInTheDocument()
    expect(screen.getByLabelText('Go to workspace home')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Spells' })).toBeInTheDocument()
    expect(screen.getByLabelText('creator@example.com')).toBeInTheDocument()
    expect(screen.getByText('Inner content')).toBeInTheDocument()
  })

  it('renders route breadcrumbs without prepending the navigation group label', () => {
    renderWithAppProviders(
      <AppShellFrame
        breadcrumbs={[
          'Spells',
          'Acid Arrow',
          'Edit'
        ]}
        navigation={platformNavigation}
        currentPath='/spells/sp_2gosc6qe4g0/acid-arrow/edit'
        userEmail='creator@example.com'
      >
        <div>Inner content</div>
      </AppShellFrame>
    )

    const breadcrumb = screen.getByLabelText('Current section')

    expect(within(breadcrumb).queryByText('Workspace')).not.toBeInTheDocument()
    expect(within(breadcrumb).getByText('Spells')).toBeInTheDocument()
    expect(within(breadcrumb).getByText('Acid Arrow')).toBeInTheDocument()
    expect(within(breadcrumb).getByText('Edit')).toBeInTheDocument()
    expect(within(breadcrumb).getAllByText('/')).toHaveLength(2)
  })
})
