import { describe, expect, it } from 'vitest'

import {
  nextEquipSlot,
  planHandDraw,
  promotesOffHandItem,
  resolveHandOccupancy,
  swapHeldItems,
  type HeldItem
} from '../domains/subjects/core/equipmentHands.js'

const item = (
  id: string,
  slot: 'MAIN_HAND' | 'OFF_HAND' | 'CARRIED' | 'WORN',
  twoHanded = false
) => ({ id, slot, twoHanded })

describe('hand occupancy', () => {
  it('leaves both hands free when nothing is held', () => {
    expect(resolveHandOccupancy([item('pack', 'CARRIED'), item('mail', 'WORN')])).toEqual({
      mainHandId: null,
      offHandId: null,
      offHandBlocked: false,
      emptyHands: 2,
      freeHand: true,
      conflicts: []
    })
  })

  it('reports a free hand while only one hand holds an item', () => {
    expect(resolveHandOccupancy([item('sword', 'MAIN_HAND')])).toMatchObject({
      mainHandId: 'sword',
      offHandId: null,
      emptyHands: 1,
      freeHand: true,
      conflicts: []
    })
    expect(resolveHandOccupancy([item('shield', 'OFF_HAND')])).toMatchObject({
      mainHandId: null,
      offHandId: 'shield',
      emptyHands: 1,
      freeHand: true,
      conflicts: []
    })
  })

  it('has no free hand when both hands hold an item', () => {
    expect(
      resolveHandOccupancy([item('sword', 'MAIN_HAND'), item('shield', 'OFF_HAND')])
    ).toMatchObject({
      mainHandId: 'sword',
      offHandId: 'shield',
      offHandBlocked: false,
      emptyHands: 0,
      freeHand: false,
      conflicts: []
    })
  })

  it('blocks the off hand behind a two-handed main-hand item', () => {
    expect(resolveHandOccupancy([item('greatclub', 'MAIN_HAND', true)])).toMatchObject({
      mainHandId: 'greatclub',
      offHandId: null,
      offHandBlocked: true,
      emptyHands: 0,
      freeHand: false,
      conflicts: []
    })
  })

  it('refuses a second item in one hand', () => {
    expect(
      resolveHandOccupancy([
        item('sword', 'MAIN_HAND'),
        item('axe', 'MAIN_HAND'),
        item('shield', 'OFF_HAND'),
        item('buckler', 'OFF_HAND')
      ]).conflicts
    ).toEqual([
      { code: 'HAND_OCCUPIED_TWICE', itemId: 'axe' },
      { code: 'HAND_OCCUPIED_TWICE', itemId: 'buckler' }
    ])
  })

  it('refuses a two-handed item in the off hand', () => {
    expect(resolveHandOccupancy([item('greatclub', 'OFF_HAND', true)]).conflicts).toEqual([
      { code: 'TWO_HANDED_IN_OFF_HAND', itemId: 'greatclub' }
    ])
  })

  it('refuses an off-hand item behind a two-handed main-hand item', () => {
    expect(
      resolveHandOccupancy([item('greatclub', 'MAIN_HAND', true), item('shield', 'OFF_HAND')])
        .conflicts
    ).toEqual([{ code: 'OFF_HAND_BLOCKED', itemId: 'shield' }])
  })

  it('lets carried and worn two-handed items stay out of the hands', () => {
    expect(
      resolveHandOccupancy([
        item('sword', 'MAIN_HAND'),
        item('shortbow', 'CARRIED', true),
        item('mail', 'WORN', true)
      ])
    ).toMatchObject({ mainHandId: 'sword', offHandBlocked: false, conflicts: [] })
  })
})

const held = (id: string, slot: 'MAIN_HAND' | 'OFF_HAND', twoHanded = false): HeldItem => ({
  id,
  slot,
  twoHanded
})
const sword = { id: 'sword', category: 'WEAPON', twoHanded: false }
const shield = { id: 'shield', category: 'SHIELD', twoHanded: false }
const greatclub = { id: 'greatclub', category: 'WEAPON', twoHanded: true }

describe('Character equip slot assignment', () => {
  it('puts the first held item in the main hand and the next in the off hand', () => {
    expect(nextEquipSlot(sword, [])).toEqual({ slot: 'MAIN_HAND' })
    expect(nextEquipSlot(shield, [held('sword', 'MAIN_HAND')])).toEqual({ slot: 'OFF_HAND' })
  })

  it('allows a shield in each hand', () => {
    expect(nextEquipSlot(shield, [held('buckler', 'MAIN_HAND')])).toEqual({ slot: 'OFF_HAND' })
  })

  it('wears anything that is not a weapon or a shield, whatever the hands hold', () => {
    const mail = { id: 'mail', category: 'ARMOR', twoHanded: false }
    expect(nextEquipSlot(mail, [])).toEqual({ slot: 'WORN' })
    expect(nextEquipSlot(mail, [held('sword', 'MAIN_HAND'), held('shield', 'OFF_HAND')])).toEqual({
      slot: 'WORN'
    })
  })

  it('refuses a held item when both hands are full', () => {
    expect(nextEquipSlot(sword, [held('axe', 'MAIN_HAND'), held('shield', 'OFF_HAND')])).toEqual({
      conflict: 'HAND_OCCUPIED_TWICE'
    })
  })

  it('refuses an item beside a two-handed main-hand item', () => {
    expect(nextEquipSlot(shield, [held('greatclub', 'MAIN_HAND', true)])).toEqual({
      conflict: 'OFF_HAND_BLOCKED'
    })
  })

  it('refuses a two-handed item when the main hand is taken', () => {
    expect(nextEquipSlot(greatclub, [held('sword', 'MAIN_HAND')])).toEqual({
      conflict: 'TWO_HANDED_IN_OFF_HAND'
    })
  })

  it('takes a two-handed item into an empty main hand', () => {
    expect(nextEquipSlot(greatclub, [])).toEqual({ slot: 'MAIN_HAND' })
  })
})

describe('Character hand swap', () => {
  it('exchanges the main and off hand holders', () => {
    expect(swapHeldItems([held('sword', 'MAIN_HAND'), held('shield', 'OFF_HAND')])).toEqual({
      held: [held('sword', 'OFF_HAND'), held('shield', 'MAIN_HAND')]
    })
  })

  it('moves a lone item to the other hand, both ways', () => {
    expect(swapHeldItems([held('sword', 'MAIN_HAND')])).toEqual({
      held: [held('sword', 'OFF_HAND')]
    })
    expect(swapHeldItems([held('sword', 'OFF_HAND')])).toEqual({
      held: [held('sword', 'MAIN_HAND')]
    })
  })

  it('refuses to swap a two-handed main-hand item', () => {
    expect(swapHeldItems([held('greatclub', 'MAIN_HAND', true)])).toEqual({
      conflict: 'TWO_HANDED_IN_OFF_HAND'
    })
  })
})

describe('hand draw plan', () => {
  it('draws into the main hand, then the off hand, while a hand is free', () => {
    expect(planHandDraw({ id: 'axe', twoHanded: false }, [], 0)).toEqual({
      kind: 'DRAW',
      slot: 'MAIN_HAND'
    })
    expect(
      planHandDraw({ id: 'dagger', twoHanded: false }, [item('sword', 'MAIN_HAND')], 0)
    ).toEqual({ kind: 'DRAW', slot: 'OFF_HAND' })
  })

  it('draws nothing when items fill the hands: swaps stay free', () => {
    expect(
      planHandDraw(
        { id: 'axe', twoHanded: false },
        [item('sword', 'MAIN_HAND'), item('shield', 'OFF_HAND')],
        0
      )
    ).toEqual({ kind: 'NO_HAND' })
  })

  it('counts a held creature as occupying a hand', () => {
    expect(planHandDraw({ id: 'axe', twoHanded: false }, [], 1)).toEqual({
      kind: 'DRAW',
      slot: 'MAIN_HAND'
    })
    expect(
      planHandDraw({ id: 'dagger', twoHanded: false }, [item('sword', 'MAIN_HAND')], 1)
    ).toEqual({ kind: 'RELEASE_REQUIRED', slot: 'OFF_HAND' })
    expect(planHandDraw({ id: 'axe', twoHanded: false }, [], 2)).toEqual({
      kind: 'RELEASE_REQUIRED',
      slot: 'MAIN_HAND'
    })
  })

  it('needs both hands for a two-handed weapon', () => {
    expect(planHandDraw({ id: 'maul', twoHanded: true }, [], 0)).toEqual({
      kind: 'DRAW',
      slot: 'MAIN_HAND'
    })
    expect(planHandDraw({ id: 'maul', twoHanded: true }, [], 1)).toEqual({
      kind: 'RELEASE_REQUIRED',
      slot: 'MAIN_HAND'
    })
    expect(planHandDraw({ id: 'maul', twoHanded: true }, [], 2)).toEqual({
      kind: 'RELEASE_REQUIRED',
      slot: 'MAIN_HAND'
    })
    expect(planHandDraw({ id: 'maul', twoHanded: true }, [item('shield', 'OFF_HAND')], 0)).toEqual({
      kind: 'NO_HAND'
    })
  })
})

describe('off-hand promotion', () => {
  it('promotes an off-hand weapon only when the main hand was emptied', () => {
    expect(promotesOffHandItem('MAIN_HAND', 'WEAPON')).toBe(true)
    expect(promotesOffHandItem('MAIN_HAND', 'SHIELD')).toBe(false)
    expect(promotesOffHandItem('OFF_HAND', 'WEAPON')).toBe(false)
    expect(promotesOffHandItem('WORN', 'WEAPON')).toBe(false)
    expect(promotesOffHandItem(undefined, 'WEAPON')).toBe(false)
  })
})
