import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from '#test/msw/server'

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    })
  })
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

if (!document.fonts) {
  const fonts = {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
    ready: Promise.resolve(undefined),
    status: 'loaded'
  } as unknown as FontFaceSet

  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: fonts
  })
}

beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'bypass'
  })
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})
