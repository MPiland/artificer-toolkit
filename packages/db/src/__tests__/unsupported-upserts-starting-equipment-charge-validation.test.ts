import { describe, expect, it } from 'vitest'
import { upsertCharge } from '../domains/shared/upserts/charge.js'
import { upsertStartingEquipment } from '../domains/shared/upserts/starting_equipment.js'
describe('unsupported authored effect paths fail loudly', () => {
  it('rejects selected starting equipment items without equipment ids', async () => {
    await expect(
      upsertStartingEquipment(
        {} as never,
        {
          id: 'starting-equipment-missing-ids',
          sets: [
            {
              id: 'set-1',
              order: 1,
              groups: [
                {
                  id: 'group-1',
                  order: 1,
                  options: [
                    {
                      id: 'option-1',
                      order: 1,
                      items: [
                        {
                          id: 'item-1',
                          order: 1,
                          startingEquipmentKind: 'EQUIPMENT',
                          authoringModeKind: 'SELECTED',
                          selectionKind: 'GRANTED',
                          quantity: 1
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        } as never
      )
    ).rejects.toThrow('missing equipmentIds')
  })
  it('rejects granted starting equipment items with count payload', async () => {
    await expect(
      upsertStartingEquipment(
        {} as never,
        {
          id: 'starting-equipment-granted-count',
          sets: [
            {
              id: 'set-1',
              order: 1,
              groups: [
                {
                  id: 'group-1',
                  order: 1,
                  options: [
                    {
                      id: 'option-1',
                      order: 1,
                      items: [
                        {
                          id: 'item-1',
                          order: 1,
                          startingEquipmentKind: 'EQUIPMENT',
                          authoringModeKind: 'ALL',
                          selectionKind: 'GRANTED',
                          quantity: 1,
                          count: 1
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        } as never
      )
    ).rejects.toThrow('cannot persist count for GRANTED')
  })
  it('rejects chosen starting equipment items with quantity payload', async () => {
    await expect(
      upsertStartingEquipment(
        {} as never,
        {
          id: 'starting-equipment-chosen-quantity',
          sets: [
            {
              id: 'set-1',
              order: 1,
              groups: [
                {
                  id: 'group-1',
                  order: 1,
                  options: [
                    {
                      id: 'option-1',
                      order: 1,
                      items: [
                        {
                          id: 'item-1',
                          order: 1,
                          startingEquipmentKind: 'EQUIPMENT',
                          authoringModeKind: 'ALL',
                          selectionKind: 'CHOSEN',
                          count: 1,
                          quantity: 1
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        } as never
      )
    ).rejects.toThrow('cannot persist quantity for CHOSEN')
  })
  it('rejects currency starting equipment items without currencies', async () => {
    await expect(
      upsertStartingEquipment(
        {} as never,
        {
          id: 'starting-equipment-missing-currencies',
          sets: [
            {
              id: 'set-1',
              order: 1,
              groups: [
                {
                  id: 'group-1',
                  order: 1,
                  options: [
                    {
                      id: 'option-1',
                      order: 1,
                      items: [
                        {
                          id: 'item-1',
                          order: 1,
                          startingEquipmentKind: 'CURRENCY',
                          currencies: []
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        } as never
      )
    ).rejects.toThrow('missing currencies')
  })
  it('rejects starting equipment items with invalid property codes', async () => {
    await expect(
      upsertStartingEquipment(
        {} as never,
        {
          id: 'starting-equipment-bad-property',
          sets: [
            {
              id: 'set-1',
              order: 1,
              groups: [
                {
                  id: 'group-1',
                  order: 1,
                  options: [
                    {
                      id: 'option-1',
                      order: 1,
                      items: [
                        {
                          id: 'item-1',
                          order: 1,
                          startingEquipmentKind: 'EQUIPMENT',
                          authoringModeKind: 'ALL',
                          selectionKind: 'GRANTED',
                          quantity: 1,
                          properties: ['SHINY']
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        } as never
      )
    ).rejects.toThrow('invalid property')
  })
  it('rejects charges with invalid reset kinds', async () => {
    await expect(
      upsertCharge(
        {} as never,
        {
          id: 'charge-bad-reset',
          resetKind: 'EVENTUALLY',
          limitKind: 'FIXED_AMOUNT',
          scalingKind: 'NONE',
          amount: 1
        } as never
      )
    ).rejects.toThrow('invalid resetKind')
  })
  it('rejects charges with invalid ability bonus abilities', async () => {
    await expect(
      upsertCharge(
        {} as never,
        {
          id: 'charge-bad-ability',
          resetKind: 'LONG_REST',
          limitKind: 'FIXED_AMOUNT',
          scalingKind: 'NONE',
          amount: 1,
          bonuses: [
            {
              id: 'bonus-1',
              bonusKind: 'ABILITY_MODIFIER',
              ability: 'LUCK',
              order: 1
            }
          ]
        } as never
      )
    ).rejects.toThrow('invalid ability')
  })
})
