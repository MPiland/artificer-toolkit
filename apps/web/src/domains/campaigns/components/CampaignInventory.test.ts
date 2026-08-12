import { describe, expect, it } from 'vitest'
import { parseOwner } from './CampaignInventory'

describe('Campaign inventory owners', () => {
  it('maps Vehicle custody without treating it as Character state', () => {
    expect(parseOwner('VEHICLE:vehicle-id', 'campaign-id')).toEqual({
      kind: 'VEHICLE',
      vehicleId: 'vehicle-id'
    })
  })
})
