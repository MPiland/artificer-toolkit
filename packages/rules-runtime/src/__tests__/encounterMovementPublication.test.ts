import { describe, expect, it } from 'vitest'

import {
  preparedMovementSceneDelta,
  preparedMovementSegment
} from '../encounterMovementPublication.js'

const tokenId = '00000000-0000-4000-8000-000000000001'
const path = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 50 }
]

describe('prepared movement publication', () => {
  it('walks the whole remaining path when no rules interrupt it', () => {
    expect(preparedMovementSegment({ path, startDistance: 0, outcome: null })).toEqual({
      path,
      position: { x: 100, y: 50 }
    })
    expect(
      preparedMovementSegment({
        path,
        startDistance: 50,
        outcome: { kind: 'UNINTERRUPTED', reason: 'NO_CANDIDATES' }
      })
    ).toEqual({
      path: [
        { x: 50, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 }
      ],
      position: { x: 100, y: 50 }
    })
  })

  it('publishes an unbound or uninterrupted move to the end of its path', () => {
    for (const outcome of [null, { kind: 'UNINTERRUPTED' as const, reason: 'MANUAL' as const }])
      expect(preparedMovementSceneDelta({ tokenId, path, outcome, sceneVersion: 4 })).toEqual({
        kind: 'TOKEN_MOVED',
        tokenId,
        position: { x: 100, y: 50 }
      })
  })
})
