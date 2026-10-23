import { afterEach, describe, expect, it, vi } from 'vitest'
import { sceneLiveStateHeaderSchema } from '@artificer-toolkit/schema/api/sceneLiveState'
import { liveSessionRoomAuthorizationSchema } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import { campaignSceneStateDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import { goblin } from '@artificer-toolkit/source-data/srd/creatures/goblin.js'
import {
  SRD_DARKVISION_SENSE_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { RoomEncounterStore } from './roomEncounterStore.js'
import { RoomInputs } from './roomInputs.js'
import { ROOM_SCENE_DEFINITION_HEADER } from './roomSceneDefinition.js'
import { composeRoomSceneVision } from './roomSceneVision.js'
import { encounterRunFixture } from './testing/encounterRunFixture.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'
import { uuid } from './testing/roomAggregateFixture.js'
import { roomAuthorizationResponse } from '../test/roomAuthorizationFixture.js'
import { roomInputsResponse } from '../test/roomInputsFixture.js'
import { darkvisionDefinition, srdSystemRoomInputs } from '../test/srdSenseInputsFixture.js'

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
 * A room holding an ACTIVE Run bound to a Scene whose one token belongs to the Run's one actor.
 * By default that actor is a Character with no assignment in the Campaign. With `creature` it is a
 * Creature of the SRD System, whose published Sense definitions the room holds. `sceneTokenId`
 * names the Scene's one token, which is not the actor's token when it differs from `TOKEN`.
 */
async function boundRoom(creature?: typeof goblin, sceneTokenId = TOKEN) {
  const systemId = creature ? srdSystemRecord.id : SYSTEM
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
    { campaignId: CAMPAIGN, systemId, ownerUserId: GM, members, assignments }
  )
  const system = creature
    ? srdSystemRoomInputs(CAMPAIGN)
    : roomInputsResponse({ kind: 'SYSTEM', part: 'SYSTEM' }, { campaignId: CAMPAIGN, systemId })
  const definitions = roomInputsResponse(
    { kind: 'DEFINITIONS', cursor: null },
    { campaignId: CAMPAIGN, systemId, definitions: creature ? [darkvisionDefinition] : [] }
  )
  if (
    authority.kind !== 'AUTHORITY' ||
    system.kind !== 'SYSTEM' ||
    definitions.kind !== 'DEFINITIONS'
  )
    throw new Error('Missing room fixture inputs.')
  const run = await encounterRunFixture({
    campaignId: CAMPAIGN,
    systemId,
    actors: creature ? [] : [{ characterId: CHARACTER }],
    creatures: creature ? [{ label: 'Goblin', tokenId: TOKEN, statBlock: creature }] : [],
    scene: { sceneId: SCENE, tokenId: creature ? undefined : TOKEN }
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
    daylight: false,
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
        id: sceneTokenId,
        assetId: null,
        controlledByUserIds: [],
        height: 1,
        width: 1,
        hidden: false,
        locked: false,
        label: creature?.label ?? 'Aria',
        rotationDegrees: 0,
        position: { x: 0, y: 0 },
        senses: [],
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
        kind: 'ROOM_INPUT',
        key: 'DEFINITIONS',
        revision: JSON.stringify(definitions.revisions),
        json: JSON.stringify({ ...definitions, definitions: [] })
      },
      ...definitions.definitions.map((definition) => ({
        kind: 'ROOM_DEFINITION',
        key: definition.id,
        revision: JSON.stringify(definitions.revisions),
        json: canonicalizeJson(definition)
      })),
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

  it("carries a Creature token's authored Senses, pinned to the System's Sense definitions (VTT_UI-5.2)", async () => {
    const { compose, scene } = await boundRoom(goblin)
    const { scene: composed, characterRevisions } = await compose()
    expect(characterRevisions).toEqual([])
    expect(composed.tokens).toEqual([
      {
        ...scene.tokens[0],
        senses: [
          {
            senseId: SRD_DARKVISION_SENSE_ID,
            label: 'Darkvision',
            channel: 'VISUAL',
            illuminationAccess: 'ORDINARY_DARKNESS',
            range: { rangeKind: 'DISTANCE', amount: 60 }
          }
        ]
      }
    ])
  })

  it('leaves a Scene token alone when the Creature bound to another token is not in the Scene', async () => {
    const { compose, scene } = await boundRoom(goblin, uuid(0xc10))
    await expect(compose()).resolves.toEqual({ scene, characterRevisions: [] })
  })

  it("refuses a Creature Sense the System's vocabulary does not list", async () => {
    const { compose } = await boundRoom({
      ...goblin,
      senses: [
        { senseDefinitionId: uuid(0xc11), range: { id: uuid(0xc12), rangeKind: 'UNLIMITED' } }
      ]
    })
    await expect(compose()).rejects.toThrow('Actor Sense is not a unique System vocabulary member.')
  })

  it('refuses a Creature with more Senses than the limit', async () => {
    const { compose } = await boundRoom({
      ...goblin,
      senses: Array.from({ length: 101 }, (_, index) => ({
        senseDefinitionId: uuid(0xd00 + index),
        range: { id: uuid(0xe00 + index), rangeKind: 'UNLIMITED' as const }
      }))
    })
    await expect(compose()).rejects.toThrow('Actor Sense limit exceeded.')
  })
})
