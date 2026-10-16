import { describe, expect, it } from 'vitest'

import { discoverCastReactionActions } from '../encounterCastReactionDiscovery.js'

/** REACTION-4.3: only a held SPELL_CAST reaction is offered when a creature casts a spell. */

const range = { rangeKind: 'DISTANCE', amount: 60, longAmount: null, unit: 'FEET' }

const candidate = (
  actionId: string,
  activation: string | null,
  reactionTrigger: { kind: string } | null
) => ({
  actionId,
  effectId: `${actionId}-effect`,
  mechanicFacts: {
    invocation: {
      activation: activation ? { code: activation, amount: 1 } : null,
      reactionTrigger,
      range
    }
  }
})

const reactor = (candidates: ReturnType<typeof candidate>[]) =>
  ({
    characterReactionSource: null,
    characterSpellCast: { candidates }
  }) as unknown as Parameters<typeof discoverCastReactionActions>[0]

describe('cast reaction discovery', () => {
  it('offers only reaction actions bound to SPELL_CAST, in action id order', () => {
    const found = discoverCastReactionActions(
      reactor([
        candidate('spell:counterspell:b', 'REACTION', { kind: 'SPELL_CAST' }),
        candidate('spell:shield', 'REACTION', { kind: 'ATTACKED_SELF' }),
        candidate('spell:fireball', 'ACTION', null),
        candidate('spell:counterspell:a', 'REACTION', { kind: 'SPELL_CAST' })
      ])
    )
    expect(found.map((action) => action.actionId)).toEqual([
      'spell:counterspell:a',
      'spell:counterspell:b'
    ])
    expect(found[0]?.range).toEqual(range)
  })

  it('offers nothing to a reactor with no spell reactions', () => {
    expect(discoverCastReactionActions(reactor([]))).toEqual([])
  })
})
