import {
  createEmptyVehicle,
  normalizeVehicleForSubmit,
  toVehicleFormValues
} from '../vehicleAuthoring.utils'
import { ownedVehicleResponseFixture } from '../vehicle.fixtures'

describe('vehicle authoring utils', () => {
  it('creates empty vehicle drafts with a real system id', () => {
    const vehicle = createEmptyVehicle({ systemId: 'system-1' })

    expect(vehicle).toMatchObject({
      label: '',
      status: 'DRAFT',
      systemId: 'system-1',
      category: 'LAND',
      details: [],
      properties: [],
      features: []
    })
    expect(vehicle.id).toBeTruthy()
  })

  it('normalizes form values into Vehicle authoring input', () => {
    const vehicle = toVehicleFormValues(ownedVehicleResponseFixture.item)
    const payload = normalizeVehicleForSubmit({
      ...vehicle,
      label: '  ',
      properties: [{ value: ' fast ' }, { value: '' }]
    })

    expect(payload).toMatchObject({
      id: ownedVehicleResponseFixture.item.id,
      label: 'Untitled Vehicle',
      properties: ['fast']
    })
    expect('userId' in payload).toBe(false)
  })

  it('maps persisted property strings to editable property rows', () => {
    expect(toVehicleFormValues(ownedVehicleResponseFixture.item).properties).toEqual([
      { value: 'fast' }
    ])
  })
})
