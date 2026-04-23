import { screen } from '@testing-library/react'
import { PublicShellFrame } from './PublicShellFrame'
import { renderWithAppProviders } from '#test/renderWithAppProviders'

describe('PublicShellFrame', () => {
  it('renders the hero copy and review panel', () => {
    renderWithAppProviders(
      <PublicShellFrame
        eyebrow='Testing'
        title='Public shell'
        description='Foundation copy'
        highlights={[
          'One',
          'Two',
          'Three'
        ]}
      >
        <div>Review panel</div>
      </PublicShellFrame>
    )

    expect(screen.getByTestId('public-shell')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Public shell' })).toBeInTheDocument()
    expect(screen.getByText('Review panel')).toBeInTheDocument()
  })
})
