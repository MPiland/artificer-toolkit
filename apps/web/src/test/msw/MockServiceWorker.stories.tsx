import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { http, HttpResponse } from 'msw'

declare module 'vitest/browser' {
  interface BrowserCommands {
    stopServiceWorkers: () => Promise<void>
  }
}

const probeUrl = '/__msw-probe__'

/**
 * Chromium may terminate a service worker at any time (idle and event timeouts) and start it again on
 * the next request. Mocking must survive that: the worker before msw 3.0.4 lost its active clients, so
 * it let every request through, and a story file loading at that moment failed to import.
 * Vitest only: the play function needs the Vitest browser command, so Storybook does not list it.
 */
const meta = {
  title: 'Platform/Mock Service Worker',
  tags: ['!dev', '!autodocs'],
  render: () => <p>Mock Service Worker probe</p>,
  beforeEach({ msw }) {
    msw.use(http.get(probeUrl, () => HttpResponse.json({ mocked: true })))
  }
} satisfies Meta

export default meta

export const KeepsMockingAfterTheBrowserStopsTheWorker: StoryObj<typeof meta> = {
  async play() {
    const { commands } = await import('vitest/browser')
    await commands.stopServiceWorkers()

    const response = await fetch(probeUrl)

    await expect(response.headers.get('content-type')).toBe('application/json')
    await expect(await response.json()).toEqual({ mocked: true })
  }
}
