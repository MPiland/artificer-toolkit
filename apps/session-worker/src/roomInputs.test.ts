import { describe, expect, it } from 'vitest'
import {
  liveRoomCharacterPartSchema,
  liveRoomDefinitionSchema,
  liveRoomInputsResponseSchema,
  type LiveRoomDefinition,
  type LiveRoomInputsDocument,
  type LiveRoomInputsInput,
  type LiveRoomInputsResponse,
  type LiveRoomInputsScope
} from '@artificer-toolkit/schema/api/liveRoomInputs'
import { readRoomInputsBatch } from '@artificer-toolkit/schema/api/liveRoomInputsBatch'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type {
  ContentSnapshotManifestDto,
  ContentSnapshotObject
} from '@artificer-toolkit/schema/api/contentSnapshots'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { liveSessionCheckpointSceneKeys } from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import { sceneLiveStateHeaderSchema } from '@artificer-toolkit/schema/api/sceneLiveState'
import { sceneStoredDefinitionEntitySchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { RoomEncounterStore, SCENE_EVIDENCE_ROW, type RoomRecord } from './roomEncounterStore.js'
import { SCENE_COMMAND_RETENTION_MS } from './roomSceneRecords.js'
import { RoomInputs, RoomInputsUnheldError } from './roomInputs.js'
import {
  ROOM_SCENE_DEFINITION_ENTITY,
  ROOM_SCENE_DEFINITION_HEADER
} from './roomSceneDefinition.js'
import { characterPageFixture } from './testing/characterPageFixture.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'
import { roomInputsResponse } from '../test/roomInputsFixture.js'
import {
  readCharacterRecord,
  readCharacterPlay
} from '@artificer-toolkit/schema/projections/characterStoredState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { canonicalJsonRecordSchema } from '@artificer-toolkit/schema/shared/jsonDelta'
import {
  campaignStoredConversationSchema,
  campaignStoredConversationMemberSchema,
  campaignStoredEntryHeaderSchema
} from '@artificer-toolkit/schema/projections/campaignCommunicationPersistence'
import { reusableDefinitionCurrentDtoSchema } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { ruleCapabilityReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/ruleState'

const uuid = (index: number) => `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`
const EPOCH = uuid(0x900)
const CAMPAIGN = uuid(2)
const ENCOUNTER = uuid(1)
const FIRST_CHARACTER = uuid(0x201)
const SECOND_CHARACTER = uuid(0x202)
const THIRD_CHARACTER = uuid(0x203)
const SCENE = uuid(0x500)
const FOG_SAVE = uuid(0x503)
const sceneSource = {
  sceneId: SCENE,
  definitionSaveId: uuid(0x501),
  definitionVersion: 2,
  presentationVersion: 3
}
const sceneBaseToken = {
  collection: 'tokens' as const,
  entity: {
    id: uuid(0x502),
    assetId: null,
    controlledByUserIds: [],
    height: 1,
    hidden: false,
    label: 'Immutable base token',
    locked: false,
    position: { x: 0, y: 0 },
    rotationDegrees: 0,
    senses: [],
    vision: null,
    width: 1
  }
}
const sceneDefinitionEntity = sceneStoredDefinitionEntitySchema.parse({
  saveId: sceneSource.definitionSaveId,
  entityId: sceneBaseToken.entity.id,
  ordinal: 0,
  value: sceneBaseToken,
  checksum: checksumCanonicalJson(sceneBaseToken)
})
const sceneDefinitionHeader = sceneLiveStateHeaderSchema.parse({
  id: SCENE,
  campaignId: CAMPAIGN,
  definitionId: uuid(0x520),
  definitionSaveId: sceneSource.definitionSaveId,
  definitionVersion: sceneSource.definitionVersion,
  version: 2,
  name: 'Room fixture Scene',
  ambientIllumination: 'BRIGHT',
  daylight: false,
  visionRevealMode: 'ON_DRAG',
  fogMode: 'OFF',
  grid: { kind: 'GRIDLESS', pixelsPerUnit: 50, unit: 'FEET' },
  map: { assetId: uuid(0x521), width: 1000, height: 1000, tileManifestAssetId: null },
  fogLayerCount: 1,
  counts: { annotations: 0, barriers: 0, darknessZones: 0, lights: 0, tokens: 1 },
  currentCounts: {
    annotations: 0,
    barriers: 0,
    darknessZones: 0,
    lights: 0,
    tokens: 0,
    measurements: 0
  }
})
/** A query page holds four Run documents and one Character effect, so every read spans pages. */
const RUN_PAGE_SIZE = 4
const EFFECT_PAGE_SIZE = 1
/** Workers Free allows 50 subrequests per invocation; a Run's hydrate must leave the room room. */
const HYDRATE_SUBREQUEST_BUDGET = 10

const characterPage = (() => {
  const part = liveRoomCharacterPartSchema.parse(characterPageFixture)
  if (part.status !== 'ASSIGNED') throw new Error('The Character fixture is not assigned.')
  return part
})()

function characterInputs(characterId: string, label = 1) {
  if (!characterPage.inputs) throw new Error('Missing Character fixture inputs.')
  const inputs = structuredClone(characterPage.inputs)
  const name = label === 1 ? inputs.owner.label : `${inputs.owner.label} ${label}`
  const userId = uuid(0x7000 + Number.parseInt(characterId.slice(-6), 16))
  const document = {
    ...canonicalJsonRecordSchema.parse(JSON.parse(inputs.owner.documentJson)),
    id: characterId,
    userId,
    label: name
  }
  return {
    ...inputs,
    owner: {
      ...inputs.owner,
      _id: `fixture:character:${characterId}`,
      id: characterId,
      userId,
      label: name,
      documentJson: JSON.stringify(document),
      checksum: checksumRuleDocument(document),
      play: {
        ...inputs.owner.play,
        _id: `fixture:character-play:${characterId}`,
        characterId,
        userId
      }
    }
  }
}

function atRevision(
  manifest: ContentSnapshotManifestDto,
  revision: number
): ContentSnapshotManifestDto {
  return {
    ...manifest,
    campaign: manifest.campaign && {
      ...manifest.campaign,
      head: {
        scope: 'CAMPAIGN',
        scopeId: manifest.campaign.id,
        revision,
        builtRevision: revision,
        kinds: {}
      }
    }
  }
}

const characterManifest = (() => {
  const manifest = characterPage.contentSnapshots
  if (!manifest) throw new Error('The Character fixture has no content manifest.')
  return manifest
})()

const revisions = (label: number, characterId?: string): LiveSessionRulesRevisions => [
  { scope: 'SYSTEM', id: uuid(3), revision: uuid(0x1000 + label) },
  { scope: 'CAMPAIGN', id: CAMPAIGN, revision: uuid(0x2000 + label) },
  characterId
    ? { scope: 'CHARACTER', id: characterId, revision: uuid(0x3000 + label) }
    : { scope: 'PLAY', id: CAMPAIGN, revision: uuid(0x4000 + label) }
]

function definitionFixture(
  id: string,
  sourceKind: LiveRoomDefinition['sourceKind'] = 'PLATFORM',
  systemId = uuid(3)
) {
  const document = ruleCapabilityReusableDefinitionDocumentDtoSchema.parse({
    schemaVersion: 1,
    kind: 'RULE_CAPABILITY',
    id,
    gameSystemId: systemId,
    usage: null
  })
  return liveRoomDefinitionSchema.parse({
    id,
    sourceKind,
    definition: reusableDefinitionCurrentDtoSchema.parse({
      id,
      gameSystemId: systemId,
      contentSourceId: uuid(0x601),
      definitionFamilyKey: 'rule-capability',
      label: `Capability ${id}`,
      description: null,
      document,
      checksum: checksumRuleDocument(document),
      contractVersion: 1,
      version: 1,
      publishedAt: '2026-09-29T00:00:00.000Z',
      publishedBy: uuid(4)
    })
  })
}

const checksum = (label: string) => sha256Hex(label)
let creationTime = 1_780_000_000_000
const document = (
  table: string,
  id: string,
  fields: Record<string, unknown>
): LiveRoomInputsDocument => ({ table, id, creationTime: creationTime++, fields })

/** A Run actor: a creature (`null`), a Character, or a Character whose state is frozen in the actor. */
type ActorSpec = null | string | { sourceId: string; frozen: true }

const frozenState = {
  currentHitPoints: 7,
  maxHitPoints: 11,
  tempHitPoints: 0,
  conditions: [],
  deathSaves: { successes: 0, failures: 0, stable: false }
}

function actorState(actor: ActorSpec, padding: number) {
  const filler = 'a'.repeat(padding)
  if (actor === null) return { kind: 'CREATURE', sourceId: uuid(0x300), filler }
  if (typeof actor === 'string')
    return { kind: 'CHARACTER', sourceId: actor, frozenState: null, filler }
  return { kind: 'CHARACTER', sourceId: actor.sourceId, frozenState, filler }
}

function runDocuments(actors: readonly ActorSpec[], padding: number) {
  return [
    document('encounterRuns', 'convex:run', {
      id: ENCOUNTER,
      campaignId: CAMPAIGN,
      gameSystemId: uuid(3),
      status: 'ACTIVE',
      version: 1,
      stateJson: '{}',
      stateChecksum: checksum('run'),
      createCommandId: uuid(4),
      createCommandFingerprint: checksum('create'),
      concentrationCasterCharacterIds: [],
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z'
    }),
    ...actors.map((actor, index) =>
      document('encounterRunActors', `convex:${0x100 + index}`, {
        id: uuid(0x100 + index),
        encounterId: ENCOUNTER,
        stateJson: JSON.stringify(actorState(actor, padding)),
        stateChecksum: checksum(`actor:${index}`),
        // A creature names its source facts; a Character's row carries none.
        snapshotChecksum: checksum(`snapshot:${index}`),
        formOriginSnapshotChecksum: null,
        sourceFactsChecksum: actor === null ? checksum(`facts:${index}`) : null
      })
    )
  ]
}

const effect = (characterId: string, ordinal: number) =>
  document('characterActiveRuleEffects', `convex:${0x4000 + ordinal}`, {
    id: uuid(0x4000 + ordinal),
    maintainedEffectStateId: null,
    createdOrdinal: ordinal,
    version: 1,
    definitionJson: '{}',
    definitionChecksum: checksum(`effect:${ordinal}`),
    lifecycle: { schemaVersion: 1, remainingTicks: null },
    lifecycleChecksum: checksum(`lifecycle:${ordinal}`),
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    characterId,
    concentrationCasterCharacterId: null,
    sourceEncounterId: null
  })

function sceneDocuments() {
  const counts = {
    annotations: 0,
    barriers: 0,
    darknessZones: 0,
    lights: 0,
    tokens: 0,
    measurements: 0
  }
  const chunks = [0, 1].map((ordinal) => ({
    data: 'AA==',
    width: 1,
    height: 1,
    index: ordinal,
    x: ordinal,
    y: 0
  }))
  const manifest = chunks.map((chunk) => ({
    index: chunk.index,
    checksum: checksumCanonicalJson(chunk)
  }))
  const rows = [
    document('sceneLiveStates', 'scene:head', {
      sceneId: SCENE,
      version: 2,
      fogLayerCount: 1,
      nextFogOrdinal: 1,
      settings: {
        ambientIllumination: { value: 'BRIGHT', daylight: false, version: 0 },
        visionRevealMode: { value: 'ON_DRAG', version: 0 },
        fogMode: { value: 'OFF', version: 0 }
      },
      counts,
      nextOrdinals: { ...counts, tokens: 1 }
    }),
    document('sceneLiveEntities', 'scene:tombstone', {
      sceneId: SCENE,
      collection: 'tokens',
      entityId: uuid(0x502),
      value: null,
      ordinal: null,
      version: 2,
      checksum: checksum('tombstone')
    }),
    document('sceneFogLayers', 'scene:layer', {
      sceneId: SCENE,
      ownerUserId: null,
      width: 2,
      height: 1,
      ordinal: 0,
      version: 2,
      chunks: manifest.map((entry, ordinal) => ({
        index: entry.index,
        saveId: FOG_SAVE,
        ordinal,
        checksum: entry.checksum
      })),
      checksum: checksum('layer')
    }),
    document('sceneFogSaves', 'scene:fogsave', {
      id: FOG_SAVE,
      sceneId: SCENE,
      commandId: uuid(0x505),
      actorUserId: uuid(4),
      input: {
        type: 'PATCH_SCENE_FOG',
        sceneId: SCENE,
        commandId: uuid(0x505),
        expectedSceneVersion: 1,
        layer: { ownerUserId: null, width: 2, height: 1 },
        chunkManifest: manifest
      },
      inputChecksum: checksum('fog'),
      status: 'PUBLISHED',
      receivedChunks: 2,
      expiresAt: 1,
      chunksRemoved: false
    }),
    ...chunks.map((chunk, ordinal) =>
      document('sceneFogChunks', `scene:chunk:${ordinal}`, {
        saveId: FOG_SAVE,
        ordinal,
        chunk,
        checksum: checksumCanonicalJson(chunk)
      })
    )
  ]
  for (const row of rows) {
    if (row.table === 'sceneLiveEntities' || row.table === 'sceneFogLayers') {
      const content = { ...row.fields }
      delete content.checksum
      row.fields.checksum = checksumCanonicalJson(content)
    } else {
      if ('input' in row.fields) row.fields.inputChecksum = checksumCanonicalJson(row.fields.input)
    }
  }
  return rows
}

/**
 * A Convex that serves the room's inputs from mutable state. `page` answers one query; `read`
 * answers one route call, which joins pages the way the real route does, so `reads.length` is the
 * number of Worker subrequests.
 */
function fakeConvex(actors: readonly ActorSpec[], padding: number, runPageSize: number) {
  const assignedCharacters = [
    ...new Set(actors.flatMap((actor) => (typeof actor === 'string' ? [actor] : [])))
  ]
  const authority = roomInputsResponse(
    { kind: 'AUTHORITY', cursor: null },
    {
      campaignId: CAMPAIGN,
      systemId: uuid(3),
      ownerUserId: uuid(4),
      members: [
        { userId: uuid(4), role: 'OWNER', membershipEpoch: '2026-09-29T00:00:00.000Z' },
        ...assignedCharacters.map((characterId) => ({
          userId: characterInputs(characterId).owner.userId,
          role: 'PLAYER' as const,
          membershipEpoch: '2026-09-29T00:00:00.000Z'
        }))
      ],
      assignments: assignedCharacters.map((characterId) => ({
        characterId,
        userId: characterInputs(characterId).owner.userId
      }))
    }
  )
  if (authority.kind !== 'AUTHORITY') throw new Error('Missing authority fixture.')
  const state = {
    authority: authority.documents,
    chatMetadata: new Array<LiveRoomInputsDocument>(),
    definitions: new Array<LiveRoomDefinition>(),
    onDefinitionPage: (_offset: number) => {},
    run: runDocuments(actors, padding),
    runVersion: 1,
    scene: sceneDocuments(),
    sceneVersion: 2,
    sceneSource: { ...sceneSource },
    onScenePage: (_pageIndex: number) => {},
    /** Called before each Run page is served, to change the Run between pages. */
    onRunPage: (_pageIndex: number) => {},
    /** Called before each Character is served, to change the Campaign during the hydrate. */
    onCharacterPage: (_characterId: string) => {},
    label: 1,
    unassigned: new Set<string>(),
    deleted: new Set<string>(),
    characters: new Map<string, LiveRoomInputsDocument[]>([
      [FIRST_CHARACTER, [effect(FIRST_CHARACTER, 1), effect(FIRST_CHARACTER, 2)]],
      [SECOND_CHARACTER, []]
    ])
  }
  const reads: { epoch: string; scope: LiveRoomInputsScope }[] = []
  const pages: LiveRoomInputsScope[] = []
  const serve = async ({ scope }: LiveRoomInputsInput): Promise<LiveRoomInputsResponse> => {
    pages.push(scope)
    switch (scope.kind) {
      case 'AUTHORITY': {
        const start = Number(scope.cursor?.paginationCursor ?? 0)
        const next = start + RUN_PAGE_SIZE
        return {
          kind: 'AUTHORITY',
          accountUserIds: authority.accountUserIds,
          revisions: revisions(state.label).filter((revision) => revision.scope !== 'PLAY'),
          documents: state.authority.slice(start, next),
          continueCursor:
            next < state.authority.length ? { position: 0, paginationCursor: String(next) } : null
        }
      }
      case 'CHAT_METADATA': {
        const start = Number(scope.cursor?.paginationCursor ?? 0)
        const next = start + 2
        return {
          kind: 'CHAT_METADATA',
          documents: state.chatMetadata.slice(start, next),
          continueCursor:
            next < state.chatMetadata.length
              ? { position: 0, paginationCursor: String(next) }
              : null
        }
      }
      case 'SCENE': {
        const start = Number(scope.cursor?.paginationCursor ?? 0)
        state.onScenePage(start)
        const next = start + 1
        return {
          kind: 'SCENE',
          source: { ...state.sceneSource },
          sceneVersion: state.sceneVersion,
          documents: state.scene.slice(start, next),
          continueCursor:
            next < state.scene.length
              ? {
                  position: Math.min(next, 4),
                  paginationCursor: String(next),
                  fogSave: next === 4 ? { id: FOG_SAVE, nextCursor: '1', isLast: false } : null
                }
              : null
        }
      }
      case 'SCENE_DEFINITION':
        return {
          kind: 'SCENE_DEFINITION',
          source: { ...state.sceneSource },
          header: sceneLiveStateHeaderSchema.parse({
            ...sceneDefinitionHeader,
            id: state.sceneSource.sceneId,
            definitionSaveId: state.sceneSource.definitionSaveId,
            definitionVersion: state.sceneSource.definitionVersion,
            version: state.sceneVersion,
            ...(state.scene.length === 0
              ? {
                  fogLayerCount: 0,
                  currentCounts: { ...sceneDefinitionHeader.counts, measurements: 0 }
                }
              : {})
          }),
          entities: [
            sceneStoredDefinitionEntitySchema.parse({
              ...sceneDefinitionEntity,
              saveId: state.sceneSource.definitionSaveId
            })
          ],
          continueCursor: null
        }
      case 'RUN': {
        const pageIndex = scope.cursor?.position ?? 0
        state.onRunPage(pageIndex)
        const start = pageIndex * runPageSize
        const next = start + runPageSize
        return {
          kind: 'RUN',
          encounterVersion: state.runVersion,
          activeEncounterId: null,
          maintenanceCharacterOwners: pageIndex === 0 ? [] : null,
          documents: state.run.slice(start, next),
          continueCursor:
            next < state.run.length ? { position: pageIndex + 1, paginationCursor: null } : null
        }
      }
      case 'CHARACTERS': {
        const position = scope.cursor?.position ?? 0
        const characterId = scope.characterIds[position]
        if (!characterId) throw new Error('Room input cursor is invalid.')
        state.onCharacterPage(characterId)
        const nextCharacter =
          position + 1 < scope.characterIds.length
            ? { position: position + 1, paginationCursor: null }
            : null
        if (state.unassigned.has(characterId) || state.deleted.has(characterId))
          return {
            kind: 'CHARACTERS',
            parts: [
              { status: state.deleted.has(characterId) ? 'DELETED' : 'UNASSIGNED', characterId }
            ],
            continueCursor: nextCharacter
          }
        const effects = state.characters.get(characterId) ?? []
        const offset = Number(scope.cursor?.paginationCursor ?? 0)
        const end = offset + EFFECT_PAGE_SIZE
        return {
          kind: 'CHARACTERS',
          parts: [
            {
              ...characterPage,
              characterId,
              revisions: revisions(state.label, characterId).filter(
                ({ scope }) => scope !== 'PLAY'
              ),
              inputs: offset === 0 ? characterInputs(characterId, state.label) : null,
              contentSnapshots: offset === 0 ? atRevision(characterManifest, state.label) : null,
              documents: effects.slice(offset, end)
            }
          ],
          continueCursor:
            end < effects.length ? { position, paginationCursor: String(end) } : nextCharacter
        }
      }
      case 'CAMPAIGN_PLAY':
        return {
          kind: 'CAMPAIGN_PLAY',
          revisions: revisions(state.label),
          contentSnapshots: atRevision(
            {
              systemId: uuid(3),
              sources: [],
              campaign: { id: CAMPAIGN, contentMaturity: 'STANDARD', head: null }
            },
            state.label
          ),
          campaign: {
            id: CAMPAIGN,
            gameSystemId: uuid(3),
            ownerUserId: uuid(4),
            contentMaturity: 'STANDARD',
            attunementSlotOverride: null,
            currencyOptions: []
          }
        }
      case 'SYSTEM':
        return { kind: 'SYSTEM', revisions: revisions(state.label), system: null, vocabulary: null }
      case 'CAMPAIGN_CLOCK':
        return { kind: 'CAMPAIGN_CLOCK', absoluteMinute: null }
      case 'DEFINITIONS': {
        const start = Number(scope.cursor?.paginationCursor ?? 0)
        state.onDefinitionPage(start)
        const next = start + 2
        return {
          kind: 'DEFINITIONS',
          revisions: revisions(state.label).filter(({ scope }) => scope !== 'PLAY'),
          definitions: state.definitions.slice(start, next),
          continueCursor:
            next < state.definitions.length ? { position: 0, paginationCursor: String(next) } : null
        }
      }
    }
  }
  // Every page crosses the shared contract the real handler and the Worker route both parse, so the
  // fake cannot emit a shape the real Convex could not. `apps/apis/convex/liveSessions/roomInputs.test.ts`
  // ("keeps the page properties the Worker fake relies on") proves the real handler's continuation,
  // revision stamping and page shape.
  const page = async (input: LiveRoomInputsInput) =>
    liveRoomInputsResponseSchema.parse(await serve(input))
  const read = (epoch: string, scope: LiveRoomInputsScope) => {
    reads.push({ epoch, scope })
    // Scene responses stay separate to exercise Worker continuation across route batch boundaries.
    if (scope.kind === 'SCENE') return page({ campaignId: CAMPAIGN, epoch, scope })
    return readRoomInputsBatch(page, { campaignId: CAMPAIGN, epoch, scope })
  }
  return { state, reads, pages, read }
}

function open(actors: readonly ActorSpec[], { padding = 0, runPageSize = RUN_PAGE_SIZE } = {}) {
  const convex = fakeConvex(actors, padding, runPageSize)
  const { storage } = createNodeSqliteRoomStorage()
  const store = new RoomEncounterStore(storage)
  const loads: ContentSnapshotManifestDto[] = []
  const epochsAtLoad: (string | null)[] = []
  const loaderState = { fail: false }
  const loadContent = async (
    manifest: ContentSnapshotManifestDto
  ): Promise<ContentSnapshotObject[]> => {
    loads.push(structuredClone(manifest))
    epochsAtLoad.push(store.epoch)
    if (loaderState.fail) throw new Error('R2 content unavailable.')
    return []
  }
  return {
    ...convex,
    storage,
    store,
    loads,
    epochsAtLoad,
    loaderState,
    loadContent,
    inputs: new RoomInputs(store, convex.read, loadContent)
  }
}

const kinds = (reads: readonly { scope: LiveRoomInputsScope }[] | readonly LiveRoomInputsScope[]) =>
  reads.map((read) => ('scope' in read ? read.scope.kind : read.kind))
const count = (
  reads: readonly { scope: LiveRoomInputsScope }[] | readonly LiveRoomInputsScope[],
  kind: LiveRoomInputsScope['kind']
) => kinds(reads).filter((read) => read === kind).length

describe('room inputs (ADR 0035 S2)', () => {
  describe('raw Scene hydration', () => {
    it('atomically loads all five families across pages and restores their exact SQLite records', async () => {
      const convex = open([FIRST_CHARACTER])
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER, sceneId: SCENE })

      expect(count(convex.reads, 'SCENE')).toBe(convex.state.scene.length)
      expect(count(convex.reads, 'SCENE_DEFINITION')).toBe(1)
      expect(convex.reads).toContainEqual({
        epoch: EPOCH,
        scope: {
          kind: 'SCENE',
          sceneId: SCENE,
          cursor: {
            position: 4,
            paginationCursor: '4',
            fogSave: { id: FOG_SAVE, nextCursor: '1', isLast: false }
          }
        }
      })
      expect(convex.store.records('SCENE_CHECKPOINT_SOURCE')).toEqual([
        {
          kind: 'SCENE_CHECKPOINT_SOURCE',
          key: SCENE,
          revision: null,
          json: canonicalizeJson(sceneSource)
        }
      ])
      const rows = convex.store.records('SCENE_CHECKPOINT_ROW')
      expect(rows).toHaveLength(convex.state.scene.length)
      for (const { table, fields } of convex.state.scene) {
        const keyFields =
          liveSessionCheckpointSceneKeys[table as keyof typeof liveSessionCheckpointSceneKeys]
        expect(rows).toContainEqual({
          kind: 'SCENE_CHECKPOINT_ROW',
          key: canonicalizeJson([table, ...keyFields.map((field) => fields[field])]),
          revision: null,
          json: canonicalizeJson(fields)
        })
      }
      expect(rows.some((row) => row.json.includes('"value":null'))).toBe(true)
      expect(rows.some((row) => row.json.includes('"ownerUserId":null'))).toBe(true)
      expect(convex.store.documents('encounterRuns')).toHaveLength(1)
      expect(convex.store.documents('characterActiveRuleEffects')).toHaveLength(2)
      expect(convex.store.logRows).toBe(0)

      convex.reads.length = 0
      const restored = new RoomEncounterStore(convex.storage)
      expect(restored.epoch).toBe(EPOCH)
      expect(restored.checksum).toBe(convex.store.checksum)
      expect(restored.records('SCENE_CHECKPOINT_SOURCE')).toEqual(
        convex.store.records('SCENE_CHECKPOINT_SOURCE')
      )
      expect(restored.records('SCENE_CHECKPOINT_ROW')).toEqual(rows)
      expect(restored.record(ROOM_SCENE_DEFINITION_HEADER, SCENE)).toEqual({
        kind: ROOM_SCENE_DEFINITION_HEADER,
        key: SCENE,
        revision: null,
        json: canonicalizeJson(sceneDefinitionHeader)
      })
      expect(restored.records(ROOM_SCENE_DEFINITION_ENTITY)).toEqual([
        {
          kind: ROOM_SCENE_DEFINITION_ENTITY,
          key: canonicalizeJson([
            sceneSource.definitionSaveId,
            'tokens',
            sceneDefinitionEntity.ordinal,
            sceneDefinitionEntity.entityId
          ]),
          revision: null,
          json: canonicalizeJson(sceneDefinitionEntity)
        }
      ])
      const retainedHeader = sceneLiveStateHeaderSchema.parse(
        JSON.parse(restored.record(ROOM_SCENE_DEFINITION_HEADER, SCENE)!.json)
      )
      expect(retainedHeader).toMatchObject({
        id: sceneSource.sceneId,
        definitionSaveId: sceneSource.definitionSaveId,
        definitionVersion: sceneSource.definitionVersion,
        counts: { tokens: 1 },
        currentCounts: { tokens: 0 }
      })
      expect(convex.reads).toEqual([])
    })

    it('keeps an untouched base Scene checkpoint as source-only at version zero', async () => {
      const convex = open([])
      convex.state.scene = []
      convex.state.sceneVersion = 0
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: null, sceneId: SCENE })
      expect(convex.store.records('SCENE_CHECKPOINT_SOURCE')).toHaveLength(1)
      expect(convex.store.records('SCENE_CHECKPOINT_ROW')).toEqual([])
      expect(convex.store.records(ROOM_SCENE_DEFINITION_ENTITY)).toHaveLength(1)
      expect(
        sceneLiveStateHeaderSchema.parse(
          JSON.parse(convex.store.record(ROOM_SCENE_DEFINITION_HEADER, SCENE)!.json)
        )
      ).toMatchObject({ version: 0, fogLayerCount: 0, currentCounts: { tokens: 1 } })
      expect(convex.store.epoch).toBe(EPOCH)
    })

    it('uses the fenced global journal base and restores it with the raw Scene', async () => {
      const convex = open([])
      const checkpoint = { epoch: EPOCH, sequence: 17, checksum: checksum('global-head') }
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: null, sceneId: SCENE, checkpoint })
      expect(convex.store.sequence).toBe(checkpoint.sequence)
      expect(convex.store.checksum).toBe(checkpoint.checksum)
      const restored = new RoomEncounterStore(convex.storage)
      expect(restored.sequence).toBe(checkpoint.sequence)
      expect(restored.checksum).toBe(checkpoint.checksum)
      expect(restored.records('SCENE_CHECKPOINT_ROW')).toEqual(
        convex.store.records('SCENE_CHECKPOINT_ROW')
      )
    })

    it('keeps the opaque geometry back-reference of a fog save', async () => {
      const convex = open([])
      const save = convex.state.scene[3]!.fields
      save.geometrySaveId = uuid(0x599)
      save.commandId = FOG_SAVE
      save.input = { ...(save.input as Record<string, unknown>), commandId: FOG_SAVE }
      save.inputChecksum = checksumCanonicalJson(save.input)
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: null, sceneId: SCENE })
      expect(convex.store.records('SCENE_CHECKPOINT_ROW')).toContainEqual({
        kind: 'SCENE_CHECKPOINT_ROW',
        key: canonicalizeJson(['sceneFogSaves', FOG_SAVE]),
        revision: null,
        json: canonicalizeJson(save)
      })
    })

    it('refuses a repeated continuation before reading it again', async () => {
      const convex = open([])
      const cursor = { position: 0, paginationCursor: 'repeat', fogSave: null }
      const inputs = new RoomInputs(
        convex.store,
        async (epoch, scope) => {
          if (scope.kind !== 'SCENE') return convex.read(epoch, scope)
          convex.reads.push({ epoch, scope })
          return {
            kind: 'SCENE',
            source: sceneSource,
            sceneVersion: 0,
            documents: [],
            continueCursor: cursor
          }
        },
        convex.loadContent
      )
      await expect(
        inputs.hydrate({ epoch: EPOCH, encounterId: null, sceneId: SCENE })
      ).rejects.toThrow('Scene input continuation repeated.')
      expect(count(convex.reads, 'SCENE')).toBe(2)
      expect(convex.store.epoch).toBeNull()
      expect(convex.store.records('SCENE_CHECKPOINT_ROW')).toEqual([])
    })

    it('preserves the no-Scene path for a null Scene', async () => {
      const convex = open([])
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: null, sceneId: null })
      expect(count(convex.reads, 'SCENE')).toBe(0)
      expect(count(convex.reads, 'SCENE_DEFINITION')).toBe(0)
      expect(convex.store.records('SCENE_CHECKPOINT_SOURCE')).toEqual([])
      expect(convex.store.records(ROOM_SCENE_DEFINITION_HEADER)).toEqual([])
      expect(convex.store.records(ROOM_SCENE_DEFINITION_ENTITY)).toEqual([])
    })

    it.each([
      'sceneVersion',
      'definitionSaveId',
      'definitionVersion',
      'presentationVersion'
    ] as const)('restarts a torn Scene read when %s changes between pages', async (pin) => {
      const convex = open([])
      let changed = false
      convex.state.onScenePage = (pageIndex) => {
        if (pageIndex !== 1 || changed) return
        changed = true
        if (pin === 'sceneVersion') {
          convex.state.sceneVersion += 1
          convex.state.scene[0]!.fields.version = convex.state.sceneVersion
        } else if (pin === 'definitionSaveId')
          convex.state.sceneSource.definitionSaveId = uuid(0x599)
        else convex.state.sceneSource[pin] += 1
      }
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: null, sceneId: SCENE })
      expect(count(convex.reads, 'SCENE')).toBe(convex.state.scene.length * 2)
      expect(convex.store.record('SCENE_CHECKPOINT_SOURCE', SCENE)?.json).toBe(
        canonicalizeJson(convex.state.sceneSource)
      )
      expect(convex.store.records('SCENE_CHECKPOINT_ROW')).toHaveLength(convex.state.scene.length)
      expect(count(convex.reads, 'SCENE_DEFINITION')).toBe(1)
      expect(
        sceneLiveStateHeaderSchema.parse(
          JSON.parse(convex.store.record(ROOM_SCENE_DEFINITION_HEADER, SCENE)!.json)
        )
      ).toMatchObject({
        definitionSaveId: convex.state.sceneSource.definitionSaveId,
        definitionVersion: convex.state.sceneSource.definitionVersion,
        version: convex.state.sceneVersion
      })
      expect(
        convex.store
          .records(ROOM_SCENE_DEFINITION_ENTITY)
          .map((record) => sceneStoredDefinitionEntitySchema.parse(JSON.parse(record.json)).saveId)
      ).toEqual([convex.state.sceneSource.definitionSaveId])
    })

    it('refuses three torn reads without storing partial initial inputs', async () => {
      const convex = open([FIRST_CHARACTER])
      convex.state.onScenePage = (pageIndex) => {
        if (pageIndex !== 1) return
        convex.state.sceneVersion += 1
        convex.state.scene[0]!.fields.version = convex.state.sceneVersion
      }
      await expect(
        convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER, sceneId: SCENE })
      ).rejects.toThrow('The Scene changed while it was being read.')
      expect(count(convex.reads, 'SCENE')).toBe(convex.state.scene.length * 3)
      expect(convex.store.epoch).toBeNull()
      expect(convex.store.records('ROOM_INPUT')).toEqual([])
      expect(convex.store.records('SCENE_CHECKPOINT_ROW')).toEqual([])
      expect(convex.store.documents('encounterRuns')).toEqual([])
      expect(convex.loads).toEqual([])
    })

    it.each([
      'unknown table',
      'foreign source',
      'foreign row',
      'missing fog save',
      'foreign fog save',
      'duplicate public key',
      'composed vision',
      'corrupt chunk',
      'changed entity checksum',
      'changed layer checksum',
      'changed chunk checksum',
      'missing saved chunk',
      'mismatched head',
      'missing head'
    ])('rejects %s and preserves the previous epoch and memory inputs', async (corruption) => {
      const convex = open([FIRST_CHARACTER])
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })
      const before = {
        checksum: convex.store.checksum,
        inputs: convex.store.records('ROOM_INPUT'),
        run: convex.store.documents('encounterRuns')
      }
      switch (corruption) {
        case 'unknown table':
          convex.state.scene[0]!.table = 'sceneUnknown'
          break
        case 'foreign source':
          convex.state.sceneSource.sceneId = uuid(0x599)
          break
        case 'foreign row':
          convex.state.scene[1]!.fields.sceneId = uuid(0x599)
          break
        case 'missing fog save':
          convex.state.scene = convex.state.scene.filter((row) => row.table !== 'sceneFogSaves')
          break
        case 'foreign fog save':
          convex.state.scene[3]!.fields.sceneId = uuid(0x599)
          break
        case 'duplicate public key':
          convex.state.scene.push({ ...convex.state.scene[1]!, id: 'scene:duplicate' })
          break
        case 'composed vision':
          convex.state.scene[1]!.fields.resolvedVision = {}
          break
        case 'corrupt chunk':
          convex.state.scene[4]!.fields.checksum = 'invalid'
          break
        case 'changed entity checksum':
          convex.state.scene[1]!.fields.checksum = checksum('changed')
          break
        case 'changed layer checksum':
          convex.state.scene[2]!.fields.checksum = checksum('changed')
          break
        case 'changed chunk checksum':
          convex.state.scene[4]!.fields.checksum = checksum('changed')
          break
        case 'missing saved chunk':
          convex.state.scene.splice(5, 1)
          break
        case 'mismatched head':
          convex.state.sceneVersion = 3
          break
        case 'missing head':
          convex.state.scene = convex.state.scene.slice(1)
          break
      }
      await expect(
        convex.inputs.hydrate({ epoch: uuid(0x901), encounterId: ENCOUNTER, sceneId: SCENE })
      ).rejects.toThrow()
      expect(convex.store.epoch).toBe(EPOCH)
      expect({
        checksum: convex.store.checksum,
        inputs: convex.store.records('ROOM_INPUT'),
        run: convex.store.documents('encounterRuns')
      }).toEqual(before)
      expect(convex.store.records('SCENE_CHECKPOINT_ROW')).toEqual([])
      const reads = convex.reads.length
      const loads = convex.loads.length
      await convex.inputs.play(revisions(1))
      expect(convex.reads).toHaveLength(reads)
      expect(convex.loads).toHaveLength(loads)
    })
  })

  describe('chat metadata hydration', () => {
    const conversationId = uuid(0x710)
    const nonce = uuid(0x711)
    const fingerprint = sha256Hex('retained native table-roll nonce evidence')
    const timestamp = '2026-09-29T00:00:00.000Z'
    function metadata(): LiveRoomInputsDocument[] {
      return [
        {
          table: 'campaignConversations',
          id: 'chat:conversation',
          creationTime: 0,
          fields: campaignStoredConversationSchema.parse({
            id: conversationId,
            campaignId: CAMPAIGN,
            kind: 'TABLE',
            participantUserIds: [],
            createdAt: timestamp
          })
        },
        {
          table: 'campaignConversationMembers',
          id: 'chat:member',
          creationTime: 0,
          fields: campaignStoredConversationMemberSchema.parse({
            conversationId,
            campaignId: CAMPAIGN,
            userId: uuid(4),
            accessStartedAt: timestamp,
            lastReadAt: null
          })
        },
        {
          table: 'campaignConversationEntries',
          id: 'chat:header',
          creationTime: 0,
          fields: campaignStoredEntryHeaderSchema.parse({
            id: uuid(0x712),
            campaignId: CAMPAIGN,
            conversationId,
            authorUserId: uuid(4),
            createdAt: timestamp,
            clientNonce: nonce,
            kind: 'ROLL',
            rollNonceFingerprint: fingerprint
          })
        }
      ]
    }

    it('hydrates paged nonce headers and reads their native index after SQLite eviction without historical payloads', async () => {
      const convex = open([])
      convex.state.chatMetadata = metadata()
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: null })
      expect(count(convex.pages, 'CHAT_METADATA')).toBe(2)
      expect(count(convex.reads, 'CHAT_METADATA')).toBe(1)
      expect(convex.store.documents('campaignConversations')).toHaveLength(1)
      expect(convex.store.documents('campaignConversationMembers')).toHaveLength(1)
      expect(convex.store.documents('campaignConversationEntryPayloads')).toEqual([])
      expect(convex.store.records('ROOM_INPUT').map(({ key }) => key)).not.toContain(
        'CHAT_METADATA'
      )
      const checksum = convex.store.checksum
      convex.reads.length = 0
      convex.loads.length = 0
      const restarted = new RoomEncounterStore(convex.storage)
      const header = await restarted.store
        .query('campaignConversationEntries')
        .withIndex('by_campaignId_authorUserId_clientNonce', (query) =>
          query.eq('campaignId', CAMPAIGN).eq('authorUserId', uuid(4)).eq('clientNonce', nonce)
        )
        .unique()
      expect(header).toMatchObject({ id: uuid(0x712), rollNonceFingerprint: fingerprint })
      expect(header).not.toHaveProperty('roll')
      expect(header).not.toHaveProperty('body')
      expect(restarted.documents('campaignConversationEntryPayloads')).toEqual([])
      expect(restarted.checksum).toBe(checksum)
      expect(convex.reads).toEqual([])
      expect(convex.loads).toEqual([])
    })

    it.each([
      'unknown table',
      'mixed Campaign',
      'missing conversation',
      'foreign member conversation',
      'foreign header conversation',
      'duplicate storage identity',
      'duplicate public identity',
      'duplicate member identity',
      'duplicate author nonce',
      'invalid header schema'
    ] as const)('refuses %s before replacing the durable snapshot', async (corruption) => {
      const convex = open([])
      convex.state.chatMetadata = metadata()
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: null })
      const checksum = convex.store.checksum
      const before = {
        conversations: convex.store.documents('campaignConversations'),
        members: convex.store.documents('campaignConversationMembers'),
        headers: convex.store.documents('campaignConversationEntries')
      }
      const rows = metadata()
      switch (corruption) {
        case 'unknown table':
          rows[2]!.table = 'campaignConversationEntryPayloads'
          break
        case 'mixed Campaign':
          rows[2]!.fields.campaignId = uuid(0x799)
          break
        case 'missing conversation':
          rows.splice(0, 1)
          break
        case 'foreign member conversation':
          rows[1]!.fields.conversationId = uuid(0x799)
          break
        case 'foreign header conversation':
          rows[2]!.fields.conversationId = uuid(0x799)
          break
        case 'duplicate storage identity':
          rows[2]!.id = rows[0]!.id
          break
        case 'duplicate public identity':
          rows.push({ ...rows[0]!, id: 'chat:duplicate-conversation' })
          break
        case 'duplicate member identity':
          rows.push({ ...rows[1]!, id: 'chat:duplicate-member' })
          break
        case 'duplicate author nonce':
          rows.push({
            ...rows[2]!,
            id: 'chat:duplicate-nonce',
            fields: { ...rows[2]!.fields, id: uuid(0x713) }
          })
          break
        case 'invalid header schema':
          rows[2]!.fields.rollNonceFingerprint = null
          break
      }
      convex.state.chatMetadata = rows
      await expect(
        convex.inputs.hydrate({ epoch: uuid(0x901), encounterId: null })
      ).rejects.toThrow()
      const restarted = new RoomEncounterStore(convex.storage)
      expect(restarted.epoch).toBe(EPOCH)
      expect(restarted.checksum).toBe(checksum)
      expect({
        conversations: restarted.documents('campaignConversations'),
        members: restarted.documents('campaignConversationMembers'),
        headers: restarted.documents('campaignConversationEntries')
      }).toEqual(before)
      expect(restarted.sequence).toBe(0)
      expect(restarted.logRows).toBe(0)
    })
  })

  describe('hydrate', () => {
    it('reads the Run, each Character once, the play scope and the System', async () => {
      const convex = open([FIRST_CHARACTER, null, SECOND_CHARACTER, FIRST_CHARACTER, null])
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })

      expect(convex.store.epoch).toBe(EPOCH)
      expect(convex.reads.every((read) => read.epoch === EPOCH)).toBe(true)
      // Six Run documents in pages of four join into one call; the two distinct Characters, whose
      // effects arrive one per page, into another (a duplicate actor does not read again).
      expect(count(convex.reads, 'RUN')).toBe(1)
      expect(count(convex.reads, 'CHARACTERS')).toBe(1)
      expect(count(convex.reads, 'CAMPAIGN_PLAY')).toBe(1)
      expect(count(convex.reads, 'AUTHORITY')).toBe(1)
      expect(count(convex.reads, 'CHAT_METADATA')).toBe(1)
      expect(count(convex.reads, 'SYSTEM')).toBe(2)
      expect(count(convex.reads, 'DEFINITIONS')).toBe(1)
      expect(count(convex.pages, 'RUN')).toBe(2)
      expect(count(convex.pages, 'CHARACTERS')).toBe(3)
      expect(convex.loads).toHaveLength(3)
      expect(convex.epochsAtLoad).toEqual([null, null, null])
      expect(convex.loads.filter((manifest) => manifest.systemId === uuid(3))).toHaveLength(1)
      const characterPages = convex.pages.filter((scope) => scope.kind === 'CHARACTERS')
      expect(characterPages).toHaveLength(3)

      expect(convex.store.documents('encounterRunActors')).toHaveLength(5)
      expect(convex.store.documents('characterActiveRuleEffects')).toHaveLength(2)
      expect(convex.store.documents('campaigns')).toHaveLength(1)
      expect(convex.store.documents('campaignMemberships')).toHaveLength(3)
      expect(convex.store.documents('campaignCharacterAssignments')).toHaveLength(2)
      expect(convex.store.documents('characterPlayStates')).toHaveLength(2)
      const initialPlay = convex.store
        .documents('characterPlayStates')
        .find((row) => row.characterId === FIRST_CHARACTER)
      expect(initialPlay).toEqual(characterInputs(FIRST_CHARACTER).owner.play)
      expect(readCharacterPlay(initialPlay!)).toEqual(
        characterInputs(FIRST_CHARACTER).owner.play.state
      )
      expect(convex.store.records('ROOM_INPUT').map((record) => record.key)).toEqual([
        'AUTHORITY',
        'CAMPAIGN_PLAY',
        `CHARACTER:${FIRST_CHARACTER}`,
        `CHARACTER:${SECOND_CHARACTER}`,
        'DEFINITIONS',
        `RUN:${ENCOUNTER}`,
        'SYSTEM:SYSTEM',
        'SYSTEM:VOCABULARY'
      ])
    })

    const historyBase = (commandId: string, encounterId: string) => ({
      campaignId: CAMPAIGN,
      encounterId,
      commandId,
      commandFingerprint: '0'.repeat(64),
      actorUserId: uuid(0xb01),
      createdAt: '2026-05-05T12:00:00.000Z'
    })
    const historyCommand = (commandId: string, encounterId: string) =>
      ({ ...historyBase(commandId, encounterId), commandType: 'CREATE' }) as const
    const historyReceipt = (commandId: string, encounterId: string) => ({
      ...historyBase(commandId, encounterId),
      id: uuid(0xc01),
      occurrenceId: uuid(0xc02),
      commandType: 'ADVANCE_TURN',
      encounterVersion: 1,
      commandMetadataJson: '{}',
      resultJson: '{}',
      resultChecksum: '0'.repeat(64),
      correlationId: null
    })
    const heldHistory = (store: RoomEncounterStore) =>
      [
        ...store
          .documents('encounterRunCommands')
          .map((row) => `encounterRunCommands:${row.commandId}`),
        ...store
          .documents('encounterRuleReceipts')
          .map((row) => `encounterRuleReceipts:${row.commandId}`)
      ].sort()

    it('carries the held history of every Run through a same-epoch reload and a new-epoch activation', async () => {
      const convex = open([FIRST_CHARACTER])
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })
      await convex.store.transact(async () => {
        await convex.store.store.insert(
          'encounterRunCommands',
          historyCommand(uuid(0xa01), ENCOUNTER)
        )
        await convex.store.store.insert(
          'encounterRuleReceipts',
          historyReceipt(uuid(0xa02), ENCOUNTER)
        )
        await convex.store.store.insert(
          'encounterRunCommands',
          historyCommand(uuid(0xa03), uuid(0xfff))
        )
      })
      const carried = [
        `encounterRuleReceipts:${uuid(0xa02)}`,
        `encounterRunCommands:${uuid(0xa01)}`,
        `encounterRunCommands:${uuid(0xa03)}`
      ]

      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })
      expect(heldHistory(convex.store)).toEqual(carried)

      await convex.inputs.hydrate({ epoch: uuid(0x902), encounterId: ENCOUNTER })
      expect(convex.store.epoch).toBe(uuid(0x902))
      expect(heldHistory(convex.store)).toEqual(carried)
    })

    it('keeps an unbound Run history through release and restores it once when the Run loads again', async () => {
      const convex = open([FIRST_CHARACTER])
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })
      await convex.store.transact(async () => {
        await convex.store.store.insert(
          'encounterRunCommands',
          historyCommand(uuid(0xa01), ENCOUNTER)
        )
        await convex.store.store.insert(
          'encounterRuleReceipts',
          historyReceipt(uuid(0xa02), ENCOUNTER)
        )
      })
      const expected = [
        `encounterRuleReceipts:${uuid(0xa02)}`,
        `encounterRunCommands:${uuid(0xa01)}`
      ]

      // The release leaves the Run unbound, so the next activation hydrates no Encounter.
      await convex.inputs.hydrate({ epoch: uuid(0x902), encounterId: null })
      expect(convex.store.documents('encounterRuns')).toHaveLength(0)
      expect(heldHistory(convex.store)).toEqual(expected)

      // Convex holds a copy of one held row and one row only it recorded.
      convex.state.run.push(
        document(
          'encounterRunCommands',
          'convex:command-held',
          historyCommand(uuid(0xa01), ENCOUNTER)
        ),
        document(
          'encounterRunCommands',
          'convex:command-new',
          historyCommand(uuid(0xa04), ENCOUNTER)
        )
      )
      await convex.store.transact((transaction) => convex.inputs.encounter(ENCOUNTER, transaction))

      expect(convex.store.documents('encounterRuns')).toHaveLength(1)
      expect(heldHistory(convex.store)).toEqual([
        `encounterRuleReceipts:${uuid(0xa02)}`,
        `encounterRunCommands:${uuid(0xa01)}`,
        `encounterRunCommands:${uuid(0xa04)}`
      ])
    })

    it('carries Scene command evidence through a reload and a new epoch, and drops it after thirty days', async () => {
      const convex = open([FIRST_CHARACTER])
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: null, sceneId: SCENE })
      const evidence = (commandId: string, writtenAt: number): RoomRecord => ({
        kind: SCENE_EVIDENCE_ROW,
        key: canonicalizeJson(['sceneLiveCommands', SCENE, commandId]),
        revision: String(writtenAt),
        json: canonicalizeJson({ sceneId: SCENE, commandId })
      })
      const fresh = evidence(uuid(0xe01), Date.now())
      const aged = evidence(uuid(0xe02), Date.now() - SCENE_COMMAND_RETENTION_MS - 60_000)
      await convex.store.transact(async (transaction) => {
        transaction.setRecord(fresh)
        transaction.setRecord(aged)
      })

      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: null, sceneId: SCENE })
      expect(convex.store.records(SCENE_EVIDENCE_ROW)).toEqual([fresh])

      await convex.inputs.hydrate({ epoch: uuid(0x902), encounterId: null, sceneId: null })
      expect(convex.store.epoch).toBe(uuid(0x902))
      expect(convex.store.records(SCENE_EVIDENCE_ROW)).toEqual([fresh])
    })

    it('loads Campaign content and System inputs before an Encounter is bound', async () => {
      const convex = open([FIRST_CHARACTER])
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: null })
      expect(kinds(convex.reads)).toEqual([
        'CAMPAIGN_PLAY',
        'SYSTEM',
        'SYSTEM',
        'AUTHORITY',
        'CHAT_METADATA',
        'DEFINITIONS'
      ])
      expect(convex.loads).toHaveLength(1)
      expect(convex.epochsAtLoad).toEqual([null])
      expect(convex.loads[0]).toMatchObject({ systemId: uuid(3), campaign: { id: CAMPAIGN } })
      expect(convex.store.epoch).toBe(EPOCH)
      expect(convex.store.documents('encounterRuns')).toEqual([])
      expect(convex.store.records('ROOM_INPUT').map((record) => record.key)).toEqual([
        'AUTHORITY',
        'CAMPAIGN_PLAY',
        'DEFINITIONS',
        'SYSTEM:SYSTEM',
        'SYSTEM:VOCABULARY'
      ])
    })

    it('leaves the store unhydrated when content loading fails', async () => {
      const convex = open([FIRST_CHARACTER])
      convex.loaderState.fail = true
      await expect(convex.inputs.hydrate({ epoch: EPOCH, encounterId: null })).rejects.toThrow(
        'R2 content unavailable.'
      )
      expect(convex.store.epoch).toBeNull()
      expect(convex.store.records('ROOM_INPUT')).toEqual([])
      expect(convex.store.documents('encounterRuns')).toEqual([])
    })

    it('reads the Run again when a command changed it between pages', async () => {
      const convex = open([FIRST_CHARACTER, null, SECOND_CHARACTER, null, null])
      let changed = false
      convex.state.onRunPage = (pageIndex) => {
        if (pageIndex === 1 && !changed) {
          changed = true
          convex.state.runVersion += 1
        }
      }
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })
      // The torn first read takes two calls (the batch stops at the version change); the second, one.
      expect(count(convex.reads, 'RUN')).toBe(3)
      expect(convex.store.documents('encounterRuns')).toHaveLength(1)
    })

    it('fails, leaving the store untouched, when the Run never holds still', async () => {
      const convex = open([FIRST_CHARACTER, null, null, null, null])
      convex.state.onRunPage = (pageIndex) => {
        if (pageIndex === 1) convex.state.runVersion += 1
      }
      await expect(convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })).rejects.toThrow(
        'changed while it was being read'
      )
      expect(convex.store.epoch).toBeNull()
    })

    it('refuses a Character without stored inputs', async () => {
      const convex = open([FIRST_CHARACTER])
      const read = convex.read
      const inputs = new RoomInputs(
        convex.store,
        async (epoch, scope) => {
          const response = await read(epoch, scope)
          return response.kind === 'CHARACTERS'
            ? {
                ...response,
                parts: response.parts.map((part) =>
                  part.status === 'ASSIGNED' ? { ...part, inputs: null } : part
                )
              }
            : response
        },
        convex.loadContent
      )
      await expect(inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })).rejects.toThrow(
        'Character inputs are missing'
      )
      expect(convex.store.epoch).toBeNull()
    })
  })

  describe('subrequest budget', () => {
    const characters = Array.from({ length: 12 }, (_, index) => uuid(0x201 + index))

    it('hydrates a Run of 11 actors in a handful of subrequests', async () => {
      const convex = open([...characters.slice(0, 3), ...Array<null>(8).fill(null)])
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })
      // Campaign authority, chat metadata and definitions, play, System/vocabulary, Run and Characters.
      expect(convex.reads).toHaveLength(8)
      expect(convex.store.documents('encounterRunActors')).toHaveLength(11)
    })

    it('hydrates a Run of 100 actors with 12 Characters within the subrequest budget', async () => {
      const convex = open([...characters, ...Array<null>(88).fill(null)], {
        padding: 6_000,
        runPageSize: 8
      })
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })

      expect(convex.reads.length).toBeLessThanOrEqual(HYDRATE_SUBREQUEST_BUDGET)
      expect(count(convex.reads, 'RUN')).toBe(1)
      expect(count(convex.reads, 'CHARACTERS')).toBe(1)
      // The query pages behind those calls are what a per-page route would have spent.
      expect(count(convex.pages, 'RUN')).toBe(13)
      expect(count(convex.pages, 'CHARACTERS')).toBeGreaterThanOrEqual(12)
      expect(convex.store.documents('encounterRunActors')).toHaveLength(100)
      expect(
        convex.store.records('ROOM_INPUT').filter((record) => record.key.startsWith('CHARACTER:'))
      ).toHaveLength(12)
    })

    it('spends a further call per byte budget on a Run of very large actors', async () => {
      // Each actor is about 300 KB, so two pages of three actors exceed the 2 MB batch budget.
      const convex = open([...characters.slice(0, 2), ...Array<null>(10).fill(null)], {
        padding: 300_000,
        runPageSize: 4
      })
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })
      expect(count(convex.reads, 'RUN')).toBe(2)
      expect(count(convex.pages, 'RUN')).toBe(4)
      expect(convex.store.documents('encounterRunActors')).toHaveLength(12)
    })
  })

  describe('a Character that left the Campaign', () => {
    it('reads no inputs for an actor whose state is frozen', async () => {
      const convex = open([FIRST_CHARACTER, { sourceId: SECOND_CHARACTER, frozen: true }, null])
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })

      expect([
        ...new Set(
          convex.pages.flatMap((scope) => (scope.kind === 'CHARACTERS' ? scope.characterIds : []))
        )
      ]).toEqual([FIRST_CHARACTER])
      expect(convex.store.records('ROOM_INPUT').map((record) => record.key)).not.toContain(
        `CHARACTER:${SECOND_CHARACTER}`
      )
      const frozen = convex.store
        .documents('encounterRunActors')
        .map((row) => JSON.parse(row.stateJson) as { frozenState: unknown })
        .filter((actor) => actor.frozenState !== null && actor.frozenState !== undefined)
      expect(frozen).toHaveLength(1)
    })

    it('hydrates a Run whose Character left or was deleted, leaving its actor to the reconcile', async () => {
      const convex = open([FIRST_CHARACTER, SECOND_CHARACTER, THIRD_CHARACTER])
      convex.state.unassigned.add(SECOND_CHARACTER)
      convex.state.deleted.add(THIRD_CHARACTER)
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })

      // Convex writes no actors of a held Run (D74), so both stay unfrozen until the reconcile.
      expect(count(convex.reads, 'RUN')).toBe(1)
      expect(convex.store.records('ROOM_INPUT').map((record) => record.key)).toEqual([
        'AUTHORITY',
        'CAMPAIGN_PLAY',
        `CHARACTER:${FIRST_CHARACTER}`,
        'DEFINITIONS',
        `RUN:${ENCOUNTER}`,
        'SYSTEM:SYSTEM',
        'SYSTEM:VOCABULARY'
      ])
      expect(
        convex.store
          .documents('encounterRunActors')
          .map((row) => JSON.parse(row.stateJson) as { frozenState: unknown })
          .every((actor) => actor.frozenState === null)
      ).toBe(true)
      expect(await convex.inputs.deletedCharacterIds([SECOND_CHARACTER, THIRD_CHARACTER])).toEqual(
        new Set([THIRD_CHARACTER])
      )
    })

    it('refuses a demand read of a Character that left the Campaign', async () => {
      const convex = open([FIRST_CHARACTER])
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })
      convex.state.unassigned.add(FIRST_CHARACTER)
      await expect(convex.inputs.character(FIRST_CHARACTER, null)).rejects.toThrow(
        'no longer assigned'
      )
    })
  })

  describe('complete definition inventory', () => {
    const firstId = uuid(0x610)
    const privateId = uuid(0x611)
    const draftId = uuid(0x612)
    const nextId = uuid(0x613)
    const inventory = () => [
      definitionFixture(firstId),
      definitionFixture(privateId, 'USER'),
      liveRoomDefinitionSchema.parse({ id: draftId, sourceKind: 'USER', definition: null })
    ]
    const snapshot = (store: RoomEncounterStore) => ({
      epoch: store.epoch,
      sequence: store.sequence,
      checksum: store.checksum,
      logRows: store.logRows,
      definitions: store.records('ROOM_DEFINITION'),
      inputs: store.records('ROOM_INPUT')
    })

    it('serves first-use, unpublished and missing IDs from the complete SQLite inventory through PLAY changes and eviction', async () => {
      const convex = open([])
      convex.state.definitions = inventory()
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: null })
      expect(count(convex.pages, 'DEFINITIONS')).toBe(2)
      expect(count(convex.reads, 'DEFINITIONS')).toBe(1)
      expect(JSON.parse(convex.store.record('ROOM_INPUT', 'DEFINITIONS')!.json)).toEqual({
        kind: 'DEFINITIONS',
        revisions: revisions(1).filter(({ scope }) => scope !== 'PLAY'),
        definitions: [],
        continueCursor: null
      })
      expect(
        convex.store
          .records('ROOM_DEFINITION')
          .map(({ json }) => liveRoomDefinitionSchema.parse(JSON.parse(json)))
      ).toEqual(convex.state.definitions)
      const before = snapshot(convex.store)
      convex.reads.length = 0
      const observed = revisions(1).map((entry) =>
        entry.scope === 'PLAY' ? { ...entry, revision: uuid(0x999) } : entry
      )
      for (const inputs of [
        convex.inputs,
        new RoomInputs(new RoomEncounterStore(convex.storage), convex.read, convex.loadContent)
      ]) {
        expect(await inputs.definition(firstId, observed)).toEqual({
          definition: convex.state.definitions[0]!.definition,
          sourceKind: 'PLATFORM'
        })
        expect(await inputs.definition(privateId, observed)).toMatchObject({
          sourceKind: 'USER',
          definition: { id: privateId }
        })
        expect(await inputs.definition(draftId, observed)).toEqual({
          definition: null,
          sourceKind: 'USER'
        })
        expect(await inputs.definition(uuid(0x699), observed)).toEqual({
          definition: null,
          sourceKind: null
        })
      }
      expect(convex.reads).toEqual([])
      expect(snapshot(convex.store)).toEqual(before)
      expect(snapshot(new RoomEncounterStore(convex.storage))).toEqual(before)
    })

    it('replaces revoked and deleted roots atomically, preserving the previous inventory on parent rollback', async () => {
      const convex = open([])
      convex.state.definitions = inventory()
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: null })
      await convex.store.transact(async (transaction) =>
        transaction.setRecord({
          kind: 'ROOM_INPUT',
          key: `DEFINITION:${firstId}`,
          revision: null,
          json: '{}'
        })
      )
      const before = snapshot(convex.store)
      convex.state.label = 2
      convex.state.definitions = [definitionFixture(nextId, 'USER')]
      convex.reads.length = 0
      await expect(
        convex.store.transact(async (transaction) => {
          expect(await convex.inputs.definition(firstId, revisions(2), transaction)).toEqual({
            definition: null,
            sourceKind: null
          })
          expect(await convex.inputs.definition(privateId, revisions(2), transaction)).toEqual({
            definition: null,
            sourceKind: null
          })
          expect(await convex.inputs.definition(nextId, revisions(2), transaction)).toMatchObject({
            sourceKind: 'USER',
            definition: { id: nextId }
          })
          expect(transaction.record('ROOM_INPUT', `DEFINITION:${firstId}`)).toBeNull()
          expect(convex.store.records('ROOM_DEFINITION')).toEqual(before.definitions)
          throw new Error('Parent command refused.')
        })
      ).rejects.toThrow('Parent command refused.')
      expect(kinds(convex.reads)).toEqual(['DEFINITIONS'])
      expect(snapshot(convex.store)).toEqual(before)
      expect(snapshot(new RoomEncounterStore(convex.storage))).toEqual(before)
      convex.reads.length = 0
      expect(await convex.inputs.definition(firstId, revisions(1))).toMatchObject({
        definition: { id: firstId },
        sourceKind: 'PLATFORM'
      })
      expect(convex.reads).toEqual([])

      await convex.store.transact(async (transaction) => {
        await convex.inputs.definition(nextId, revisions(2), transaction)
        expect(await convex.inputs.definition(firstId, revisions(2), transaction)).toEqual({
          definition: null,
          sourceKind: null
        })
      })
      expect(convex.store.logRows).toBe(before.logRows + 1)
      expect(convex.store.records('ROOM_DEFINITION').map(({ key }) => key)).toEqual([nextId])
      expect(convex.store.record('ROOM_INPUT', `DEFINITION:${firstId}`)).toBeNull()
      convex.reads.length = 0
      const restarted = new RoomInputs(
        new RoomEncounterStore(convex.storage),
        convex.read,
        convex.loadContent
      )
      expect(await restarted.definition(privateId, revisions(2))).toEqual({
        definition: null,
        sourceKind: null
      })
      expect(await restarted.definition(nextId, revisions(2))).toMatchObject({
        definition: { id: nextId },
        sourceKind: 'USER'
      })
      expect(convex.reads).toEqual([])
    })

    it('restarts the full paged inventory after a revision tear and refuses a continuously changing read', async () => {
      const convex = open([])
      convex.state.definitions = inventory()
      let changed = false
      convex.state.onDefinitionPage = (offset) => {
        if (offset !== 2 || changed) return
        changed = true
        convex.state.label += 1
      }
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: null })
      expect(count(convex.reads, 'DEFINITIONS')).toBe(3)
      expect(
        convex.pages.filter((scope) => scope.kind === 'DEFINITIONS' && scope.cursor === null)
      ).toHaveLength(2)
      expect(convex.store.record('ROOM_INPUT', 'DEFINITIONS')!.revision).toBe(
        JSON.stringify(revisions(2).filter(({ scope }) => scope !== 'PLAY'))
      )
      const before = snapshot(convex.store)
      convex.reads.length = 0
      convex.state.onDefinitionPage = (offset) => {
        if (offset === 2) convex.state.label += 1
      }
      await expect(
        convex.inputs.hydrate({ epoch: uuid(0x901), encounterId: null })
      ).rejects.toThrow('Definitions changed while they were being read.')
      expect(count(convex.reads, 'DEFINITIONS')).toBe(6)
      expect(snapshot(convex.store)).toEqual(before)
      expect(snapshot(new RoomEncounterStore(convex.storage))).toEqual(before)
    })

    it.each([
      'duplicate',
      'wrong-system',
      'wrong-identity',
      'bad-checksum',
      'invalid-schema'
    ] as const)(
      'refuses %s before either refresh or hydration replaces the durable inventory',
      async (corruption) => {
        const convex = open([])
        convex.state.definitions = inventory()
        await convex.inputs.hydrate({ epoch: EPOCH, encounterId: null })
        const before = snapshot(convex.store)
        convex.state.label = 2
        const current = definitionFixture(firstId)
        if (!current.definition) throw new Error('Missing published definition fixture.')
        switch (corruption) {
          case 'duplicate':
            convex.state.definitions = [current, structuredClone(current)]
            break
          case 'wrong-system':
            convex.state.definitions = [definitionFixture(firstId, 'PLATFORM', uuid(0x999))]
            break
          case 'wrong-identity':
            convex.state.definitions = [{ ...current, id: nextId }]
            break
          case 'bad-checksum':
            convex.state.definitions = [
              { ...current, definition: { ...current.definition, checksum: '0'.repeat(64) } }
            ]
            break
          case 'invalid-schema':
            convex.state.definitions = [{ ...current, id: 'invalid definition UUID' }]
            break
        }
        await expect(convex.inputs.definition(firstId, revisions(2))).rejects.toThrow()
        expect(snapshot(convex.store)).toEqual(before)
        await expect(
          convex.inputs.hydrate({ epoch: uuid(0x901), encounterId: null })
        ).rejects.toThrow()
        expect(snapshot(convex.store)).toEqual(before)
        expect(snapshot(new RoomEncounterStore(convex.storage))).toEqual(before)
      }
    )
  })

  describe('revision-keyed cache', () => {
    async function hydrated() {
      const convex = open([FIRST_CHARACTER, SECOND_CHARACTER])
      await convex.inputs.hydrate({ epoch: EPOCH, encounterId: ENCOUNTER })
      convex.reads.length = 0
      convex.loads.length = 0
      return convex
    }

    it('joins warm cached Character structure to the latest typed room play without a backend read', async () => {
      const convex = await hydrated()
      const initial = characterInputs(FIRST_CHARACTER)
      const play = convex.store
        .documents('characterPlayStates')
        .find((row) => row.characterId === FIRST_CHARACTER)!
      const nextState = {
        ...play.state,
        hitpoints: { ...play.state.hitpoints, current: 4 },
        partyVisibility: { ...play.state.partyVisibility, sheet: true }
      }
      await convex.store.transact(async () => {
        await convex.store.store.patch(play._id, {
          state: nextState,
          checksum: checksumRuleDocument(nextState),
          streamVersion: 2
        })
      })
      const afterMutation = { checksum: convex.store.checksum, logRows: convex.store.logRows }
      const part = await convex.inputs.character(FIRST_CHARACTER, revisions(1, FIRST_CHARACTER))
      if (!part.inputs) throw new Error('Missing warm Character inputs.')
      expect(part.inputs.owner.documentJson).toBe(initial.owner.documentJson)
      expect(readCharacterRecord(part.inputs.owner).state.hitpoints.current).toBe(4)
      expect(part.inputs.owner.play.streamVersion).toBe(2)
      expect(part.inputs.sheetState.partyVisibility.sheet).toBe(true)
      expect(convex.reads).toEqual([])
      expect(convex.loads).toEqual([])
      expect({ checksum: convex.store.checksum, logRows: convex.store.logRows }).toEqual(
        afterMutation
      )
      const restarted = new RoomEncounterStore(convex.storage)
      expect(restarted.documents('characterPlayStates')).toEqual(
        convex.store.documents('characterPlayStates')
      )
    })

    it('stages stale Character and authority caches inside the parent command and rolls back its play and inputs', async () => {
      const convex = await hydrated()
      const before = {
        records: convex.store.records('ROOM_INPUT'),
        play: convex.store.documents('characterPlayStates'),
        effects: convex.store.documents('characterActiveRuleEffects'),
        campaigns: convex.store.documents('campaigns'),
        checksum: convex.store.checksum,
        sequence: convex.store.sequence,
        logRows: convex.store.logRows
      }
      convex.state.label = 2
      convex.state.characters.set(FIRST_CHARACTER, [effect(FIRST_CHARACTER, 3)])
      await expect(
        convex.store.transact(async (transaction) => {
          const play = before.play.find((row) => row.characterId === FIRST_CHARACTER)!
          const nextState = { ...play.state, hitpoints: { ...play.state.hitpoints, current: 3 } }
          await convex.store.store.patch(play._id, {
            state: nextState,
            checksum: checksumRuleDocument(nextState),
            streamVersion: 2
          })
          await convex.inputs.authority(revisions(2), transaction)
          const part = await convex.inputs.character(
            FIRST_CHARACTER,
            revisions(2, FIRST_CHARACTER),
            transaction
          )
          if (!part.inputs) throw new Error('Missing staged Character inputs.')
          expect(part.inputs.owner.label).toBe(characterInputs(FIRST_CHARACTER, 2).owner.label)
          expect(readCharacterRecord(part.inputs.owner).state.hitpoints.current).toBe(3)
          expect(transaction.record('ROOM_INPUT', `CHARACTER:${FIRST_CHARACTER}`)?.revision).toBe(
            JSON.stringify(revisions(2, FIRST_CHARACTER))
          )
          expect(convex.store.record('ROOM_INPUT', `CHARACTER:${FIRST_CHARACTER}`)?.revision).toBe(
            JSON.stringify(revisions(1, FIRST_CHARACTER))
          )
          expect(convex.store.logRows).toBe(before.logRows)
          throw new Error('Parent command refused.')
        })
      ).rejects.toThrow('Parent command refused.')
      expect(kinds(convex.reads)).toEqual(['AUTHORITY', 'CHARACTERS'])
      expect({
        records: convex.store.records('ROOM_INPUT'),
        play: convex.store.documents('characterPlayStates'),
        effects: convex.store.documents('characterActiveRuleEffects'),
        campaigns: convex.store.documents('campaigns'),
        checksum: convex.store.checksum,
        sequence: convex.store.sequence,
        logRows: convex.store.logRows
      }).toEqual(before)
      convex.reads.length = 0
      const restored = await convex.inputs.character(FIRST_CHARACTER, revisions(1, FIRST_CHARACTER))
      expect(restored.inputs).toEqual(characterInputs(FIRST_CHARACTER))
      expect(convex.reads).toEqual([])
      expect(convex.store.logRows).toBe(before.logRows)
      const restarted = new RoomEncounterStore(convex.storage)
      expect(restarted.records('ROOM_INPUT')).toEqual(before.records)
      expect(restarted.documents('characterPlayStates')).toEqual(before.play)
    })

    it('commits a parent play mutation and stale Character refresh as one journal entry', async () => {
      const convex = await hydrated()
      const before = { sequence: convex.store.sequence, logRows: convex.store.logRows }
      convex.state.label = 2
      convex.state.characters.set(FIRST_CHARACTER, [effect(FIRST_CHARACTER, 3)])
      await convex.store.transact(async (transaction) => {
        const play = convex.store
          .documents('characterPlayStates')
          .find((row) => row.characterId === FIRST_CHARACTER)!
        const state = { ...play.state, hitpoints: { ...play.state.hitpoints, current: 5 } }
        await convex.store.store.patch(play._id, { state, checksum: checksumRuleDocument(state) })
        await convex.inputs.character(FIRST_CHARACTER, revisions(2, FIRST_CHARACTER), transaction)
      })
      expect(convex.store.logRows).toBe(before.logRows + 1)
      expect(convex.store.sequence).toBe(before.sequence + 1)
      expect(kinds(convex.reads)).toEqual(['CHARACTERS'])
      convex.reads.length = 0
      const part = await convex.inputs.character(FIRST_CHARACTER, revisions(2, FIRST_CHARACTER))
      if (!part.inputs) throw new Error('Missing committed Character inputs.')
      expect(readCharacterRecord(part.inputs.owner).state.hitpoints.current).toBe(5)
      expect(part.inputs.owner.label).toBe(characterInputs(FIRST_CHARACTER, 2).owner.label)
      expect(
        convex.store.documents('characterActiveRuleEffects').map((row) => row.createdOrdinal)
      ).toEqual([1, 2])
      expect(convex.reads).toEqual([])
      expect(convex.store.logRows).toBe(before.logRows + 1)
    })

    it('serves a scope from the store while the observed revisions include its own', async () => {
      const convex = await hydrated()
      const held = revisions(1)
      const extra = [...held, { scope: 'PLAY' as const, id: uuid(0x13), revision: uuid(0x5000) }]
      const play = await convex.inputs.play(extra)
      expect(play.campaign.id).toBe(CAMPAIGN)
      expect(await convex.inputs.system('SYSTEM', held)).toMatchObject({ kind: 'SYSTEM' })
      expect(convex.reads).toEqual([])
      expect(convex.loads).toEqual([])
    })

    it('reads a scope again when a revision changed, and stores the new read', async () => {
      const convex = await hydrated()
      convex.state.label = 2
      await convex.inputs.play(revisions(2))
      expect(kinds(convex.reads)).toEqual(['CAMPAIGN_PLAY'])
      expect(convex.loads).toHaveLength(1)
      convex.reads.length = 0
      convex.loads.length = 0
      await convex.inputs.play(revisions(2))
      expect(convex.reads).toEqual([])
      expect(convex.loads).toEqual([])
    })

    it('keeps a held Character current when only PLAY moves, so a read racing a checkpoint cannot split it', async () => {
      const convex = await hydrated()
      const moved = revisions(1, FIRST_CHARACTER).map((entry) =>
        entry.scope === 'PLAY' ? { ...entry, revision: uuid(0x999) } : entry
      )
      const character = await convex.inputs.character(FIRST_CHARACTER, moved)
      expect(character.revisions.some(({ scope }) => scope === 'PLAY')).toBe(false)
      expect(convex.reads).toEqual([])
    })

    describe('after the room checkpoint advanced the revisions it sent', () => {
      const sent = {
        system: uuid(0x1001),
        campaign: uuid(0x2001),
        play: uuid(0x4001),
        characters: [{ characterId: FIRST_CHARACTER, revision: uuid(0x3001) }],
        preferences: '0'.repeat(64)
      }
      const adopted = {
        play: uuid(0x4002),
        characters: [{ characterId: FIRST_CHARACTER, revision: uuid(0x3002) }]
      }

      it('serves the held scopes at the adopted revisions without reading Convex', async () => {
        const convex = await hydrated()
        convex.inputs.adopt(CAMPAIGN, sent, adopted)
        const play = await convex.inputs.play(revisions(1).map(adoptedEntry))
        const character = await convex.inputs.character(
          FIRST_CHARACTER,
          revisions(1, FIRST_CHARACTER).map(adoptedEntry)
        )
        expect(play.campaign.id).toBe(CAMPAIGN)
        expect(character.inputs).toEqual(characterInputs(FIRST_CHARACTER))
        expect(play.revisions.find(({ scope }) => scope === 'PLAY')?.revision).toBe(adopted.play)
        expect(character.revisions.find(({ scope }) => scope === 'CHARACTER')?.revision).toBe(
          adopted.characters[0].revision
        )
        expect(convex.reads).toEqual([])
        expect(convex.loads).toEqual([])
      })

      it('still reads a scope an outside edit advanced past the adopted revision', async () => {
        const convex = await hydrated()
        convex.inputs.adopt(CAMPAIGN, sent, adopted)
        convex.state.label = 3
        await convex.inputs.play(revisions(3))
        await convex.inputs.character(FIRST_CHARACTER, revisions(3, FIRST_CHARACTER))
        expect(kinds(convex.reads)).toEqual(['CAMPAIGN_PLAY', 'CHARACTERS'])
      })

      it('does not restamp a scope the checkpoint adopted nothing for', async () => {
        const convex = await hydrated()
        convex.inputs.adopt(CAMPAIGN, sent, { characters: [] })
        convex.state.label = 2
        await convex.inputs.play(revisions(2))
        expect(kinds(convex.reads)).toEqual(['CAMPAIGN_PLAY'])
      })

      it('forgets the restamp once the record is read again', async () => {
        const convex = await hydrated()
        convex.inputs.adopt(CAMPAIGN, sent, adopted)
        convex.state.label = 3
        await convex.inputs.play(revisions(3))
        convex.reads.length = 0
        await convex.inputs.play(revisions(3))
        expect(convex.reads).toEqual([])
        await convex.inputs.play(revisions(2))
        expect(kinds(convex.reads)).toEqual(['CAMPAIGN_PLAY'])
      })

      function adoptedEntry(entry: LiveSessionRulesRevisions[number]) {
        if (entry.scope === 'PLAY') return { ...entry, revision: adopted.play }
        if (entry.scope === 'CHARACTER')
          return { ...entry, revision: adopted.characters[0].revision }
        return entry
      }
    })

    it('reloads content once after hibernation using cached SQLite inputs without reading Convex', async () => {
      const convex = await hydrated()
      const store = new RoomEncounterStore(convex.storage)
      const before = {
        checksum: store.checksum,
        logRows: store.logRows,
        records: store.records('ROOM_INPUT')
      }
      const restarted = new RoomInputs(store, convex.read, convex.loadContent)
      const loaded = await restarted.character(FIRST_CHARACTER, revisions(1, FIRST_CHARACTER))
      expect(loaded.inputs).toEqual(characterInputs(FIRST_CHARACTER))
      expect(convex.reads).toEqual([])
      expect(convex.loads).toEqual([atRevision(characterManifest, 1)])
      convex.loads.length = 0
      expect(await restarted.character(FIRST_CHARACTER, revisions(1, FIRST_CHARACTER))).toEqual(
        loaded
      )
      expect(convex.reads).toEqual([])
      expect(convex.loads).toEqual([])
      expect({
        checksum: store.checksum,
        logRows: store.logRows,
        records: store.records('ROOM_INPUT')
      }).toEqual(before)
    })

    it('reads a scope again when nothing is observed', async () => {
      const convex = await hydrated()
      await convex.inputs.definition(uuid(0x600), null)
      await convex.inputs.play(null)
      expect(kinds(convex.reads)).toEqual(['DEFINITIONS', 'CAMPAIGN_PLAY'])
    })

    it('serves what is held through a held-only view and refuses what would read Convex', async () => {
      const convex = await hydrated()
      const held = convex.inputs.heldOnly()
      expect((await held.play(revisions(1))).campaign.id).toBe(CAMPAIGN)
      expect((await held.character(FIRST_CHARACTER, revisions(1, FIRST_CHARACTER))).inputs).toEqual(
        characterInputs(FIRST_CHARACTER)
      )

      convex.state.label = 2
      await expect(held.play(revisions(2))).rejects.toBeInstanceOf(RoomInputsUnheldError)
      await expect(held.definition(uuid(0x600), null)).rejects.toBeInstanceOf(RoomInputsUnheldError)
      expect(convex.reads).toEqual([])
      expect(convex.loads).toEqual([])
    })

    it('refreshes a Character’s record in one room command, once, keeping its room-owned effects', async () => {
      const convex = await hydrated()
      const rowsBefore = convex.store.logRows
      convex.state.characters.set(FIRST_CHARACTER, [effect(FIRST_CHARACTER, 3)])
      convex.state.label = 2

      const loaded = await convex.inputs.character(FIRST_CHARACTER, revisions(2, FIRST_CHARACTER))
      expect(loaded.inputs).toEqual(characterInputs(FIRST_CHARACTER, 2))
      expect(kinds(convex.reads)).toEqual(['CHARACTERS'])
      expect(convex.loads).toEqual([atRevision(characterManifest, 2)])
      // Active effects are room-owned while held, like play, so a Builder refresh keeps them.
      expect(
        convex.store.documents('characterActiveRuleEffects').map((row) => row.createdOrdinal)
      ).toEqual([1, 2])
      expect(convex.store.logRows).toBe(rowsBefore + 1)

      // The change is durable: a restarted store holds the same effects and record.
      const restarted = new RoomEncounterStore(convex.storage)
      expect(restarted.documents('characterActiveRuleEffects')).toEqual(
        convex.store.documents('characterActiveRuleEffects')
      )
      expect(restarted.records('ROOM_INPUT')).toEqual(convex.store.records('ROOM_INPUT'))
      expect(restarted.checksum).toBe(convex.store.checksum)

      convex.reads.length = 0
      convex.loads.length = 0
      await convex.inputs.character(FIRST_CHARACTER, revisions(2, FIRST_CHARACTER))
      expect(convex.reads).toEqual([])
      expect(convex.loads).toEqual([])
      expect(convex.store.logRows).toBe(rowsBefore + 1)
    })

    it('refuses a demand read before the store is hydrated', async () => {
      const convex = open([FIRST_CHARACTER])
      await expect(convex.inputs.play(null)).rejects.toThrow('has not been hydrated')
    })

    it.each(['play', 'character'] as const)(
      'retains stored inputs when stale %s content cannot load',
      async (scope) => {
        const convex = await hydrated()
        const before = {
          records: convex.store.records('ROOM_INPUT'),
          effects: convex.store.documents('characterActiveRuleEffects'),
          checksum: convex.store.checksum,
          logRows: convex.store.logRows
        }
        convex.state.label = 2
        convex.state.characters.set(FIRST_CHARACTER, [effect(FIRST_CHARACTER, 3)])
        convex.loaderState.fail = true
        await expect(
          scope === 'play'
            ? convex.inputs.play(revisions(2))
            : convex.inputs.character(FIRST_CHARACTER, revisions(2, FIRST_CHARACTER))
        ).rejects.toThrow('R2 content unavailable.')
        expect({
          records: convex.store.records('ROOM_INPUT'),
          effects: convex.store.documents('characterActiveRuleEffects'),
          checksum: convex.store.checksum,
          logRows: convex.store.logRows
        }).toEqual(before)
        convex.loaderState.fail = false
        await (scope === 'play'
          ? convex.inputs.play(revisions(2))
          : convex.inputs.character(FIRST_CHARACTER, revisions(2, FIRST_CHARACTER)))
        expect(convex.loads).toHaveLength(2)
      }
    )
  })
})
