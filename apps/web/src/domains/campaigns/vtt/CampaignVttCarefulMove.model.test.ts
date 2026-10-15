import { describe, expect, it } from 'vitest'
import { halfSpeedFieldsEntered, type HalfSpeedField } from './CampaignVttCarefulMove.model'

const field = (id: string, left: number): HalfSpeedField => ({
  id,
  label: null,
  shape: {
    kind: 'POLYGON',
    points: [
      { x: left, y: -100 },
      { x: left + 100, y: -100 },
      { x: left + 100, y: 100 },
      { x: left, y: 100 }
    ]
  }
})
const near = field('00000000-0000-4000-8000-000000000001', 200)
const far = field('00000000-0000-4000-8000-000000000002', 1000)
const token = { position: { x: 0, y: 0 }, width: 100, height: 100 }

describe('halfSpeedFieldsEntered', () => {
  it('lists the fields the dragged footprint passes through, in the room’s order', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1400, y: 0 }
    ]
    expect(halfSpeedFieldsEntered({ fields: [near, far], path, token })).toEqual([near, far])
  })

  it('lists none when the path stops short of, or runs beside, every field', () => {
    expect(
      halfSpeedFieldsEntered({
        fields: [near, far],
        path: [
          { x: 0, y: 0 },
          { x: -300, y: 0 },
          { x: -300, y: 600 }
        ],
        token
      })
    ).toEqual([])
  })

  it('lists a field a later leg of the path enters', () => {
    expect(
      halfSpeedFieldsEntered({
        fields: [near],
        path: [
          { x: 0, y: 0 },
          { x: 0, y: 500 },
          { x: 250, y: 500 },
          { x: 250, y: 0 }
        ],
        token
      })
    ).toEqual([near])
  })
})
