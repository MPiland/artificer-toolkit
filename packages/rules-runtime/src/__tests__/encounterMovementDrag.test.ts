import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { SpatialEffectInstance } from '@artificer-toolkit/shared/vtt'
import { describe, expect, it } from 'vitest'

import { encounterMovementDrag } from '../encounterMovementDrag.js'
import { ENCOUNTER_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { activeEffect } from './encounterActiveEffectFixtures.js'
import { zoneToken } from './spatialZoneFixture.js'

type RelationshipModule = Extract<
  Extract<ActiveRuleEffectRecord['definition'], { schemaVersion: 2 }>['stateContributions'][number],
  { kind: 'ACTOR_RELATIONSHIP' }
>['modules'][number]

const MOVER = { actorId: testUuid(0xd701), tokenId: testUuid(0xd711) }
const HELD = { actorId: testUuid(0xd702), tokenId: testUuid(0xd712) }
const OTHER = { actorId: testUuid(0xd703), tokenId: testUuid(0xd713) }
const dragged: RelationshipModule = { id: testUuid(0xd720), order: 0, kind: 'TARGET_DRAGGED' }
const occupiesHand: RelationshipModule = {
  id: testUuid(0xd721),
  order: 0,
  kind: 'SOURCE_OCCUPIES_HAND'
}

/** `sourceActorId` holds `HELD` through a relationship carrying `modules`. */
function holds(sourceActorId: string, modules: RelationshipModule[]) {
  return new Map([
    [
      HELD.actorId,
      [
        activeEffect({
          id: testUuid(0xd730),
          owner: {
            kind: 'ENCOUNTER_ACTOR',
            encounterId: ENCOUNTER_ID,
            targetActorId: HELD.actorId
          },
          createdOrdinal: 1,
          sourceActorId,
          stateContributions: [
            {
              kind: 'ACTOR_RELATIONSHIP',
              relationshipOutcomeId: testUuid(0xd731),
              sealedReachFeet: 5,
              modules,
              conditionIds: [],
              capabilitySuppressions: []
            }
          ]
        })
      ]
    ]
  ])
}

/** A fixed square zone spanning x 400 to 500 across the row. */
const zone = (overrides: Partial<SpatialEffectInstance> = {}): SpatialEffectInstance => ({
  effectId: testUuid(0xd740),
  sourceActorId: OTHER.actorId,
  sourceTokenId: null,
  anchorKind: 'FIXED',
  geometry: {
    frame: 'SCENE_ABSOLUTE',
    shape: {
      kind: 'POLYGON',
      points: [
        { x: 400, y: 0 },
        { x: 500, y: 0 },
        { x: 500, y: 100 },
        { x: 400, y: 100 }
      ]
    }
  },
  triggerModes: ['ENTER'],
  movementKinds: ['VOLUNTARY'],
  ...overrides
})

// The mover stands at x 150 with the creature it holds beside it at x 50.
const scene: Parameters<typeof encounterMovementDrag>[0]['scene'] = {
  map: { assetId: testUuid(0xd760), width: 1000, height: 100, tileManifestAssetId: null },
  tokens: [
    zoneToken(MOVER.tokenId, 'Mover', 150),
    zoneToken(HELD.tokenId, 'Held', 50),
    zoneToken(OTHER.tokenId, 'Other', 750)
  ],
  barriers: [],
  doorStates: {}
}
const actorIdByTokenId = new Map(
  [MOVER, HELD, OTHER].map((entry) => [entry.tokenId, entry.actorId])
)
const walk = (toX: number) => [
  { x: 150, y: 50 },
  { x: toX, y: 50 }
]

function drag(
  input: Partial<Parameters<typeof encounterMovementDrag>[0]> & {
    sizes?: Record<string, string | null>
  } = {}
) {
  const sizes = input.sizes ?? { [MOVER.actorId]: 'MEDIUM', [HELD.actorId]: 'MEDIUM' }
  return encounterMovementDrag({
    scene,
    mover: MOVER,
    actorIdByTokenId,
    activeEffectsByActorId: holds(MOVER.actorId, [occupiesHand, dragged]),
    sizeOf: (actorId) => sizes[actorId] ?? null,
    effects: [],
    path: walk(250),
    ...input
  })
}

describe('a grappler drags the creatures it holds (ATTACK-7.T7, D105)', () => {
  it('drags only the creatures its own TARGET_DRAGGED holds bind', () => {
    expect(drag()).toEqual({
      kind: 'DRAG',
      tokens: [{ tokenId: HELD.tokenId, actorId: HELD.actorId }],
      doublesCost: true
    })
    // A hold without the module, or one another creature applied, drags nothing.
    for (const activeEffectsByActorId of [
      holds(MOVER.actorId, [occupiesHand]),
      holds(OTHER.actorId, [dragged])
    ])
      expect(drag({ activeEffectsByActorId })).toEqual({
        kind: 'DRAG',
        tokens: [],
        doublesCost: false
      })
  })

  it('costs double unless the dragged creature is two or more sizes smaller', () => {
    const doubles = (mover: string | null, held: string | null) => {
      const planned = drag({ sizes: { [MOVER.actorId]: mover, [HELD.actorId]: held } })
      return planned.kind === 'DRAG' && planned.doublesCost
    }
    expect(doubles('LARGE', 'MEDIUM')).toBe(true)
    expect(doubles('LARGE', 'SMALL')).toBe(false)
    expect(doubles('HUGE', 'TINY')).toBe(false)
    // An unknown size counts as not smaller.
    expect(doubles('LARGE', null)).toBe(true)
    expect(doubles(null, 'TINY')).toBe(true)
  })

  it('refuses a drag whose dragged creature leaves the map, hits a wall or lands on a token', () => {
    expect(
      drag({
        path: [
          { x: 150, y: 50 },
          { x: 100, y: 50 }
        ]
      }).kind
    ).toBe('DRAG')
    // Dragged 100 left of the mover, the held creature would leave the map.
    expect(
      drag({
        path: [
          { x: 150, y: 50 },
          { x: 50, y: 50 }
        ]
      }).kind
    ).toBe('REFUSED')
    const wall = {
      id: testUuid(0xd750),
      kind: 'WALL' as const,
      a: { x: 200, y: 0 },
      b: { x: 200, y: 100 },
      blocksLight: true,
      blocksMovement: true
    }
    // The mover walks from 150 to 350; the held creature from 50 to 250 crosses the wall at 200.
    expect(drag({ scene: { ...scene, barriers: [wall] }, path: walk(350) }).kind).toBe('REFUSED')
    // The held creature would land on the other token at 750.
    expect(drag({ path: walk(850) }).kind).toBe('REFUSED')
  })

  it('refuses a drag through a Scene effect that can catch the dragged creature', () => {
    // The held creature, 100 behind, walks 50 to 350 and stays clear of the zone at 400 to 500.
    expect(drag({ effects: [zone()], path: walk(450) }).kind).toBe('DRAG')
    // Walking 50 to 450, its footprint enters the zone.
    expect(drag({ effects: [zone()], path: walk(550) }).kind).toBe('REFUSED')
    // A zone that never catches the dragged creature does not refuse.
    expect(
      drag({ effects: [zone({ unaffectedActorIds: [HELD.actorId] })], path: walk(550) }).kind
    ).toBe('DRAG')
    // An aura carried by the mover keeps its place relative to the dragged creature.
    const aura = zone({
      anchorKind: 'TOKEN',
      sourceTokenId: MOVER.tokenId,
      geometry: {
        frame: 'TOKEN_LOCAL',
        shape: { kind: 'CIRCLE', center: { x: 0, y: 0 }, radius: 150 }
      }
    })
    expect(drag({ effects: [aura], path: walk(550) }).kind).toBe('DRAG')
  })
})
