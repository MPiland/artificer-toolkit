import type {
  LiveSessionCommandDto,
  LiveSessionCoordinatorSnapshotDto
} from '@artificer-toolkit/schema/api/liveSessions'
import { describe, expect, it } from 'vitest'

import {
  deriveLiveSessionConflictKeys as deriveLocalKeys,
  deriveLiveSessionSceneVisionContext
} from './liveSessionConflictKeys.js'
import { deriveLiveSessionConflictKeys as deriveRemoteKeys } from '../../session-worker/src/conflictKeys.js'

const ids = {
  actorA: '00000000-0000-4000-8000-000000000001',
  actorB: '00000000-0000-4000-8000-000000000002',
  characterA: '00000000-0000-4000-8000-000000000003',
  characterB: '00000000-0000-4000-8000-000000000004',
  campaign: '00000000-0000-4000-8000-000000000009',
  command: '00000000-0000-4000-8000-000000000005',
  encounter: '00000000-0000-4000-8000-000000000006',
  occurrence: '00000000-0000-4000-8000-000000000010',
  scene: '00000000-0000-4000-8000-000000000007',
  session: '00000000-0000-4000-8000-000000000013',
  token: '00000000-0000-4000-8000-000000000008',
  userA: '00000000-0000-4000-8000-000000000011',
  userB: '00000000-0000-4000-8000-000000000012'
} as const

const snapshot = {
  characterVisions: [
    { characterId: ids.characterA, dimRange: { amount: 60, unit: 'FEET' } },
    { characterId: ids.characterB, dimRange: null }
  ],
  encounterCharacterBindings: [
    { actorId: ids.actorA, characterId: ids.characterA, encounterId: ids.encounter },
    { actorId: ids.actorB, characterId: ids.characterB, encounterId: ids.encounter }
  ],
  encounterRuleOccurrenceBindings: [
    {
      encounterId: ids.encounter,
      executionKind: 'SPATIAL',
      occurrenceId: ids.occurrence,
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
      map: { assetId: ids.scene, height: 100, tileManifestAssetId: null, width: 100 },
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
  | 'characterVisions'
  | 'encounterActorTokenBindings'
  | 'encounterCharacterBindings'
  | 'encounterRuleOccurrenceBindings'
  | 'encounterSceneBindings'
  | 'sceneStates'
>

describe('local and remote live-session conflict-key parity', () => {
  it.each([
    {
      aggregateKind: 'SESSION',
      command: {
        commandId: ids.command,
        expectedPresentationVersion: null,
        sceneId: ids.scene,
        sessionId: ids.session,
        type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
      }
    },
    {
      aggregateKind: 'SCENE',
      command: {
        commandId: ids.command,
        correlationId: null,
        expectedEncounterVersion: 3,
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
    },
    {
      aggregateKind: 'SCENE',
      command: {
        commandId: ids.command,
        expectedSceneVersion: 1,
        sceneId: ids.scene,
        type: 'UNDO_LAST_SCENE_MOVE'
      }
    },
    {
      aggregateKind: 'SCENE',
      command: {
        commandId: ids.command,
        expectedSceneVersion: 1,
        illumination: 'DIM',
        sceneId: ids.scene,
        type: 'SET_SCENE_AMBIENT_ILLUMINATION'
      }
    },
    {
      aggregateKind: 'ENCOUNTER',
      command: {
        actorId: ids.actorA,
        commandId: ids.command,
        encounterId: ids.encounter,
        expectedVersion: 3,
        actionId: 'attack',
        targetActorId: ids.actorB,
        type: 'RESOLVE_ACTION'
      }
    }
  ] satisfies LiveSessionCommandDto[])('derives identical keys for $aggregateKind', (command) => {
    expect(deriveLocalKeys(command, snapshot)).toEqual(deriveRemoteKeys(command, snapshot))
  })

  it('retains authoritative Character vision while an Encounter-rooted spatial occurrence resumes', () => {
    const command = {
      aggregateKind: 'ENCOUNTER',
      command: {
        commandId: ids.command,
        correlationId: null,
        encounterId: ids.encounter,
        expectedOccurrenceVersion: 1,
        expectedVersion: 3,
        occurrenceId: ids.occurrence,
        resolution: { kind: 'SYSTEM_ROLL', requestId: 'spatial-request' },
        type: 'RESOLVE_RULE_OCCURRENCE'
      }
    } satisfies LiveSessionCommandDto

    expect(deriveLiveSessionSceneVisionContext(command, snapshot)).toEqual({
      characterVisions: snapshot.characterVisions,
      encounterCharacterBindings: snapshot.encounterCharacterBindings
    })
    expect(deriveLocalKeys(command, snapshot)).toEqual(
      expect.arrayContaining([
        `character:${ids.characterA}`,
        `character:${ids.characterB}`,
        `encounter:${ids.encounter}`,
        `scene:${ids.scene}`
      ])
    )
  })

  it('does not claim a Scene for a non-spatial occurrence even when the Encounter has one', () => {
    const command = {
      aggregateKind: 'ENCOUNTER',
      command: {
        commandId: ids.command,
        correlationId: null,
        encounterId: ids.encounter,
        expectedOccurrenceVersion: 1,
        expectedVersion: 3,
        occurrenceId: ids.occurrence,
        resolution: { kind: 'SYSTEM_ROLL', requestId: 'action-request' },
        type: 'RESOLVE_RULE_OCCURRENCE'
      }
    } satisfies LiveSessionCommandDto
    const nonSpatialSnapshot = {
      ...snapshot,
      encounterRuleOccurrenceBindings: [
        {
          encounterId: ids.encounter,
          executionKind: 'NON_SPATIAL' as const,
          occurrenceId: ids.occurrence,
          sceneId: null
        }
      ]
    }

    const local = deriveLocalKeys(command, nonSpatialSnapshot)
    expect(local).toEqual(deriveRemoteKeys(command, nonSpatialSnapshot))
    expect(local).not.toContain(`scene:${ids.scene}`)
  })

  it('conservatively claims the Encounter aggregate set when an occurrence binding is absent', () => {
    const command = {
      aggregateKind: 'ENCOUNTER',
      command: {
        commandId: ids.command,
        correlationId: null,
        encounterId: ids.encounter,
        expectedOccurrenceVersion: 1,
        expectedVersion: 3,
        occurrenceId: ids.occurrence,
        resolution: { kind: 'SYSTEM_ROLL', requestId: 'spatial-request' },
        type: 'RESOLVE_RULE_OCCURRENCE'
      }
    } satisfies LiveSessionCommandDto

    const otherEncounter = '00000000-0000-4000-8000-000000000013'
    const otherCharacter = '00000000-0000-4000-8000-000000000014'
    const otherScene = '00000000-0000-4000-8000-000000000015'
    const terminalSnapshot = {
      ...snapshot,
      encounterRuleOccurrenceBindings: [],
      encounterCharacterBindings: [
        ...snapshot.encounterCharacterBindings,
        { actorId: otherCharacter, characterId: otherCharacter, encounterId: otherEncounter }
      ],
      sceneStates: [
        ...snapshot.sceneStates,
        { ...snapshot.sceneStates[0]!, id: otherScene, encounterId: otherEncounter }
      ]
    }
    expect(deriveLocalKeys(command, terminalSnapshot)).toEqual([
      `character:${ids.characterA}`,
      `character:${ids.characterB}`,
      `encounter:${ids.encounter}`,
      `scene:${ids.scene}`
    ])
    expect(deriveLocalKeys(command, terminalSnapshot)).toEqual(
      deriveRemoteKeys(command, terminalSnapshot)
    )
  })

  it('rejects duplicate occurrence bindings before execution', () => {
    const command = {
      aggregateKind: 'ENCOUNTER',
      command: {
        commandId: ids.command,
        correlationId: null,
        encounterId: ids.encounter,
        expectedOccurrenceVersion: 1,
        expectedVersion: 3,
        occurrenceId: ids.occurrence,
        resolution: { kind: 'SYSTEM_ROLL', requestId: 'spatial-request' },
        type: 'RESOLVE_RULE_OCCURRENCE'
      }
    } satisfies LiveSessionCommandDto
    const invalidSnapshot = {
      ...snapshot,
      encounterRuleOccurrenceBindings: [
        snapshot.encounterRuleOccurrenceBindings[0]!,
        snapshot.encounterRuleOccurrenceBindings[0]!
      ]
    }

    expect(() => deriveLocalKeys(command, invalidSnapshot)).toThrow(
      'requires one authoritative binding'
    )
    expect(() => deriveRemoteKeys(command, invalidSnapshot)).toThrow(
      'requires one authoritative binding'
    )
  })

  it('claims matching shared and per-player fog keys before exploration can be derived', () => {
    const move = {
      aggregateKind: 'SCENE',
      command: {
        commandId: ids.command,
        correlationId: null,
        encounterId: ids.encounter,
        expectedEncounterVersion: 3,
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
      if (command.command.type === 'MOVE_SCENE_TOKEN') {
        expect(local).toContain(`scene:${ids.scene}`)
      }
    }
  })
})
