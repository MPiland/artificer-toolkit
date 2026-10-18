import { describe, expect, it } from 'vitest'

import {
  sceneFogOwnerKey,
  sceneTransientStreamKey,
  type SceneTransientEnvelope
} from '../domains/vtt/scene.js'

const PLAYER_ID = '00000000-0000-4000-8000-0000000000a1'
const base = { audience: 'TABLE', baselineVersion: 1, sceneId: 'scene-1', sequence: 1 } as const

function fogPreview(ownerUserId: string | null, x: number): SceneTransientEnvelope {
  return {
    ...base,
    kind: 'FOG_AREA_PREVIEW',
    explored: true,
    ownerUserId,
    rectangle: { a: { x, y: 0 }, b: { x: x + 1, y: 1 } }
  }
}

function tokenDrag(tokenId: string, x: number): SceneTransientEnvelope {
  return { ...base, kind: 'TOKEN_DRAG_PREVIEW', position: { x, y: 0 }, tokenId }
}

describe('live-session envelope stream key', () => {
  it('keys a fog preview by its explicit owner: a player or the shared party', () => {
    expect(sceneTransientStreamKey(fogPreview(PLAYER_ID, 0))).toBe(
      sceneTransientStreamKey(fogPreview(PLAYER_ID, 5))
    )
    expect(sceneTransientStreamKey(fogPreview(null, 0))).toBe(
      sceneTransientStreamKey(fogPreview(null, 5))
    )
    expect(sceneTransientStreamKey(fogPreview(PLAYER_ID, 0))).not.toBe(
      sceneTransientStreamKey(fogPreview(null, 0))
    )
    expect(sceneTransientStreamKey(fogPreview(null, 0))).toBe(
      `FOG_AREA_PREVIEW:${sceneFogOwnerKey(null)}`
    )
  })

  it('keys a token drag per token and other previews per kind', () => {
    expect(sceneTransientStreamKey(tokenDrag('token-a', 0))).toBe(
      sceneTransientStreamKey(tokenDrag('token-a', 3))
    )
    expect(sceneTransientStreamKey(tokenDrag('token-a', 0))).not.toBe(
      sceneTransientStreamKey(tokenDrag('token-b', 0))
    )
    expect(
      sceneTransientStreamKey({ ...base, kind: 'MEASUREMENT_PREVIEW', path: [{ x: 0, y: 0 }] })
    ).toBe('MEASUREMENT_PREVIEW')
  })

  it('names the shared party fog layer apart from every player layer', () => {
    expect(sceneFogOwnerKey(PLAYER_ID)).toBe(PLAYER_ID)
    expect(sceneFogOwnerKey(null)).not.toBe(sceneFogOwnerKey(PLAYER_ID))
  })
})
