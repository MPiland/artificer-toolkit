import type { SpatialEffectInstance, SpatialSceneToken } from '@artificer-toolkit/shared/vtt'
import { describe, expect, it } from 'vitest'

import {
  zoneMeleeRetaliationContacts,
  zoneMovementContacts,
  zoneTurnContacts
} from '../encounterZoneContacts.js'

// Moved from packages/shared/src/__tests__/vtt-spatial.test.ts (RULES-2.T5d): the shared
// collectors report contact facts only, and the event table decides which zones act on them.

const ids = {
  effect: '00000000-0000-4000-8000-000000000001',
  sourceActor: '00000000-0000-4000-8000-000000000003',
  sourceToken: '00000000-0000-4000-8000-000000000004',
  targetActor: '00000000-0000-4000-8000-000000000005',
  targetToken: '00000000-0000-4000-8000-000000000006'
}

const actorIdByTokenId = new Map([
  [ids.sourceToken, ids.sourceActor],
  [ids.targetToken, ids.targetActor]
])

function token(id: string, x: number, y = 0): SpatialSceneToken {
  return { height: 2, id, position: { x, y }, width: 2 }
}

function effect(overrides: Partial<SpatialEffectInstance> = {}): SpatialEffectInstance {
  return {
    anchorKind: 'FIXED',
    effectId: ids.effect,
    geometry: {
      frame: 'SCENE_ABSOLUTE',
      shape: { kind: 'CIRCLE', center: { x: 0, y: 0 }, radius: 1 }
    },
    movementKinds: ['VOLUNTARY', 'FORCED', 'TELEPORT'],
    sourceActorId: ids.sourceActor,
    sourceTokenId: null,
    triggerModes: ['ENTER', 'EXIT', 'CROSS'],
    ...overrides
  }
}

function collect(
  input: Omit<
    Parameters<typeof zoneMovementContacts>[0],
    'actorIdByTokenId' | 'effects' | 'grid' | 'tokens' | 'movingTokenId' | 'turnSequence'
  > & {
    readonly effects?: readonly SpatialEffectInstance[]
    readonly tokens?: readonly SpatialSceneToken[]
  }
) {
  return zoneMovementContacts({
    actorIdByTokenId,
    effects: input.effects ?? [effect()],
    movingTokenId: ids.targetToken,
    tokens: input.tokens ?? [token(ids.targetToken, input.path[0]!.x, input.path[0]!.y)],
    grid: { kind: 'GRIDLESS', pixelsPerUnit: 1, unit: 'FEET' },
    ...input,
    turnSequence: 1
  })
}

describe('zone movement contacts', () => {
  it('fails closed for a missing source token and filters unsupported movement or trigger kinds', () => {
    const missingSource = effect({
      anchorKind: 'TOKEN',
      geometry: {
        frame: 'TOKEN_LOCAL',
        shape: { kind: 'CIRCLE', center: { x: 0, y: 0 }, radius: 1 }
      },
      sourceTokenId: ids.sourceToken
    })
    const filtered = effect({ movementKinds: ['VOLUNTARY'], triggerModes: ['EXIT'] })
    expect(
      collect({
        effects: [missingSource],
        movementKind: 'VOLUNTARY',
        path: [
          { x: -5, y: 0 },
          { x: 0, y: 0 }
        ]
      })
    ).toEqual([])
    expect(
      collect({
        effects: [filtered],
        movementKind: 'FORCED',
        path: [
          { x: 0, y: 0 },
          { x: 5, y: 0 }
        ]
      })
    ).toEqual([])
    expect(
      collect({
        effects: [filtered],
        movementKind: 'VOLUNTARY',
        path: [
          { x: -5, y: 0 },
          { x: 5, y: 0 }
        ]
      })
    ).toEqual([])
  })

  describe('per distance moved (SPELLS-4.T1h, D156)', () => {
    const field = effect({
      distanceStep: 5,
      geometry: {
        frame: 'SCENE_ABSOLUTE',
        shape: {
          kind: 'POLYGON',
          points: [
            { x: 0, y: -30 },
            { x: 30, y: -30 },
            { x: 30, y: 30 },
            { x: 0, y: 30 }
          ]
        }
      },
      triggerModes: ['ENTER', 'CROSS']
    })
    const walk = (to: number, from = 10) => [
      { x: from, y: 0 },
      { x: to, y: 0 }
    ]

    it('raises nothing for a teleport, or for a component that does not act on entering', () => {
      const exitOnly = { ...field, triggerModes: ['EXIT'] as const }

      expect(collect({ effects: [field], movementKind: 'TELEPORT', path: walk(25) })).toEqual([])
      expect(collect({ effects: [exitOnly], movementKind: 'VOLUNTARY', path: walk(25) })).toEqual(
        []
      )
    })
  })
})

describe('zone turn contacts', () => {
  const collectTurn = (
    input: Partial<Parameters<typeof zoneTurnContacts>[0]> & {
      readonly targetAt?: number
    } = {}
  ) =>
    zoneTurnContacts({
      actorIdByTokenId,
      effects: [effect({ turnTriggers: ['START_OF_TURN', 'END_OF_TURN'] })],
      targetTokenId: ids.targetToken,
      tokens: [token(ids.targetToken, input.targetAt ?? 0)],
      trigger: 'START_OF_TURN',
      turnSequence: 1,
      ...input
    })

  it('catches a creature inside the area at a trigger the effect has, with the effect facts', () => {
    expect(collectTurn()).toEqual([
      {
        effectId: ids.effect,
        sourceActorId: ids.sourceActor,
        targetActorId: ids.targetActor,
        trigger: 'START_OF_TURN'
      }
    ])
    expect(collectTurn({ trigger: 'END_OF_TURN' })).toHaveLength(1)
  })

  it.each([
    ['at a boundary the effect lacks', { effects: [effect({ turnTriggers: ['END_OF_TURN'] })] }],
    ['for an effect without turn triggers', { effects: [effect()] }]
  ])('catches nothing: %s', (_name, input) => {
    expect(collectTurn(input)).toEqual([])
  })
})

describe('zone melee retaliation contacts (D153)', () => {
  const sourceZone = (overrides: Partial<SpatialEffectInstance> = {}) =>
    effect({
      anchorKind: 'TOKEN',
      sourceTokenId: ids.sourceToken,
      geometry: {
        frame: 'TOKEN_LOCAL',
        shape: { kind: 'CIRCLE', center: { x: 0, y: 0 }, radius: 3 }
      },
      triggerModes: [],
      retaliatesMeleeHits: true,
      ...overrides
    })
  const collectMelee = (
    input: Partial<Parameters<typeof zoneMeleeRetaliationContacts>[0]> & {
      readonly attackerAt?: number
    } = {}
  ) =>
    zoneMeleeRetaliationContacts({
      actorIdByTokenId,
      effects: [sourceZone()],
      attackerTokenId: ids.targetToken,
      hitTokenId: ids.sourceToken,
      tokens: [token(ids.sourceToken, 0), token(ids.targetToken, input.attackerAt ?? 3)],
      ...input
    })

  it('catches the attacker inside the hit creature’s retaliating zone, the zone’s source its source', () => {
    expect(collectMelee()).toEqual([
      { effectId: ids.effect, sourceActorId: ids.sourceActor, targetActorId: ids.targetActor }
    ])
  })

  it('raises no movement or turn candidate for a zone that only retaliates', () => {
    const tokens = [token(ids.sourceToken, 0), token(ids.targetToken, 3)]
    expect(
      zoneMovementContacts({
        actorIdByTokenId,
        grid: { kind: 'GRIDLESS', pixelsPerUnit: 1, unit: 'FEET' },
        effects: [sourceZone()],
        movementKind: 'VOLUNTARY',
        path: [
          { x: 10, y: 0 },
          { x: 3, y: 0 }
        ],
        tokens,
        movingTokenId: ids.targetToken,
        turnSequence: 1
      })
    ).toEqual([])
    expect(
      zoneTurnContacts({
        actorIdByTokenId,
        effects: [sourceZone()],
        targetTokenId: ids.targetToken,
        tokens,
        trigger: 'START_OF_TURN',
        turnSequence: 1
      })
    ).toEqual([])
  })
})
