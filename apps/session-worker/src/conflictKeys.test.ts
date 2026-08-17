import { describe, expect, it } from 'vitest'

import type {
  LiveSessionCommandDto,
  LiveSessionCoordinatorSnapshotDto
} from '@artificer-toolkit/schema/api/liveSessions'

import { deriveLiveSessionConflictKeys } from './conflictKeys.js'

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
  token: '00000000-0000-4000-8000-000000000009'
} as const

const snapshot = {
  encounterCharacterBindings: [
    { actorId: ids.actorA, characterId: ids.characterA, encounterId: ids.encounter },
    { actorId: ids.actorB, characterId: ids.characterB, encounterId: ids.encounter }
  ],
  sceneStates: [
    {
      annotations: [],
      barriers: [],
      campaignId: ids.campaign,
      darknessZones: [],
      definitionId: ids.scene,
      definitionVersion: 1,
      doorStates: {},
      encounterId: ids.encounter,
      fogLayers: [],
      fogMode: 'SHARED_PARTY',
      grid: { kind: 'GRIDLESS', pixelsPerUnit: 5, unit: 'FEET' },
      id: ids.scene,
      lights: [],
      map: { assetId: ids.scene, height: 100, tileManifestAssetId: null, width: 100 },
      measurements: [],
      name: 'Room',
      tokens: [
        {
          actorId: ids.actorA,
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
} satisfies Pick<LiveSessionCoordinatorSnapshotDto, 'encounterCharacterBindings' | 'sceneStates'>

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
        encounterId: ids.encounter,
        expectedSceneVersion: 1,
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
        encounterId: ids.encounter,
        expectedSceneVersion: 1,
        sceneId: ids.scene,
        state: 'OPEN',
        type: 'SET_SCENE_DOOR_STATE'
      }
    } satisfies LiveSessionCommandDto
    const attachment = {
      aggregateKind: 'SCENE',
      command: {
        commandId: ids.command,
        encounterId: ids.encounter,
        sceneDefinitionId: ids.scene,
        type: 'ATTACH_SCENE'
      }
    } satisfies LiveSessionCommandDto
    const undo = {
      aggregateKind: 'SCENE',
      command: {
        commandId: ids.command,
        encounterId: ids.encounter,
        expectedSceneVersion: 1,
        sceneId: ids.scene,
        type: 'UNDO_LAST_SCENE_MOVE'
      }
    } satisfies LiveSessionCommandDto

    expect(deriveLiveSessionConflictKeys(character, snapshot)).toEqual([
      `character:${ids.characterA}`
    ])
    expect(deriveLiveSessionConflictKeys(token, snapshot)).toEqual([
      `character:${ids.characterA}`,
      `scene:${ids.scene}:fog:shared`,
      `scene:${ids.scene}:token:${ids.token}`
    ])
    expect(deriveLiveSessionConflictKeys(door, snapshot)).toEqual([
      `character:${ids.characterA}`,
      `scene:${ids.scene}:barrier:${ids.door}`,
      `scene:${ids.scene}:fog:shared`
    ])
    expect(deriveLiveSessionConflictKeys(attachment, snapshot)).toEqual([
      `encounter:${ids.encounter}`
    ])
    expect(deriveLiveSessionConflictKeys(undo, snapshot)).toEqual([`scene:${ids.scene}`])
  })

  it('claims the Encounter and every bound Character targeted by an action', () => {
    const command = {
      aggregateKind: 'ENCOUNTER',
      command: {
        actorId: ids.actorA,
        commandId: ids.command,
        encounterId: ids.encounter,
        expectedVersion: 3,
        modelKey: 'attack',
        selections: {},
        targetActorIds: [ids.actorB],
        type: 'RESOLVE_ACTION',
        visibility: 'TABLE'
      }
    } satisfies LiveSessionCommandDto

    expect(deriveLiveSessionConflictKeys(command, snapshot)).toEqual([
      `character:${ids.characterA}`,
      `character:${ids.characterB}`,
      `encounter:${ids.encounter}`
    ])
  })
})
