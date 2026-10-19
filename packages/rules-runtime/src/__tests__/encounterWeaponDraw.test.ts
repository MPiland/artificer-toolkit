import { describe, expect, it } from 'vitest'

import {
  characterActionDrawWeapon,
  creatureActionDrawWeapon,
  evaluateEncounterWeaponDraw
} from '../encounterWeaponDraw'

const club = { id: 'club', twoHanded: false, drawn: false }
const greatclub = { id: 'greatclub', twoHanded: true, drawn: false }
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

describe('the weapon an action draws', () => {
  it('is the loadout entry a Creature action binds, and none for a natural attack', () => {
    const hands = [carried('club'), inHand('shield', 'OFF_HAND')]
    expect(creatureActionDrawWeapon(hands, 'club')).toEqual(club)
    expect(creatureActionDrawWeapon(hands, 'shield')).toEqual({
      id: 'shield',
      twoHanded: false,
      drawn: true
    })
    expect(creatureActionDrawWeapon(hands, undefined)).toBeNull()
  })

  it('is none for a Character action with no wielded grip', () => {
    expect(characterActionDrawWeapon(null)).toBeNull()
    expect(characterActionDrawWeapon(undefined)).toBeNull()
  })
})
