import { act } from '@testing-library/react'

/** The screen and window sizes are the platform: jsdom reports fixed values, so tests set them. */
export function stubDisplay({
  screen,
  viewportWidth
}: {
  screen: { height: number; width: number }
  viewportWidth: number
}) {
  Object.defineProperty(window.screen, 'width', { configurable: true, value: screen.width })
  Object.defineProperty(window.screen, 'height', { configurable: true, value: screen.height })
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: viewportWidth })
}

/** Changes the window width the way a rotation or a drag of the window edge does. */
export function resizeViewport(viewportWidth: number) {
  act(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: viewportWidth })
    window.dispatchEvent(new Event('resize'))
  })
}
