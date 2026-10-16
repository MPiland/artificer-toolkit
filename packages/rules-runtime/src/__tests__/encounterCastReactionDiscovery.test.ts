import { describe, expect, it } from 'vitest'

import {
  discoverCastReactionActions,
  preparedSpellCastLevel
} from '../encounterCastReactionDiscovery.js'

/** REACTION-4.3: only a held SPELL_CAST reaction that cancels the cast is offered when a creature casts a spell. */

const range = { rangeKind: 'DISTANCE', amount: 60, longAmount: null, unit: 'FEET' }

const candidate = (
  actionId: string,
  activation: string | null,
  reactionTrigger: { kind: string } | null,
  effectKind = 'CANCEL_TRIGGERING_EVENT'
) => ({
  actionId,
  effectId: `${actionId}-effect`,
  mechanicFacts: {
    invocation: {
      activation: activation ? { code: activation, amount: 1 } : null,
      reactionTrigger,
      range
    },
    outcomes: [{ kind: 'EFFECT', pathCode: 'effect', effectKind, label: null }]
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

describe('cast reaction discovery by outcome', () => {
  it('skips a SPELL_CAST reaction that does not cancel the cast', () => {
    expect(
      discoverCastReactionActions(
        reactor([candidate('spell:observer', 'REACTION', { kind: 'SPELL_CAST' }, 'OTHER_EFFECT')])
      )
    ).toEqual([])
  })
})

describe('prepared spell cast level', () => {
  const prepared = (
    source: { kind: string; candidate?: { mechanicsOwner: { kind: string } } },
    spellCastLevel?: number
  ) =>
    ({
      source,
      characterActionState:
        spellCastLevel === undefined ? null : { actionMechanic: { spellCastLevel } }
    }) as unknown as Parameters<typeof preparedSpellCastLevel>[0]

  it('is the cast level of a Character spell, 0 for a cantrip', () => {
    const spell = { kind: 'CHARACTER_ACTION', candidate: { mechanicsOwner: { kind: 'SPELL' } } }
    expect(preparedSpellCastLevel(prepared(spell, 3))).toBe(3)
    expect(preparedSpellCastLevel(prepared(spell, 0))).toBe(0)
  })

  it('is null for anything that is not a Character spell cast or has no known level', () => {
    const weapon = { kind: 'CHARACTER_ACTION', candidate: { mechanicsOwner: { kind: 'ITEM' } } }
    expect(preparedSpellCastLevel(prepared(weapon, 1))).toBeNull()
    expect(preparedSpellCastLevel(prepared({ kind: 'CREATURE_CAPABILITY' }, 1))).toBeNull()
    expect(
      preparedSpellCastLevel(
        prepared({ kind: 'CHARACTER_ACTION', candidate: { mechanicsOwner: { kind: 'SPELL' } } })
      )
    ).toBeNull()
  })
})
