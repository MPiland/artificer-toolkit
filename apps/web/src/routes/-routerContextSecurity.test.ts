import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthSessionUserDto } from '@artificer-toolkit/schema/api/auth'
import { getRouter } from '#app/router'

const constructorOptions = vi.hoisted(() => vi.fn())
vi.mock('@convex-dev/react-query', async (importOriginal) => {
  const original = await importOriginal<typeof import('@convex-dev/react-query')>()
  return {
    ...original,
    ConvexQueryClient: class extends original.ConvexQueryClient {
      constructor(...args: ConstructorParameters<typeof original.ConvexQueryClient>) {
        super(...args)
        constructorOptions(args[1])
      }
    }
  }
})

describe('router context security', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_CONVEX_URL', 'https://example.convex.cloud')
    constructorOptions.mockClear()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('waits for browser authentication before subscribing to SSR-hydrated queries', () => {
    getRouter()
    expect(constructorOptions).toHaveBeenCalledWith(expect.objectContaining({ expectAuth: true }))
  })

  it('does not serialize auth tokens into the route payload context', () => {
    const user = {
      authoringExperience: 'guided',
      email: 'player@example.com',
      registrationCompleted: true,
      role: 'user',
      userId: '018f4a3e-712b-7c0d-8f88-6a0e5ef00d11',
      username: 'player_one'
    } satisfies AuthSessionUserDto
    const payload = JSON.stringify(getRouter(user).options.context)

    expect(payload).not.toContain('accessToken')
    expect(payload).not.toContain('access_token')
    expect(payload).not.toContain('refresh_token')
    expect(payload).not.toContain('Authorization')
    expect(payload).not.toContain('Bearer')
    expect(payload).not.toContain('token')
  })
})
