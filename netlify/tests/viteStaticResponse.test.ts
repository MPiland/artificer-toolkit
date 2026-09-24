import { createServer } from 'node:http'
import { afterEach, expect, it, vi } from 'vitest'
import netlify from '@netlify/vite-plugin'
import type { Connect, Plugin } from 'vite'

const { handleRequest, sendResponse } = vi.hoisted(() => ({
  handleRequest: vi.fn(),
  sendResponse: vi.fn()
}))

vi.mock('@netlify/dev', () => ({
  NetlifyDev: class {
    siteIsLinked = true
    start = vi.fn()
    stop = vi.fn()
    getEnabledFeatures = () => ['static']
    handleAndIntrospectNodeRequest = handleRequest
  }
}))
vi.mock('@netlify/dev-utils', () => ({
  fromWebResponse: sendResponse,
  netlifyCommand: (command: string) => command,
  netlifyBanner: 'Netlify',
  warning: (message: string) => message
}))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  delete process.env.__VITE_PLUGIN_NETLIFY_LOADED__
})

it('releases discarded static bodies before delegating to Vite, without cancelling handled responses', async () => {
  vi.stubEnv('NETLIFY_DEV', '')
  const register = vi.fn<(handler: Connect.NextHandleFunction) => void>()
  const server = createServer()
  const plugin: Plugin = netlify()[0]
  const configure = plugin.configureServer
  if (typeof configure !== 'function') throw new Error('Expected Netlify dev middleware')
  await Reflect.apply(configure, {}, [
    {
      httpServer: server,
      config: { root: '/app', publicDir: '/app/public', logger: { info: vi.fn(), warn: vi.fn() } },
      middlewares: { use: register }
    }
  ])
  const middleware = register.mock.calls[0][0]
  const request = { socket: { localPort: 3000 } }
  const response = { setHeader: vi.fn() }
  const cancel = vi.fn()
  const staticResponse = new Response(new ReadableStream({ cancel }))
  handleRequest.mockResolvedValueOnce({ type: 'static', response: staticResponse })
  const next = vi.fn(() => expect(cancel).toHaveBeenCalledOnce())
  try {
    await Reflect.apply(middleware, {}, [request, response, next])
    expect(next).toHaveBeenCalledOnce()
    expect(sendResponse).not.toHaveBeenCalled()

    const handledCancel = vi.fn()
    const handledResponse = new Response(new ReadableStream({ cancel: handledCancel }))
    handleRequest.mockResolvedValueOnce({ type: 'function', response: handledResponse })
    await Reflect.apply(middleware, {}, [request, response, next])
    expect(sendResponse).toHaveBeenCalledExactlyOnceWith(handledResponse, response)
    expect(handledCancel).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledOnce()
    await handledResponse.body?.cancel()
  } finally {
    await staticResponse.body?.cancel()
    server.emit('close')
  }
})
