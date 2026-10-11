import { describe, expect, it } from 'vitest'

import { resolveHandOccupancy } from '../domains/subjects/core/equipmentHands.js'

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
      freeHand: true,
      conflicts: []
    })
  })

  it('reports a free hand while only one hand holds an item', () => {
    expect(resolveHandOccupancy([item('sword', 'MAIN_HAND')])).toMatchObject({
      mainHandId: 'sword',
      offHandId: null,
      freeHand: true,
      conflicts: []
    })
    expect(resolveHandOccupancy([item('shield', 'OFF_HAND')])).toMatchObject({
      mainHandId: null,
      offHandId: 'shield',
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
      freeHand: false,
      conflicts: []
    })
  })

  it('blocks the off hand behind a two-handed main-hand item', () => {
    expect(resolveHandOccupancy([item('greatclub', 'MAIN_HAND', true)])).toMatchObject({
      mainHandId: 'greatclub',
      offHandId: null,
      offHandBlocked: true,
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
