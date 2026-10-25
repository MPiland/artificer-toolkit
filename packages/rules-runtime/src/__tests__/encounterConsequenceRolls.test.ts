import { describe, expect, it } from 'vitest'
import { deathSaveShortfall } from '@artificer-toolkit/schema/shared/characterDeathSaves'

import type { DamageBatch } from '../encounterConcentrationDamage.js'
import {
  consequenceRollDamageFacts,
  consequenceRollRow,
  encounterConsequenceRollTables,
  offerConsequenceRolls,
  withdrawConsequenceRollOffers,
  withDeathSaveFacts,
  withoutConsequenceRollOffer
} from '../encounterConsequenceRolls.js'
import {
  characterActor,
  creatureActor,
  srdEncounterState,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'

const HERO = testUuid(0x15a1)
const OGRE = testUuid(0x15a2)
const ATTACK = testUuid(0x15c1)
const LATER = testUuid(0x15c2)
const AT = '2026-10-25T12:00:00.000Z'

const hero = characterActor({ id: HERO, characterId: testUuid(0x15b1) })
const ogre = creatureActor({ id: OGRE, snapshot: {} })
const actors = [hero, ogre]
const injuries = srdEncounterState({
  actors,
  currentActorId: null,
  optionalCombatKinds: ['INJURIES']
})
const off = srdEncounterState({ actors, currentActorId: null })

function hit(
  targetActorId: string,
  damage: { critical?: boolean; before?: number; after?: number; applied?: number } = {}
): DamageBatch {
  const before = damage.before ?? 20
  const applied = damage.applied ?? 5
  return {
    targetActorId,
    applications: [
      {
        ordinal: 0,
        sourceNodeId: 'node',
        sourceOperationKey: 'operation',
        authoredPath: null,
        resolvedPath: null,
        kind: 'DAMAGE',
        requestedAmount: Math.max(1, applied),
        resolvedAmount: applied,
        appliedAmount: applied,
        beforeCurrentHitPoints: before,
        afterCurrentHitPoints: damage.after ?? Math.max(0, before - applied),
        beforeTemporaryHitPoints: 0,
        afterTemporaryHitPoints: 0,
        maximumHitPoints: 30,
        damageTypeId: testUuid(0x15d1),
        damageDisposition: 'NORMAL',
        incomingHalved: false,
        critical: damage.critical ?? false
      }
    ]
  }
}

function offer(
  facts: ReturnType<typeof consequenceRollDamageFacts>,
  input: { state?: typeof injuries; actors?: typeof actors; sourceCommandId?: string } = {}
) {
  return offerConsequenceRolls({
    state: input.state ?? injuries,
    actors: input.actors ?? actors,
    facts,
    sourceCommandId: input.sourceCommandId ?? ATTACK,
    occurredAt: AT
  })
}

const offeredEvents = (changes: ReturnType<typeof offer>) =>
  changes.map(({ after }) =>
    after.consequenceRollOffers?.map(({ triggers }) => triggers.map(({ event }) => event))
  )

describe('Consequence roll offers (ATTACK-15.1)', () => {
  const [table] = encounterConsequenceRollTables(injuries)

  it('read the authored Injuries table only while the rule is on', () => {
    expect(table).toMatchObject({
      label: 'Lingering Injuries',
      dieFaces: 20,
      triggers: [
        { event: 'DAMAGED', critical: true },
        { event: 'HIT_POINTS_ZERO' },
        { event: 'DEATH_SAVE_FAILED', byAtLeast: 5 }
      ]
    })
    expect(encounterConsequenceRollTables(off)).toEqual([])
    expect(
      offer(consequenceRollDamageFacts([hit(HERO, { critical: true })]), { state: off })
    ).toEqual([])
  })

  it('offer one roll on a critical hit, naming the table and the source command', () => {
    const [change] = offer(consequenceRollDamageFacts([hit(HERO, { critical: true })]))
    expect(change!.before).toBe(hero)
    expect(change!.after.consequenceRollOffers).toEqual([
      {
        sourceCommandId: ATTACK,
        definitionId: table!.pin.definitionId,
        label: 'Lingering Injuries',
        triggers: [{ event: 'DAMAGED', critical: true }],
        occurredAt: AT
      }
    ])
  })

  it('offer nothing for an ordinary hit or a hit the target took no damage from', () => {
    expect(offer(consequenceRollDamageFacts([hit(HERO)]))).toEqual([])
    expect(offer(consequenceRollDamageFacts([hit(HERO, { critical: true, applied: 0 })]))).toEqual(
      []
    )
  })

  it('offer a roll on dropping to 0, and one offer listing both for a critical that drops', () => {
    expect(offeredEvents(offer(consequenceRollDamageFacts([hit(HERO, { before: 5 })])))).toEqual([
      [['HIT_POINTS_ZERO']]
    ])
    expect(
      offeredEvents(offer(consequenceRollDamageFacts([hit(HERO, { before: 5, critical: true })])))
    ).toEqual([[['DAMAGED', 'HIT_POINTS_ZERO']]])
  })

  it('offer nothing for damage taken already at 0', () => {
    expect(offer(consequenceRollDamageFacts([hit(HERO, { before: 0, after: 0 })]))).toEqual([])
  })

  it('offer a roll on a death save failed by 5 or more, never by 4', () => {
    const save = (rawDie: number, addedTotal = 0) =>
      offeredEvents(offer(withDeathSaveFacts(new Map(), { actorId: HERO, rawDie, addedTotal })))
    expect(save(5)).toEqual([[['DEATH_SAVE_FAILED']]])
    expect(save(6)).toEqual([])
    expect(save(9, -4)).toEqual([[['DEATH_SAVE_FAILED']]])
    expect(save(2)).toEqual([[['DEATH_SAVE_FAILED']]])
    expect(save(10)).toEqual([])
  })

  it('give Creatures no offers: their injuries are the GM’s ruling', () => {
    expect(offer(consequenceRollDamageFacts([hit(OGRE, { critical: true, before: 3 })]))).toEqual(
      []
    )
  })

  it('merge a later trigger of the same command into its offer, and keep commands apart', () => {
    const [first] = offer(consequenceRollDamageFacts([hit(HERO, { critical: true })]))
    const offered = first!.after
    const [merged] = offer(
      withDeathSaveFacts(new Map(), { actorId: HERO, rawDie: 1, addedTotal: 0 }),
      {
        actors: [offered]
      }
    )
    expect(offeredEvents([merged!])).toEqual([[['DAMAGED', 'DEATH_SAVE_FAILED']]])
    const [separate] = offer(consequenceRollDamageFacts([hit(HERO, { critical: true })]), {
      actors: [offered],
      sourceCommandId: LATER
    })
    expect(separate!.after.consequenceRollOffers?.map((open) => open.sourceCommandId)).toEqual([
      ATTACK,
      LATER
    ])
  })

  it('keep the newest offers when an actor holds too many', () => {
    let current = hero
    for (let index = 0; index < 9; index += 1)
      current = offer(consequenceRollDamageFacts([hit(HERO, { critical: true })]), {
        actors: [current],
        sourceCommandId: testUuid(0x1600 + index)
      })[0]!.after
    expect(current.consequenceRollOffers?.map((open) => open.sourceCommandId)).toEqual(
      Array.from({ length: 8 }, (_, index) => testUuid(0x1601 + index))
    )
  })

  it('withdraw a command’s offers and remove a resolved one', () => {
    const offered = offer(consequenceRollDamageFacts([hit(HERO, { critical: true })]))[0]!.after
    const [withdrawn] = withdrawConsequenceRollOffers([offered, ogre], ATTACK, AT)
    expect(withdrawn!.after.consequenceRollOffers).toBeUndefined()
    expect(withdrawConsequenceRollOffers([offered], LATER, AT)).toEqual([])
    expect(
      withoutConsequenceRollOffer(offered, offered.consequenceRollOffers![0]!, AT)
        .consequenceRollOffers
    ).toBeUndefined()
  })

  it('land a roll on its authored row, or on none in a gap', () => {
    const gapped = { ...table!, rows: [table!.rows[0]!, table!.rows[2]!] }
    expect(consequenceRollRow(table!, table!.rows[1]!.minimum)).toBe(table!.rows[1]!.rowId)
    expect(consequenceRollRow(gapped, table!.rows[1]!.minimum)).toBeNull()
  })
})

describe('Death save shortfall', () => {
  it('measures a failure against DC 10, with a natural 1 failing and a natural 20 succeeding', () => {
    expect(deathSaveShortfall(4)).toBe(6)
    expect(deathSaveShortfall(9)).toBe(1)
    expect(deathSaveShortfall(10)).toBeNull()
    expect(deathSaveShortfall(1, 12)).toBe(-3)
    expect(deathSaveShortfall(20, -15)).toBeNull()
    expect(deathSaveShortfall(8, 3)).toBeNull()
  })
})
