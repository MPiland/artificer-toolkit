import { applyCreatureAttackRolls } from '@artificer-toolkit/source-data/srd/creatures/attack-rolls.js'
import { bandit } from '@artificer-toolkit/source-data/srd/creatures/bandit.js'
import { erinyes } from '@artificer-toolkit/source-data/srd/creatures/erinyes.js'
import { gladiator } from '@artificer-toolkit/source-data/srd/creatures/gladiator.js'
import { knight } from '@artificer-toolkit/source-data/srd/creatures/knight.js'
import { SIZE_CODE } from '@artificer-toolkit/source-data/srd/sizes.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { SceneGrid } from '@artificer-toolkit/shared/vtt'
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
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'

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

/** SPELLS-31.T4c3: only a held ATTACK_ROLL_BY_OTHER reaction that subtracts from the roll is offered when another creature rolls an attack. */
describe('attack-roll reaction discovery', () => {
  const rolled = { kind: 'ATTACK_ROLLED_BY_OTHER' } as const
  const subtract = (actionId: string) =>
    candidate(
      actionId,
      'REACTION',
      { kind: 'ATTACK_ROLL_BY_OTHER' },
      'SUBTRACT_FROM_TRIGGERING_ROLL'
    )

  it('offers a held subtract reaction when another creature rolls an attack', () => {
    nextSequence = 0
    expect(
      heldReactionsTo([subtract('class:cutting-words')], rolled).map(
        ({ reaction, trigger }) => [reaction.actionId, trigger] as const
      )
    ).toEqual([['class:cutting-words', 'ATTACK_ROLL_BY_OTHER']])
  })

  it('skips an attack-roll reaction that does not subtract from the roll', () => {
    expect(
      heldReactionsTo(
        [candidate('class:observer', 'REACTION', { kind: 'ATTACK_ROLL_BY_OTHER' }, 'OTHER_EFFECT')],
        rolled
      )
    ).toEqual([])
  })

  it('offers it to no other event, and offers no other reaction to an attack roll', () => {
    nextSequence = 0
    expect(
      heldReactionsTo([subtract('class:cutting-words')], { kind: 'SPELL_CAST_BY_OTHER' })
    ).toEqual([])
    expect(
      heldReactionsTo(
        [
          candidate('spell:counterspell', 'REACTION', { kind: 'SPELL_CAST' }),
          candidate('spell:shield', 'REACTION', { kind: 'ATTACKED_SELF' }, 'GRANT_MODIFIER')
        ],
        rolled
      )
    ).toEqual([])
  })
})

/**
 * SPELLS-31.T4k1b (D217): an ATTACK_ON_OTHER reaction that imposes a roll mode is offered before
 * another creature's attack d20 only when each of its authored predicates holds.
 */
describe('attack-on-other reaction discovery', () => {
  /** 100px cells of 5 feet; a one-cell token stands at (column, 0). */
  const grid: SceneGrid = {
    kind: 'SQUARE',
    cellSize: 100,
    diagonalPolicy: 'EQUAL',
    distancePerCell: 5,
    origin: { x: 0, y: 0 },
    unit: 'FEET'
  }
  const token = (column: number) => ({
    position: { x: column * 100 + 50, y: 50 },
    width: 100,
    height: 100,
    rotationDegrees: 0
  })
  const trigger = {
    kind: 'ATTACK_ON_OTHER',
    requiresSight: true,
    targetWithinFeet: 5,
    holderEquippedCategory: 'SHIELD',
    attackerSize: { maximumSizeCode: SIZE_CODE.LARGE }
  }
  const impose = (effectKind = 'IMPOSE_ROLL_MODE_ON_TRIGGERING_ROLL') =>
    candidate('class:protection', 'REACTION', trigger, effectKind)
  /** The reactor stands in column 0; the attack's target stands `targetColumn` squares away. */
  const aimed = (
    overrides: Partial<Extract<EncounterEvent, { kind: 'ATTACK_AIMED_AT_OTHER' }>> & {
      targetColumn?: number
    } = {}
  ) => {
    const { targetColumn = 1, ...event } = overrides
    return {
      kind: 'ATTACK_AIMED_AT_OTHER',
      gameSystemId: DND5E_SYSTEM_ID,
      attackerSeen: true,
      attackerSizeCode: SIZE_CODE.MEDIUM,
      targetScene: { grid, sourceToken: token(0), targetToken: token(targetColumn) },
      holderEquippedCategories: ['SHIELD'],
      ...event
    } as const
  }
  const offered = (event: ReturnType<typeof aimed>, effectKind?: string) => {
    nextSequence = 0
    return heldReactionsTo([impose(effectKind)], event).map(
      ({ reaction, trigger: met }) => [reaction.actionId, met] as const
    )
  }

  it('offers it when a seen attacker in its size range aims at a creature within reach of a shield holder', () => {
    expect(offered(aimed())).toEqual([['class:protection', 'ATTACK_ON_OTHER']])
  })

  it('measures the attack’s target from the reactor’s token against the authored feet', () => {
    expect(offered(aimed({ targetColumn: 2 }))).toEqual([])
    expect(offered(aimed({ targetScene: null }))).toEqual([])
  })

  it('needs sight of the attacker only when the trigger asks for it', () => {
    expect(offered(aimed({ attackerSeen: false }))).toEqual([])
  })

  it('needs the authored equipment category among the holder’s equipped items', () => {
    expect(offered(aimed({ holderEquippedCategories: [] }))).toEqual([])
    expect(offered(aimed({ holderEquippedCategories: ['WEAPON'] }))).toEqual([])
  })

  it('needs the attacker’s size inside the authored range', () => {
    expect(offered(aimed({ attackerSizeCode: SIZE_CODE.LARGE }))).toEqual([
      ['class:protection', 'ATTACK_ON_OTHER']
    ])
    expect(offered(aimed({ attackerSizeCode: SIZE_CODE.HUGE }))).toEqual([])
    expect(offered(aimed({ attackerSizeCode: null }))).toEqual([])
  })

  it('skips an attack-on-other reaction that does not impose a roll mode, and any other event', () => {
    expect(offered(aimed(), 'OTHER_EFFECT')).toEqual([])
    nextSequence = 0
    expect(heldReactionsTo([impose()], { kind: 'ATTACK_ROLLED_BY_OTHER' })).toEqual([])
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
