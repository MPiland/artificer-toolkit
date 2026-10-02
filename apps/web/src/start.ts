import { captureException } from '@sentry/cloudflare'
import { createMiddleware, createStart } from '@tanstack/react-start'
import { withSecurityHeaders } from '#app/server/securityHeaders'

const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
  const result = await next({
    context: { nonce }
  })
  return { ...result, response: withSecurityHeaders(result.response, { nonce }) }
})

// TanStack Start turns request and server-function errors into responses, so the Worker-level
// Sentry wrapper never sees them. The Start compiler strips these server bodies, and with them the
// Sentry import, from the client bundle.
function reportServerErrors(mechanism: string) {
  return async <Result>({ next }: { next: () => Result | Promise<Result> }) => {
    try {
      return await next()
    } catch (error) {
      captureException(error, { mechanism: { type: mechanism, handled: false } })
      throw error
    }
  }
}

export const startInstance = createStart(() => ({
  // Routes render on the server only when they opt in with `ssr: true` (root, guest and the
  // _authed layout). Every other route renders its pending skeleton on the server and loads in the
  // browser, so signed-in pages never prefetch Convex data during SSR (D75).
  defaultSsr: false,
  functionMiddleware: [
    createMiddleware({ type: 'function' }).server(
      reportServerErrors('auto.middleware.tanstackstart.server_function')
    )
  ],
  requestMiddleware: [
    createMiddleware().server(reportServerErrors('auto.middleware.tanstackstart.request')),
    securityHeadersMiddleware
  ]
}))
