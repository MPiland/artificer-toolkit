import { screen } from '@testing-library/react'
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
})
