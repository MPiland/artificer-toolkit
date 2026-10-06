import { afterEach, describe, expect, it, vi } from 'vitest'
import { sceneLiveStateHeaderSchema } from '@artificer-toolkit/schema/api/sceneLiveState'
import { liveSessionRoomAuthorizationSchema } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import { campaignSceneStateDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import { RoomEncounterStore } from './roomEncounterStore.js'
import { RoomInputs } from './roomInputs.js'
import { ROOM_SCENE_DEFINITION_HEADER } from './roomSceneDefinition.js'
import { composeRoomSceneVision } from './roomSceneVision.js'
import { encounterRunFixture } from './testing/encounterRunFixture.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'
import { uuid } from './testing/roomAggregateFixture.js'
import { roomAuthorizationResponse } from '../test/roomAuthorizationFixture.js'
import { roomInputsResponse } from '../test/roomInputsFixture.js'

const EPOCH = uuid(0xc00)
const CAMPAIGN = uuid(0xc01)
const SYSTEM = uuid(0xc02)
const GM = uuid(0xc03)
const PLAYER = uuid(0xc04)
const CHARACTER = uuid(0xc05)
const SCENE = uuid(0xc06)
const TOKEN = uuid(0xc07)
const MEMBERSHIP_EPOCH = '2026-09-30T00:00:00.000Z'
const databases: Array<{ close(): void }> = []

afterEach(() => {
  for (const database of databases.splice(0)) database.close()
})

/**
 * A room holding an ACTIVE Run bound to a Scene, whose Character actor owns one Scene token and
 * whose Character has no assignment in the Campaign.
 */
async function boundRoom() {
  const assignments: { characterId: string; userId: string }[] = []
  const members = [
    { userId: GM, role: 'OWNER' as const, membershipEpoch: MEMBERSHIP_EPOCH },
    { userId: PLAYER, role: 'PLAYER' as const, membershipEpoch: MEMBERSHIP_EPOCH }
  ]
  const authorization = liveSessionRoomAuthorizationSchema.parse(
    roomAuthorizationResponse({ members, assignments })
  )
  const authority = roomInputsResponse(
    { kind: 'AUTHORITY', cursor: null },
    { campaignId: CAMPAIGN, systemId: SYSTEM, ownerUserId: GM, members, assignments }
  )
  const system = roomInputsResponse(
    { kind: 'SYSTEM', part: 'SYSTEM' },
    { campaignId: CAMPAIGN, systemId: SYSTEM }
  )
  if (authority.kind !== 'AUTHORITY' || system.kind !== 'SYSTEM')
    throw new Error('Missing room fixture inputs.')
  const run = await encounterRunFixture({
    campaignId: CAMPAIGN,
    systemId: SYSTEM,
    actors: [{ characterId: CHARACTER }],
    scene: { sceneId: SCENE, tokenId: TOKEN }
  })
  const counts = { annotations: 0, barriers: 0, darknessZones: 0, lights: 0, tokens: 1 }
  const header = sceneLiveStateHeaderSchema.parse({
    id: SCENE,
    campaignId: CAMPAIGN,
    definitionId: uuid(0xc08),
    definitionSaveId: uuid(0xc09),
    definitionVersion: 1,
    name: 'Room Scene',
    ambientIllumination: 'BRIGHT',
    fogMode: 'OFF',
    visionRevealMode: 'ON_DRAG',
    grid: { kind: 'GRIDLESS', pixelsPerUnit: 50, unit: 'FEET' },
    map: { assetId: uuid(0xc0a), width: 1000, height: 1000, tileManifestAssetId: null },
    version: 0,
    fogLayerCount: 0,
    counts,
    currentCounts: { ...counts, measurements: 0 }
  })
  const {
    counts: _counts,
    currentCounts: _currentCounts,
    definitionSaveId: _saveId,
    fogLayerCount: _fogLayerCount,
    ...sceneHeader
  } = header
  const scene = campaignSceneStateDtoSchema.parse({
    ...sceneHeader,
    annotations: [],
    barriers: [],
    darknessZones: [],
    lights: [],
    tokens: [
      {
        id: TOKEN,
        assetId: null,
        controlledByUserIds: [],
        height: 1,
        width: 1,
        hidden: false,
        locked: false,
        label: 'Aria',
        rotationDegrees: 0,
        position: { x: 0, y: 0 },
        vision: null
      }
    ],
    measurements: [],
    fogLayers: [],
    doorStates: {}
  })
  const { storage, database } = createNodeSqliteRoomStorage()
  databases.push(database)
  const store = new RoomEncounterStore(storage)
  store.hydrate({
    epoch: EPOCH,
    documents: [...authority.documents, ...run.documents],
    records: [
      {
        kind: 'ROOM_INPUT',
        key: 'AUTHORITY',
        revision: JSON.stringify(authority.revisions),
        json: JSON.stringify({ ...authority, documents: [] })
      },
      {
        kind: 'ROOM_INPUT',
        key: 'SYSTEM:SYSTEM',
        revision: JSON.stringify(system.revisions),
        json: JSON.stringify(system)
      },
      {
        kind: ROOM_SCENE_DEFINITION_HEADER,
        key: SCENE,
        revision: null,
        json: canonicalizeJson(header)
      },
      {
        kind: 'SCENE_CHECKPOINT_SOURCE',
        key: SCENE,
        revision: null,
        json: canonicalizeJson({
          sceneId: SCENE,
          definitionSaveId: header.definitionSaveId,
          definitionVersion: header.definitionVersion,
          presentationVersion: 1
        })
      }
    ]
  })
  const inputs = new RoomInputs(
    store,
    vi.fn(async () => {
      throw new Error('Unexpected backend read.')
    }),
    async () => []
  )
  const compose = () =>
    store.transact((transaction) =>
      composeRoomSceneVision({
        store,
        transaction,
        inputs,
        authorization,
        campaignId: CAMPAIGN,
        epoch: EPOCH,
        scene
      })
    )
  return { compose, scene }
}

describe('composeRoomSceneVision', () => {
  it('binds no vision for a Character actor whose assignment was removed while the Run is held (D74)', async () => {
    const { compose, scene } = await boundRoom()
    await expect(compose()).resolves.toEqual({ scene, characterRevisions: [] })
  })
})
