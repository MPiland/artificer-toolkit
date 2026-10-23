// The shared barrels re-export each other in cycles, and Vitest's module runner resolves `export *`
// through them only when the first importer enters at the barrel. Loading it here, before any test
// file's own imports, fixes that entry point for every file.
import '@artificer-toolkit/shared/core'
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

// jsdom implements no object URLs. Vitest 4.1 bridges `URL.createObjectURL` to Node by reading jsdom
// 29 Blob internals (`_buffer`) that jsdom 30 replaced, so it throws for every jsdom File or Blob.
if (typeof window !== 'undefined') {
  let objectUrlCount = 0
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: () => `blob:http://localhost/${(objectUrlCount += 1)}`
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
