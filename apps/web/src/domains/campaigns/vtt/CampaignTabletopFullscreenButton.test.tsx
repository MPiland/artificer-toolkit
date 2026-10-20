import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { CampaignTabletopFullscreenButton } from './CampaignTabletopFullscreenButton'

/** The browser's Fullscreen API is the platform: jsdom has none, so the document gets a fake one. */
function stubFullscreen(enabled: boolean) {
  let element: Element | null = null
  const requestFullscreen = vi.fn(() => {
    element = document.documentElement
    document.dispatchEvent(new Event('fullscreenchange'))
    return Promise.resolve()
  })
  const exitFullscreen = vi.fn(() => {
    element = null
    document.dispatchEvent(new Event('fullscreenchange'))
    return Promise.resolve()
  })
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: enabled })
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => element
  })
  Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exitFullscreen })
  Object.defineProperty(document.documentElement, 'requestFullscreen', {
    configurable: true,
    value: requestFullscreen
  })
  return { exitFullscreen, requestFullscreen }
}

describe('CampaignTabletopFullscreenButton', () => {
  afterEach(() => {
    for (const property of ['fullscreenEnabled', 'fullscreenElement', 'exitFullscreen']) {
      Reflect.deleteProperty(document, property)
    }
    Reflect.deleteProperty(document.documentElement, 'requestFullscreen')
  })

  it('enters full screen on click and offers to exit', async () => {
    const { exitFullscreen, requestFullscreen } = stubFullscreen(true)
    const user = userEvent.setup()
    renderWithAppProviders(<CampaignTabletopFullscreenButton />)

    await user.click(await screen.findByRole('button', { name: 'Full screen' }))
    expect(requestFullscreen).toHaveBeenCalledOnce()

    await user.click(await screen.findByRole('button', { name: 'Exit full screen' }))
    expect(exitFullscreen).toHaveBeenCalledOnce()
    expect(await screen.findByRole('button', { name: 'Full screen' })).toBeInTheDocument()
  })

  it('follows full screen left by the browser, such as with Escape', async () => {
    stubFullscreen(true)
    const user = userEvent.setup()
    renderWithAppProviders(<CampaignTabletopFullscreenButton />)
    await user.click(await screen.findByRole('button', { name: 'Full screen' }))
    expect(await screen.findByRole('button', { name: 'Exit full screen' })).toBeInTheDocument()

    await act(async () => {
      await document.exitFullscreen()
    })
    expect(await screen.findByRole('button', { name: 'Full screen' })).toBeInTheDocument()
  })

  it('is absent where the browser cannot go full screen', () => {
    stubFullscreen(false)
    renderWithAppProviders(<CampaignTabletopFullscreenButton />)
    expect(screen.queryByRole('button', { name: /full screen/i })).toBeNull()
  })
})
