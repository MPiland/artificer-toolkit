import { describe, expect, it } from 'vitest'

import type {
  LiveSessionCommandDto,
  LiveSessionCoordinatorSnapshotDto
} from '@artificer-toolkit/schema/api/liveSessions'

import {
  deriveLiveSessionConflictKeys,
  deriveLiveSessionSceneVisionContext
} from './conflictKeys.js'

const ids = {
  actorA: '00000000-0000-4000-8000-000000000001',
  actorB: '00000000-0000-4000-8000-000000000002',
  characterA: '00000000-0000-4000-8000-000000000003',
  characterB: '00000000-0000-4000-8000-000000000004',
  campaign: '00000000-0000-4000-8000-000000000010',
  command: '00000000-0000-4000-8000-000000000005',
  door: '00000000-0000-4000-8000-000000000006',
  encounter: '00000000-0000-4000-8000-000000000007',
  scene: '00000000-0000-4000-8000-000000000008',
  session: '00000000-0000-4000-8000-000000000011',
  token: '00000000-0000-4000-8000-000000000009',
  tokenB: '00000000-0000-4000-8000-000000000012'
} as const

const snapshot = {
  encounterCharacterBindings: [
    {
      actorId: ids.actorA,
      characterId: ids.characterA,
      encounterId: ids.encounter,
      tokenId: ids.token
    },
    {
      actorId: ids.actorB,
      characterId: ids.characterB,
      encounterId: ids.encounter,
      tokenId: ids.tokenB
    }
  ],
  encounterRuleOccurrenceBindings: [
    {
      encounterId: ids.encounter,
      executionKind: 'SPATIAL',
      occurrenceId: ids.command,
      sceneId: ids.scene
    }
  ],
  encounterActorTokenBindings: [
    {
      actorId: ids.actorA,
      encounterId: ids.encounter,
      sceneId: ids.scene,
      tokenId: ids.token
    }
  ],
  encounterSceneBindings: [{ encounterId: ids.encounter, sceneId: ids.scene }],
  sceneStates: [
    {
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
      map: {
        assetId: ids.scene,
        height: 100,
        tileManifestAssetId: null,
        width: 100
      },
      measurements: [],
      name: 'Room',
      tokens: [
        {
          assetId: null,
          controlledByUserIds: [],
          height: 1,
          hidden: false,
          id: ids.token,
          label: 'Hero',
          locked: false,
          position: { x: 1, y: 2 },
          rotationDegrees: 0,
          vision: null,
          width: 1
        }
      ],
      version: 1,
      visionRevealMode: 'ON_DRAG'
    }
  ]
} satisfies Pick<
  LiveSessionCoordinatorSnapshotDto,
  | 'encounterActorTokenBindings'
  | 'encounterCharacterBindings'
  | 'encounterRuleOccurrenceBindings'
  | 'encounterSceneBindings'
  | 'sceneStates'
>

describe('live-session conflict keys', () => {
  it('keeps unrelated Character and Scene resources independent', () => {
    const character = {
      aggregateKind: 'CHARACTER',
      characterId: ids.characterA,
      command: {
        commandId: ids.command,
        expectedVersion: 1,
        inspired: true,
        type: 'SET_INSPIRATION'
      }
    } satisfies LiveSessionCommandDto
    const token = {
      aggregateKind: 'SCENE',
      command: {
        commandId: ids.command,
        correlationId: null,
        expectedEncounterVersion: 1,
        expectedSceneVersion: 1,
        movementKind: 'VOLUNTARY',
        path: [
          { x: 1, y: 2 },
          { x: 2, y: 2 }
        ],
        sceneId: ids.scene,
        tokenId: ids.token,
        type: 'MOVE_SCENE_TOKEN'
      }
    } satisfies LiveSessionCommandDto
    const door = {
      aggregateKind: 'SCENE',
      command: {
        barrierId: ids.door,
        commandId: ids.command,
        expectedSceneVersion: 1,
        sceneId: ids.scene,
        state: 'OPEN',
        type: 'SET_SCENE_DOOR_STATE'
      }
    } satisfies LiveSessionCommandDto
    const presentation = {
      aggregateKind: 'SESSION',
      command: {
        commandId: ids.command,
        expectedPresentationVersion: null,
        sceneId: ids.scene,
        sessionId: ids.session,
        type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
      }
    } satisfies LiveSessionCommandDto
    const undo = {
      aggregateKind: 'SCENE',
      command: {
        commandId: ids.command,
        expectedSceneVersion: 1,
        sceneId: ids.scene,
        type: 'UNDO_LAST_SCENE_MOVE'
      }
    } satisfies LiveSessionCommandDto
    const ambient = {
      aggregateKind: 'SCENE',
      command: {
        commandId: ids.command,
        expectedSceneVersion: 1,
        illumination: 'DIM',
        sceneId: ids.scene,
        type: 'SET_SCENE_AMBIENT_ILLUMINATION'
      }
    } satisfies LiveSessionCommandDto

    expect(deriveLiveSessionConflictKeys(character, snapshot)).toEqual([
      `character:${ids.characterA}`
    ])
    expect(deriveLiveSessionConflictKeys(token, snapshot)).toEqual([
      `character:${ids.characterA}`,
      `character:${ids.characterB}`,
      `encounter:${ids.encounter}`,
      `scene:${ids.scene}`,
      `scene:${ids.scene}:fog:shared`,
      `scene:${ids.scene}:token:${ids.token}`
    ])
    expect(deriveLiveSessionConflictKeys(door, snapshot)).toEqual([
      `character:${ids.characterA}`,
      `scene:${ids.scene}:barrier:${ids.door}`,
      `scene:${ids.scene}:fog:shared`
    ])
    expect(deriveLiveSessionConflictKeys(presentation, snapshot)).toEqual([
      `session:${ids.session}`
    ])
    expect(deriveLiveSessionConflictKeys(undo, snapshot)).toEqual([`scene:${ids.scene}`])
    expect(deriveLiveSessionConflictKeys(ambient, snapshot)).toEqual([
      `scene:${ids.scene}:environment:ambient-illumination`
    ])
  })

  it('claims the Encounter and every bound Character targeted by an action', () => {
    const command = {
      aggregateKind: 'ENCOUNTER',
      command: {
        actorId: ids.actorA,
        commandId: ids.command,
        encounterId: ids.encounter,
        expectedVersion: 3,
        actionId: 'attack',
        targetActorId: ids.actorB,
        sceneContext: null,
        type: 'RESOLVE_ACTION'
      }
    } satisfies LiveSessionCommandDto

    expect(deriveLiveSessionConflictKeys(command, snapshot)).toEqual([
      `character:${ids.characterA}`,
      `character:${ids.characterB}`,
      `encounter:${ids.encounter}`
    ])
  })

  it('uses Encounter bindings to supply vision for occurrence resolution', () => {
    const command = {
      aggregateKind: 'ENCOUNTER',
      command: {
        commandId: ids.command,
        correlationId: null,
        encounterId: ids.encounter,
        expectedOccurrenceVersion: 1,
        expectedVersion: 1,
        occurrenceId: ids.command,
        resolution: { kind: 'SYSTEM_ROLL', requestId: 'roll-1' },
        type: 'RESOLVE_RULE_OCCURRENCE'
      }
    } satisfies LiveSessionCommandDto
    const visionSnapshot = {
      ...snapshot,
      characterVisions: [{ characterId: ids.characterA, dimRange: { amount: 60, unit: 'FEET' } }]
    } satisfies Pick<
      LiveSessionCoordinatorSnapshotDto,
      'characterVisions' | 'encounterCharacterBindings'
    >

    expect(deriveLiveSessionSceneVisionContext(command, visionSnapshot)).toEqual({
      characterVisions: [{ characterId: ids.characterA, dimRange: { amount: 60, unit: 'FEET' } }],
      encounterCharacterBindings: snapshot.encounterCharacterBindings
    })
    expect(deriveLiveSessionConflictKeys(command, snapshot)).toEqual([
      `character:${ids.characterA}`,
      `character:${ids.characterB}`,
      `encounter:${ids.encounter}`,
      `scene:${ids.scene}`
    ])
  })

  it('fails closed when a spatial occurrence has no exact Encounter Scene', () => {
    const command = {
      aggregateKind: 'ENCOUNTER',
      command: {
        commandId: ids.command,
        correlationId: null,
        encounterId: ids.encounter,
        expectedOccurrenceVersion: 1,
        expectedVersion: 1,
        occurrenceId: ids.command,
        resolution: { kind: 'SYSTEM_ROLL', requestId: 'roll-1' },
        type: 'RESOLVE_RULE_OCCURRENCE'
      }
    } satisfies LiveSessionCommandDto

    expect(() => deriveLiveSessionConflictKeys(command, { ...snapshot, sceneStates: [] })).toThrow(
      'requires its exact authoritative Scene'
    )
  })
})
