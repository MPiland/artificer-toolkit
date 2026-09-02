import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { canonicalizeJson } from '@artificer-toolkit/db'
import type { SceneCommandInputDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { MovementReactionTimelineDto } from '@artificer-toolkit/schema/shared/reaction'
import {
  applySceneEvent,
  materializeCampaignScene,
  replaySceneEvents,
  type CampaignSceneState,
  type SceneDefinition,
  type SceneEvent
} from '@artificer-toolkit/shared/vtt'

import { EncounterValidationError } from './encounterErrors.js'
import {
  assertCampaignSceneProjectionReplay,
  compileSceneCurrentProjection,
  replayCampaignSceneProjection
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

function scene(): CampaignSceneState {
  return {
    annotations: [],
    ambientIllumination: 'BRIGHT',
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
    ambientIllumination: state.ambientIllumination,
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
  it('keeps a later passage boundary after an earlier automatic reaction and consumes it once', () => {
    const timeline: MovementReactionTimelineDto = [
      {
        kind: 'AUTOMATIC_ACTION',
        option: {
          optionId: 'a'.repeat(64),
          contactSourceId: 'b'.repeat(64),
          actionId: 'earlier-automatic-reaction',
          actionSourceKind: 'ENCOUNTER_FEATURE',
          actionSourceCurrentnessChecksum: 'c'.repeat(64),
          candidate: {
            contact: { x: 1, y: 0 },
            movingActorId: ids.encounter,
            pathDistance: 1,
            reactorActorId: ids.campaign,
            reactorTokenId: ids.barrier,
            sourceId: 'b'.repeat(64),
            stage: 'BEFORE_LEAVE_REACH'
          },
          binding: {
            kind: 'MOVEMENT',
            stage: 'BEFORE_LEAVE_REACH',
            perceptionRequirement: null,
            eligibilityDefinitionId: ids.scene,
            movementInterruption: null
          },
          policy: {
            eligible: true,
            allowanceDefinitionId: ids.command,
            allowanceMaximum: 1,
            allowanceRefreshBoundary: 'START_OF_TURN',
            selectionPolicy: 'AUTOMATIC',
            choiceDefinitionId: null,
            targetPolicy: 'MOVER'
          },
          eligibilityEvidenceChecksum: 'd'.repeat(64),
          authority: { kind: 'GM' },
          visibility: 'GM_ONLY'
        }
      }
    ]

    expect(vttSceneServiceInternals.nextMovementTimelineBoundaryDistance(timeline, 2)).toBe(1)
    expect(
      vttSceneServiceInternals.nextMovementTimelineBoundaryDistance(timeline.slice(1), 2)
    ).toBe(2)
    expect(vttSceneServiceInternals.nextMovementTimelineBoundaryDistance([], null)).toBeNull()
  })

  it('continues after an ineligible passage contact instead of re-interrupting it', () => {
    expect(vttSceneServiceInternals.nextMovementTimelineBoundaryDistance([], 2)).toBe(2)
    expect(vttSceneServiceInternals.nextMovementTimelineBoundaryDistance([], null)).toBeNull()
  })

  it('does not issue passage options whose authoritative contest facts are unavailable', async () => {
    const options = ['overrun', 'tumble'] as const
    await expect(
      vttSceneServiceInternals.filterExecutableMovementPassageOptions({
        options,
        prepare: async () => {
          throw new EncounterValidationError('Custom actor contest facts are unavailable.')
        }
      })
    ).resolves.toEqual([])
  })

  it('maps a durable movement command to its renderer-neutral delta', () => {
    const input: SceneCommandInputDto = {
      commandId: ids.command,
      expectedEncounterVersion: 0,
      expectedSceneVersion: 0,
      correlationId: null,
      movementKind: 'VOLUNTARY',
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

  it('maps owner-authored ambient illumination to a renderer-neutral delta', () => {
    const input = {
      commandId: ids.command,
      expectedSceneVersion: 0,
      illumination: 'DIM',
      sceneId: ids.scene,
      type: 'SET_SCENE_AMBIENT_ILLUMINATION'
    } satisfies Extract<SceneCommandInputDto, { type: 'SET_SCENE_AMBIENT_ILLUMINATION' }>

    expect(vttSceneServiceInternals.commandToDelta(input)).toEqual({
      illumination: 'DIM',
      kind: 'AMBIENT_ILLUMINATION_SET'
    })
    expect(() =>
      vttSceneServiceInternals.assertPlayerCommand(
        scene(),
        ids.user,
        vttSceneServiceInternals.commandToDelta(input)
      )
    ).toThrow('Only the Campaign owner can make this scene change.')
  })

  it('preserves exact legacy darkness replay identity without changing current fingerprints', () => {
    const input: SceneCommandInputDto = {
      commandId: ids.command,
      expectedSceneVersion: 0,
      sceneId: ids.scene,
      type: 'UPSERT_SCENE_DARKNESS',
      zone: {
        id: ids.token,
        mechanicalIllumination: null,
        mechanicalObscurement: null,
        opacity: 0.5,
        polygon: {
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 }
          ]
        }
      }
    }
    const marked: SceneCommandInputDto = {
      ...input,
      legacyReplayKind: 'VISUAL_ONLY_DARKNESS_V0'
    }
    const { mechanicalIllumination, mechanicalObscurement, ...legacyZone } = input.zone
    const expectedLegacyFingerprint = createHash('sha256')
      .update(JSON.stringify({ ...input, zone: legacyZone }))
      .digest('hex')

    expect(mechanicalIllumination).toBeNull()
    expect(mechanicalObscurement).toBeNull()
    expect(vttSceneServiceInternals.sceneCommandFingerprint(marked)).toBe(
      vttSceneServiceInternals.sceneCommandFingerprint(input)
    )
    expect(vttSceneServiceInternals.legacyVisualOnlyDarknessFingerprint(input)).toBe(
      expectedLegacyFingerprint
    )
    expect(
      vttSceneServiceInternals.legacyVisualOnlyDarknessFingerprint({
        ...input,
        zone: { ...input.zone, mechanicalIllumination: 'ORDINARY_DARKNESS' }
      })
    ).toBeNull()
  })

  it('slices a committed movement prefix by distance without position lookup', () => {
    const path = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
      { x: 0, y: 0 }
    ]
    expect(vttSceneServiceInternals.sliceMovementPath(path, 0, 5)).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 0 }
    ])
    expect(vttSceneServiceInternals.sliceMovementPath(path, 3, 7)).toEqual([
      { x: 3, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 2 }
    ])
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
          {
            actorId: ids.barrier,
            characterId: ids.user,
            encounterId: ids.encounter,
            tokenId: ids.token
          }
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
    const ambient = { kind: 'AMBIENT_ILLUMINATION_SET' as const, illumination: 'DIM' as const }
    expect(() =>
      vttSceneServiceInternals.assertSceneCommandVersion(81, 80, ambient, [
        { kind: 'AMBIENT_ILLUMINATION_SET', illumination: 'ORDINARY_DARKNESS' }
      ])
    ).toThrow('Scene target changed before this command completed.')
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
    const current = replaySceneEvents(sceneDefinition, ids.scene, [move, door])
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
    const moved = replaySceneEvents(sceneDefinition, ids.scene, [move])
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
    expect(materializeCampaignScene(sceneDefinition, ids.scene).tokens[0]?.position).toEqual(
      restored.tokens[0]?.position
    )
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
    const projection = replaySceneEvents(sceneDefinition, ids.scene, events)
    const rebuilt = assertCampaignSceneProjectionReplay({
      definition: sceneDefinition,
      events,
      projection,
      sceneId: ids.scene
    })

    expect(canonicalizeJson(rebuilt)).toBe(canonicalizeJson(projection))
    expect(
      canonicalizeJson(
        replayCampaignSceneProjection({
          definition: sceneDefinition,
          events,
          sceneId: ids.scene
        })
      )
    ).toBe(canonicalizeJson(projection))

    const committedProjection = compileSceneCurrentProjection(projection)
    expect(committedProjection).toMatchObject({
      projectionSchemaVersion: 2,
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
