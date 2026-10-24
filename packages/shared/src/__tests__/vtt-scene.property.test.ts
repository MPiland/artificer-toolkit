import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import {
  applySceneDelta,
  applySceneEvent,
  createSceneFogAreaPatch,
  isSceneFogCellExplored,
  materializeCampaignScene,
  projectSceneForViewer,
  replaySceneEvents,
  segmentsIntersect,
  type SceneDefinition,
  type SceneEvent
} from '../domains/vtt/index.js'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  definition: '00000000-0000-4000-8000-000000000002',
  encounter: '00000000-0000-4000-8000-000000000003',
  map: '00000000-0000-4000-8000-000000000004',
  player: '00000000-0000-4000-8000-000000000005',
  scene: '00000000-0000-4000-8000-000000000006',
  token: '00000000-0000-4000-8000-000000000007'
} as const

const pointArbitrary = fc.record({
  x: fc.integer({ max: 1_000, min: -1_000 }),
  y: fc.integer({ max: 1_000, min: -1_000 })
})

describe('VTT scene properties', () => {
  it('replays contiguous events deterministically and treats every committed event as idempotent', () => {
    fc.assert(
      fc.property(fc.array(pointArbitrary, { maxLength: 40 }), (positions) => {
        const events: SceneEvent[] = positions.map((position, index) => ({
          actorUserId: ids.player,
          commandId: `command-${index}`,
          delta: { kind: 'TOKEN_MOVED', position, tokenId: ids.token },
          sceneId: ids.scene,
          version: index + 1
        }))
        const replayed = replaySceneEvents(definition(), ids.scene, events)
        const reduced = events.reduce(
          (state, event) => applySceneEvent(state, event),
          materializeCampaignScene(definition(), ids.scene)
        )

        expect(replayed).toEqual(reduced)
        for (const event of events) expect(applySceneEvent(replayed, event)).toBe(replayed)
      })
    )
  })

  it('keeps segment intersection symmetric under segment ordering and direction', () => {
    fc.assert(
      fc.property(pointArbitrary, pointArbitrary, pointArbitrary, pointArbitrary, (a, b, c, d) => {
        const expected = segmentsIntersect(a, b, c, d)
        expect(segmentsIntersect(c, d, a, b)).toBe(expected)
        expect(segmentsIntersect(b, a, d, c)).toBe(expected)
      })
    )
  })

  it('never exposes hidden tokens and never expands a player projection', () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { maxLength: 100 }), (hiddenValues) => {
        const state = materializeCampaignScene(definition(), ids.scene)
        state.tokens = hiddenValues.map((hidden, index) => ({
          ...state.tokens[0]!,
          controlledByUserIds: [ids.player],
          hidden,
          id: `token-${index}`
        }))

        const projection = projectSceneForViewer(
          state,
          {
            role: 'PLAYER',
            userId: ids.player
          },
          new Map()
        )

        expect(projection.tokens.length).toBeLessThanOrEqual(state.tokens.length)
        expect(projection.tokens.every((token) => !token.hidden)).toBe(true)
        expect(projection.annotations.length).toBeLessThanOrEqual(state.annotations.length)
        expect(projection.barriers.length).toBeLessThanOrEqual(state.barriers.length)
      })
    )
  })

  it('makes repeated reveals monotonic and an identical reveal a no-op', () => {
    fc.assert(
      fc.property(
        fc.integer({ max: 999, min: 0 }),
        fc.integer({ max: 999, min: 0 }),
        fc.integer({ max: 1_000, min: 1 }),
        fc.integer({ max: 1_000, min: 1 }),
        fc.integer({ max: 999, min: 0 }),
        fc.integer({ max: 999, min: 0 }),
        fc.integer({ max: 1_000, min: 1 }),
        fc.integer({ max: 1_000, min: 1 }),
        fc.array(
          fc.record({ x: fc.integer({ max: 511, min: 0 }), y: fc.integer({ max: 511, min: 0 }) }),
          { maxLength: 32 }
        ),
        (x1, y1, x2, y2, x3, y3, x4, y4, sampledCells) => {
          const state = materializeCampaignScene(definition(), ids.scene)
          const patch = createSceneFogAreaPatch(state, {
            explored: true,
            ownerUserId: ids.player,
            rectangle: { a: { x: x1, y: y1 }, b: { x: x2, y: y2 } }
          })
          if (!patch) return

          const revealed = applySceneDelta(state, { kind: 'FOG_CHUNKS_PATCHED', layer: patch }, 1)
          expect(
            createSceneFogAreaPatch(revealed, {
              explored: true,
              ownerUserId: ids.player,
              rectangle: { a: { x: x1, y: y1 }, b: { x: x2, y: y2 } }
            })
          ).toBeNull()
          const secondPatch = createSceneFogAreaPatch(revealed, {
            explored: true,
            ownerUserId: ids.player,
            rectangle: { a: { x: x3, y: y3 }, b: { x: x4, y: y4 } }
          })
          const afterSecondReveal = secondPatch
            ? applySceneDelta(revealed, { kind: 'FOG_CHUNKS_PATCHED', layer: secondPatch }, 2)
            : revealed
          const firstLayer = revealed.fogLayers[0]!
          const secondLayer = afterSecondReveal.fogLayers[0]!
          for (const cell of sampledCells) {
            if (isSceneFogCellExplored(firstLayer, cell.x, cell.y)) {
              expect(isSceneFogCellExplored(secondLayer, cell.x, cell.y)).toBe(true)
            }
          }
        }
      ),
      { numRuns: 50 }
    )
  })
})

function definition(): SceneDefinition {
  return {
    annotations: [
      {
        id: 'annotation',
        position: { x: 25, y: 25 },
        text: 'Private note',
        visibility: 'GM_ONLY'
      }
    ],
    ambientIllumination: 'BRIGHT',
    daylight: false,
    barriers: [],
    campaignId: ids.campaign,
    darknessZones: [],
    fogMode: 'PER_PLAYER',
    grid: {
      cellSize: 50,
      diagonalPolicy: 'EQUAL',
      distancePerCell: 5,
      kind: 'SQUARE',
      origin: { x: 0, y: 0 },
      unit: 'FEET'
    },
    id: ids.definition,
    lights: [],
    map: { assetId: ids.map, height: 1_000, tileManifestAssetId: null, width: 1_000 },
    name: 'Property scene',
    tokens: [
      {
        assetId: null,
        controlledByUserIds: [ids.player],
        height: 1,
        hidden: false,
        id: ids.token,
        label: 'Hero',
        locked: false,
        position: { x: 0, y: 0 },
        rotationDegrees: 0,
        senses: [],
        vision: null,
        width: 1
      }
    ],
    version: 1,
    visionRevealMode: 'ON_DRAG'
  }
}
