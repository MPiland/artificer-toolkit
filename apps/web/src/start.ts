import { randomBytes } from 'node:crypto'
import { createMiddleware, createStart } from '@tanstack/react-start'
import { setResponseHeaders } from '@tanstack/react-start/server'
import { createSecurityHeaders } from '#app/server/securityHeaders'

const securityHeadersMiddleware = createMiddleware().server(({ next }) => {
  const nonce = randomBytes(16).toString('base64')

  setResponseHeaders(createSecurityHeaders({ nonce }))

  return next({
    context: { nonce }
  })
})

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeadersMiddleware]
}))
