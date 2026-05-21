import { randomBytes } from 'node:crypto'
import { createMiddleware, createStart } from '@tanstack/react-start'
import { getResponseHeaders } from '@tanstack/react-start/server'
import { createSecurityHeaders } from '#app/server/securityHeaders'

const securityHeadersMiddleware = createMiddleware().server(({ next }) => {
  const nonce = randomBytes(16).toString('base64')

  const responseHeaders = getResponseHeaders()
  for (const [name, value] of Object.entries(createSecurityHeaders({ nonce }))) {
    responseHeaders.set(name, value)
  }

  return next({
    context: { nonce }
  })
})

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeadersMiddleware]
}))
