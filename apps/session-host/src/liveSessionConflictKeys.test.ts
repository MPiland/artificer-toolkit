import type {
  LiveSessionCommandDto,
  LiveSessionCoordinatorSnapshotDto
} from '@artificer-toolkit/schema/api/liveSessions'
import { describe, expect, it } from 'vitest'

import { deriveLiveSessionConflictKeys as deriveLocalKeys } from './liveSessionConflictKeys.js'
import { deriveLiveSessionConflictKeys as deriveRemoteKeys } from '../../session-worker/src/conflictKeys.js'

const ids = {
  actorA: '00000000-0000-4000-8000-000000000001',
  actorB: '00000000-0000-4000-8000-000000000002',
  characterA: '00000000-0000-4000-8000-000000000003',
  characterB: '00000000-0000-4000-8000-000000000004',
  campaign: '00000000-0000-4000-8000-000000000009',
  command: '00000000-0000-4000-8000-000000000005',
  encounter: '00000000-0000-4000-8000-000000000006',
  scene: '00000000-0000-4000-8000-000000000007',
  token: '00000000-0000-4000-8000-000000000008',
  userA: '00000000-0000-4000-8000-000000000011',
  userB: '00000000-0000-4000-8000-000000000012'
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

describe('local and remote live-session conflict-key parity', () => {
  it.each([
    {
      aggregateKind: 'SCENE',
      command: {
        commandId: ids.command,
        encounterId: ids.encounter,
        sceneDefinitionId: ids.scene,
        type: 'ATTACH_SCENE'
      }
    },
    {
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
    },
    {
      aggregateKind: 'SCENE',
      command: {
        commandId: ids.command,
        encounterId: ids.encounter,
        expectedSceneVersion: 1,
        sceneId: ids.scene,
        type: 'UNDO_LAST_SCENE_MOVE'
      }
    },
    {
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
    }
  ] satisfies LiveSessionCommandDto[])('derives identical keys for $aggregateKind', (command) => {
    expect(deriveLocalKeys(command, snapshot)).toEqual(deriveRemoteKeys(command, snapshot))
  })

  it('claims matching shared and per-player fog keys before exploration can be derived', () => {
    const move = {
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
    const barrier = {
      aggregateKind: 'SCENE',
      command: {
        barrier: {
          a: { x: 1, y: 1 },
          b: { x: 2, y: 2 },
          blocksLight: true,
          blocksMovement: true,
          id: ids.token,
          kind: 'WALL'
        },
        commandId: ids.command,
        encounterId: ids.encounter,
        expectedSceneVersion: 1,
        sceneId: ids.scene,
        type: 'UPSERT_SCENE_BARRIER'
      }
    } satisfies LiveSessionCommandDto
    const perPlayerSnapshot = {
      ...snapshot,
      sceneStates: snapshot.sceneStates.map((scene) => ({
        ...scene,
        fogMode: 'PER_PLAYER' as const,
        tokens: [
          { ...scene.tokens[0]!, controlledByUserIds: [ids.userA] },
          { ...scene.tokens[0]!, controlledByUserIds: [ids.userB], id: ids.encounter }
        ]
      }))
    } satisfies Pick<
      LiveSessionCoordinatorSnapshotDto,
      'encounterCharacterBindings' | 'sceneStates'
    >

    const cases = [
      [move, snapshot, [`scene:${ids.scene}:fog:shared`]],
      [move, perPlayerSnapshot, [`scene:${ids.scene}:fog:${ids.userA}`]],
      [
        barrier,
        perPlayerSnapshot,
        [`scene:${ids.scene}:fog:${ids.userA}`, `scene:${ids.scene}:fog:${ids.userB}`]
      ]
    ] as const
    for (const [command, currentSnapshot, expectedFogKeys] of cases) {
      const local = deriveLocalKeys(command, currentSnapshot)
      expect(local).toEqual(deriveRemoteKeys(command, currentSnapshot))
      expect(local).toEqual(expect.arrayContaining(expectedFogKeys))
    }
  })
})
