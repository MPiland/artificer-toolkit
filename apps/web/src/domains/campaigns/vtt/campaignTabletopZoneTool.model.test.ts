import { describe, expect, it } from 'vitest'
import type { ManifestAuthored } from '@artificer-toolkit/shared/authored'
import { environmentalZones } from '@artificer-toolkit/rules-runtime/testing/authoredZoneFixture'
import { resolveFixtureNodeRuntime } from '#test/nodeRuntimeResolver'
import {
  createPlacedZoneDraft,
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

  it('places the starting draft once the GM picks its center', () => {
    expect(placeZoneCommand({ zone: createPlacedZoneDraft(), ...placement })).not.toBeNull()
  })

  it('refuses a manifest that is not a placed-space zone', () => {
    const draft = createPlacedZoneDraft()
    const sourceZone: ManifestAuthored = { ...draft, attachmentKind: 'SOURCE' }
    const object: ManifestAuthored = { ...draft, manifestKind: 'OBJECT' }
    expect(placeZoneCommand({ zone: sourceZone, ...placement })).toBeNull()
    expect(placeZoneCommand({ zone: object, ...placement })).toBeNull()
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
    expect(placedZoneSize({ shape: { id: 'wall', shapeKind: 'WALL' } }, grid)).toBeNull()
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
