import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { ThemeToggle } from './ThemeToggle'

describe('ThemeToggle', () => {
  it('switches the shared Mantine color scheme', async () => {
    renderWithAppProviders(<ThemeToggle />)

    const toggleButton = screen.getByRole('button', { name: 'Switch to light mode' })

    expect(toggleButton).toBeInTheDocument()
    await waitFor(() => expect(toggleButton).toBeEnabled())

    fireEvent.click(toggleButton)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeEnabled()
    )
  })
})
