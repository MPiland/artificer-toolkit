import { randomBytes } from 'node:crypto'
import {
  sentryGlobalFunctionMiddleware,
  sentryGlobalRequestMiddleware
} from '@sentry/tanstackstart-react'
import { createMiddleware, createStart } from '@tanstack/react-start'
import { withSecurityHeaders } from '#app/server/securityHeaders'

const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const nonce = randomBytes(16).toString('base64')
  const result = await next({
    context: { nonce }
  })
  return { ...result, response: withSecurityHeaders(result.response, { nonce }) }
})

export const startInstance = createStart(() => ({
  functionMiddleware: [sentryGlobalFunctionMiddleware],
  requestMiddleware: [sentryGlobalRequestMiddleware, securityHeadersMiddleware]
}))
