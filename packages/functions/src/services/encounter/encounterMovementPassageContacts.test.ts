import { describe, expect, it } from 'vitest'

import { discoverEncounterMovementPassageContact } from './encounterMovementPassageContacts.js'

const ids = {
  movingActor: '00000000-0000-4000-8000-000000000101',
  movingToken: '00000000-0000-4000-8000-000000000102',
  nearActor: '00000000-0000-4000-8000-000000000103',
  nearToken: '00000000-0000-4000-8000-000000000104',
  farActor: '00000000-0000-4000-8000-000000000105',
  farToken: '00000000-0000-4000-8000-000000000106'
} as const

function input() {
  const tokens = [
    { id: ids.movingToken, position: { x: 0, y: 0 }, width: 2, height: 2 },
    { id: ids.nearToken, position: { x: 5, y: 0 }, width: 2, height: 2 },
    { id: ids.farToken, position: { x: 11, y: 0 }, width: 4, height: 4 }
  ]
  return {
    actorIdByTokenId: new Map([
      [ids.movingToken, ids.movingActor],
      [ids.nearToken, ids.nearActor],
      [ids.farToken, ids.farActor]
    ]),
    isHostile: ({ blockerActorId }: { blockerActorId: string }) => blockerActorId !== ids.farActor,
    movementKind: 'VOLUNTARY' as const,
    movingTokenId: ids.movingToken,
    path: [
      { x: 0, y: 0 },
      { x: 20, y: 0 }
    ],
    tokens
  }
}

describe('Encounter movement passage contacts', () => {
  it('returns the first hostile full-footprint crossing in deterministic order', () => {
    expect(discoverEncounterMovementPassageContact(input())).toEqual({
      kind: 'CROSSING',
      contact: {
        blockerActorId: ids.nearActor,
        blockerTokenId: ids.nearToken,
        contact: { x: 3, y: 0 },
        pathDistance: 3
      },
      laterContacts: []
    })
  })

  it('retains later hostile contacts in canonical path order', () => {
    const value = input()
    value.isHostile = () => true
    expect(discoverEncounterMovementPassageContact(value)).toMatchObject({
      kind: 'CROSSING',
      contact: { blockerActorId: ids.nearActor, pathDistance: 3 },
      laterContacts: [{ blockerActorId: ids.farActor, pathDistance: 8 }]
    })
  })

  it('does not open passage for forced movement or teleport', () => {
    expect(discoverEncounterMovementPassageContact({ ...input(), movementKind: 'FORCED' })).toEqual(
      { kind: 'NONE' }
    )
    expect(
      discoverEncounterMovementPassageContact({ ...input(), movementKind: 'TELEPORT' })
    ).toEqual({ kind: 'NONE' })
  })

  it('rejects an endpoint inside any hostile occupied footprint', () => {
    const value = input()
    value.path = [
      { x: 0, y: 0 },
      { x: 5, y: 0 }
    ]
    expect(discoverEncounterMovementPassageContact(value)).toEqual({
      kind: 'ENDPOINT_OCCUPIED',
      blockerActorIds: [ids.nearActor]
    })
  })

  it('allows an endpoint exactly at the last legal occupied-footprint boundary', () => {
    const value = input()
    value.path = [
      { x: 0, y: 0 },
      { x: 3, y: 0 }
    ]
    expect(discoverEncounterMovementPassageContact(value)).toEqual({ kind: 'NONE' })
  })

  it('uses large footprints and ignores non-hostile blockers', () => {
    const value = input()
    value.isHostile = () => true
    expect(discoverEncounterMovementPassageContact(value)).toMatchObject({
      kind: 'CROSSING',
      contact: { blockerActorId: ids.nearActor, pathDistance: 3 }
    })
  })
})
