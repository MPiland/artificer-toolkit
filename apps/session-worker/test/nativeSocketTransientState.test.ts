import { runInDurableObject } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { expect, it } from 'vitest'
import { NativeSocketTransientState } from '../src/nativeSocketTransientState.js'

it('retains 1000 token streams with full paths across a reconstructed SQLite reader', async () => {
  const stub = env.LIVE_SESSION_ROOMS.get(
    env.LIVE_SESSION_ROOMS.idFromName(`transient-capacity:${crypto.randomUUID()}`)
  )
  await runInDurableObject(stub, (_instance, state) => {
    const transients = new NativeSocketTransientState(state.storage)
    for (let token = 0; token < 1000; token += 1) {
      const path = Array.from({ length: 256 }, (_, point) => ({ x: token, y: point }))
      transients.retain(
        'socket-1',
        `TOKEN_DRAG_PREVIEW:token-${token}`,
        token + 1,
        'scene-1',
        7,
        path
      )
    }

    const reconstructed = new NativeSocketTransientState(state.storage)
    for (let token = 0; token < 1000; token += 1) {
      expect(reconstructed.read('socket-1', `TOKEN_DRAG_PREVIEW:token-${token}`)).toEqual({
        sequence: token + 1,
        sceneId: 'scene-1',
        baselineVersion: 7,
        path: Array.from({ length: 256 }, (_, point) => ({ x: token, y: point }))
      })
    }
  })
})

it('keeps stream sequences monotonic and cleans only closed socket rows', async () => {
  const stub = env.LIVE_SESSION_ROOMS.get(
    env.LIVE_SESSION_ROOMS.idFromName(`transient-cleanup:${crypto.randomUUID()}`)
  )
  await runInDurableObject(stub, (_instance, state) => {
    const transients = new NativeSocketTransientState(state.storage)
    const tokenStream = 'TOKEN_DRAG_PREVIEW:token-1'

    transients.retain('socket-1', tokenStream, 9, 'scene-1', 8, [{ x: 5, y: 6 }])
    transients.retain('socket-1', tokenStream, 4, 'scene-1', 7, [{ x: 1, y: 2 }])
    expect(transients.read('socket-1', tokenStream)).toEqual({
      sequence: 9,
      sceneId: 'scene-1',
      baselineVersion: 8,
      path: [{ x: 5, y: 6 }]
    })

    transients.retain('socket-1', 'POINTER_PREVIEW', 3, 'scene-1', 8)
    transients.retain('socket-2', 'POINTER_PREVIEW', 11, 'scene-2', 1)
    transients.retain('orphan', 'POINTER_PREVIEW', 12, 'scene-3', 1)
    transients.forget('socket-1')
    expect(transients.read('socket-1', tokenStream)).toBeNull()
    expect(transients.read('socket-1', 'POINTER_PREVIEW')).toBeNull()
    expect(transients.read('socket-2', 'POINTER_PREVIEW')?.sequence).toBe(11)

    transients.forgetClosedSockets(new Set(['socket-2']))
    expect(transients.read('socket-2', 'POINTER_PREVIEW')?.sequence).toBe(11)
    expect(transients.read('orphan', 'POINTER_PREVIEW')).toBeNull()
  })
})
