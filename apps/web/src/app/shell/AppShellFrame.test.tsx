import { screen } from '@testing-library/react'
import { AppShellFrame } from './AppShellFrame'
import { renderWithAppProviders } from '#test/renderWithAppProviders'

describe('AppShellFrame', () => {
  it('renders the navigation and content region', () => {
    renderWithAppProviders(
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
        <div>Inner content</div>
      </AppShellFrame>
    )

    expect(screen.getByTestId('app-shell')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Workspace' })).toBeInTheDocument()
    expect(screen.getByText('Characters')).toBeInTheDocument()
    expect(screen.getByText('Inner content')).toBeInTheDocument()
  })
})
