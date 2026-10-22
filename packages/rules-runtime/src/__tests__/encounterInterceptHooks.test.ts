import { describe, expect, it } from 'vitest'

import type { EncounterEvent } from '../events/encounterEventTable.js'
import { discoverEncounterEventHooks } from '../events/encounterEventHooks.js'

/**
 * RULES-2.T5c: a held intercept acts on an event before it resolves, through the one discovery entry
 * point. A damage interception meets damage about to drop its holder from above 0 hit points to 0 (and
 * an outright kill when it negates one); an incoming gate meets a harmful action aimed at its holder.
 */

const ward = { effectId: 'ward', dropToHitPoints: 1, negatesKill: true }
const plainWard = { effectId: 'plain-ward', dropToHitPoints: 3, negatesKill: false }

const before = (
  hitPoints: { before: number; after: number },
  blow: { damageTaken?: number; damageTypeId?: string; critical?: boolean } = {}
) =>
  ({
    kind: 'DAMAGED',
    phase: 'BEFORE',
    hitPoints,
    damageTaken: blow.damageTaken ?? hitPoints.before - hitPoints.after,
    damageTypeId: blow.damageTypeId ?? null,
    critical: blow.critical ?? false
  }) as const

const interceptionsMet = (events: readonly EncounterEvent[]) =>
  discoverEncounterEventHooks({ damageInterceptions: [plainWard, ward], events })
    .damageInterceptions

describe('damage interception hooks', () => {
  it('intercepts a DAMAGED event about to bring its holder to 0 hit points, in spend order', () => {
    expect(interceptionsMet([before({ before: 7, after: 0 })])).toEqual([plainWard, ward])
  })

  it('does not intercept damage that leaves its holder above 0, or meets it already at 0', () => {
    expect(interceptionsMet([before({ before: 7, after: 2 })])).toEqual([])
    expect(interceptionsMet([before({ before: 0, after: 0 })])).toEqual([])
  })

  it('does not intercept damage that has already landed', () => {
    expect(
      interceptionsMet([
        {
          kind: 'DAMAGED',
          phase: 'AFTER',
          damagerActorId: null,
          damageTypeIds: [],
          dispositions: new Map()
        }
      ])
    ).toEqual([])
  })

  it('intercepts a kill only when it negates one', () => {
    expect(interceptionsMet([{ kind: 'KILLED' }])).toEqual([ward])
  })

  describe('exclusions and the damage cap', () => {
    const picky = {
      effectId: 'picky',
      dropToHitPoints: 1,
      negatesKill: false,
      excludes: { damageTypeIds: ['radiant'], critical: true },
      maxDamageTaken: 14
    }
    const met = (blow: Parameters<typeof before>[1]) =>
      discoverEncounterEventHooks({
        damageInterceptions: [picky],
        events: [before({ before: 5, after: 0 }, blow)]
      }).damageInterceptions

    it('meets a blow of another type that is not a critical hit and is within the cap', () => {
      expect(met({ damageTypeId: 'fire', damageTaken: 14 })).toEqual([picky])
    })

    it('does not meet a blow of an excluded damage type', () => {
      expect(met({ damageTypeId: 'radiant', damageTaken: 6 })).toEqual([])
    })

    it('does not meet a critical hit', () => {
      expect(met({ damageTypeId: 'fire', critical: true })).toEqual([])
    })

    it('does not meet a blow over the cap, by the whole blow rather than the overflow past 0', () => {
      expect(met({ damageTypeId: 'fire', damageTaken: 15 })).toEqual([])
    })

    it('excludes nothing when it names no exclusion', () => {
      expect(
        discoverEncounterEventHooks({
          damageInterceptions: [ward],
          events: [before({ before: 5, after: 0 }, { damageTypeId: 'radiant', critical: true })]
        }).damageInterceptions
      ).toEqual([ward])
    })
  })
})

describe('incoming gate hooks', () => {
  const anyAttacker = { wardId: 'sanctuary', payload: {} }
  const beastsOnly = { wardId: 'beasts', payload: { attackerCreatureTypeIds: ['beast'] } }
  const gatesMet = (attackerCreatureTypeId: string | null) =>
    discoverEncounterEventHooks({
      incomingGates: [beastsOnly, anyAttacker],
      events: [{ kind: 'HARMFUL_ACTION_AIMED', attackerCreatureTypeId }]
    }).incomingGates

  it('intercepts a harmful action by an attacker of a listed type, or by any attacker when unlisted', () => {
    expect(gatesMet('beast')).toEqual([beastsOnly, anyAttacker])
    expect(gatesMet('fiend')).toEqual([anyAttacker])
    expect(gatesMet(null)).toEqual([anyAttacker])
  })

  it('intercepts no other event', () => {
    expect(
      discoverEncounterEventHooks({
        incomingGates: [anyAttacker],
        damageInterceptions: [ward],
        events: [{ kind: 'HIT' }, { kind: 'TARGETED_BY_CAST', castOwnerId: 'spell' }]
      })
    ).toMatchObject({ incomingGates: [], damageInterceptions: [] })
  })
})
