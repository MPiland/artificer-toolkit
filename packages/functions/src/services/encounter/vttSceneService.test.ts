import { describe, expect, it } from 'vitest'

import { canonicalizeJson } from '@artificer-toolkit/db'
import type { SceneCommandInputDto } from '@artificer-toolkit/schema/api/vttScenes'
import {
  applySceneEvent,
  materializeEncounterScene,
  replaySceneEvents,
  type EncounterSceneState,
  type SceneDefinition,
  type SceneEvent
} from '@artificer-toolkit/shared/vtt'

import { EncounterValidationError } from './encounterErrors.js'
import {
  assertEncounterSceneProjectionReplay,
  compileSceneCurrentProjection,
  replayEncounterSceneProjection
} from './sceneProjectionReplay.js'
import { vttSceneServiceInternals } from './vttSceneService.js'

const ids = {
  barrier: '00000000-0000-4000-8000-000000000001',
  campaign: '00000000-0000-4000-8000-000000000002',
  command: '00000000-0000-4000-8000-000000000003',
  encounter: '00000000-0000-4000-8000-000000000004',
  scene: '00000000-0000-4000-8000-000000000005',
  token: '00000000-0000-4000-8000-000000000006',
  user: '00000000-0000-4000-8000-000000000007'
}

function scene(): EncounterSceneState {
  return {
    annotations: [],
    barriers: [
      {
        a: { x: 50, y: 0 },
        b: { x: 50, y: 100 },
        blocksLightWhenClosed: true,
        blocksMovementWhenClosed: true,
        id: ids.barrier,
        initialState: 'CLOSED',
        kind: 'DOOR',
        openAngleDegrees: 90
      }
    ],
    campaignId: ids.campaign,
    darknessZones: [],
    definitionId: ids.scene,
    definitionVersion: 1,
    doorStates: { [ids.barrier]: 'CLOSED' },
    encounterId: ids.encounter,
    fogLayers: [],
    fogMode: 'SHARED_PARTY',
    grid: { kind: 'GRIDLESS', pixelsPerUnit: 5, unit: 'FEET' },
    id: ids.scene,
    lights: [],
    map: {
      assetId: ids.scene,
      height: 100,
      tileManifestAssetId: null,
      width: 100
    },
    measurements: [],
    name: 'Test scene',
    tokens: [
      {
        actorId: null,
        assetId: null,
        controlledByUserIds: [ids.user],
        height: 1,
        hidden: false,
        id: ids.token,
        label: 'Hero',
        locked: false,
        position: { x: 20, y: 20 },
        rotationDegrees: 0,
        vision: null,
        width: 1
      }
    ],
    version: 0,
    visionRevealMode: 'ON_DRAG'
  }
}

function definition(): SceneDefinition {
  const state = scene()
  return {
    annotations: state.annotations,
    barriers: state.barriers,
    campaignId: state.campaignId,
    darknessZones: state.darknessZones,
    fogMode: state.fogMode,
    grid: state.grid,
    id: state.definitionId,
    lights: state.lights,
    map: state.map,
    name: state.name,
    tokens: state.tokens,
    version: state.definitionVersion,
    visionRevealMode: state.visionRevealMode
  }
}

describe('VTT scene command helpers', () => {
  it('maps a durable movement command to its renderer-neutral delta', () => {
    const input: SceneCommandInputDto = {
      commandId: ids.command,
      encounterId: ids.encounter,
      expectedSceneVersion: 0,
      path: [
        { x: 20, y: 20 },
        { x: 25, y: 20 }
      ],
      sceneId: ids.scene,
      tokenId: ids.token,
      type: 'MOVE_SCENE_TOKEN'
    }

    expect(vttSceneServiceInternals.commandToDelta(input)).toEqual({
      kind: 'TOKEN_MOVED',
      position: { x: 25, y: 20 },
      tokenId: ids.token
    })
  })

  it('allows a player to move their unlocked token without crossing a door', () => {
    expect(() =>
      vttSceneServiceInternals.assertPlayerCommand(scene(), ids.user, {
        kind: 'TOKEN_MOVED',
        position: { x: 25, y: 20 },
        tokenId: ids.token
      })
    ).not.toThrow()
  })

  it('rejects player token movement through a closed door', () => {
    expect(() =>
      vttSceneServiceInternals.assertPlayerCommand(scene(), ids.user, {
        kind: 'TOKEN_MOVED',
        position: { x: 75, y: 20 },
        tokenId: ids.token
      })
    ).toThrow(EncounterValidationError)
  })

  it('rejects player attempts to lock a door', () => {
    expect(() =>
      vttSceneServiceInternals.assertPlayerCommand(scene(), ids.user, {
        barrierId: ids.barrier,
        kind: 'DOOR_STATE_SET',
        state: 'LOCKED'
      })
    ).toThrow(EncounterValidationError)
  })

  it('derives shared exploration from the post-move token position', () => {
    const state = scene()
    state.tokens[0] = {
      ...state.tokens[0]!,
      actorId: ids.barrier,
      position: { x: 25, y: 20 },
      vision: null
    }
    const deltas = vttSceneServiceInternals.explorationDeltasFor(
      state,
      state,
      {
        kind: 'TOKEN_MOVED',
        position: { x: 25, y: 20 },
        tokenId: ids.token
      },
      {
        characterVisions: [{ characterId: ids.user, dimRange: { amount: 10, unit: 'FEET' } }],
        encounterCharacterBindings: [
          { actorId: ids.barrier, characterId: ids.user, encounterId: ids.encounter }
        ]
      }
    )

    expect(deltas).toHaveLength(1)
    expect(deltas[0]).toMatchObject({
      kind: 'FOG_CHUNKS_PATCHED',
      layer: { ownerUserId: null }
    })
  })

  it('rebases stale commands only when later scene changes have different conflict keys', () => {
    const moveToken = {
      kind: 'TOKEN_MOVED' as const,
      position: { x: 25, y: 20 },
      tokenId: ids.token
    }
    expect(() =>
      vttSceneServiceInternals.assertSceneCommandVersion(81, 80, moveToken, [
        { barrierId: ids.barrier, kind: 'DOOR_STATE_SET', state: 'OPEN' }
      ])
    ).not.toThrow()
    expect(() =>
      vttSceneServiceInternals.assertSceneCommandVersion(81, 80, moveToken, [
        { kind: 'TOKEN_MOVED', position: { x: 30, y: 20 }, tokenId: ids.token }
      ])
    ).toThrow('Scene target changed before this command completed.')
    expect(() => vttSceneServiceInternals.assertSceneCommandVersion(81, 82, moveToken, [])).toThrow(
      'Scene version is ahead of the authoritative state.'
    )
  })

  it('rejects a stale fog edit when a later batch derived that same fog layer', () => {
    const fog = { chunks: [], height: 1, ownerUserId: null, width: 1 }
    const fogPatch = { kind: 'FOG_CHUNKS_PATCHED' as const, layer: fog }
    expect(() =>
      vttSceneServiceInternals.assertSceneCommandVersion(81, 80, fogPatch, [
        {
          deltas: [
            { kind: 'TOKEN_MOVED', position: { x: 25, y: 20 }, tokenId: ids.token },
            fogPatch
          ],
          kind: 'BATCH'
        }
      ])
    ).toThrow('Scene target changed before this command completed.')
    expect(() =>
      vttSceneServiceInternals.assertSceneCommandVersion(81, 80, fogPatch, [
        {
          deltas: [
            {
              barrier: {
                a: { x: 1, y: 1 },
                b: { x: 2, y: 2 },
                blocksLight: true,
                blocksMovement: true,
                id: ids.barrier,
                kind: 'WALL'
              },
              kind: 'BARRIER_UPSERTED'
            },
            fogPatch
          ],
          kind: 'BATCH'
        }
      ])
    ).toThrow('Scene target changed before this command completed.')
    expect(() =>
      vttSceneServiceInternals.assertSceneCommandVersion(81, 80, fogPatch, [
        { barrierId: ids.barrier, kind: 'DOOR_STATE_SET', state: 'OPEN' }
      ])
    ).not.toThrow()
  })

  it('builds an append-only undo that restores the token and fog without reverting unrelated state', () => {
    const sceneDefinition = definition()
    const move: SceneEvent = {
      actorUserId: ids.user,
      commandId: ids.command,
      delta: {
        deltas: [
          { kind: 'TOKEN_MOVED', position: { x: 25, y: 20 }, tokenId: ids.token },
          {
            kind: 'FOG_CHUNKS_PATCHED',
            layer: {
              chunks: [{ data: 'AQ==', height: 1, index: 0, width: 1, x: 0, y: 0 }],
              height: 1,
              ownerUserId: null,
              width: 1
            }
          }
        ],
        kind: 'BATCH'
      },
      sceneId: ids.scene,
      version: 1
    }
    const door: SceneEvent = {
      actorUserId: ids.user,
      commandId: ids.barrier,
      delta: { barrierId: ids.barrier, kind: 'DOOR_STATE_SET', state: 'OPEN' },
      sceneId: ids.scene,
      version: 2
    }
    const history = [
      { commandType: 'MOVE_SCENE_TOKEN', event: move },
      { commandType: 'SET_SCENE_DOOR_STATE', event: door }
    ]
    const current = replaySceneEvents(sceneDefinition, ids.encounter, ids.scene, [move, door])
    const undoDelta = vttSceneServiceInternals.createUndoLastMoveDelta(
      current,
      sceneDefinition,
      history
    )
    const restored = applySceneEvent(current, {
      actorUserId: ids.user,
      commandId: ids.encounter,
      delta: undoDelta,
      sceneId: ids.scene,
      version: 3
    })

    expect(restored.tokens[0]?.position).toEqual({ x: 20, y: 20 })
    expect(restored.doorStates[ids.barrier]).toBe('OPEN')
    expect(restored.fogLayers).toEqual([])
    expect(undoDelta).toMatchObject({
      deltas: [
        { kind: 'TOKEN_MOVE_UNDONE', undoneCommandId: ids.command },
        { kind: 'FOG_LAYER_REPLACED', layer: null, ownerUserId: null }
      ],
      kind: 'BATCH'
    })
  })

  it('does not undo the same committed move twice', () => {
    const sceneDefinition = definition()
    const move: SceneEvent = {
      actorUserId: ids.user,
      commandId: ids.command,
      delta: { kind: 'TOKEN_MOVED', position: { x: 25, y: 20 }, tokenId: ids.token },
      sceneId: ids.scene,
      version: 1
    }
    const moved = replaySceneEvents(sceneDefinition, ids.encounter, ids.scene, [move])
    const undoDelta = vttSceneServiceInternals.createUndoLastMoveDelta(moved, sceneDefinition, [
      { commandType: 'MOVE_SCENE_TOKEN', event: move }
    ])
    const undo: SceneEvent = {
      actorUserId: ids.user,
      commandId: ids.encounter,
      delta: undoDelta,
      sceneId: ids.scene,
      version: 2
    }
    const restored = applySceneEvent(moved, undo)

    expect(() =>
      vttSceneServiceInternals.createUndoLastMoveDelta(restored, sceneDefinition, [
        { commandType: 'MOVE_SCENE_TOKEN', event: move },
        { commandType: 'UNDO_LAST_SCENE_MOVE', event: undo }
      ])
    ).toThrow('There is no committed token move to undo.')
    expect(
      materializeEncounterScene(sceneDefinition, ids.encounter, ids.scene).tokens[0]?.position
    ).toEqual(restored.tokens[0]?.position)
  })

  it('rebuilds the current scene projection byte-equivalently from its event stream', () => {
    const sceneDefinition = definition()
    const events: SceneEvent[] = [
      {
        actorUserId: ids.user,
        commandId: ids.command,
        delta: { kind: 'TOKEN_MOVED', position: { x: 25, y: 20 }, tokenId: ids.token },
        sceneId: ids.scene,
        version: 1
      },
      {
        actorUserId: ids.user,
        commandId: ids.barrier,
        delta: { barrierId: ids.barrier, kind: 'DOOR_STATE_SET', state: 'OPEN' },
        sceneId: ids.scene,
        version: 2
      }
    ]
    const projection = replaySceneEvents(sceneDefinition, ids.encounter, ids.scene, events)
    const rebuilt = assertEncounterSceneProjectionReplay({
      definition: sceneDefinition,
      encounterId: ids.encounter,
      events,
      projection,
      sceneId: ids.scene
    })

    expect(canonicalizeJson(rebuilt)).toBe(canonicalizeJson(projection))
    expect(
      canonicalizeJson(
        replayEncounterSceneProjection({
          definition: sceneDefinition,
          encounterId: ids.encounter,
          events,
          sceneId: ids.scene
        })
      )
    ).toBe(canonicalizeJson(projection))

    const committedProjection = compileSceneCurrentProjection(projection)
    expect(committedProjection).toMatchObject({
      projectionSchemaVersion: 1,
      sceneId: ids.scene,
      streamVersion: projection.version
    })
    expect(committedProjection.projectionChecksum).toMatch(/^[a-f0-9]{64}$/)
    expect(
      compileSceneCurrentProjection({ ...projection, version: projection.version + 1 })
        .projectionChecksum
    ).not.toBe(committedProjection.projectionChecksum)
  })
})
