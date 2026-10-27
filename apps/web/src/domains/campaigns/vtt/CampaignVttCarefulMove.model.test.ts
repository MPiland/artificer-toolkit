import type { EncounterSessionStateDto } from '@artificer-toolkit/schema/api/encounterData'
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
const moverActorId = '00000000-0000-4000-8000-0000000000a1'
const placedZone = (
  { id, label, shape }: HalfSpeedField,
  unawareActorIds: string[]
): EncounterSessionStateDto['placedZones'][number] => ({
  id,
  label,
  shape,
  spotDc: null,
  disarmDc: null,
  unawareActorIds
})

describe('halfSpeedFieldsEntered', () => {
  it('lists the fields the dragged footprint passes through, in the room’s order', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1400, y: 0 }
    ]
    expect(
      halfSpeedFieldsEntered({
        session: { halfSpeedFields: [near, far], placedZones: [] },
        moverActorId,
        path,
        token
      })
    ).toEqual([near, far])
  })

  it('lists none when the path stops short of, or runs beside, every field', () => {
    expect(
      halfSpeedFieldsEntered({
        session: { halfSpeedFields: [near, far], placedZones: [] },
        moverActorId,
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
        session: { halfSpeedFields: [near], placedZones: [] },
        moverActorId,
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

  it('leaves out a concealed field its mover has not noticed, and keeps one it knows of (MOVE-3.6)', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 1400, y: 0 }
    ]
    const otherActorId = '00000000-0000-4000-8000-0000000000a2'
    expect(
      halfSpeedFieldsEntered({
        session: {
          halfSpeedFields: [near, far],
          placedZones: [placedZone(near, [moverActorId]), placedZone(far, [otherActorId])]
        },
        moverActorId,
        path,
        token
      })
    ).toEqual([far])
  })
})
