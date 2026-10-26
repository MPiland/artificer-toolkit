import { describe, expect, it } from 'vitest'
import { environmentalZones } from '@artificer-toolkit/rules-runtime/testing/authoredZoneFixture'
import { resolveFixtureNodeRuntime } from '#test/nodeRuntimeResolver'
import {
  createPlacedZoneDraft,
  isPlacedZone,
  placedZoneSize,
  placeZoneCommand
} from './campaignTabletopZoneTool.model'

const grid = { kind: 'GRIDLESS', pixelsPerUnit: 10, unit: 'FEET' } as const
const point = { x: 120, y: 80 }
const encounterId = '00000000-0000-4000-8000-0000000000e1'
const placement = { point, encounterId, expectedVersion: 7 }

describe('the GM zone tool model (MOVE-3.2)', () => {
  it('places the authored environmental zones the room accepts, unchanged', () => {
    for (const zone of Object.values(environmentalZones())) {
      expect(placeZoneCommand({ zone, ...placement })).toEqual({
        type: 'PLACE_ZONE',
        commandId: expect.any(String),
        encounterId,
        expectedVersion: 7,
        zone,
        point
      })
    }
  })

  it('accepts the starting draft and the authored environmental zones as placed zones', () => {
    const draft = createPlacedZoneDraft()
    expect(isPlacedZone(draft)).toBe(true)
    for (const zone of Object.values(environmentalZones())) expect(isPlacedZone(zone)).toBe(true)
  })

  it('refuses a manifest that is not a placed-space zone, or incomplete form values', () => {
    const draft = createPlacedZoneDraft()
    expect(isPlacedZone({ ...draft, attachmentKind: 'SOURCE' })).toBe(false)
    expect(isPlacedZone({ ...draft, manifestKind: 'OBJECT' })).toBe(false)
    expect(isPlacedZone({ ...draft, id: undefined })).toBe(false)
    expect(isPlacedZone({})).toBe(false)
  })

  it('sizes a circle as a radius and a cube as a square in Scene units', () => {
    expect(placedZoneSize(createPlacedZoneDraft(), grid)).toEqual({ kind: 'RADIUS', radius: 100 })
    expect(
      placedZoneSize(
        { shape: { id: 'cube', shapeKind: 'CUBE', edgeLength: { amount: 10, unit: 'FEET' } } },
        grid
      )
    ).toEqual({ kind: 'CUBE', edgeLength: 100 })
  })

  it('has no size for a shape a GM cannot place at a point, or an empty size', () => {
    expect(
      placedZoneSize(
        {
          shape: {
            id: 'wall',
            shapeKind: 'WALL',
            length: { amount: 30, unit: 'FEET' },
            height: { amount: 10, unit: 'FEET' }
          }
        },
        grid
      )
    ).toBeNull()
    expect(
      placedZoneSize(
        {
          shape: { id: 'empty', shapeKind: 'SPHERE', radius: { amount: 0, unit: 'FEET' } }
        },
        grid
      )
    ).toBeNull()
    expect(placedZoneSize({}, grid)).toBeNull()
  })

  it('authors the draft through the outcome node map, showing its shape, attachment and components', async () => {
    const model = await resolveFixtureNodeRuntime({
      mapId: 'outcome',
      values: createPlacedZoneDraft()
    })
    const nodeIds = model.steps.flatMap((step) =>
      step.sections.flatMap((section) => section.nodes.map((node) => node.id))
    )
    expect(nodeIds).toEqual(expect.arrayContaining(['shape', 'attachmentKind', 'components']))
  })
})
