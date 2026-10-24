import { describe, expect, it } from 'vitest'

import {
  createSceneFogAreaPatch,
  applySceneDelta,
  applySceneEvent,
  canMoveBetween,
  createUniformSceneFogLayer,
  deriveSceneExplorationPatch,
  deriveSceneCommandExplorationDeltas,
  deriveSceneCommandFogLayer,
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
  measureScenePathMovementCost,
  projectSceneForViewer,
  replaySceneEvents,
  resolveSceneActorVision,
  sceneDeltaConflictKeys,
  sceneDerivesExploration,
  sceneLengthInFeet,
  sceneTokenIdsAffectedByBarriers,
  SceneBarrierIndex,
  segmentsIntersect,
  unionScenePolygons,
  visibilityPolygon,
  visibilityPolygonForLight,
  withSceneTokenLights,
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
    daylight: false,
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
        senses: [],
        vision: null,
        width: 1
      }
    ],
    version: 3,
    visionRevealMode: 'ON_DRAG'
  }
}

function visionOff() {
  return { enabled: false, brightRange: 0, dimRange: 0, angleDegrees: 360, directionDegrees: 0 }
}

/** A Character's pinned darkvision, ranged in feet until a Scene grid converts it. */
const pinnedDarkvision = {
  channel: 'VISUAL' as const,
  illuminationAccess: 'ORDINARY_DARKNESS' as const,
  label: 'Darkvision',
  range: { rangeKind: 'DISTANCE' as const, amount: 30, unit: 'FEET' as const },
  senseId: ids.command2
}

/** Fog exploration follows authored token vision only; presented senses never reveal fog. */
function seeingTokens<T extends { vision: unknown }>(tokens: T[]) {
  return tokens.map((token) => ({
    ...token,
    vision: { ...visionOff(), enabled: true, dimRange: 30 }
  }))
}

it('derives command fog from geometry alone while preserving explicit token vision', () => {
  const scene = materializeCampaignScene(definition(), ids.scene)
  const full = { ...scene, tokens: seeingTokens(scene.tokens) }
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
    encounterActorBindings: [{ actorId: ids.encounter, tokenId: ids.token }],
    actorVisions: [{ actorId: ids.encounter, senses: [pinnedDarkvision] }]
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

it('derives exploration only with fog on and a stored layer or a seeing token', () => {
  const seeing = [{ vision: { ...visionOff(), enabled: true } }]
  const blind = [{ vision: null }, { vision: visionOff() }]
  expect(sceneDerivesExploration({ fogMode: 'OFF', fogLayerCount: 3, tokens: seeing })).toBe(false)
  expect(sceneDerivesExploration({ fogMode: 'PER_PLAYER', fogLayerCount: 0, tokens: blind })).toBe(
    false
  )
  expect(
    sceneDerivesExploration({ fogMode: 'SHARED_PARTY', fogLayerCount: 1, tokens: blind })
  ).toBe(true)
  expect(sceneDerivesExploration({ fogMode: 'PER_PLAYER', fogLayerCount: 0, tokens: seeing })).toBe(
    true
  )
})

it('stages a complete canonical layer that keeps earlier exploration and adds the command patch', () => {
  const full = materializeCampaignScene(definition(), ids.scene)
  const state: SceneExplorationState = {
    map: full.map,
    grid: full.grid,
    tokens: full.tokens.map((token) => ({
      ...token,
      vision: { ...visionOff(), enabled: true, dimRange: 30 }
    })),
    barriers: [],
    doorStates: {},
    fogMode: 'PER_PLAYER',
    fogLayers: []
  }
  const delta = { kind: 'TOKEN_MOVED' as const, tokenId: ids.token, position: { x: 600, y: 0 } }
  const plan = planSceneCommandExploration(state, state, delta)
  const earlier = createUniformSceneFogLayer(state, { explored: false, ownerUserId: ids.player })
  const movement = {
    tokenId: ids.token,
    path: [
      { x: 0, y: 0 },
      { x: 600, y: 0 }
    ]
  }
  const layer = deriveSceneCommandFogLayer(plan, {
    ownerUserId: ids.player,
    existing: earlier,
    movement
  })
  const patch = deriveSceneTokenPathExplorationPatch(
    { ...plan.state, fogLayers: [earlier] },
    { ownerUserId: ids.player, path: movement.path, tokenId: ids.token }
  )
  if (!layer || !patch) throw new Error('Expected newly explored cells.')
  expect(layer).toMatchObject({ ownerUserId: ids.player, width: earlier.width })
  // The complete layer covers every canonical tile, so staging can replace the stored layer.
  expect(layer.chunks).toHaveLength(earlier.chunks.length)
  expect(isScenePointExplored({ ...state, fogLayers: [layer] }, ids.player, { x: 600, y: 0 })).toBe(
    true
  )
  // Nothing new explored stages nothing.
  expect(
    deriveSceneCommandFogLayer(plan, { ownerUserId: ids.player, existing: layer, movement })
  ).toBeNull()
})

it('plans recipients without fog and matches command exploration one recipient at a time', () => {
  const scene = materializeCampaignScene(definition(), ids.scene)
  const full = { ...scene, tokens: seeingTokens(scene.tokens) }
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
    encounterActorBindings: [{ actorId: ids.encounter, tokenId: ids.token }],
    actorVisions: [{ actorId: ids.encounter, senses: [pinnedDarkvision] }]
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
      sceneDeltaConflictKeys({
        kind: 'AMBIENT_ILLUMINATION_SET',
        daylight: false,
        illumination: 'DIM'
      })
    ).toEqual(['ENVIRONMENT:AMBIENT_ILLUMINATION'])
  })
})

describe('VTT scene replay and projection', () => {
  it('presents the bound actor senses on the token and leaves its vision alone', () => {
    const state = materializeCampaignScene(definition(), ids.scene)
    const bindings = [{ actorId: ids.user, tokenId: ids.token }]
    const actorVisions = [
      {
        actorId: ids.user,
        senses: [
          {
            ...pinnedDarkvision,
            range: { rangeKind: 'DISTANCE' as const, amount: 60, unit: 'FEET' as const }
          }
        ]
      }
    ]

    const resolved = resolveSceneActorVision(state, bindings, actorVisions)
    expect(resolved.tokens[0]?.senses).toEqual([
      {
        channel: 'VISUAL',
        illuminationAccess: 'ORDINARY_DARKNESS',
        label: 'Darkvision',
        range: { rangeKind: 'DISTANCE', amount: 60 },
        senseId: pinnedDarkvision.senseId
      }
    ])
    expect(resolved.tokens[0]?.vision).toBeNull()

    const explicitVision = {
      angleDegrees: 90,
      brightRange: 10,
      dimRange: 20,
      directionDegrees: 45,
      enabled: true
    }
    state.tokens[0] = { ...state.tokens[0]!, vision: explicitVision }
    const overridden = resolveSceneActorVision(state, bindings, actorVisions).tokens[0]
    expect(overridden?.vision).toEqual(explicitVision)
    expect(overridden?.senses).toHaveLength(1)
  })

  it('marks a bound token that passes blocking barriers and leaves other tokens unmarked (SPELLS-33.T6k1)', () => {
    const state = materializeCampaignScene(definition(), ids.scene)
    const bindings = [{ actorId: ids.user, tokenId: ids.token }]
    const resolve = (vision: { passesBlockingBarriers?: true }) =>
      resolveSceneActorVision(state, bindings, [{ actorId: ids.user, senses: [], ...vision }])
        .tokens[0]
    expect(resolve({ passesBlockingBarriers: true })?.passesBlockingBarriers).toBe(true)
    expect(resolve({})).not.toHaveProperty('passesBlockingBarriers')
  })

  it('presents the light the bound actor sheds on its token, in Scene units', () => {
    const state = materializeCampaignScene(definition(), ids.scene)
    state.grid = { kind: 'GRIDLESS', pixelsPerUnit: 5, unit: 'METERS' }
    const light = {
      bright: { amount: 10, unit: 'FEET' as const },
      dim: { amount: 20, unit: 'FEET' as const }
    }
    const bindings = [{ actorId: ids.user, tokenId: ids.token }]

    const presented = resolveSceneActorVision(state, bindings, [
      { actorId: ids.user, senses: [], light }
    ]).tokens[0]
    expect(presented?.light).toEqual({
      brightRadius: expect.closeTo(3.048),
      dimRadius: expect.closeTo(6.096)
    })
    expect(
      resolveSceneActorVision(state, bindings, [{ actorId: ids.user, senses: [] }]).tokens[0]
    ).not.toHaveProperty('light')
    expect(withSceneTokenLights(state, [{ tokenId: ids.token, light }]).tokens[0]?.light).toEqual(
      presented?.light
    )
    expect(withSceneTokenLights(state, [])).toBe(state)
  })

  it('leaves unbound tokens without senses', () => {
    const state = materializeCampaignScene(definition(), ids.scene)
    expect(
      resolveSceneActorVision(state, [], [{ actorId: ids.user, senses: [pinnedDarkvision] }])
        .tokens[0]?.senses
    ).toEqual([])
  })

  it('converts sense ranges to scene units and drops empty ones', () => {
    const state = materializeCampaignScene(definition(), ids.scene)
    state.grid = { kind: 'GRIDLESS', pixelsPerUnit: 5, unit: 'METERS' }
    const bindings = [{ actorId: ids.user, tokenId: ids.token }]
    const sense = (range: { rangeKind: 'DISTANCE'; amount: number; unit: 'FEET' }) => ({
      ...pinnedDarkvision,
      range
    })
    const resolve = (...ranges: Parameters<typeof sense>[0][]) =>
      resolveSceneActorVision(state, bindings, [{ actorId: ids.user, senses: ranges.map(sense) }])
        .tokens[0]?.senses

    expect(resolve({ rangeKind: 'DISTANCE', amount: 60, unit: 'FEET' })?.[0]?.range).toEqual({
      rangeKind: 'DISTANCE',
      amount: expect.closeTo(18.288)
    })
    expect(resolve({ rangeKind: 'DISTANCE', amount: 0, unit: 'FEET' })).toEqual([])
    expect(
      resolve(
        { rangeKind: 'DISTANCE', amount: 0, unit: 'FEET' },
        { rangeKind: 'DISTANCE', amount: 30, unit: 'FEET' }
      )
    ).toHaveLength(1)

    state.grid = { kind: 'GRIDLESS', pixelsPerUnit: 1, unit: 'SQUARES' }
    expect(resolve({ rangeKind: 'DISTANCE', amount: 60, unit: 'FEET' })?.[0]?.range).toEqual({
      rangeKind: 'DISTANCE',
      amount: 12
    })
    expect(resolve({ rangeKind: 'DISTANCE', amount: 0, unit: 'FEET' })).toEqual([])
  })

  it('presents an unlimited sense on the token whatever the grid can measure', () => {
    const state = materializeCampaignScene(definition(), ids.scene)
    const bindings = [{ actorId: ids.user, tokenId: ids.token }]
    const unlimited = { ...pinnedDarkvision, range: { rangeKind: 'UNLIMITED' as const } }
    const resolve = () =>
      resolveSceneActorVision(state, bindings, [{ actorId: ids.user, senses: [unlimited] }])
        .tokens[0]?.senses

    state.grid = { kind: 'GRIDLESS', pixelsPerUnit: 5, unit: 'FEET' }
    expect(resolve()).toEqual([
      {
        channel: 'VISUAL',
        illuminationAccess: 'ORDINARY_DARKNESS',
        label: 'Darkvision',
        range: { rangeKind: 'UNLIMITED' },
        senseId: pinnedDarkvision.senseId
      }
    ])
    state.grid = { kind: 'GRIDLESS', pixelsPerUnit: 1, unit: 'SQUARES' }
    expect(resolve()).toHaveLength(1)
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
      daylight: false,
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
        delta: { kind: 'AMBIENT_ILLUMINATION_SET', daylight: true, illumination: 'DIM' },
        sceneId: ids.scene,
        version: 1
      }
    ])

    expect(materialized.ambientIllumination).toBe('ORDINARY_DARKNESS')
    expect(materialized.daylight).toBe(false)
    expect(materialized.darknessZones[0]).toMatchObject({
      mechanicalIllumination: 'MAGICAL_DARKNESS',
      mechanicalObscurement: 'HEAVY'
    })
    expect(replayed.ambientIllumination).toBe('DIM')
    expect(replayed.daylight).toBe(true)
    expect(
      projectSceneForViewer(replayed, { role: 'PLAYER', userId: ids.player }, new Map())
        .ambientIllumination
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

    const player = projectSceneForViewer(state, { role: 'PLAYER', userId: ids.player }, new Map())
    expect(player.tokens.map((token) => token.id)).toEqual([ids.token])
    expect(player.annotations).toEqual([])
    expect(player.barriers).toEqual([])
    expect(player.doorStates).toEqual({})
    expect(player.fogLayers.map((layer) => layer.ownerUserId)).toEqual([null, ids.player])
    expect(projectSceneForViewer(state, { role: 'GM', userId: ids.user }, new Map())).toEqual(state)
  })

  it('shows senses to the GM and to a token’s controllers, never to other players', () => {
    const state = materializeCampaignScene({ ...definition(), fogMode: 'OFF' }, ids.scene)
    const presented = [
      { ...pinnedDarkvision, range: { rangeKind: 'DISTANCE' as const, amount: 30 } }
    ]
    state.tokens[0] = { ...state.tokens[0]!, senses: presented }
    state.tokens.push({
      ...state.tokens[0]!,
      controlledByUserIds: [ids.user],
      id: ids.command1,
      senses: presented
    })

    const player = projectSceneForViewer(state, { role: 'PLAYER', userId: ids.player }, new Map())
    expect(player.tokens.map(({ id, senses }) => ({ id, senses }))).toEqual([
      { id: ids.token, senses: presented },
      { id: ids.command1, senses: [] }
    ])
    const other = projectSceneForViewer(state, { role: 'PLAYER', userId: ids.encounter }, new Map())
    expect(other.tokens.map(({ senses }) => senses)).toEqual([[], []])
    expect(projectSceneForViewer(state, { role: 'GM', userId: ids.user }, new Map())).toEqual(state)
    // Withholding a player's view of another token's senses never alters the stored scene.
    expect(state.tokens.map(({ senses }) => senses)).toEqual([presented, presented])
  })

  it('shows a bound Creature token its senses by Encounter control, for the GM and the controller only', () => {
    const creatureActorId = ids.encounter
    const base = materializeCampaignScene({ ...definition(), fogMode: 'OFF' }, ids.scene)
    const state = resolveSceneActorVision(
      base,
      [{ actorId: creatureActorId, tokenId: ids.token }],
      [{ actorId: creatureActorId, senses: [pinnedDarkvision] }]
    )
    const presented = state.tokens[0]!.senses
    expect(presented).toHaveLength(1)
    const controlled = new Map([[ids.token, true]])
    const notControlled = new Map([[ids.token, false]])

    expect(projectSceneForViewer(state, { role: 'GM', userId: ids.user }, notControlled)).toEqual(
      state
    )
    expect(
      projectSceneForViewer(state, { role: 'PLAYER', userId: ids.player }, controlled).tokens[0]
        ?.senses
    ).toEqual(presented)
    // Encounter control, not the stored token control list, decides who sees a bound token's senses.
    const withStaleControl = {
      ...state,
      tokens: [{ ...state.tokens[0]!, controlledByUserIds: [ids.player] }]
    }
    expect(
      projectSceneForViewer(withStaleControl, { role: 'PLAYER', userId: ids.player }, notControlled)
        .tokens[0]?.senses
    ).toEqual([])
  })

  it('withholds senses from token deltas exactly as from the snapshot', () => {
    const before = materializeCampaignScene({ ...definition(), fogMode: 'OFF' }, ids.scene)
    const presented = [
      { ...pinnedDarkvision, range: { rangeKind: 'DISTANCE' as const, amount: 30 } }
    ]
    const listed = { ...before.tokens[0]!, senses: presented }
    const unlisted = { ...listed, controlledByUserIds: [ids.user], id: ids.command1 }
    const after = { ...before, tokens: [listed, unlisted] }
    const player = { role: 'PLAYER' as const, userId: ids.player }
    const upserted = (token: typeof listed, control: ReadonlyMap<string, boolean>) =>
      projectSceneDeltaForViewer(before, after, player, { kind: 'TOKEN_UPSERTED', token }, control)

    expect(upserted(listed, new Map())).toEqual({ kind: 'TOKEN_UPSERTED', token: listed })
    expect(upserted(unlisted, new Map())).toEqual({
      kind: 'TOKEN_UPSERTED',
      token: { ...unlisted, senses: [] }
    })
    // An Encounter-bound token follows its actor's control, not the Scene list.
    expect(upserted(unlisted, new Map([[ids.command1, true]]))).toEqual({
      kind: 'TOKEN_UPSERTED',
      token: unlisted
    })
    expect(upserted(listed, new Map([[ids.token, false]]))).toEqual({
      kind: 'TOKEN_UPSERTED',
      token: { ...listed, senses: [] }
    })
    expect(
      projectSceneDeltaForViewer(
        before,
        after,
        { role: 'GM', userId: ids.user },
        { kind: 'TOKEN_UPSERTED', token: unlisted },
        new Map()
      )
    ).toEqual({ kind: 'TOKEN_UPSERTED', token: unlisted })
  })

  it('withholds senses from deltas that newly show a token and from batches', () => {
    const base = materializeCampaignScene({ ...definition(), fogMode: 'OFF' }, ids.scene)
    const presented = [
      { ...pinnedDarkvision, range: { rangeKind: 'DISTANCE' as const, amount: 30 } }
    ]
    const listed = { ...base.tokens[0]!, senses: presented }
    const unlisted = { ...listed, controlledByUserIds: [ids.user], id: ids.command1 }
    const before = {
      ...base,
      tokens: [listed, unlisted].map((token) => ({ ...token, hidden: true }))
    }
    const after = { ...base, tokens: [listed, unlisted] }
    const player = { role: 'PLAYER' as const, userId: ids.player }
    const project = (
      viewer: Parameters<typeof projectSceneForViewer>[1],
      delta: Parameters<typeof applySceneDelta>[1]
    ) => projectSceneDeltaForViewer(before, after, viewer, delta, new Map())
    const revealing = (token: typeof listed) => [
      { kind: 'TOKEN_MOVED' as const, position: token.position, tokenId: token.id },
      {
        kind: 'TOKEN_MOVE_UNDONE' as const,
        position: token.position,
        tokenId: token.id,
        undoneCommandId: ids.command2
      },
      { kind: 'TOKEN_REMOVED' as const, tokenId: token.id }
    ]

    for (const delta of revealing(listed))
      expect(project(player, delta)).toEqual({ kind: 'TOKEN_UPSERTED', token: listed })
    for (const delta of revealing(unlisted))
      expect(project(player, delta)).toEqual({
        kind: 'TOKEN_UPSERTED',
        token: { ...unlisted, senses: [] }
      })

    const batch = {
      kind: 'BATCH' as const,
      deltas: [
        { kind: 'TOKEN_UPSERTED' as const, token: unlisted },
        { kind: 'TOKEN_MOVED' as const, position: listed.position, tokenId: listed.id }
      ]
    }
    expect(project(player, batch)).toEqual({
      kind: 'BATCH',
      deltas: [
        { kind: 'TOKEN_UPSERTED', token: { ...unlisted, senses: [] } },
        { kind: 'TOKEN_UPSERTED', token: listed }
      ]
    })
    expect(project({ role: 'GM', userId: ids.user }, batch)).toEqual(batch)
  })

  it('reveals tokens in a drag preview without their senses', () => {
    const state = materializeCampaignScene(definition(), ids.scene)
    const presented = [
      { ...pinnedDarkvision, range: { rangeKind: 'DISTANCE' as const, amount: 30 } }
    ]
    state.map = { ...state.map, height: 100, width: 100 }
    state.grid = { kind: 'GRIDLESS', pixelsPerUnit: 1, unit: 'FEET' }
    state.fogMode = 'PER_PLAYER'
    state.barriers = []
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
    const seen = {
      ...state.tokens[0]!,
      controlledByUserIds: [ids.user],
      id: ids.command1,
      position: { x: 35, y: 50 },
      senses: presented,
      vision: null
    }
    state.tokens.push(seen)
    const options = {
      path: [
        { x: 20, y: 50 },
        { x: 40, y: 50 }
      ],
      tokenId: ids.token
    }

    expect(
      projectSceneTokenPreviewForViewer(state, {
        ...options,
        viewer: { role: 'PLAYER', userId: ids.player }
      }).reveal.tokens
    ).toEqual([{ ...seen, senses: [] }])
    expect(state.tokens[1]?.senses).toEqual(presented)
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
    ).toEqual(projectSceneForViewer(state, player, new Map()).tokens)
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
        },
        new Map()
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
        },
        new Map()
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
        },
        new Map()
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
      projectSceneDeltaForViewer(
        before,
        afterBatch,
        { role: 'PLAYER', userId: ids.player },
        batch,
        new Map()
      )
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
    const player = projectSceneForViewer(
      explored,
      { role: 'PLAYER', userId: ids.player },
      new Map()
    )
    expect(player.tokens.map((token) => token.id)).toEqual([ids.token, ids.command1])
    expect(player.barriers.map((barrier) => barrier.id)).toEqual([ids.wall])
    expect(deriveSceneExplorationPatch(explored, { ownerUserId: ids.player })).toBeNull()
    expect(() => deriveSceneExplorationPatch(state, { ownerUserId: null })).toThrow(
      'Per-player fog requires a player-owned fog layer.'
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
        { kind: 'FOG_LAYER_REPLACED', layer: null, ownerUserId: ids.player },
        new Map()
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

  it('shows players every non-hidden object with fog OFF and hides them again with fog on', () => {
    const state = materializeCampaignScene(definition(), ids.scene)
    state.map = { ...state.map, height: 100, width: 100 }
    state.lights = [
      {
        brightRadius: 10,
        color: '#ffffff',
        dimRadius: 20,
        id: ids.command1,
        intensity: 1,
        kind: 'POINT',
        position: { x: 80, y: 80 }
      }
    ]
    state.annotations.push({
      id: ids.command2,
      position: { x: 70, y: 70 },
      text: 'Table note',
      visibility: 'TABLE'
    })
    state.tokens.push(
      { ...state.tokens[0]!, controlledByUserIds: [ids.user], id: ids.encounter, label: 'Ally' },
      { ...state.tokens[0]!, controlledByUserIds: [], hidden: true, id: ids.map, label: 'Ambush' }
    )
    const viewer = { role: 'PLAYER' as const, userId: ids.player }
    // Kept layers from an earlier fog mode must not narrow an OFF Scene.
    const off = {
      ...state,
      fogMode: 'OFF' as const,
      fogLayers: [
        createUniformSceneFogLayer(
          { ...state, fogMode: 'PER_PLAYER' },
          { explored: false, ownerUserId: ids.player }
        )
      ]
    }

    const player = projectSceneForViewer(off, viewer, new Map())
    expect(player.tokens.map((token) => token.id)).toEqual([ids.token, ids.encounter])
    expect(player.barriers.map((barrier) => barrier.id)).toEqual([ids.door, ids.wall])
    expect(player.doorStates).toEqual({ [ids.door]: 'CLOSED' })
    expect(player.lights.map((light) => light.id)).toEqual([ids.command1])
    expect(player.annotations.map((annotation) => annotation.id)).toEqual([ids.command2])
    expect(isSceneTokenVisibleToViewer(off, viewer, ids.map)).toBe(false)

    const moved = applySceneDelta(
      off,
      { kind: 'TOKEN_MOVED', position: { x: 90, y: 90 }, tokenId: ids.encounter },
      1
    )
    expect(
      projectSceneDeltaForViewer(
        off,
        moved,
        viewer,
        {
          kind: 'TOKEN_MOVED',
          position: { x: 90, y: 90 },
          tokenId: ids.encounter
        },
        new Map()
      )
    ).toEqual({ kind: 'TOKEN_MOVED', position: { x: 90, y: 90 }, tokenId: ids.encounter })

    const fogged = applySceneDelta(off, { kind: 'FOG_MODE_SET', mode: 'PER_PLAYER' }, 1)
    expect(fogged.fogLayers).toEqual(off.fogLayers)
    const foggedPlayer = projectSceneForViewer(fogged, viewer, new Map())
    expect(foggedPlayer.tokens.map((token) => token.id)).toEqual([ids.token])
    expect(foggedPlayer.barriers).toEqual([])
    expect(foggedPlayer.lights).toEqual([])
    expect(foggedPlayer.annotations).toEqual([])
    expect(sceneDeltaConflictKeys({ kind: 'FOG_MODE_SET', mode: 'OFF' })).toEqual(['FOG_MODE'])
  })

  it('refuses fog writes and derives no exploration while fog is OFF', () => {
    const state = materializeCampaignScene(definition(), ids.scene)
    state.map = { ...state.map, height: 100, width: 100 }
    state.grid = { kind: 'GRIDLESS', pixelsPerUnit: 1, unit: 'FEET' }
    state.fogMode = 'OFF'
    state.tokens[0] = {
      ...state.tokens[0]!,
      position: { x: 20, y: 50 },
      vision: {
        angleDegrees: 360,
        brightRange: 0,
        dimRange: 40,
        directionDegrees: 0,
        enabled: true
      }
    }
    for (const ownerUserId of [null, ids.player]) {
      expect(() => createUniformSceneFogLayer(state, { explored: true, ownerUserId })).toThrow(
        'Fog of war is off for this Scene.'
      )
      expect(() =>
        createSceneFogAreaPatch(state, {
          explored: true,
          ownerUserId,
          rectangle: { a: { x: 0, y: 0 }, b: { x: 20, y: 20 } }
        })
      ).toThrow('Fog of war is off for this Scene.')
      expect(() => deriveSceneExplorationPatch(state, { ownerUserId })).toThrow(
        'Fog of war is off for this Scene.'
      )
    }
    const path = [
      { x: 20, y: 50 },
      { x: 40, y: 50 }
    ]
    const moved = {
      ...state,
      tokens: state.tokens.map((token) => ({ ...token, position: path[1]! }))
    }
    const delta = { kind: 'TOKEN_MOVED' as const, position: path[1]!, tokenId: ids.token }
    expect(planSceneCommandExploration(state, moved, delta).owners).toEqual([])
    expect(deriveSceneCommandExplorationDeltas(state, moved, delta, undefined, path)).toEqual([])
    expect(
      projectSceneTokenPreviewForViewer(state, {
        path,
        tokenId: ids.token,
        viewer: { role: 'PLAYER', userId: ids.player }
      })
    ).toEqual({ reveal: { barriers: [], doorStates: {}, tokens: [] }, visionLayers: [] })
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
    // A walked path pays each segment's terrain only for that segment.
    expect(
      measureScenePathMovementCost(grid, terrain, [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 }
      ])
    ).toBe(3 + 4 + 15)
    expect(sceneLengthInFeet(3, { ...grid, unit: 'METERS' })).toBeCloseTo(9.8425, 3)
    expect(sceneLengthInFeet(3, { ...grid, unit: 'SQUARES' })).toBe(15)
  })

  it('charges a segment the multiplier a caller sets from its terrain one (D154)', () => {
    const grid = { kind: 'GRIDLESS', pixelsPerUnit: 10, unit: 'FEET' } as const
    const terrain = {
      barriers: [
        {
          a: { x: 40, y: -10 },
          b: { x: 40, y: 10 },
          id: ids.command1,
          kind: 'TERRAIN',
          movementCostMultiplier: 3
        }
      ]
    } as const
    const path = [
      { x: 0, y: 0 },
      { x: 100, y: 0 }
    ]
    const terrains: number[] = []
    expect(
      measureScenePathMovementCost(grid, terrain, path, (_from, _to, multiplier) => {
        terrains.push(multiplier)
        return Math.max(multiplier, 2)
      })
    ).toBe(30)
    expect(terrains).toEqual([3])
    expect(measureScenePathMovementCost(grid, { barriers: [] }, path, () => 1.4)).toBeCloseTo(14)
  })

  it('keeps alternating diagonals across walked segments', () => {
    const grid = definition().grid
    const path = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 100 }
    ]
    expect(measureScenePathMovementCost(grid, { barriers: [] }, path)).toBe(
      measureScenePathDistance(grid, path)
    )
  })
})
