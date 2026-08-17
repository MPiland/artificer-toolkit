import type { LiveSessionWebSocketServerMessageDto } from '@artificer-toolkit/schema/api/liveSessions'
import type { EncounterSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import { describe, expect, it } from 'vitest'
import { applyLiveSessionServerMessage, emptyLiveSessionSceneState } from './liveSessionSceneState'

const campaignId = '00000000-0000-4000-8000-000000000001'
const sessionId = '00000000-0000-4000-8000-000000000002'
const encounterId = '00000000-0000-4000-8000-000000000003'
const sceneId = '00000000-0000-4000-8000-000000000004'
const definitionId = '00000000-0000-4000-8000-000000000005'
const mapAssetId = '00000000-0000-4000-8000-000000000006'
const tokenId = '00000000-0000-4000-8000-000000000007'
const commandId = '00000000-0000-4000-8000-000000000008'
const characterId = '00000000-0000-4000-8000-000000000009'
type SceneCommittedMessage = Extract<
  LiveSessionWebSocketServerMessageDto,
  { aggregateKind: 'SCENE' }
>

function scene(version = 0): EncounterSceneStateDto {
  return {
    annotations: [],
    barriers: [],
    campaignId,
    darknessZones: [],
    definitionId,
    definitionVersion: 1,
    doorStates: {},
    encounterId,
    fogLayers: [],
    fogMode: 'SHARED_PARTY',
    visionRevealMode: 'ON_DROP',
    grid: { kind: 'GRIDLESS', pixelsPerUnit: 5, unit: 'FEET' },
    id: sceneId,
    lights: [],
    map: { assetId: mapAssetId, height: 100, tileManifestAssetId: null, width: 100 },
    measurements: [],
    name: 'Test map',
    tokens: [
      {
        actorId: null,
        assetId: null,
        controlledByUserIds: [],
        height: 1,
        hidden: false,
        id: tokenId,
        label: 'Hero',
        locked: false,
        position: { x: 10, y: 10 },
        rotationDegrees: 0,
        vision: null,
        width: 1
      }
    ],
    version
  }
}

function committed(version: number, delta: SceneCommittedMessage['delta']): SceneCommittedMessage {
  return {
    acceptedSequence: version,
    aggregateId: sceneId,
    aggregateKind: 'SCENE',
    deliverySequence: version,
    delta,
    originCommandId: commandId,
    replayed: false,
    snapshot: null,
    type: 'COMMAND_COMMITTED',
    version
  }
}

describe('live-session scene state', () => {
  it('hydrates a private snapshot and applies contiguous durable deltas', () => {
    const ready: LiveSessionWebSocketServerMessageDto = {
      aggregateVersions: [{ aggregateId: sceneId, aggregateKind: 'SCENE', version: 0 }],
      campaignId,
      deliverySequence: 0,
      sceneSnapshots: [{ campaignId, scene: scene(), sessionId }],
      sessionId,
      type: 'READY'
    }
    const hydrated = applyLiveSessionServerMessage(emptyLiveSessionSceneState, ready)
    const moved = applyLiveSessionServerMessage(
      hydrated,
      committed(1, { kind: 'TOKEN_MOVED', position: { x: 20, y: 30 }, tokenId })
    )

    expect(moved.scenes[0]?.tokens[0]?.position).toEqual({ x: 20, y: 30 })
    expect(moved.scenes[0]?.version).toBe(1)
  })

  it('advances a private scene version when the committed delta is withheld', () => {
    const state = { ...emptyLiveSessionSceneState, scenes: [scene()] }
    const next = applyLiveSessionServerMessage(state, committed(1, null))

    expect(next.scenes[0]?.version).toBe(1)
    expect(next.scenes[0]?.tokens[0]?.position).toEqual({ x: 10, y: 10 })
  })

  it('refreshes private scenes after a Character rule change without reloading the page', () => {
    const state = { ...emptyLiveSessionSceneState, scenes: [scene()] }
    const refreshed = scene()
    refreshed.tokens[0] = {
      ...refreshed.tokens[0]!,
      vision: {
        angleDegrees: 360,
        brightRange: 0,
        dimRange: 60,
        directionDegrees: 0,
        enabled: true
      }
    }
    const next = applyLiveSessionServerMessage(state, {
      acceptedSequence: 1,
      aggregateId: characterId,
      aggregateKind: 'CHARACTER',
      deliverySequence: 1,
      originCommandId: commandId,
      replayed: false,
      response: null,
      sceneSnapshots: [{ campaignId, scene: refreshed, sessionId }],
      type: 'COMMAND_COMMITTED',
      version: 1
    })

    expect(next.scenes[0]?.tokens[0]?.vision?.dimRange).toBe(60)
    expect(next.deliverySequence).toBe(1)
  })

  it('accepts a delayed idempotent result without regressing the current scene version', () => {
    const current = scene(2)
    current.tokens[0] = { ...current.tokens[0]!, position: { x: 30, y: 20 } }
    const historical = scene(2)
    historical.tokens[0] = { ...historical.tokens[0]!, position: { x: 30, y: 20 } }
    const next = applyLiveSessionServerMessage(
      {
        aggregateVersions: [{ aggregateId: sceneId, aggregateKind: 'SCENE', version: 2 }],
        deliverySequence: 2,
        scenes: [current]
      },
      {
        ...committed(1, null),
        deliverySequence: 1,
        replayed: true,
        snapshot: { campaignId, scene: historical, sessionId }
      }
    )

    expect(next.aggregateVersions).toContainEqual({
      aggregateId: sceneId,
      aggregateKind: 'SCENE',
      version: 2
    })
    expect(next.deliverySequence).toBe(2)
    expect(next.scenes[0]?.version).toBe(2)
  })
})
