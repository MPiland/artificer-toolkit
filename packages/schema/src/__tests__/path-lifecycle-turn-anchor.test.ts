import { describe, expect, it } from 'vitest'

import { pathLifecycleDtoSchema } from '../effects/path.js'

describe('the authored lifecycle turn anchor (SPELLS-5 D99)', () => {
  it.each([
    ['TARGET', 'START_OF_TURN'],
    ['TARGET', 'END_OF_TURN'],
    ['SOURCE', 'START_OF_TURN'],
    ['SOURCE', 'END_OF_TURN']
  ] as const)('accepts %s at %s', (actor, boundary) => {
    const lifecycle = {
      turnAnchor: { actor, boundary },
      endTriggers: [{ event: 'LIFECYCLE', timing: 'CONSUME', code: 'ON_ATTACK_ROLL' }]
    }
    expect(pathLifecycleDtoSchema.parse(lifecycle)).toEqual(lifecycle)
  })

  it('stays optional', () => {
    expect(pathLifecycleDtoSchema.parse({})).toEqual({})
  })

  it.each([
    ['an unknown key', { actor: 'TARGET', boundary: 'END_OF_TURN', extra: true }],
    ['an unknown actor', { actor: 'HOLDER', boundary: 'END_OF_TURN' }],
    ['an unknown boundary', { actor: 'TARGET', boundary: 'NONE' }],
    ['a missing boundary', { actor: 'TARGET' }],
    ['a missing actor', { boundary: 'END_OF_TURN' }]
  ])('rejects %s', (_label, turnAnchor) => {
    expect(pathLifecycleDtoSchema.safeParse({ turnAnchor }).success).toBe(false)
  })
})
