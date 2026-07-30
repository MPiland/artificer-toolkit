import { fn } from 'storybook/test'
import type { AuthClient, AuthResult } from '../authClient'

export interface MockAuthClientOptions {
  result?: AuthResult
  delayMs?: number
}

async function wait(delayMs = 0) {
  if (delayMs <= 0) return
  await new Promise((resolve) => window.setTimeout(resolve, delayMs))
}

export function createMockAuthClient(options: MockAuthClientOptions = {}): AuthClient {
  const result = options.result ?? { ok: true }

  return {
    completeInvitation: fn(async () => {
      await wait(options.delayMs)
      return result
    }),
    signIn: fn(async () => {
      await wait(options.delayMs)
      return result
    }),
    signUp: fn(async () => {
      await wait(options.delayMs)
      return result
    }),
    requestPasswordReset: fn(async () => {
      await wait(options.delayMs)
      return result
    }),
    updatePassword: fn(async () => {
      await wait(options.delayMs)
      return result
    }),
    signOut: fn(async () => {
      await wait(options.delayMs)
      return result
    })
  }
}

export const mockAuthClient = createMockAuthClient()
