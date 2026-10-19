import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import { spatialRuleEffectPlacementDtoSchema } from '@artificer-toolkit/schema/shared/spatial'
import { describe, expect, it } from 'vitest'

import {
  preparedMovementCost,
  preparedMovementSceneDelta,
  preparedMovementSegment
} from '../encounterMovementPublication.js'
import { toSpatialInstances } from '../encounterSpatialCandidateExecution.js'

const tokenId = '00000000-0000-4000-8000-000000000001'
const actorId = '00000000-0000-4000-8000-000000000011'
const casterActorId = '00000000-0000-4000-8000-000000000012'

/**
 * The zones as the movement cost reads them, from records reduced to the fields it uses, cast by
 * `casterActorId`. A record with no maintained state is a passive zone.
 */
function spatialInstances(
  effects: readonly (Pick<EncounterSpatialRuleEffectRecord, 'placement' | 'spatialState'> &
    Partial<Pick<EncounterSpatialRuleEffectRecord, 'maintainedEffectStateId'>>)[],
  actors: readonly EncounterRunActorState[] = []
) {
  return toSpatialInstances(
    effects.map(
      (effect, index) =>
        ({
          id: `00000000-0000-4000-8000-0000000001${index}0`,
          maintainedEffectStateId: '00000000-0000-4000-8000-000000000200',
          definition: { origin: { kind: 'ENCOUNTER', sourceActorId: casterActorId } },
          ...effect
        }) as unknown as EncounterSpatialRuleEffectRecord
    ),
    actors
  )
}
const path = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 50 }
]

describe('prepared movement publication', () => {
  it('measures a segment from the path origin, so a mid-cell pause does not round twice', () => {
    const grid = {
      kind: 'SQUARE' as const,
      origin: { x: 0, y: 0 },
      cellSize: 100,
      distancePerCell: 5,
      diagonalPolicy: 'EQUAL' as const,
      unit: 'FEET' as const
    }
    const walk = {
      grid,
      scene: { barriers: [] },
      path: [
        { x: 0, y: 0 },
        { x: 300, y: 0 }
      ]
    }
    // A pause half a cell in rounds to one cell; the rest of the walk then costs two.
    expect(preparedMovementCost({ ...walk, startDistance: 50, outcome: null })).toBe(10)
    expect(preparedMovementCost({ ...walk, startDistance: 0, outcome: null })).toBe(15)
  })

  it('charges a careful mover double for the stretch it spends in a half-speed field', () => {
    const grid = {
      kind: 'SQUARE' as const,
      origin: { x: 0, y: 0 },
      cellSize: 100,
      distancePerCell: 5,
      diagonalPolicy: 'EQUAL' as const,
      unit: 'FEET' as const
    }
    const field = (
      bypassAtHalfSpeed: boolean,
      visibility: 'PUBLIC' | 'HIDDEN' = 'PUBLIC',
      revealed = true
    ) => ({
      spatialState: { schemaVersion: 1 as const, revealed },
      placement: spatialRuleEffectPlacementDtoSchema.parse({
        schemaVersion: 1,
        anchorKind: 'FIXED',
        sourceTokenId: null,
        geometry: {
          frame: 'SCENE_ABSOLUTE',
          shape: {
            kind: 'POLYGON',
            points: [
              { x: 100, y: -100 },
              { x: 200, y: -100 },
              { x: 200, y: 100 },
              { x: 100, y: 100 }
            ]
          }
        },
        triggerModes: ['ENTER'],
        movementKinds: ['VOLUNTARY'],
        activation: 'REPEATABLE',
        visibility,
        revealOnTrigger: false,
        bypassAtHalfSpeed
      })
    })
    const walk = {
      grid,
      scene: { barriers: [] },
      path: [
        { x: 0, y: 0 },
        { x: 400, y: 0 }
      ],
      startDistance: 0,
      outcome: null
    }
    const tokens = [{ id: tokenId, position: { x: 0, y: 0 }, width: 100, height: 100 }]
    const careful = (
      flagged: boolean,
      visibility: 'PUBLIC' | 'HIDDEN' = 'PUBLIC',
      revealed = true
    ) => ({
      tokenId,
      actorId,
      tokens,
      effects: spatialInstances([field(flagged, visibility, revealed)]),
      carefully: true
    })
    const plain = preparedMovementCost(walk)
    expect(plain).toBe(20)
    expect(preparedMovementCost({ ...walk, mover: careful(false) })).toBe(plain)
    expect(preparedMovementCost({ ...walk, mover: { ...careful(true), carefully: false } })).toBe(
      plain
    )
    // A hidden field the mover has not seen cannot be crossed carefully: no doubled cost.
    expect(preparedMovementCost({ ...walk, mover: careful(true, 'HIDDEN', false) })).toBe(plain)
    expect(preparedMovementCost({ ...walk, mover: careful(true, 'HIDDEN', true) })).toBeCloseTo(30)
    // The 100-wide footprint overlaps the field while its centre is between x=50 and x=250: half
    // of the 400-unit walk, so that half costs double.
    expect(preparedMovementCost({ ...walk, mover: careful(true) })).toBeCloseTo(30)

    // SPELLS-4.T1b (D154): a zone's movement cost applies to every mover for the stretch inside it,
    // and the highest of the terrain, zone and careful multipliers applies, never their product.
    const costly = (movementCostMultiplier: number) => ({
      ...field(true),
      placement: { ...field(true).placement, movementCostMultiplier }
    })
    const mover = (effect: ReturnType<typeof costly>, carefully: boolean) => ({
      tokenId,
      actorId,
      tokens,
      effects: spatialInstances([effect]),
      carefully
    })
    expect(preparedMovementCost({ ...walk, mover: mover(costly(4), false) })).toBeCloseTo(10 + 40)
    expect(preparedMovementCost({ ...walk, mover: mover(costly(4), true) })).toBeCloseTo(10 + 40)
    expect(preparedMovementCost({ ...walk, mover: mover(costly(1.5), true) })).toBeCloseTo(30)
    const terrain = {
      barriers: [
        {
          a: { x: 150, y: -100 },
          b: { x: 150, y: 100 },
          id: '00000000-0000-4000-8000-000000000002',
          kind: 'TERRAIN' as const,
          movementCostMultiplier: 3
        }
      ]
    }
    // Terrain 3 on the whole segment outranks the careful doubling; nothing multiplies.
    expect(preparedMovementCost({ ...walk, scene: terrain, mover: careful(true) })).toBeCloseTo(60)

    // ATTACK-7.T7 (D105): a drag doubles the whole cost on top of the highest multiplier, so
    // dragging through difficult terrain costs four times as much.
    const dragging = (effect: ReturnType<typeof costly>) => ({
      ...mover(effect, false),
      dragDoublesCost: true
    })
    expect(preparedMovementCost({ ...walk, mover: dragging(costly(1)) })).toBe(plain * 2)
    expect(preparedMovementCost({ ...walk, mover: dragging(costly(4)) })).toBeCloseTo((10 + 40) * 2)
    const difficult = {
      barriers: [{ ...terrain.barriers[0]!, movementCostMultiplier: 2 }]
    }
    expect(
      preparedMovementCost({ ...walk, scene: difficult, mover: dragging(costly(1)) })
    ).toBeCloseTo(plain * 4)
    expect(
      preparedMovementCost({
        ...walk,
        scene: difficult,
        mover: { ...dragging(costly(1)), dragDoublesCost: false }
      })
    ).toBeCloseTo(plain * 2)
  })

  it('charges a zone’s movement cost only to the movers it catches (SPELLS-20 T4d)', () => {
    const grid = {
      kind: 'SQUARE' as const,
      origin: { x: 0, y: 0 },
      cellSize: 100,
      distancePerCell: 5,
      diagonalPolicy: 'EQUAL' as const,
      unit: 'FEET' as const
    }
    const casterTokenId = '00000000-0000-4000-8000-000000000002'
    const walk = {
      grid,
      scene: { barriers: [] },
      path: [
        { x: 0, y: 0 },
        { x: 400, y: 0 }
      ],
      startDistance: 0,
      outcome: null
    }
    const moverToken = { id: tokenId, position: { x: 0, y: 0 }, width: 100, height: 100 }
    const casterToken = { id: casterTokenId, position: { x: 200, y: 0 }, width: 100, height: 100 }
    const zone = (anchor: 'TOKEN' | 'FIXED', unaffectedActorIds?: string[]) => ({
      spatialState: { schemaVersion: 1 as const, revealed: true },
      placement: spatialRuleEffectPlacementDtoSchema.parse({
        schemaVersion: 1,
        anchorKind: anchor,
        sourceTokenId: anchor === 'TOKEN' ? casterTokenId : null,
        geometry: {
          frame: anchor === 'TOKEN' ? 'TOKEN_LOCAL' : 'SCENE_ABSOLUTE',
          shape: {
            kind: 'CIRCLE',
            center: anchor === 'TOKEN' ? { x: 0, y: 0 } : { x: 200, y: 0 },
            radius: 50
          }
        },
        triggerModes: ['ENTER'],
        movementKinds: ['VOLUNTARY'],
        activation: 'REPEATABLE',
        visibility: 'PUBLIC',
        revealOnTrigger: false,
        movementCostMultiplier: 2,
        ...(unaffectedActorIds ? { unaffectedActorIds } : {})
      })
    })
    const cost = (
      effects: Parameters<typeof spatialInstances>[0],
      mover: { tokenId: string; actorId: string } = { tokenId, actorId },
      actors: readonly EncounterRunActorState[] = []
    ) =>
      preparedMovementCost({
        ...walk,
        mover: {
          ...mover,
          tokens: [
            { ...moverToken, id: mover.tokenId },
            ...(mover.tokenId === casterTokenId ? [] : [casterToken])
          ],
          effects: spatialInstances(effects, actors),
          carefully: false
        }
      })
    // The footprint overlaps the caster's 50-radius aura for half the 400-unit walk.
    expect(cost([zone('TOKEN')])).toBeCloseTo(30)
    expect(cost([zone('TOKEN', [actorId])])).toBe(20)
    // The aura moves with its caster's token, so it never slows the caster.
    expect(cost([zone('TOKEN')], { tokenId: casterTokenId, actorId: casterActorId })).toBe(20)
    // A zone the caster placed still slows the caster.
    expect(cost([zone('FIXED')], { tokenId, actorId: casterActorId })).toBeCloseTo(30)
    // A passive aura rests while its Creature source is defeated.
    const passive = { ...zone('TOKEN'), maintainedEffectStateId: null }
    const caster = (defeated: boolean) =>
      [{ id: casterActorId, kind: 'CREATURE', defeated }] as unknown as EncounterRunActorState[]
    expect(cost([passive], undefined, caster(false))).toBeCloseTo(30)
    expect(cost([passive], undefined, caster(true))).toBe(20)
  })

  it('walks the whole remaining path when no rules interrupt it', () => {
    expect(preparedMovementSegment({ path, startDistance: 0, outcome: null })).toEqual({
      path,
      position: { x: 100, y: 50 }
    })
    expect(
      preparedMovementSegment({
        path,
        startDistance: 50,
        outcome: { kind: 'UNINTERRUPTED', reason: 'NO_CANDIDATES' }
      })
    ).toEqual({
      path: [
        { x: 50, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 }
      ],
      position: { x: 100, y: 50 }
    })
  })

  it('publishes an unbound or uninterrupted move to the end of its path', () => {
    for (const outcome of [null, { kind: 'UNINTERRUPTED' as const, reason: 'MANUAL' as const }])
      expect(preparedMovementSceneDelta({ tokenId, path, outcome, sceneVersion: 4 })).toEqual({
        kind: 'TOKEN_MOVED',
        tokenId,
        position: { x: 100, y: 50 }
      })
  })

  it('publishes a drag as one batch: the mover, then each dragged token (D105)', () => {
    const draggedTokenId = '00000000-0000-4000-8000-000000000003'
    const draggedTokens = [
      { tokenId: draggedTokenId, from: { x: 100, y: 0 }, to: { x: 200, y: 50 } }
    ]
    expect(
      preparedMovementSceneDelta({ tokenId, path, outcome: null, sceneVersion: 4, draggedTokens })
    ).toEqual({
      kind: 'BATCH',
      deltas: [
        { kind: 'TOKEN_MOVED', tokenId, position: { x: 100, y: 50 } },
        { kind: 'TOKEN_MOVED', tokenId: draggedTokenId, position: { x: 200, y: 50 } }
      ]
    })
  })
})
