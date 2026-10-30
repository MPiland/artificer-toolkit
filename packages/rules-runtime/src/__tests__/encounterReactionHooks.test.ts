import { applyCreatureAttackRolls } from '@artificer-toolkit/source-data/srd/creatures/attack-rolls.js'
import { bandit } from '@artificer-toolkit/source-data/srd/creatures/bandit.js'
import { erinyes } from '@artificer-toolkit/source-data/srd/creatures/erinyes.js'
import { gladiator } from '@artificer-toolkit/source-data/srd/creatures/gladiator.js'
import { knight } from '@artificer-toolkit/source-data/srd/creatures/knight.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import type { EncounterEvent } from '../events/encounterEventTable.js'
import { discoverEncounterEventHooks } from '../events/encounterEventHooks.js'
import {
  attackHitDamageTypeIds,
  characterReactionCandidates,
  encounterReactorCandidates
} from '../encounterReactors.js'
import { summonBody } from '../encounterActorBody.js'
import { srdCreatureActor } from '../testing/dnd5eSrdEncounter.js'

/**
 * SPELLS-33.T4k1: a Creature's authored `ATTACKED_SELF` reaction (Parry) is discovered from its own
 * feature actions, as its turn reads them, and answers only a hit its qualifiers admit: a melee attack
 * by an attacker the reactor sees.
 */

const reactorCandidates = (creature: Parameters<typeof srdCreatureActor>[0]['creature']) =>
  encounterReactorCandidates({
    spells: new Map(),
    actor: srdCreatureActor({ id: crypto.randomUUID(), creature }),
    target: {},
    system: srdSystemRecord
  })

const meleeSeenHit = {
  kind: 'HIT_BY_ATTACK',
  damageTypeIds: new Set<string>(),
  melee: true,
  weapon: true,
  attackerSeen: true
} as const

const reactionsTo = <Event extends EncounterEvent>(
  reactions: ReturnType<typeof reactorCandidates>,
  event: Event
) => discoverEncounterEventHooks({ reactions, events: [event] }).reactions

describe('creature attack reaction discovery', () => {
  it.each([knight, gladiator, erinyes])(
    "offers $name's Parry against a melee hit by an attacker it sees",
    (creature) => {
      const found = reactionsTo(reactorCandidates(creature), meleeSeenHit)
      expect(found).toEqual([
        expect.objectContaining({ trigger: 'ATTACKED_SELF', triggerDamageTypeIds: [] })
      ])
    }
  )

  it('offers nothing against a ranged hit', () => {
    expect(reactionsTo(reactorCandidates(knight), { ...meleeSeenHit, melee: false })).toEqual([])
  })

  it('offers nothing against an attacker the reactor does not see', () => {
    expect(
      reactionsTo(reactorCandidates(knight), {
        ...meleeSeenHit,
        attackerSeen: false
      })
    ).toEqual([])
  })

  it('offers nothing to a creature holding no attack reaction', () => {
    expect(reactionsTo(reactorCandidates(bandit), meleeSeenHit)).toEqual([])
  })

  it('keeps no attack among the reactions of a summon that cannot attack, only what is no attack', () => {
    const armed = applyCreatureAttackRolls(knight)
    const actor = srdCreatureActor({ id: crypto.randomUUID(), creature: armed })
    const free = reactorCandidates(armed)
    const flagged = encounterReactorCandidates({
      spells: new Map(),
      actor: {
        ...actor,
        snapshot: {
          ...(actor.snapshot as Record<string, unknown>),
          body: summonBody({ occupiesSpace: true }, true)
        }
      },
      target: {},
      system: srdSystemRecord
    })
    expect(flagged.length).toBeGreaterThan(0)
    expect(flagged.length).toBeLessThan(free.length)
    expect(reactionsTo(flagged, meleeSeenHit)).toEqual([
      expect.objectContaining({ trigger: 'ATTACKED_SELF' })
    ])
  })

  it('offers an attack reaction to no other event', () => {
    for (const event of [
      { kind: 'SPELL_CAST_BY_OTHER' },
      { kind: 'TARGETED_BY_CAST', castOwnerId: 'spell:magic-missile' },
      { kind: 'HIT' }
    ] as const)
      expect(reactionsTo(reactorCandidates(knight), event)).toEqual([])
  })
})

/**
 * REACTION-4.2: a reaction to a damage type is offered only when the hit deals that type, and an
 * ON_CRIT type is dealt only by a critical hit.
 */

const FIRE = 'fire-type'
const RADIANT = 'radiant-type'

const facts = {
  outcomes: [
    { kind: 'DAMAGE', pathCode: 'ON_HIT', damageTypeId: FIRE },
    { kind: 'DAMAGE', pathCode: 'ON_CRIT', damageTypeId: RADIANT },
    { kind: 'DAMAGE', pathCode: 'ON_MISS', damageTypeId: 'miss-type' },
    { kind: 'CONDITION', pathCode: 'ON_HIT', conditionId: 'condition' }
  ]
} as unknown as Parameters<typeof attackHitDamageTypeIds>[0]

describe('damage types an attack deals when it hits', () => {
  it('leaves out an ON_CRIT type on a normal hit', () => {
    expect([...attackHitDamageTypeIds(facts, false)]).toEqual([FIRE])
  })

  it('adds the ON_CRIT types on a critical hit', () => {
    expect([...attackHitDamageTypeIds(facts, true)]).toEqual([FIRE, RADIANT])
  })
})

const range = { rangeKind: 'DISTANCE', amount: 60, longAmount: null, unit: 'FEET' }

let nextSequence = 0
const candidate = (
  actionId: string,
  activation: string | null,
  reactionTrigger: { kind: string } | null,
  effectKind = 'CANCEL_TRIGGERING_EVENT'
) => ({
  actionId,
  sequence: nextSequence++,
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
  }) as unknown as Parameters<typeof characterReactionCandidates>[0]

const heldReactionsTo = <Event extends EncounterEvent>(
  candidates: ReturnType<typeof candidate>[],
  event: Event
) =>
  discoverEncounterEventHooks({
    reactions: characterReactionCandidates(reactor(candidates)),
    events: [event]
  }).reactions

describe('damage-type reaction discovery (REACTION-4.2)', () => {
  const absorb = () =>
    candidate(
      'spell:absorb-elements',
      'REACTION',
      { kind: 'DAMAGE_TAKEN', damageTypeIds: [FIRE, 'cold-type'] } as { kind: string },
      'GRANT_MODIFIER'
    )
  const hit = (damageTypeIds: string[]) =>
    ({
      kind: 'HIT_BY_ATTACK',
      damageTypeIds: new Set(damageTypeIds),
      melee: false,
      weapon: true,
      attackerSeen: false
    }) as const

  it('offers a reaction to a type the hit deals, naming only the types that triggered it', () => {
    expect(heldReactionsTo([absorb()], hit([FIRE, RADIANT]))).toEqual([
      expect.objectContaining({ trigger: 'DAMAGE_TAKEN', triggerDamageTypeIds: [FIRE] })
    ])
  })

  it('offers nothing against a hit that deals none of its types', () => {
    expect(heldReactionsTo([absorb()], hit([RADIANT]))).toEqual([])
  })
})

/**
 * SPELLS-31.T5b: a held `ATTACKED_SELF` reaction limited to ranged weapon attacks (Deflect
 * Missiles) answers a ranged weapon hit, never a melee hit or a spell attack.
 */
describe('ranged weapon attack reaction discovery (SPELLS-31.T5b)', () => {
  const deflect = () =>
    candidate(
      'feature:deflect',
      'REACTION',
      { kind: 'ATTACKED_SELF', attackRange: 'RANGED', weaponOnly: true } as { kind: string },
      'GRANT_MODIFIER'
    )
  const rangedWeaponHit = { ...meleeSeenHit, melee: false, attackerSeen: false } as const

  it('offers the reaction against a ranged weapon hit, seen or not', () => {
    expect(heldReactionsTo([deflect()], rangedWeaponHit)).toEqual([
      expect.objectContaining({ trigger: 'ATTACKED_SELF' })
    ])
  })

  it('offers nothing against a melee hit', () => {
    expect(heldReactionsTo([deflect()], { ...rangedWeaponHit, melee: true })).toEqual([])
  })

  it('offers nothing against a ranged spell attack', () => {
    expect(heldReactionsTo([deflect()], { ...rangedWeaponHit, weapon: false })).toEqual([])
  })
})
/** REACTION-4.3: only a held SPELL_CAST reaction that cancels the cast is offered when a creature casts a spell. */
describe('cast reaction discovery', () => {
  const cast = { kind: 'SPELL_CAST_BY_OTHER' } as const

  it('offers only reaction actions bound to SPELL_CAST, in the order the Character lists them', () => {
    nextSequence = 0
    const found = heldReactionsTo(
      [
        candidate('spell:counterspell:b', 'REACTION', { kind: 'SPELL_CAST' }),
        candidate('spell:shield', 'REACTION', { kind: 'ATTACKED_SELF' }),
        candidate('spell:fireball', 'ACTION', null),
        candidate('spell:counterspell:a', 'REACTION', { kind: 'SPELL_CAST' })
      ],
      cast
    )
    expect(found.map(({ reaction }) => reaction.actionId)).toEqual([
      'spell:counterspell:b',
      'spell:counterspell:a'
    ])
    expect(found[0]?.reaction.mechanicFacts.invocation.range).toEqual(range)
  })

  it('offers nothing to a reactor with no spell reactions', () => {
    expect(heldReactionsTo([], cast)).toEqual([])
  })

  it('skips a SPELL_CAST reaction that does not cancel the cast', () => {
    expect(
      heldReactionsTo(
        [candidate('spell:observer', 'REACTION', { kind: 'SPELL_CAST' }, 'OTHER_EFFECT')],
        cast
      )
    ).toEqual([])
  })
})

describe('targeted-self reaction discovery (REACTION-4.1)', () => {
  const targeted = (actionId: string, sourceEffectIds?: string[]) =>
    candidate(
      actionId,
      'REACTION',
      {
        kind: 'TARGETED_SELF',
        ...(sourceEffectIds === undefined ? {} : { sourceEffectIds })
      } as { kind: string },
      'GRANT_MODIFIER'
    )
  const castOf = (castOwnerId: string) => ({ kind: 'TARGETED_BY_CAST', castOwnerId }) as const

  it('offers an unfiltered reaction for any cast: absent or empty sourceEffectIds', () => {
    nextSequence = 0
    const found = heldReactionsTo(
      [targeted('spell:absent'), targeted('spell:empty', [])],
      castOf('spell:fireball')
    )
    expect(found.map(({ reaction }) => reaction.actionId)).toEqual(['spell:absent', 'spell:empty'])
  })

  it('offers a filtered reaction only for a cast of a listed spell', () => {
    nextSequence = 0
    const held = [targeted('spell:shield', ['spell:magic-missile'])]
    expect(
      heldReactionsTo(held, castOf('spell:magic-missile')).map(({ reaction }) => reaction.actionId)
    ).toEqual(['spell:shield'])
    expect(heldReactionsTo(held, castOf('spell:fireball'))).toEqual([])
  })

  it('ignores counters, attack reactions and actions that are not reactions', () => {
    nextSequence = 0
    expect(
      heldReactionsTo(
        [
          candidate('spell:counterspell', 'REACTION', { kind: 'SPELL_CAST' }),
          candidate('spell:shield', 'REACTION', { kind: 'ATTACKED_SELF' }, 'GRANT_MODIFIER'),
          candidate('spell:ward', 'ACTION', { kind: 'TARGETED_SELF' }, 'GRANT_MODIFIER')
        ],
        castOf('spell:magic-missile')
      )
    ).toEqual([])
  })
})

describe('one discovery for effects and reactions', () => {
  it('lists a reaction once however many events it meets, with the first hook met', () => {
    nextSequence = 0
    const found = discoverEncounterEventHooks({
      reactions: characterReactionCandidates(
        reactor([candidate('spell:counterspell', 'REACTION', { kind: 'SPELL_CAST' })])
      ),
      events: [{ kind: 'MOVED' }, { kind: 'SPELL_CAST_BY_OTHER' }, { kind: 'SPELL_CAST_BY_OTHER' }]
    })
    expect(found.reactions).toEqual([
      expect.objectContaining({ event: 'SPELL_CAST_BY_OTHER', trigger: 'SPELL_CAST' })
    ])
    expect(found.ended).toEqual([])
  })
})
