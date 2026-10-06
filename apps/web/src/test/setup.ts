import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from '#test/msw/server'

for (const method of ['scrollIntoView', 'scrollTo'] as const) {
  if (typeof Element !== 'undefined' && !Element.prototype[method]) {
    Object.defineProperty(Element.prototype, method, {
      configurable: true,
      writable: true,
      value: () => undefined
    })
  }
}

if (typeof window !== 'undefined' && !window.matchMedia) {
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

if (typeof document !== 'undefined' && !document.fonts) {
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
    onUnhandledFrame: 'bypass'
  })
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})
