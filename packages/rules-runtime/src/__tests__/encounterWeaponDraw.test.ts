import { describe, expect, it } from 'vitest'

import {
  characterActionDrawWeapon,
  creatureActionDrawWeapon,
  evaluateEncounterWeaponDraw
} from '../encounterWeaponDraw.js'

const club = { id: 'club', twoHanded: false, drawn: false, thrown: false }
const greatclub = { id: 'greatclub', twoHanded: true, drawn: false, thrown: false }
const javelin = { id: 'javelin', twoHanded: false, drawn: false, thrown: true }
const carried = (id: string, twoHanded = false) => ({ id, slot: 'CARRIED' as const, twoHanded })
const inHand = (id: string, slot: 'MAIN_HAND' | 'OFF_HAND', twoHanded = false) => ({
  id,
  slot,
  twoHanded
})

describe('evaluateEncounterWeaponDraw (D107)', () => {
  it('draws a carried weapon into a free hand', () => {
    expect(
      evaluateEncounterWeaponDraw({ weapon: club, hands: [carried('club')], holds: 0 })
    ).toEqual({ kind: 'DRAW', itemId: 'club', slot: 'MAIN_HAND' })
  })

  it('draws nothing for a natural attack or a weapon already in hand', () => {
    expect(evaluateEncounterWeaponDraw({ weapon: null, hands: [], holds: 2 })).toEqual({
      kind: 'NONE'
    })
    expect(
      evaluateEncounterWeaponDraw({ weapon: { ...club, drawn: true }, hands: [], holds: 2 })
    ).toEqual({ kind: 'NONE' })
  })

  it('requires a release when held creatures are the only thing filling the hands', () => {
    expect(
      evaluateEncounterWeaponDraw({ weapon: club, hands: [carried('club')], holds: 2 })
    ).toEqual({ kind: 'RELEASE_REQUIRED' })
    expect(
      evaluateEncounterWeaponDraw({
        weapon: greatclub,
        hands: [carried('greatclub', true)],
        holds: 1
      })
    ).toEqual({ kind: 'RELEASE_REQUIRED' })
  })

  it('draws into the remaining hand beside one hold, and leaves full hands of items to swap', () => {
    expect(
      evaluateEncounterWeaponDraw({ weapon: club, hands: [carried('club')], holds: 1 })
    ).toEqual({ kind: 'DRAW', itemId: 'club', slot: 'MAIN_HAND' })
    expect(
      evaluateEncounterWeaponDraw({
        weapon: club,
        hands: [carried('club'), inHand('a', 'MAIN_HAND'), inHand('b', 'OFF_HAND')],
        holds: 0
      })
    ).toEqual({ kind: 'NONE' })
  })
})

describe('a thrown weapon leaves its hand (D107, ATTACK-19.3)', () => {
  it('throws a held weapon out of the hand it is in', () => {
    expect(
      evaluateEncounterWeaponDraw({
        weapon: { ...javelin, drawn: true },
        hands: [inHand('javelin', 'OFF_HAND'), inHand('shield', 'MAIN_HAND')],
        holds: 0
      })
    ).toEqual({ kind: 'THROW', itemId: 'javelin', slot: 'OFF_HAND' })
  })

  it('throws a carried weapon without drawing it or needing a hand', () => {
    expect(
      evaluateEncounterWeaponDraw({ weapon: javelin, hands: [carried('javelin')], holds: 2 })
    ).toEqual({ kind: 'NONE' })
  })
})

describe('the weapon an action draws', () => {
  const items = [
    {
      entry: { id: 'club', useState: 'CARRIED' as const },
      source: { compiled: { properties: [] } }
    },
    {
      entry: { id: 'javelin', useState: 'MAIN_HAND' as const },
      source: { compiled: { properties: ['THROWN'] } }
    },
    {
      entry: { id: 'greatclub', useState: 'MAIN_HAND' as const },
      source: { compiled: { properties: ['TWO_HANDED'] } }
    }
  ]

  it('is the loadout entry a Creature action binds, and none for a natural attack', () => {
    expect(creatureActionDrawWeapon(items, 'club', 'MELEE')).toEqual(club)
    expect(creatureActionDrawWeapon(items, 'greatclub', 'MELEE')).toEqual({
      id: 'greatclub',
      twoHanded: true,
      drawn: true,
      thrown: false
    })
    expect(creatureActionDrawWeapon(items, undefined, 'MELEE')).toBeNull()
  })

  it('is thrown only by a ranged attack through a Thrown weapon', () => {
    expect(creatureActionDrawWeapon(items, 'javelin', 'RANGED')).toEqual({
      id: 'javelin',
      twoHanded: false,
      drawn: true,
      thrown: true
    })
    expect(creatureActionDrawWeapon(items, 'javelin', 'MELEE')?.thrown).toBe(false)
    expect(creatureActionDrawWeapon(items, 'club', 'RANGED')?.thrown).toBe(false)
  })

  it('is none for a Character action with no wielded grip', () => {
    expect(characterActionDrawWeapon(null, 'MELEE')).toBeNull()
    expect(characterActionDrawWeapon(undefined, 'RANGED')).toBeNull()
  })
})
