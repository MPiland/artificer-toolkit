import { screen } from '@testing-library/react'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { MobileAppFooter } from './MobileAppFooter'

describe('MobileAppFooter', () => {
  it('renders Social as a direct active destination', () => {
    renderWithAppProviders(
      <MobileAppFooter
        items={[
          {
            href: '/social',
            icon: 'social',
            id: 'social',
            isActive: true,
            label: 'Social'
          }
        ]}
      />,
      { initialPath: '/social' }
    )

    expect(screen.getByRole('link', { name: 'Social' })).toHaveAttribute('href', '/social')
    expect(screen.getByRole('link', { name: 'Social' })).toHaveAttribute('aria-current', 'page')
  })
})
