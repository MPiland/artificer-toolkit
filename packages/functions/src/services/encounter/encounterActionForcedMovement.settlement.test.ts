import { describe, expect, it, vi } from 'vitest'

import type { CampaignLiveSceneRecord, DBLike } from '@artificer-toolkit/db'
import type { CampaignSceneState, SceneToken } from '@artificer-toolkit/shared/vtt'
import type { CharacterRuleActionSpatialDirective } from '../rules/characterRuleActionSystemAdapter.js'

const ids = {
  actor: '00000000-0000-4000-8000-000000000301',
  campaign: '00000000-0000-4000-8000-000000000302',
  command: '00000000-0000-4000-8000-000000000303',
  encounter: '00000000-0000-4000-8000-000000000304',
  scene: '00000000-0000-4000-8000-000000000305',
  source: '00000000-0000-4000-8000-000000000306',
  target: '00000000-0000-4000-8000-000000000307',
  user: '00000000-0000-4000-8000-000000000308'
} as const

const state = vi.hoisted(() => ({
  appendEvent: vi.fn(async () => undefined),
  bindings: vi.fn<() => Promise<Array<{ actorId: string; tokenId: string }>>>(async () => []),
  lockScope: vi.fn<() => Promise<unknown>>(async () => ({ snapshot: async () => [] })),
  updateProjection: vi.fn<() => Promise<{ version: number } | null>>(async () => ({ version: 2 }))
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => ({
  ...(await importOriginal()),
  createSpatialRuleEffectRepository: () => ({ lockScope: state.lockScope }),
  createVttSceneRepository: () => ({
    appendEvent: state.appendEvent,
    listActorTokenBindings: state.bindings,
    updateProjection: state.updateProjection
  })
}))

vi.mock('@artificer-toolkit/shared/vtt', async (importOriginal) => ({
  ...(await importOriginal()),
  canTokenFootprintMoveBetween: () => true
}))

import {
  settleEncounterActionForcedMovement,
  settleEncounterShoveAsideMovement,
  shoveAsideSceneStateChecksum
} from './encounterActionForcedMovement.js'

function token(id: string, x: number): SceneToken {
  return {
    assetId: null,
    controlledByUserIds: [],
    height: 5,
    hidden: false,
    id,
    label: id,
    locked: false,
    position: { x, y: 50 },
    rotationDegrees: 0,
    vision: null,
    width: 5
  }
}

function sceneState(): CampaignSceneState {
  return {
    annotations: [],
    ambientIllumination: 'BRIGHT',
    barriers: [],
    campaignId: ids.campaign,
    darknessZones: [],
    definitionId: ids.scene,
    definitionVersion: 1,
    doorStates: {},
    fogLayers: [],
    fogMode: 'SHARED_PARTY',
    grid: { kind: 'GRIDLESS', pixelsPerUnit: 5, unit: 'FEET' },
    id: ids.scene,
    lights: [],
    map: { assetId: ids.scene, height: 500, tileManifestAssetId: null, width: 500 },
    measurements: [],
    name: 'Forced movement test',
    tokens: [token(ids.source, 0), token(ids.target, 200)],
    version: 1,
    visionRevealMode: 'ON_DRAG'
  }
}

function liveScene(version = 1): CampaignLiveSceneRecord {
  const state = sceneState()
  state.version = version
  return {
    materializationCommandFingerprint: 'a'.repeat(64),
    materializationCommandId: ids.command,
    createdAt: '2026-08-31T00:00:00.000Z',
    definitionSnapshot: {
      annotations: [],
      ambientIllumination: 'BRIGHT',
      barriers: [],
      campaignId: ids.campaign,
      darknessZones: [],
      fogMode: 'SHARED_PARTY',
      grid: state.grid,
      id: ids.scene,
      lights: [],
      map: state.map,
      name: state.name,
      tokens: state.tokens,
      version: 1,
      visionRevealMode: 'ON_DRAG'
    },
    projectionChecksum: 'b'.repeat(64),
    projectionSchemaVersion: 2,
    state,
    updatedAt: '2026-08-31T00:00:00.000Z'
  }
}

function squareLiveScene(): CampaignLiveSceneRecord {
  const scene = liveScene()
  const grid = {
    kind: 'SQUARE' as const,
    cellSize: 5,
    diagonalPolicy: 'EQUAL' as const,
    distancePerCell: 5,
    origin: { x: 0, y: 0 },
    unit: 'FEET' as const
  }
  const tokens = [token(ids.source, 52.5), token(ids.target, 57.5)]
  tokens[0]!.position.y = 52.5
  tokens[1]!.position.y = 52.5
  scene.state.grid = grid
  scene.state.tokens = tokens
  scene.definitionSnapshot = { ...scene.definitionSnapshot, grid, tokens }
  return scene
}

function directive(): CharacterRuleActionSpatialDirective {
  return {
    kind: 'FORCED_MOVEMENT' as const,
    sourceNodeId: 'nested-save-forced-movement',
    sourceOperationKey: 'dnd5e.forced-movement-proposal',
    authoredPath: 'ON_HIT',
    resolvedPath: 'ON_SAVE_FAIL',
    targetActorId: ids.target,
    targetStateChecksum: 'c'.repeat(64),
    direction: 'TOWARD_SOURCE' as const,
    distanceMode: 'FIXED_DISTANCE' as const,
    amount: 25,
    unit: 'FEET' as const,
    actionEconomy: 'NONE' as const
  }
}

function input(scene = liveScene()) {
  return {
    db: {} as DBLike,
    encounter: { id: ids.encounter, campaignId: ids.campaign } as never,
    sceneContext: {
      scene,
      sceneId: ids.scene,
      sceneVersion: 1,
      sourceToken: {
        actorId: ids.actor,
        height: 5,
        position: { x: 0, y: 50 },
        rotationDegrees: 0,
        tokenId: ids.source,
        width: 5
      },
      targetToken: {
        actorId: ids.target,
        height: 5,
        position: { x: 200, y: 50 },
        rotationDegrees: 0,
        tokenId: ids.target,
        width: 5
      },
      grid: scene.state.grid
    },
    actorUserId: ids.user,
    commandId: ids.command,
    commandFingerprint: 'd'.repeat(64),
    sourceActorId: ids.actor,
    targetActorId: ids.target,
    targetStateChecksum: 'c'.repeat(64),
    directives: [directive()]
  }
}

describe('direct-action forced movement Scene settlement', () => {
  it('commits one genuine correlated TOKEN_MOVED child event from the sealed directive', async () => {
    state.appendEvent.mockClear()
    state.bindings.mockResolvedValue([
      { actorId: ids.actor, tokenId: ids.source },
      { actorId: ids.target, tokenId: ids.target }
    ])
    state.lockScope.mockResolvedValue({ snapshot: async () => [] })

    await settleEncounterActionForcedMovement(input())

    expect(state.appendEvent).toHaveBeenCalledTimes(1)
    expect(state.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        commandFingerprint: 'd'.repeat(64),
        commandType: 'RESOLVE_ACTION',
        encounterId: ids.encounter,
        event: expect.objectContaining({
          commandId: ids.command,
          delta: expect.objectContaining({ kind: 'TOKEN_MOVED', tokenId: ids.target }),
          sceneId: ids.scene,
          version: 2
        })
      })
    )
  })

  it('rejects stale Scene and spatial-effect scope before a child event is committed', async () => {
    state.appendEvent.mockClear()
    state.bindings.mockResolvedValue([{ actorId: ids.actor, tokenId: ids.source }])
    await expect(settleEncounterActionForcedMovement(input())).rejects.toThrow('bindings are stale')
    expect(state.appendEvent).not.toHaveBeenCalled()

    state.bindings.mockResolvedValue([
      { actorId: ids.actor, tokenId: ids.source },
      { actorId: ids.target, tokenId: ids.target }
    ])
    await expect(settleEncounterActionForcedMovement(input(liveScene(2)))).rejects.toThrow('stale')
    expect(state.appendEvent).not.toHaveBeenCalled()

    state.lockScope.mockResolvedValue({
      snapshot: async () => [
        {
          id: 'effect',
          definition: { origin: { kind: 'ENCOUNTER' } },
          placement: {
            sourceTokenId: null,
            anchorKind: 'FIXED',
            geometry: {
              frame: 'SCENE_ABSOLUTE',
              shape: { kind: 'CIRCLE', center: { x: 100, y: 50 }, radius: 30 }
            },
            triggerModes: ['ENTER'],
            movementKinds: ['FORCED']
          }
        }
      ]
    })
    await expect(settleEncounterActionForcedMovement(input())).rejects.toThrow('configured spatial')
    expect(state.appendEvent).not.toHaveBeenCalled()
  })

  it('surfaces Scene CAS failure before the caller can finalize the root receipt', async () => {
    state.appendEvent.mockClear()
    state.bindings.mockResolvedValue([
      { actorId: ids.actor, tokenId: ids.source },
      { actorId: ids.target, tokenId: ids.target }
    ])
    state.lockScope.mockResolvedValue({ snapshot: async () => [] })
    state.updateProjection.mockResolvedValueOnce(null)

    await expect(settleEncounterActionForcedMovement(input())).rejects.toThrow('Scene changed')
    expect(state.appendEvent).toHaveBeenCalledTimes(1)
  })

  it('commits only the sealed legal Shove Aside destination and rejects stale selection state', async () => {
    state.appendEvent.mockClear()
    state.bindings.mockResolvedValue([
      { actorId: ids.actor, tokenId: ids.source },
      { actorId: ids.target, tokenId: ids.target }
    ])
    state.lockScope.mockResolvedValue({ snapshot: async () => [] })
    const scene = squareLiveScene()
    const source = scene.state.tokens.find((entry) => entry.id === ids.source)!
    const target = scene.state.tokens.find((entry) => entry.id === ids.target)!
    const destination = { x: 57.5, y: 47.5 }
    const stateChecksum = shoveAsideSceneStateChecksum({
      destination,
      displacement: { amount: 5, unit: 'FEET', sceneUnits: 5 },
      scene: scene.state,
      sourceToken: source,
      targetToken: target
    })
    const command = {
      ...input(scene),
      destination,
      displacement: { amount: 5 as const, unit: 'FEET' as const, sceneUnits: 5 },
      stateChecksum
    }

    await settleEncounterShoveAsideMovement(command)
    expect(state.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        commandType: 'RESOLVE_OPTIONAL_COMBAT',
        event: expect.objectContaining({
          delta: expect.objectContaining({ kind: 'TOKEN_MOVED', tokenId: ids.target })
        })
      })
    )

    state.appendEvent.mockClear()
    await expect(
      settleEncounterShoveAsideMovement({ ...command, stateChecksum: 'e'.repeat(64) })
    ).rejects.toThrow('destination state is stale')
    expect(state.appendEvent).not.toHaveBeenCalled()

    const staleDisplacement = { amount: 5 as const, unit: 'FEET' as const, sceneUnits: 10 }
    await expect(
      settleEncounterShoveAsideMovement({
        ...command,
        displacement: staleDisplacement,
        stateChecksum: shoveAsideSceneStateChecksum({
          destination,
          displacement: staleDisplacement,
          scene: scene.state,
          sourceToken: source,
          targetToken: target
        })
      })
    ).rejects.toThrow('displacement is no longer current')
    expect(state.appendEvent).not.toHaveBeenCalled()
  })

  it('uses the Encounter effective diagonal policy instead of the raw Scene policy', async () => {
    state.appendEvent.mockClear()
    state.bindings.mockResolvedValue([
      { actorId: ids.actor, tokenId: ids.source },
      { actorId: ids.target, tokenId: ids.target }
    ])
    state.lockScope.mockResolvedValue({ snapshot: async () => [] })
    const scene = squareLiveScene()
    const rawGrid = { ...scene.state.grid, diagonalPolicy: 'EUCLIDEAN' as const }
    const effectiveGrid = { ...rawGrid, diagonalPolicy: 'EQUAL' as const }
    scene.state.grid = rawGrid
    scene.definitionSnapshot = { ...scene.definitionSnapshot, grid: rawGrid }
    const source = scene.state.tokens.find((entry) => entry.id === ids.source)!
    const target = scene.state.tokens.find((entry) => entry.id === ids.target)!
    const destination = { x: 52.5, y: 47.5 }
    const displacement = { amount: 5 as const, unit: 'FEET' as const, sceneUnits: 5 }

    await settleEncounterShoveAsideMovement({
      ...input(scene),
      sceneContext: { ...input(scene).sceneContext, grid: effectiveGrid },
      destination,
      displacement,
      stateChecksum: shoveAsideSceneStateChecksum({
        destination,
        displacement,
        scene: scene.state,
        sourceToken: source,
        targetToken: target
      })
    })

    expect(state.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({
          delta: expect.objectContaining({
            kind: 'TOKEN_MOVED',
            position: destination,
            tokenId: ids.target
          })
        })
      })
    )
  })
})
