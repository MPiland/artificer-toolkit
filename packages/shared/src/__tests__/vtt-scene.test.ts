import { describe, expect, it } from 'vitest'

import {
  createSceneFogAreaPatch,
  applySceneDelta,
  applySceneEvent,
  canMoveBetween,
  createUniformSceneFogLayer,
  deriveSceneExplorationPatch,
  deriveSceneCommandExplorationDeltas,
  deriveSceneTokenPathExplorationPatch,
  extendSceneMovementPath,
  isSceneTokenVisibleToViewer,
  isSceneFogCellExplored,
  isScenePointExplored,
  isSceneSegmentExplored,
  materializeCampaignScene,
  planSceneCommandExploration,
  projectSceneDeltaForViewer,
  projectSceneTokenPreviewForViewer,
  measureSceneDistance,
  measureScenePathDistance,
  measureSceneMovementCost,
  projectSceneForViewer,
  replaySceneEvents,
  resolveSceneCharacterVision,
  sceneDeltaConflictKeys,
  sceneTokenIdsAffectedByBarriers,
  SceneBarrierIndex,
  segmentsIntersect,
  unionScenePolygons,
  visibilityPolygon,
  visibilityPolygonForLight,
  type SceneDefinition,
  type SceneExplorationState,
  type SceneEvent
} from '../domains/vtt/index.js'

const ids = {
  annotation: '00000000-0000-4000-8000-000000000001',
  campaign: '00000000-0000-4000-8000-000000000002',
  command1: '00000000-0000-4000-8000-000000000003',
  command2: '00000000-0000-4000-8000-000000000004',
  definition: '00000000-0000-4000-8000-000000000005',
  door: '00000000-0000-4000-8000-000000000006',
  encounter: '00000000-0000-4000-8000-000000000007',
  map: '00000000-0000-4000-8000-000000000008',
  player: '00000000-0000-4000-8000-000000000009',
  scene: '00000000-0000-4000-8000-000000000010',
  token: '00000000-0000-4000-8000-000000000011',
  user: '00000000-0000-4000-8000-000000000012',
  wall: '00000000-0000-4000-8000-000000000013'
} as const

function definition(): SceneDefinition {
  return {
    annotations: [
      {
        id: ids.annotation,
        position: { x: 30, y: 30 },
        text: 'GM only',
        visibility: 'GM_ONLY'
      }
    ],
    ambientIllumination: 'BRIGHT',
    barriers: [
      {
        a: { x: 10, y: 0 },
        b: { x: 10, y: 20 },
        blocksLightWhenClosed: true,
        blocksMovementWhenClosed: true,
        id: ids.door,
        initialState: 'CLOSED',
        kind: 'DOOR',
        openAngleDegrees: 90
      },
      {
        a: { x: 20, y: 0 },
        b: { x: 20, y: 20 },
        blocksLight: true,
        blocksMovement: true,
        id: ids.wall,
        kind: 'WALL'
      }
    ],
    campaignId: ids.campaign,
    darknessZones: [],
    fogMode: 'PER_PLAYER',
    grid: {
      cellSize: 50,
      diagonalPolicy: 'ALTERNATING',
      distancePerCell: 5,
      kind: 'SQUARE',
      origin: { x: 0, y: 0 },
      unit: 'FEET'
    },
    id: ids.definition,
    lights: [],
    map: { assetId: ids.map, height: 1_000, tileManifestAssetId: null, width: 1_000 },
    name: 'Test scene',
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
        vision: null,
        width: 1
      }
    ],
    version: 3,
    visionRevealMode: 'ON_DRAG'
  }
}

it('derives command fog from geometry alone while preserving pinned and explicit token vision', () => {
  const full = materializeCampaignScene(definition(), ids.scene)
  const state: SceneExplorationState = {
    map: full.map,
    grid: full.grid,
    tokens: full.tokens,
    barriers: full.barriers,
    doorStates: full.doorStates,
    fogMode: full.fogMode,
    fogLayers: full.fogLayers
  }
  const before = structuredClone(state)
  const context = {
    encounterCharacterBindings: [
      { actorId: ids.encounter, characterId: ids.user, tokenId: ids.token }
    ],
    characterVisions: [{ characterId: ids.user, dimRange: { amount: 30, unit: 'FEET' as const } }]
  }
  const after = { ...state, barriers: state.barriers.filter((barrier) => barrier.id !== ids.door) }
  const deltas = deriveSceneCommandExplorationDeltas(
    state,
    after,
    { kind: 'BARRIER_REMOVED', barrierId: ids.door },
    context
  )
  expect(deltas).toHaveLength(1)
  expect(deltas[0]).toMatchObject({
    kind: 'FOG_CHUNKS_PATCHED',
    layer: { ownerUserId: ids.player }
  })
  expect(deltas).toEqual(
    deriveSceneCommandExplorationDeltas(
      full,
      { ...full, barriers: after.barriers },
      { kind: 'BARRIER_REMOVED', barrierId: ids.door },
      context
    )
  )
  expect(state).toEqual(before)
  const disabled = {
    ...after,
    tokens: after.tokens.map((token) => ({
      ...token,
      vision: {
        enabled: false,
        brightRange: 0,
        dimRange: 0,
        angleDegrees: 360,
        directionDegrees: 0
      }
    }))
  }
  expect(
    deriveSceneCommandExplorationDeltas(
      state,
      disabled,
      { kind: 'TOKEN_UPSERTED', token: disabled.tokens[0]! },
      context
    )
  ).toEqual([])
  expect(
    deriveSceneCommandExplorationDeltas(
      state,
      after,
      { kind: 'TOKEN_REMOVED', tokenId: ids.token },
      context
    )
  ).toEqual([])
})

it('plans recipients without fog and matches command exploration one recipient at a time', () => {
  const full = materializeCampaignScene(definition(), ids.scene)
  const geometry = {
    map: full.map,
    grid: full.grid,
    tokens: full.tokens.map((token) => ({
      ...token,
      controlledByUserIds: [ids.player, ids.user, ids.player]
    })),
    barriers: full.barriers,
    doorStates: full.doorStates,
    fogMode: full.fogMode
  }
  const before = structuredClone(geometry)
  const context = {
    encounterCharacterBindings: [
      { actorId: ids.encounter, characterId: ids.user, tokenId: ids.token }
    ],
    characterVisions: [{ characterId: ids.user, dimRange: { amount: 30, unit: 'FEET' as const } }]
  }
  const delta = { kind: 'DOOR_STATE_SET' as const, barrierId: ids.door, state: 'OPEN' as const }
  const opened = { ...geometry, doorStates: { ...geometry.doorStates, [ids.door]: delta.state } }
  const plan = planSceneCommandExploration(geometry, opened, delta, context)
  expect(plan.owners).toEqual([ids.player, ids.user])
  expect(plan.tokenIds).toEqual([ids.token])
  expect(plan.state).not.toHaveProperty('fogLayers')
  const explored = deriveSceneExplorationPatch(
    { ...plan.state, fogLayers: [] },
    { ownerUserId: ids.player, tokenIds: plan.tokenIds }
  )!
  expect(explored.chunks.length).toBeGreaterThan(0)
  const fogLayers = [explored]
  const withFog = { ...full, ...opened, fogLayers }
  const fromFullState = planSceneCommandExploration(geometry, withFog, delta, context)
  expect(fromFullState.state).not.toHaveProperty('fogLayers')
  expect(fromFullState.state).not.toHaveProperty('annotations')
  expect(fromFullState).toEqual(plan)
  const separatelyDerived = plan.owners.flatMap((ownerUserId) => {
    const layer = deriveSceneExplorationPatch(
      { ...plan.state, fogLayers: fogLayers.filter((layer) => layer.ownerUserId === ownerUserId) },
      { ownerUserId, tokenIds: plan.tokenIds }
    )
    return layer ? [{ kind: 'FOG_CHUNKS_PATCHED', layer }] : []
  })
  expect(separatelyDerived).toHaveLength(1)
  expect(separatelyDerived[0]?.layer.ownerUserId).toBe(ids.user)
  expect(separatelyDerived).toEqual(
    deriveSceneCommandExplorationDeltas(geometry, { ...opened, fogLayers }, delta, context)
  )
  expect(
    planSceneCommandExploration(geometry, { ...opened, fogMode: 'SHARED_PARTY' }, delta, context)
      .owners
  ).toEqual([null])
  expect(
    planSceneCommandExploration(
      geometry,
      opened,
      { kind: 'TOKEN_REMOVED', tokenId: ids.token },
      context
    ).owners
  ).toEqual([])
  expect(geometry).toEqual(before)
})

it('selects tokens near both the previous and replacement barrier', () => {
  const state = materializeCampaignScene(definition(), ids.scene)
  state.grid = { kind: 'GRIDLESS', pixelsPerUnit: 1, unit: 'FEET' }
  const wall = state.barriers.find((barrier) => barrier.id === ids.wall)!
  const priorBarrier = { ...wall, a: { x: 35, y: 20 }, b: { x: 35, y: 40 } }
  const replacement = { ...wall, a: { x: 305, y: 20 }, b: { x: 305, y: 40 } }
  state.barriers = [priorBarrier]
  state.tokens = [
    { id: ids.token, x: 30 },
    { id: ids.user, x: 300 }
  ].map(({ id, x }) => ({
    ...state.tokens[0]!,
    id,
    position: { x, y: 30 },
    vision: {
      enabled: true,
      brightRange: 0,
      dimRange: 10,
      angleDegrees: 360,
      directionDegrees: 0
    }
  }))
  const plan = planSceneCommandExploration(
    state,
    { ...state, barriers: [replacement] },
    { kind: 'BARRIER_UPSERTED', barrier: replacement }
  )
  expect(plan.tokenIds).toEqual([ids.token, ids.user])
  expect(plan.owners).toEqual([ids.player])
})

describe('VTT scene conflict keys', () => {
  it('retains every unique atomic resource in a batch', () => {
    expect(
      sceneDeltaConflictKeys({
        deltas: [
          { kind: 'TOKEN_MOVED', position: { x: 1, y: 1 }, tokenId: ids.token },
          {
            kind: 'FOG_CHUNKS_PATCHED',
            layer: { chunks: [], height: 1, ownerUserId: ids.player, width: 1 }
          },
          { kind: 'TOKEN_MOVED', position: { x: 2, y: 2 }, tokenId: ids.token }
        ],
        kind: 'BATCH'
      })
    ).toEqual([`TOKEN:${ids.token}`, `FOG:${ids.player}`])
  })

  it('uses one conflict key for authoritative ambient illumination', () => {
    expect(
      sceneDeltaConflictKeys({ kind: 'AMBIENT_ILLUMINATION_SET', illumination: 'DIM' })
    ).toEqual(['ENVIRONMENT:AMBIENT_ILLUMINATION'])
  })
})

describe('VTT scene replay and projection', () => {
  it('applies pinned Character vision without replacing an explicit scene override', () => {
    const state = materializeCampaignScene(definition(), ids.scene)

    const resolved = resolveSceneCharacterVision(
      state,
      [{ actorId: ids.user, characterId: ids.player, tokenId: ids.token }],
      [{ characterId: ids.player, dimRange: { amount: 60, unit: 'FEET' } }]
    )

    expect(resolved.tokens[0]?.vision).toEqual({
      angleDegrees: 360,
      brightRange: 0,
      dimRange: 60,
      directionDegrees: 0,
      enabled: true
    })

    const explicitVision = {
      angleDegrees: 90,
      brightRange: 10,
      dimRange: 20,
      directionDegrees: 45,
      enabled: true
    }
    state.tokens[0] = { ...state.tokens[0]!, vision: explicitVision }
    expect(
      resolveSceneCharacterVision(
        state,
        [{ actorId: ids.user, characterId: ids.player, tokenId: ids.token }],
        [{ characterId: ids.player, dimRange: { amount: 120, unit: 'FEET' } }]
      ).tokens[0]?.vision
    ).toEqual(explicitVision)
  })

  it('converts pinned Character vision to scene units and rejects non-distance units', () => {
    const state = materializeCampaignScene(definition(), ids.scene)
    state.grid = { kind: 'GRIDLESS', pixelsPerUnit: 5, unit: 'METERS' }
    const bindings = [{ actorId: ids.user, characterId: ids.player, tokenId: ids.token }]

    expect(
      resolveSceneCharacterVision(state, bindings, [
        { characterId: ids.player, dimRange: { amount: 60, unit: 'FEET' } }
      ]).tokens[0]?.vision?.dimRange
    ).toBeCloseTo(18.288)
    expect(
      resolveSceneCharacterVision(state, bindings, [
        { characterId: ids.player, dimRange: { amount: 12, unit: 'CUPS' } }
      ]).tokens[0]?.vision
    ).toBeNull()
  })

  it('replays durable events deterministically and ignores an idempotent stale event', () => {
    const events: SceneEvent[] = [
      {
        actorUserId: ids.user,
        commandId: ids.command1,
        delta: { barrierId: ids.door, kind: 'DOOR_STATE_SET', state: 'OPEN' },
        sceneId: ids.scene,
        version: 1
      },
      {
        actorUserId: ids.user,
        commandId: ids.command2,
        delta: {
          deltas: [
            { kind: 'TOKEN_MOVED', position: { x: 12, y: 4 }, tokenId: ids.token },
            {
              kind: 'FOG_CHUNKS_PATCHED',
              layer: { chunks: [], height: 8, ownerUserId: null, width: 8 }
            }
          ],
          kind: 'BATCH'
        },
        sceneId: ids.scene,
        version: 2
      }
    ]

    const replayed = replaySceneEvents(definition(), ids.scene, events)
    const manuallyApplied = events.reduce(
      (state, event) => applySceneEvent(state, event),
      materializeCampaignScene(definition(), ids.scene)
    )

    expect(JSON.stringify(replayed)).toBe(JSON.stringify(manuallyApplied))
    expect(applySceneEvent(replayed, events[0]!)).toBe(replayed)
    expect(replayed.doorStates[ids.door]).toBe('OPEN')
    expect(replayed.tokens[0]?.position).toEqual({ x: 12, y: 4 })
    expect(replayed.fogLayers).toHaveLength(1)
    expect(() => applySceneEvent(replayed, { ...events[1]!, version: 4 })).toThrow(
      'contiguous version order'
    )
  })

  it('materializes and replays authoritative ambient and zone mechanics without fog substitution', () => {
    const source = {
      ...definition(),
      ambientIllumination: 'ORDINARY_DARKNESS' as const,
      darknessZones: [
        {
          id: ids.command1,
          mechanicalIllumination: 'MAGICAL_DARKNESS' as const,
          mechanicalObscurement: 'HEAVY' as const,
          opacity: 0.6,
          polygon: {
            points: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 0, y: 1 }
            ]
          }
        }
      ]
    }
    const materialized = materializeCampaignScene(source, ids.scene)
    const replayed = replaySceneEvents(source, ids.scene, [
      {
        actorUserId: ids.user,
        commandId: ids.command2,
        delta: { kind: 'AMBIENT_ILLUMINATION_SET', illumination: 'DIM' },
        sceneId: ids.scene,
        version: 1
      }
    ])

    expect(materialized.ambientIllumination).toBe('ORDINARY_DARKNESS')
    expect(materialized.darknessZones[0]).toMatchObject({
      mechanicalIllumination: 'MAGICAL_DARKNESS',
      mechanicalObscurement: 'HEAVY'
    })
    expect(replayed.ambientIllumination).toBe('DIM')
    expect(
      projectSceneForViewer(replayed, { role: 'PLAYER', userId: ids.player }).ambientIllumination
    ).toBe('DIM')
  })

  it('withholds hidden entities, GM annotations, and other players fog', () => {
    const state = materializeCampaignScene(definition(), ids.scene)
    state.tokens.push({ ...state.tokens[0]!, id: ids.command1, hidden: true })
    state.tokens.push({
      ...state.tokens[0]!,
      controlledByUserIds: [],
      id: ids.command2,
      position: { x: 500, y: 500 }
    })
    state.fogLayers = [
      { chunks: [], height: 8, ownerUserId: null, width: 8 },
      { chunks: [], height: 8, ownerUserId: ids.player, width: 8 },
      { chunks: [], height: 8, ownerUserId: ids.user, width: 8 }
    ]

    const player = projectSceneForViewer(state, { role: 'PLAYER', userId: ids.player })
    expect(player.tokens.map((token) => token.id)).toEqual([ids.token])
    expect(player.annotations).toEqual([])
    expect(player.barriers).toEqual([])
    expect(player.doorStates).toEqual({})
    expect(player.fogLayers.map((layer) => layer.ownerUserId)).toEqual([null, ids.player])
    expect(projectSceneForViewer(state, { role: 'GM', userId: ids.user })).toEqual(state)
  })

  it('uses the snapshot token predicate for lightweight recipient visibility checks', () => {
    const state = materializeCampaignScene(definition(), ids.scene)
    state.tokens.push({ ...state.tokens[0]!, id: ids.command1, hidden: true })
    state.tokens.push({
      ...state.tokens[0]!,
      controlledByUserIds: [],
      id: ids.command2,
      position: { x: 500, y: 500 }
    })
    state.fogLayers = [{ chunks: [], height: 8, ownerUserId: ids.player, width: 8 }]

    const player = { role: 'PLAYER' as const, userId: ids.player }
    expect(isSceneTokenVisibleToViewer(state, player, ids.token)).toBe(true)
    expect(isSceneTokenVisibleToViewer(state, player, ids.command1)).toBe(false)
    expect(isSceneTokenVisibleToViewer(state, player, ids.command2)).toBe(false)
    expect(isSceneTokenVisibleToViewer(state, { role: 'GM', userId: ids.user }, ids.command1)).toBe(
      true
    )
    expect(isSceneTokenVisibleToViewer(state, { role: 'GM', userId: ids.user }, ids.wall)).toBe(
      false
    )
    expect(
      state.tokens.filter((token) => isSceneTokenVisibleToViewer(state, player, token.id))
    ).toEqual(projectSceneForViewer(state, player).tokens)
  })

  it('converts private scene changes into visible upserts, removals, or no delta', () => {
    const before = materializeCampaignScene(definition(), ids.scene)
    const hiddenToken = { ...before.tokens[0]!, hidden: true }
    const afterHidden = applySceneEvent(before, {
      actorUserId: ids.user,
      commandId: ids.command1,
      delta: { kind: 'TOKEN_UPSERTED', token: hiddenToken },
      sceneId: ids.scene,
      version: 1
    })
    expect(
      projectSceneDeltaForViewer(
        before,
        afterHidden,
        { role: 'PLAYER', userId: ids.player },
        {
          kind: 'TOKEN_UPSERTED',
          token: hiddenToken
        }
      )
    ).toEqual({ kind: 'TOKEN_REMOVED', tokenId: ids.token })
    expect(
      projectSceneDeltaForViewer(
        before,
        afterHidden,
        { role: 'PLAYER', userId: ids.user },
        {
          kind: 'FOG_CHUNKS_PATCHED',
          layer: { chunks: [], height: 8, ownerUserId: ids.player, width: 8 }
        }
      )
    ).toBeNull()
    expect(
      projectSceneDeltaForViewer(
        before,
        afterHidden,
        { role: 'GM', userId: ids.user },
        {
          kind: 'TOKEN_UPSERTED',
          token: hiddenToken
        }
      )
    ).toEqual({ kind: 'TOKEN_UPSERTED', token: hiddenToken })

    const batch = {
      deltas: [
        { kind: 'TOKEN_MOVED' as const, position: { x: 8, y: 4 }, tokenId: ids.token },
        {
          kind: 'FOG_CHUNKS_PATCHED' as const,
          layer: { chunks: [], height: 8, ownerUserId: ids.player, width: 8 }
        },
        {
          kind: 'FOG_CHUNKS_PATCHED' as const,
          layer: { chunks: [], height: 8, ownerUserId: ids.user, width: 8 }
        }
      ],
      kind: 'BATCH' as const
    }
    const afterBatch = applySceneDelta(before, batch, 1)
    expect(
      projectSceneDeltaForViewer(before, afterBatch, { role: 'PLAYER', userId: ids.player }, batch)
    ).toEqual({ deltas: batch.deltas.slice(0, 2), kind: 'BATCH' })
  })

  it('removes orphan door state when a door is replaced and enforces projection limits', () => {
    const state = materializeCampaignScene(definition(), ids.scene)
    const replaced = applySceneEvent(state, {
      actorUserId: ids.user,
      commandId: ids.command1,
      delta: {
        kind: 'BARRIER_UPSERTED',
        barrier: {
          a: { x: 10, y: 0 },
          b: { x: 10, y: 20 },
          blocksLight: true,
          blocksMovement: true,
          id: ids.door,
          kind: 'WALL'
        }
      },
      sceneId: ids.scene,
      version: 1
    })
    expect(replaced.doorStates).not.toHaveProperty(ids.door)

    state.measurements = Array.from({ length: 500 }, (_, index) => ({
      createdByUserId: ids.user,
      id: `00000000-0000-4000-8001-${String(index).padStart(12, '0')}`,
      label: null,
      path: [
        { x: 0, y: 0 },
        { x: 1, y: 1 }
      ]
    }))
    expect(() =>
      applySceneEvent(state, {
        actorUserId: ids.user,
        commandId: ids.command2,
        delta: {
          kind: 'MEASUREMENT_UPSERTED',
          measurement: {
            createdByUserId: ids.user,
            id: '00000000-0000-4000-8000-000000000099',
            label: null,
            path: [
              { x: 0, y: 0 },
              { x: 2, y: 2 }
            ]
          }
        },
        sceneId: ids.scene,
        version: 1
      })
    ).toThrow('500 item limit')
  })
})

describe('VTT scene geometry', () => {
  it('limits barrier exploration work to tokens whose vision reaches the changed segment', () => {
    const state = materializeCampaignScene(definition(), ids.scene)
    state.grid = { kind: 'GRIDLESS', pixelsPerUnit: 1, unit: 'FEET' }
    state.tokens[0] = {
      ...state.tokens[0]!,
      position: { x: 20, y: 20 },
      vision: {
        angleDegrees: 360,
        brightRange: 0,
        dimRange: 10,
        directionDegrees: 0,
        enabled: true
      }
    }

    expect(
      sceneTokenIdsAffectedByBarriers(state, [
        {
          a: { x: 25, y: -100 },
          b: { x: 25, y: 100 },
          blocksLight: true,
          blocksMovement: true,
          id: ids.command1,
          kind: 'WALL'
        }
      ])
    ).toEqual([ids.token])
    expect(
      sceneTokenIdsAffectedByBarriers(state, [
        {
          a: { x: 80, y: 0 },
          b: { x: 80, y: 100 },
          blocksLight: true,
          blocksMovement: true,
          id: ids.command2,
          kind: 'WALL'
        }
      ])
    ).toEqual([])
  })

  it('derives monotonic, occlusion-aware exploration chunks for the correct player', () => {
    const state = materializeCampaignScene(definition(), ids.scene)
    state.map = { ...state.map, height: 100, width: 100 }
    state.fogMode = 'SHARED_PARTY'
    state.grid = { kind: 'GRIDLESS', pixelsPerUnit: 1, unit: 'FEET' }
    state.fogMode = 'PER_PLAYER'
    state.barriers = [
      {
        a: { x: 50, y: 0 },
        b: { x: 50, y: 100 },
        blocksLight: true,
        blocksMovement: true,
        id: ids.wall,
        kind: 'WALL'
      }
    ]
    state.tokens[0] = {
      ...state.tokens[0]!,
      controlledByUserIds: [ids.player],
      position: { x: 25, y: 50 },
      vision: {
        angleDegrees: 360,
        brightRange: 0,
        dimRange: 60,
        directionDegrees: 0,
        enabled: true
      }
    }
    state.tokens.push(
      {
        ...state.tokens[0]!,
        controlledByUserIds: [],
        id: ids.command1,
        label: 'Nearby creature',
        position: { x: 40, y: 50 },
        vision: null
      },
      {
        ...state.tokens[0]!,
        controlledByUserIds: [],
        id: ids.command2,
        label: 'Hidden by fog',
        position: { x: 75, y: 50 },
        vision: null
      }
    )

    const patch = deriveSceneExplorationPatch(state, { ownerUserId: ids.player })
    expect(patch).not.toBeNull()
    if (!patch) throw new Error('Expected newly explored fog chunks.')
    expect({ height: patch.height, width: patch.width }).toEqual({ height: 100, width: 100 })
    expect(isSceneFogCellExplored(patch, 25, 50)).toBe(true)
    expect(isSceneFogCellExplored(patch, 45, 50)).toBe(true)
    expect(isSceneFogCellExplored(patch, 75, 50)).toBe(false)

    const explored = applySceneDelta(state, { kind: 'FOG_CHUNKS_PATCHED', layer: patch }, 1)
    const player = projectSceneForViewer(explored, { role: 'PLAYER', userId: ids.player })
    expect(player.tokens.map((token) => token.id)).toEqual([ids.token, ids.command1])
    expect(player.barriers.map((barrier) => barrier.id)).toEqual([ids.wall])
    expect(deriveSceneExplorationPatch(explored, { ownerUserId: ids.player })).toBeNull()
    expect(() => deriveSceneExplorationPatch(state, { ownerUserId: null })).toThrow(
      'Per-player exploration requires a player-owned fog layer.'
    )
  })

  it('preserves visibility samples while bounding off-map segments and full-map fog reads', () => {
    const state = materializeCampaignScene(definition(), ids.scene)
    state.map = { ...state.map, width: 1, height: 1 }
    state.fogLayers = [
      {
        ownerUserId: null,
        width: 4,
        height: 4,
        chunks: [{ index: 0, x: 0, y: 0, width: 4, height: 4, data: 'IQA=' }]
      }
    ]
    const points = [
      { x: -2, y: -1 },
      { x: -0.125, y: 0.25 },
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 1.125, y: 0.25 },
      { x: 2, y: 1 }
    ]
    for (const a of points)
      for (const b of points) {
        const steps = Math.max(
          1,
          Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * 512)
        )
        let expected = false
        for (let index = 0; index <= steps && !expected; index++) {
          const x = a.x + ((b.x - a.x) * index) / steps
          const y = a.y + ((b.y - a.y) * index) / steps
          expected = [
            { x, y },
            { x: x - 0.125, y },
            { x: x + 0.125, y },
            { x, y: y - 0.125 },
            { x, y: y + 0.125 }
          ].some((point) => isScenePointExplored(state, ids.player, point))
        }
        expect(isSceneSegmentExplored(state, ids.player, a, b)).toBe(expected)
      }
    expect(
      isSceneSegmentExplored(state, ids.player, { x: -1_000_000, y: -1 }, { x: 1_000_000, y: -1 })
    ).toBe(false)
    expect(
      isSceneSegmentExplored(state, ids.player, { x: -1_000_000, y: 0.1 }, { x: 1_000_000, y: 0.1 })
    ).toBe(true)
    const bytes = Uint8Array.from({ length: (512 * 512) / 8 }, (_, index) => index % 251)
    const layer = {
      ownerUserId: null,
      width: 512,
      height: 512,
      chunks: [
        {
          index: 0,
          x: 0,
          y: 0,
          width: 512,
          height: 512,
          data: btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
        }
      ]
    }
    for (const cell of [0, 7, 8, 15, 16, 23, 24, 25, 31, 255, 256, 262143])
      expect(isSceneFogCellExplored(layer, cell % 512, Math.floor(cell / 512))).toBe(
        (bytes[Math.floor(cell / 8)]! & (1 << (cell % 8))) !== 0
      )
  })

  it('retains a legal routed drag path and rejects a segment through a wall', () => {
    const state = materializeCampaignScene(definition(), ids.scene)
    state.map = { ...state.map, height: 100, width: 100 }
    state.barriers = [
      {
        a: { x: 50, y: 30 },
        b: { x: 50, y: 70 },
        blocksLight: true,
        blocksMovement: true,
        id: ids.wall,
        kind: 'WALL'
      }
    ]
    const index = new SceneBarrierIndex(state.barriers)
    let path = [{ x: 20, y: 50 }]
    path = extendSceneMovementPath(state, path, { x: 45, y: 50 }, index)
    expect(extendSceneMovementPath(state, path, { x: 55, y: 50 }, index)).toEqual(path)
    path = extendSceneMovementPath(state, path, { x: 45, y: 20 }, index)
    path = extendSceneMovementPath(state, path, { x: 55, y: 20 }, index)
    path = extendSceneMovementPath(state, path, { x: 55, y: 50 }, index)
    expect(path.at(-1)).toEqual({ x: 55, y: 50 })
  })

  it('derives path exploration and recipient-private drag reveals only in on-drag mode', () => {
    const state = materializeCampaignScene(definition(), ids.scene)
    state.map = { ...state.map, height: 100, width: 100 }
    state.grid = { kind: 'GRIDLESS', pixelsPerUnit: 1, unit: 'FEET' }
    state.fogMode = 'PER_PLAYER'
    state.barriers = [
      {
        a: { x: 50, y: 30 },
        b: { x: 50, y: 70 },
        blocksLight: true,
        blocksMovement: true,
        id: ids.wall,
        kind: 'WALL'
      }
    ]
    state.tokens[0] = {
      ...state.tokens[0]!,
      controlledByUserIds: [ids.player],
      position: { x: 20, y: 50 },
      vision: {
        angleDegrees: 360,
        brightRange: 0,
        dimRange: 40,
        directionDegrees: 0,
        enabled: true
      }
    }
    const path = [
      { x: 20, y: 50 },
      { x: 40, y: 50 }
    ]
    const patch = deriveSceneTokenPathExplorationPatch(state, {
      ownerUserId: ids.player,
      path,
      tokenId: ids.token
    })
    expect(patch && isSceneFogCellExplored(patch, 20, 50)).toBe(true)
    expect(patch && isSceneFogCellExplored(patch, 40, 50)).toBe(true)

    const routedPath = [
      { x: 20, y: 50 },
      { x: 20, y: 10 },
      { x: 80, y: 10 }
    ]
    const moved = {
      ...state,
      tokens: state.tokens.map((token) => ({
        ...token,
        position: routedPath[2]!,
        vision: { ...token.vision!, dimRange: 8 }
      }))
    }
    const moveDelta = { kind: 'TOKEN_MOVED' as const, tokenId: ids.token, position: routedPath[2]! }
    const commandPatch = deriveSceneCommandExplorationDeltas(
      state,
      moved,
      moveDelta,
      undefined,
      routedPath
    )[0]
    const endpointPatch = deriveSceneCommandExplorationDeltas(state, moved, moveDelta)[0]
    expect(commandPatch?.kind).toBe('FOG_CHUNKS_PATCHED')
    expect(endpointPatch?.kind).toBe('FOG_CHUNKS_PATCHED')
    if (commandPatch?.kind !== 'FOG_CHUNKS_PATCHED' || endpointPatch?.kind !== 'FOG_CHUNKS_PATCHED')
      throw new Error('Expected movement exploration patches.')
    expect(isSceneFogCellExplored(commandPatch.layer, 20, 10)).toBe(true)
    expect(isSceneFogCellExplored(endpointPatch.layer, 20, 10)).toBe(false)

    const preview = projectSceneTokenPreviewForViewer(state, {
      path,
      tokenId: ids.token,
      viewer: { role: 'PLAYER', userId: ids.player }
    })
    expect(preview.visionLayers).toHaveLength(1)
    expect(preview.reveal.barriers.map((barrier) => barrier.id)).toEqual([ids.wall])
    expect(
      projectSceneTokenPreviewForViewer(
        { ...state, visionRevealMode: 'ON_DROP' },
        { path, tokenId: ids.token, viewer: { role: 'PLAYER', userId: ids.player } }
      )
    ).toEqual({ reveal: { barriers: [], doorStates: {}, tokens: [] }, visionLayers: [] })
    expect(
      projectSceneTokenPreviewForViewer(state, {
        path,
        tokenId: ids.token,
        viewer: { role: 'PLAYER', userId: ids.user }
      })
    ).toEqual({ reveal: { barriers: [], doorStates: {}, tokens: [] }, visionLayers: [] })
  })

  it('restores fog by replacement and withholds another player’s undo fog delta', () => {
    const state = materializeCampaignScene(definition(), ids.scene)
    const layer = createUniformSceneFogLayer(
      { ...state, fogMode: 'PER_PLAYER' },
      { explored: true, ownerUserId: ids.player }
    )
    const explored = applySceneDelta(
      { ...state, fogMode: 'PER_PLAYER' },
      { kind: 'FOG_LAYER_REPLACED', layer, ownerUserId: ids.player },
      1
    )
    const hidden = applySceneDelta(
      explored,
      { kind: 'FOG_LAYER_REPLACED', layer: null, ownerUserId: ids.player },
      2
    )
    expect(hidden.fogLayers).toEqual([])
    expect(
      projectSceneDeltaForViewer(
        explored,
        hidden,
        { role: 'PLAYER', userId: ids.user },
        { kind: 'FOG_LAYER_REPLACED', layer: null, ownerUserId: ids.player }
      )
    ).toBeNull()
  })

  it('builds complete shared and per-player manual fog replacements', () => {
    const state = materializeCampaignScene(definition(), ids.scene)
    state.map = { ...state.map, height: 100, width: 120 }
    state.fogMode = 'SHARED_PARTY'
    const revealed = createUniformSceneFogLayer(state, {
      explored: true,
      ownerUserId: null
    })
    expect(isSceneFogCellExplored(revealed, 0, 0)).toBe(true)
    expect(isSceneFogCellExplored(revealed, 119, 99)).toBe(true)

    const reset = createUniformSceneFogLayer(
      { ...state, fogLayers: [revealed] },
      { explored: false, ownerUserId: null }
    )
    expect(isSceneFogCellExplored(reset, 0, 0)).toBe(false)
    expect(isSceneFogCellExplored(reset, 119, 99)).toBe(false)

    state.fogMode = 'PER_PLAYER'
    expect(
      createUniformSceneFogLayer(state, { explored: true, ownerUserId: ids.player }).ownerUserId
    ).toBe(ids.player)
    expect(() => createUniformSceneFogLayer(state, { explored: true, ownerUserId: null })).toThrow(
      'Per-player fog requires a player-owned fog layer.'
    )
  })

  it('patches only the changed bounded fog chunks for reveal and hide', () => {
    const state = materializeCampaignScene(definition(), ids.scene)
    state.map = { ...state.map, height: 100, width: 100 }
    state.fogMode = 'SHARED_PARTY'
    const revealed = createSceneFogAreaPatch(state, {
      explored: true,
      ownerUserId: null,
      rectangle: { a: { x: -10, y: -10 }, b: { x: 20, y: 20 } }
    })
    expect(revealed?.chunks).toHaveLength(1)
    expect(revealed && isSceneFogCellExplored(revealed, 10, 10)).toBe(true)
    const withReveal = revealed ? { ...state, fogLayers: [revealed] } : state
    const hidden = createSceneFogAreaPatch(withReveal, {
      explored: false,
      ownerUserId: null,
      rectangle: { a: { x: 0, y: 0 }, b: { x: 20, y: 20 } }
    })
    expect(hidden && isSceneFogCellExplored(hidden, 10, 10)).toBe(false)
    expect(
      createSceneFogAreaPatch(withReveal, {
        explored: true,
        ownerUserId: null,
        rectangle: { a: { x: 0, y: 0 }, b: { x: 20, y: 20 } }
      })
    ).toBeNull()
    state.fogMode = 'PER_PLAYER'
    expect(() =>
      createSceneFogAreaPatch(state, {
        explored: true,
        ownerUserId: null,
        rectangle: { a: { x: 0, y: 0 }, b: { x: 20, y: 20 } }
      })
    ).toThrow('Per-player fog requires a player-owned fog layer.')
  })

  it('respects directional token vision when deriving exploration', () => {
    const state = materializeCampaignScene(definition(), ids.scene)
    state.map = { ...state.map, height: 100, width: 100 }
    state.grid = { kind: 'GRIDLESS', pixelsPerUnit: 1, unit: 'FEET' }
    state.fogMode = 'PER_PLAYER'
    state.barriers = []
    state.tokens[0] = {
      ...state.tokens[0]!,
      controlledByUserIds: [ids.player],
      position: { x: 25, y: 50 },
      vision: {
        angleDegrees: 90,
        brightRange: 0,
        dimRange: 30,
        directionDegrees: 0,
        enabled: true
      }
    }

    const patch = deriveSceneExplorationPatch(state, { ownerUserId: ids.player })
    expect(patch).not.toBeNull()
    if (!patch) throw new Error('Expected directional exploration.')
    expect(isSceneFogCellExplored(patch, 45, 50)).toBe(true)
    expect(isSceneFogCellExplored(patch, 5, 50)).toBe(false)
  })

  it('uses open door state for collision while the wall remains blocking', () => {
    const state = materializeCampaignScene(definition(), ids.scene)
    const index = new SceneBarrierIndex(state.barriers)
    expect(canMoveBetween(state, { x: 0, y: 10 }, { x: 15, y: 10 }, index)).toBe(false)
    state.doorStates[ids.door] = 'OPEN'
    expect(canMoveBetween(state, { x: 0, y: 10 }, { x: 15, y: 10 }, index)).toBe(true)
    expect(canMoveBetween(state, { x: 0, y: 10 }, { x: 25, y: 10 }, index)).toBe(false)
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 })).toBe(
      true
    )
  })

  it('measures square and gridless movement and produces visibility/polygon output', () => {
    expect(measureSceneDistance(definition().grid, { x: 0, y: 0 }, { x: 100, y: 100 })).toBe(15)
    expect(
      measureSceneDistance(
        { kind: 'GRIDLESS', pixelsPerUnit: 10, unit: 'FEET' },
        { x: 0, y: 0 },
        { x: 30, y: 40 }
      )
    ).toBe(5)
    expect(
      measureScenePathDistance(definition().grid, [
        { x: 0, y: 0 },
        { x: 50, y: 50 },
        { x: 100, y: 100 }
      ])
    ).toBe(15)
    expect(visibilityPolygon({ x: 0, y: 0 }, 100, [], {}).points).toHaveLength(64)
    expect(
      visibilityPolygon(
        { x: 0, y: 0 },
        100,
        [
          {
            a: { x: 10, y: -10 },
            b: { x: 10, y: 10 },
            blocksLight: true,
            blocksMovement: true,
            id: ids.wall,
            kind: 'WALL'
          }
        ],
        {}
      ).points.length
    ).toBeGreaterThan(64)
    expect(
      unionScenePolygons([
        {
          points: [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
            { x: 2, y: 2 },
            { x: 0, y: 2 }
          ]
        },
        {
          points: [
            { x: 1, y: 0 },
            { x: 3, y: 0 },
            { x: 3, y: 2 },
            { x: 1, y: 2 }
          ]
        }
      ])
    ).toHaveLength(1)
  })

  it('clips cone lights and applies the highest crossed terrain movement multiplier', () => {
    const cone = visibilityPolygonForLight(
      {
        angleDegrees: 90,
        brightRadius: 50,
        color: '#6bd8cb',
        dimRadius: 100,
        directionDegrees: 0,
        id: ids.command1,
        intensity: 1,
        kind: 'CONE',
        position: { x: 0, y: 0 }
      },
      [
        {
          a: { x: 10, y: -10 },
          b: { x: 10, y: 10 },
          blocksLight: true,
          blocksMovement: true,
          id: ids.wall,
          kind: 'WALL'
        }
      ],
      {}
    )
    expect(cone.points[0]).toEqual({ x: 0, y: 0 })
    expect(cone.points.slice(1).every((point) => point.x >= -1e-8)).toBe(true)
    const centerRay = cone.points
      .slice(1)
      .reduce((nearest, point) => (Math.abs(point.y) < Math.abs(nearest.y) ? point : nearest))
    expect(centerRay.x).toBeCloseTo(10)
    expect(centerRay.y).toBeCloseTo(0)

    const grid = { kind: 'GRIDLESS', pixelsPerUnit: 10, unit: 'FEET' } as const
    const terrain = {
      barriers: [
        {
          a: { x: 40, y: -10 },
          b: { x: 40, y: 10 },
          id: ids.command1,
          kind: 'TERRAIN',
          movementCostMultiplier: 2
        },
        {
          a: { x: 60, y: -10 },
          b: { x: 60, y: 10 },
          id: ids.command2,
          kind: 'TERRAIN',
          movementCostMultiplier: 3
        }
      ]
    } as const
    expect(measureSceneMovementCost(grid, terrain, { x: 0, y: 0 }, { x: 100, y: 0 })).toBe(30)
  })
})
