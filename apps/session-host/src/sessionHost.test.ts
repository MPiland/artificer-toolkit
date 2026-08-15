import { describe, expect, it, vi } from 'vitest'
import { Encoder } from '@colyseus/schema'

import { createSessionHostServer, getSessionHostHealth } from './app.js'
import { DEFAULT_SESSION_HOST_PORT, resolveSessionHostPort } from './config.js'
import type { LiveSessionRoomDependencies } from './dependencies.js'
import {
  createLiveSessionRoomClass,
  LiveSessionAggregateVersionState,
  LiveSessionState
} from './liveSessionRoom.js'

function dependencies(
  overrides: Partial<LiveSessionRoomDependencies> = {}
): LiveSessionRoomDependencies {
  return {
    authenticate: async () => '00000000-0000-4000-8000-000000000001',
    authorize: async () => undefined,
    loadSnapshot: async () => ({
      aggregateVersions: [],
      characterRuleSnapshots: [],
      encounterRuleSnapshots: []
    }),
    claimAuthority: async () => undefined,
    renewAuthority: async () => undefined,
    releaseAuthority: async () => undefined,
    execute: async () => {
      throw new Error('Not used by this bootstrap test.')
    },
    ...overrides
  }
}

describe('session host bootstrap', () => {
  it('uses one portable local and remote port contract', () => {
    expect(resolveSessionHostPort(undefined)).toBe(DEFAULT_SESSION_HOST_PORT)
    expect(resolveSessionHostPort('4321')).toBe(4321)
    expect(() => resolveSessionHostPort('0')).toThrow('PORT must be an integer')
    expect(() => resolveSessionHostPort('not-a-port')).toThrow('PORT must be an integer')
  })

  it('creates the Colyseus server and exposes a stable health payload', () => {
    expect(createSessionHostServer(dependencies())).toBeDefined()
    expect(getSessionHostHealth()).toEqual({
      service: 'artificer-session-host',
      status: 'ok'
    })
  })

  it('serializes aggregate versions through the Colyseus Schema wire format', () => {
    const state = new LiveSessionState()
    state.roomVersion = 1
    state.aggregateVersions.set(
      'CHARACTER:00000000-0000-4000-8000-000000000001',
      new LiveSessionAggregateVersionState().assign({
        aggregateKind: 'CHARACTER',
        aggregateId: '00000000-0000-4000-8000-000000000001',
        version: 3
      })
    )

    expect(new Encoder(state).encodeAll().byteLength).toBeGreaterThan(0)
  })

  it('authenticates and authorizes exact Campaign session admission before joining', async () => {
    const authenticate = vi.fn(async () => '00000000-0000-4000-8000-000000000001')
    const authorize = vi.fn(async () => undefined)
    const RoomClass = createLiveSessionRoomClass(dependencies({ authenticate, authorize }))
    const options = {
      campaignId: '00000000-0000-4000-8000-000000000002',
      sessionId: '00000000-0000-4000-8000-000000000003'
    }

    await expect(RoomClass.onAuth('access-token', options)).resolves.toEqual({
      userId: '00000000-0000-4000-8000-000000000001',
      options
    })
    expect(authenticate).toHaveBeenCalledWith('access-token')
    expect(authorize).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001', options)
  })
})
