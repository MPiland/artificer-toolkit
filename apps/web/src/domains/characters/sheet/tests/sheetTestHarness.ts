import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
export {
  createMovementPanel,
  createRestPreview,
  createSheet
} from '../fixtures/playedCharacters.fixture'

export async function openHpControls(user: ReturnType<typeof userEvent.setup>) {
  const manageButton = screen.getByRole('button', { name: /manage (?:hp|hit points)/i })
  if (manageButton.getAttribute('aria-expanded') !== 'true') {
    await user.click(manageButton)
  }
  await screen.findByRole('dialog', { name: /manage hit points/i })
  await screen.findByLabelText(/hit point amount/i)
}

export async function openEquipmentManager(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /manage equipment/i }))
  await screen.findByRole('dialog', { name: /manage equipment/i })
}

export async function showCarriedEquipment(user: ReturnType<typeof userEvent.setup>) {
  const carried = screen.getByRole('button', { name: /^carried$/i })
  if (carried.getAttribute('aria-expanded') !== 'true') {
    await user.click(carried)
  }
}

export function mockMobileSheetViewport() {
  const originalMatchMedia = window.matchMedia

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width: 760px') || query.includes('max-width: 48rem'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })

  return () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia
    })
  }
}
