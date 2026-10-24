import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { describe, expect, it } from 'vitest'

import { encounterMovementDrag } from '../encounterMovementDrag.js'
import { encounterTokenOccupiesSpace, summonBody } from '../encounterActorBody.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import { ENCOUNTER_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { activeEffect } from './encounterActiveEffectFixtures.js'
import { zoneToken } from './spatialZoneFixture.js'

type RelationshipModule = Extract<
  Extract<ActiveRuleEffectRecord['definition'], { schemaVersion: 2 }>['stateContributions'][number],
  { kind: 'ACTOR_RELATIONSHIP' }
>['modules'][number]

const MOVER = { actorId: testUuid(0xd701), tokenId: testUuid(0xd711) }
const HELD = { actorId: testUuid(0xd702), tokenId: testUuid(0xd712) }
const HELD_TWO = { actorId: testUuid(0xd704), tokenId: testUuid(0xd714) }
const OTHER = { actorId: testUuid(0xd703), tokenId: testUuid(0xd713) }
const dragged: RelationshipModule = { id: testUuid(0xd720), order: 0, kind: 'TARGET_DRAGGED' }
const occupiesHand: RelationshipModule = {
  id: testUuid(0xd721),
  order: 0,
  kind: 'SOURCE_OCCUPIES_HAND'
}

/** `sourceActorId` holds `held` through a relationship carrying `modules`. */
function holds(sourceActorId: string, modules: RelationshipModule[], held = HELD) {
  return new Map([
    [
      held.actorId,
      [
        activeEffect({
          id: testUuid(0xd730 + (held === HELD ? 0 : 0x100)),
          owner: {
            kind: 'ENCOUNTER_ACTOR',
            encounterId: ENCOUNTER_ID,
            targetActorId: held.actorId
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
  [MOVER, HELD, HELD_TWO, OTHER].map((entry) => [entry.tokenId, entry.actorId])
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
    gameSystemId: DND5E_SYSTEM_ID,
    scene,
    mover: MOVER,
    actorIdByTokenId,
    activeEffectsByActorId: holds(MOVER.actorId, [occupiesHand, dragged]),
    sizeOf: (actorId) => sizes[actorId] ?? null,
    occupiesSpace: encounterTokenOccupiesSpace([], actorIdByTokenId),
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

  it('drags a creature onto a summon that does not occupy its space (SPELLS-4.T2v2a3c)', () => {
    const summon = (occupiesSpace: boolean) => [
      { id: OTHER.actorId, snapshot: { kind: 'CUSTOM', body: summonBody({ occupiesSpace }) } }
    ]
    const onto = (occupiesSpace: boolean) =>
      drag({
        path: walk(850),
        occupiesSpace: encounterTokenOccupiesSpace(summon(occupiesSpace), actorIdByTokenId)
      }).kind
    expect(onto(false)).toBe('DRAG')
    expect(onto(true)).toBe('REFUSED')
  })

  it('does not refuse a drag for the Scene effects on its way: they settle in the spatial pass (SPELLS-4.T1k)', () => {
    // The held creature, 100 behind, walks 50 to 450 across a zone at 400 to 500 in the Scene.
    expect(drag({ path: walk(550) }).kind).toBe('DRAG')
  })

  it('prices a mixed-size pair of holds together: one creature that is not small enough doubles the move', () => {
    const both = new Map([
      ...holds(MOVER.actorId, [occupiesHand, dragged]),
      ...holds(MOVER.actorId, [occupiesHand, dragged], HELD_TWO)
    ])
    const planned = (mover: string, held: string, heldTwo: string) =>
      drag({
        scene: {
          ...scene,
          tokens: [...scene.tokens, zoneToken(HELD_TWO.tokenId, 'Held two', 350)]
        },
        activeEffectsByActorId: both,
        path: walk(200),
        sizes: { [MOVER.actorId]: mover, [HELD.actorId]: held, [HELD_TWO.actorId]: heldTwo }
      })
    expect(planned('LARGE', 'TINY', 'MEDIUM')).toEqual({
      kind: 'DRAG',
      tokens: [
        { tokenId: HELD.tokenId, actorId: HELD.actorId },
        { tokenId: HELD_TWO.tokenId, actorId: HELD_TWO.actorId }
      ],
      doublesCost: true
    })
    // Each creature is judged on its own size: with both two sizes smaller the move is full speed.
    expect(planned('LARGE', 'TINY', 'SMALL')).toMatchObject({ doublesCost: false })
    // The order of the holds does not matter.
    expect(planned('LARGE', 'MEDIUM', 'TINY')).toMatchObject({ doublesCost: true })
  })
})
