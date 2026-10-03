import {
  liveRoomActorSourceSchema,
  liveRoomAuthorityRevisionsSchema,
  liveRoomCharacterPartSchema,
  liveRoomDefinitionSchema,
  liveRoomInputsResponseSchema,
  type LiveRoomCharacterPart,
  type LiveRoomInputsCursor,
  type LiveRoomInputsResponse,
  type LiveRoomInputsScope,
  type LiveRoomSceneInputsCursor
} from '@artificer-toolkit/schema/api/liveRoomInputs'
import {
  liveSessionCheckpointSceneSchemas,
  liveSessionCheckpointSceneKeys,
  type LiveSessionCheckpointSceneTable
} from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import { canonicalJsonRecordSchema } from '@artificer-toolkit/schema/shared/jsonDelta'
import type { LiveSessionCheckpointAcknowledgement } from '@artificer-toolkit/schema/api/liveSessionCheckpointJournal'
import {
  liveSessionRulesRevisionsSchema,
  type LiveSessionRulesRevisions
} from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type {
  RoomDocument,
  RoomEncounterStore,
  RoomRecord,
  RoomTransaction
} from './roomEncounterStore.js'
import type {
  ContentSnapshotObject,
  ContentSnapshotManifestDto
} from '@artificer-toolkit/schema/api/contentSnapshots'
import { createSnapshotReaders } from '@artificer-toolkit/rules-runtime/character/snapshotReaders'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  parseGeometrySave,
  parseGeometryCommand
} from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'
import {
  readCharacterPlay,
  readCharacterSheetState,
  readCharacterSheetStructure
} from '@artificer-toolkit/schema/projections/characterStoredState'
import { characterStoredHeadSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import { roomSceneDefinitionRecords } from './roomSceneDefinition.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { LiveSessionRoomAuthorizationRevisions } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'

/** Reads one scope of the room's rules inputs from Convex, for `epoch`'s Campaign. */
export type RoomInputsReader = (
  epoch: string,
  scope: LiveRoomInputsScope
) => Promise<LiveRoomInputsResponse>

type LoadedContent = {
  manifest: string
  objects: ContentSnapshotObject[]
}

type ResponseKind = LiveRoomInputsResponse['kind']
type ResponseOf<Kind extends ResponseKind> = Extract<LiveRoomInputsResponse, { kind: Kind }>
type PagedKind =
  | 'AUTHORITY'
  | 'CHAT_METADATA'
  | 'RUN'
  | 'CHARACTERS'
  | 'SCENE_DEFINITION'
  | 'DEFINITIONS'
type PagedScope = Extract<LiveRoomInputsScope, { kind: PagedKind }>
type AssignedPart = Extract<LiveRoomCharacterPart, { status: 'ASSIGNED' }>

function characterHeadDocument(owner: NonNullable<AssignedPart['inputs']>['owner']): RoomDocument {
  const {
    _id,
    _creationTime,
    documentJson: _documentJson,
    sheetState,
    play: _play,
    ...head
  } = owner
  return {
    table: 'characters',
    id: _id,
    creationTime: _creationTime,
    fields: characterStoredHeadSchema.parse({
      ...head,
      sheetStateChecksum:
        head.sheetStateChecksum ?? checksumRuleDocument(readCharacterSheetStructure(sheetState))
    })
  }
}

/** Room records that cache one rules input each, keyed by their scope. */
const CACHE_KIND = 'ROOM_INPUT'
const DEFINITION_KIND = 'ROOM_DEFINITION'
const RUN_READ_ATTEMPTS = 3

function expectKind<Kind extends ResponseKind>(response: LiveRoomInputsResponse, kind: Kind) {
  if (response.kind !== kind) throw new Error(`Room input ${kind} answered as ${response.kind}.`)
  // The check above is the narrowing; TypeScript cannot narrow by a generic discriminant.
  return response as ResponseOf<Kind>
}

/** Reads every page of a paged scope, in order. */
async function readPages<Kind extends PagedKind>(
  read: (scope: LiveRoomInputsScope) => Promise<LiveRoomInputsResponse>,
  kind: Kind,
  scopeAt: (cursor: LiveRoomInputsCursor) => PagedScope
) {
  const pages: ResponseOf<Kind>[] = []
  const seen = new Set<string>()
  let cursor: LiveRoomInputsCursor = null
  do {
    const key = canonicalizeJson(cursor)
    if (seen.has(key)) throw new Error('Room input continuation repeated.')
    seen.add(key)
    const page: ResponseOf<Kind> = expectKind(await read(scopeAt(cursor)), kind)
    pages.push(page)
    cursor = (page as ResponseOf<PagedScope['kind']>).continueCursor
  } while (cursor)
  return pages
}

function expectAssigned(part: LiveRoomCharacterPart) {
  if (part.status !== 'ASSIGNED')
    throw new Error('Character is no longer assigned to the Campaign.')
  return part
}

function toRoomDocuments(pages: readonly { documents: readonly RoomDocument[] }[]) {
  return pages.flatMap((page) => page.documents)
}

function chatMetadataDocuments(
  pages: readonly ResponseOf<'CHAT_METADATA'>[],
  authority: ResponseOf<'AUTHORITY'>
) {
  const campaignId = authority.documents.find(({ table }) => table === 'campaigns')?.fields.id
  const documents = toRoomDocuments(pages)
  const ids = new Set<string>()
  const publicKeys = new Set<string>()
  const conversations = new Set<string>()
  const nonces = new Set<string>()
  for (const { table, id, fields } of documents) {
    if (
      ![
        'campaignConversations',
        'campaignConversationMembers',
        'campaignConversationEntries'
      ].includes(table) ||
      fields.campaignId !== campaignId
    )
      throw new Error('Room chat metadata has inconsistent Campaign scope.')
    if (ids.has(id)) throw new Error('Room chat metadata repeats a storage identity.')
    ids.add(id)
    const identity =
      table === 'campaignConversationMembers' ? [fields.conversationId, fields.userId] : [fields.id]
    if (identity.some((value) => typeof value !== 'string'))
      throw new Error('Room chat metadata has an invalid public identity.')
    const key = canonicalizeJson([table, ...identity])
    if (publicKeys.has(key)) throw new Error('Room chat metadata repeats a public identity.')
    publicKeys.add(key)
    if (table === 'campaignConversations') conversations.add(String(fields.id))
    if (table === 'campaignConversationEntries') {
      const nonce = canonicalizeJson([campaignId, fields.authorUserId, fields.clientNonce])
      if (nonces.has(nonce)) throw new Error('Room chat metadata repeats an author nonce.')
      nonces.add(nonce)
    }
  }
  for (const { table, fields } of documents) {
    if (table === 'campaignConversations') continue
    if (typeof fields.conversationId !== 'string' || !conversations.has(fields.conversationId))
      throw new Error('Room chat metadata references an unavailable conversation.')
  }
  return documents
}

function sceneRecords(pages: readonly ResponseOf<'SCENE'>[]): RoomRecord[] {
  const first = pages[0]!
  const rows = pages
    .flatMap((page) => page.documents)
    .map(({ table, fields }) => {
      if (!Object.hasOwn(liveSessionCheckpointSceneSchemas, table))
        throw new Error(`Unknown checkpoint Scene table ${table}.`)
      const sceneTable = table as LiveSessionCheckpointSceneTable
      liveSessionCheckpointSceneSchemas[sceneTable].parse(fields)
      const value = canonicalJsonRecordSchema.parse(fields)
      if (sceneTable !== 'sceneFogChunks' && value.sceneId !== first.source.sceneId)
        throw new Error('Checkpoint Scene row scope does not match its source.')
      for (const field of ['input', 'result', 'previousLayer']) {
        const nested = value[field]
        if (
          nested &&
          typeof nested === 'object' &&
          !Array.isArray(nested) &&
          Object.hasOwn(nested, 'sceneId') &&
          nested.sceneId !== first.source.sceneId
        )
          throw new Error('Checkpoint Scene nested row scope does not match its source.')
      }
      const key = canonicalizeJson([
        sceneTable,
        ...liveSessionCheckpointSceneKeys[sceneTable].map((field) => value[field])
      ])
      return { table: sceneTable, key, value }
    })
  if (new Set(rows.map((row) => row.key)).size !== rows.length)
    throw new Error('Duplicate checkpoint Scene public key.')
  const heads = rows.filter((row) => row.table === 'sceneLiveStates')
  if (
    (first.sceneVersion === 0 && heads.length !== 0) ||
    (first.sceneVersion !== 0 &&
      (heads.length !== 1 || heads[0]!.value.version !== first.sceneVersion))
  )
    throw new Error('Checkpoint Scene head does not match its version.')
  const fogSaves = new Map(
    rows
      .filter((row) => row.table === 'sceneFogSaves')
      .map((row) => {
        const save = liveSessionCheckpointSceneSchemas.sceneFogSaves.parse(row.value)
        return [save.id, save] as const
      })
  )
  if (
    rows.some(
      (row) =>
        row.table === 'sceneFogChunks' &&
        (typeof row.value.saveId !== 'string' || !fogSaves.has(row.value.saveId))
    )
  )
    throw new Error('Checkpoint Scene fog chunk has no same-Scene saved body.')
  const fogChunks = new Map(
    rows
      .filter((row) => row.table === 'sceneFogChunks')
      .map((row) => {
        const chunk = liveSessionCheckpointSceneSchemas.sceneFogChunks.parse(row.value)
        return [canonicalizeJson([chunk.saveId, chunk.ordinal]), chunk] as const
      })
  )
  const geometrySaves = new Map(
    rows
      .filter((row) => row.table === 'sceneGeometrySaves')
      .map((row) => {
        const save = parseGeometrySave(row.value)
        return [save.id, save] as const
      })
  )
  const commands = new Map(
    rows
      .filter((row) => row.table === 'sceneLiveCommands')
      .map((row) => {
        const command = liveSessionCheckpointSceneSchemas.sceneLiveCommands.parse(row.value)
        return [command.commandId, command] as const
      })
  )
  for (const save of geometrySaves.values()) {
    const command = commands.get(save.commandId)
    if (
      command &&
      (save.status !== 'PUBLISHED' ||
        command.encoding !== 'GEOMETRY' ||
        command.inputChecksum !== save.inputChecksum ||
        command.actorUserId !== save.actorUserId)
    )
      throw new Error('Stored Scene geometry save is inconsistent.')
    for (const reference of save.fogSaves) {
      const child = fogSaves.get(reference.saveId)
      if (
        !child ||
        child.geometrySaveId !== save.id ||
        child.actorUserId !== save.actorUserId ||
        child.input.layer.ownerUserId !== reference.ownerUserId ||
        child.commandId !== child.id ||
        child.input.expectedSceneVersion !== save.snapshotVersion ||
        (save.status === 'PUBLISHED' && child.status !== 'PUBLISHED')
      )
        throw new Error('Stored geometry fog save is inconsistent.')
    }
  }
  const validateLayer = (
    layer: ReturnType<typeof liveSessionCheckpointSceneSchemas.sceneFogLayers.parse>,
    version: number
  ) => {
    const { checksum, ...content } = layer
    if (
      checksum !== checksumCanonicalJson(content) ||
      layer.version > version ||
      new Set(layer.chunks.map((chunk) => chunk.index)).size !== layer.chunks.length
    )
      throw new Error('Stored Scene fog layer is inconsistent.')
    for (const reference of layer.chunks) {
      const save = fogSaves.get(reference.saveId)
      const chunk = fogChunks.get(canonicalizeJson([reference.saveId, reference.ordinal]))
      if (
        !save ||
        !chunk ||
        save.status !== 'PUBLISHED' ||
        save.input.layer.ownerUserId !== layer.ownerUserId ||
        save.input.layer.width !== layer.width ||
        save.input.layer.height !== layer.height ||
        chunk.chunk.index !== reference.index ||
        chunk.checksum !== reference.checksum
      )
        throw new Error('Stored Scene fog chunk is inconsistent.')
    }
  }
  for (const { table, value } of rows) {
    switch (table) {
      case 'sceneLiveStates': {
        const state = liveSessionCheckpointSceneSchemas.sceneLiveStates.parse(value)
        if (Object.values(state.settings).some((setting) => setting.version > state.version))
          throw new Error('Stored live Scene settings are inconsistent.')
        break
      }
      case 'sceneLiveEntities': {
        const entity = liveSessionCheckpointSceneSchemas.sceneLiveEntities.parse(value)
        const { checksum, ...content } = entity
        const isDoor =
          entity.value?.collection === 'barriers' && entity.value.entity.kind === 'DOOR'
        const hasDoorState = entity.doorState !== undefined && entity.doorState !== null
        if (
          checksumCanonicalJson(content) !== checksum ||
          entity.version > first.sceneVersion ||
          (entity.value === null) !== (entity.ordinal === null) ||
          isDoor !== hasDoorState ||
          ((entity.collection === 'tokens' || entity.collection === 'barriers') &&
            entity.entityId !== entity.entityId.toLowerCase()) ||
          (entity.value !== null &&
            (entity.value.entity.id !== entity.entityId ||
              entity.value.collection !== entity.collection))
        )
          throw new Error('Stored live Scene entity is inconsistent.')
        break
      }
      case 'sceneFogLayers':
        validateLayer(
          liveSessionCheckpointSceneSchemas.sceneFogLayers.parse(value),
          first.sceneVersion
        )
        break
      case 'sceneFogChunks': {
        const chunk = liveSessionCheckpointSceneSchemas.sceneFogChunks.parse(value)
        const save = fogSaves.get(chunk.saveId)!
        const manifest = save.input.chunkManifest[chunk.ordinal]
        if (
          !manifest ||
          chunk.ordinal >= save.receivedChunks ||
          save.chunksRemoved ||
          manifest.index !== chunk.chunk.index ||
          manifest.checksum !== chunk.checksum ||
          chunk.checksum !== checksumCanonicalJson(chunk.chunk) ||
          chunk.chunk.x + chunk.chunk.width > save.input.layer.width ||
          chunk.chunk.y + chunk.chunk.height > save.input.layer.height
        )
          throw new Error('Stored Scene fog chunk is inconsistent.')
        break
      }
      case 'sceneFogSaves': {
        const save = liveSessionCheckpointSceneSchemas.sceneFogSaves.parse(value)
        if (
          save.commandId !== save.input.commandId ||
          save.inputChecksum !== checksumCanonicalJson(save.input) ||
          save.receivedChunks > save.input.chunkManifest.length ||
          (save.chunksRemoved && save.status !== 'EXPIRED') ||
          (save.status === 'PUBLISHED' &&
            (save.chunksRemoved ||
              save.receivedChunks !== save.input.chunkManifest.length ||
              save.input.chunkManifest.some(
                (_, ordinal) => !fogChunks.has(canonicalizeJson([save.id, ordinal]))
              )))
        )
          throw new Error('Stored Scene fog save is inconsistent.')
        if (save.previousLayer) {
          if (
            save.previousLayer.ownerUserId !== save.input.layer.ownerUserId ||
            save.previousLayer.width !== save.input.layer.width ||
            save.previousLayer.height !== save.input.layer.height
          )
            throw new Error('Stored Scene fog snapshot is inconsistent.')
          const parent = save.geometrySaveId ? geometrySaves.get(save.geometrySaveId) : null
          validateLayer(save.previousLayer, parent?.snapshotVersion ?? first.sceneVersion)
        }
        break
      }
      case 'sceneLiveCommands': {
        const command = liveSessionCheckpointSceneSchemas.sceneLiveCommands.parse(value)
        if (
          command.inputChecksum !== checksumCanonicalJson(command.input) ||
          command.resultChecksum !== checksumCanonicalJson(command.result) ||
          command.commandId !== command.input.commandId ||
          command.commandId !== command.result.commandId ||
          command.result.replayed ||
          command.result.version > first.sceneVersion
        )
          throw new Error('Stored Scene command is inconsistent.')
        if (command.encoding === 'FOG_PATCH') {
          const patch = command.result.patch
          const save = fogSaves.get(patch.saveId)
          if (
            patch.chunkCount !== command.input.chunkManifest.length ||
            patch.ownerUserId !== command.input.layer.ownerUserId ||
            patch.width !== command.input.layer.width ||
            patch.height !== command.input.layer.height ||
            !save ||
            save.status !== 'PUBLISHED' ||
            save.inputChecksum !== command.inputChecksum ||
            save.commandId !== command.commandId ||
            save.actorUserId !== command.actorUserId
          )
            throw new Error('Stored Scene fog command is inconsistent.')
        } else if (command.encoding === 'GEOMETRY') {
          parseGeometryCommand(value, first.sceneVersion)
          for (const patch of command.result.fogPatches) {
            const child = fogSaves.get(patch.saveId)
            const parent = child?.geometrySaveId ? geometrySaves.get(child.geometrySaveId) : null
            if (
              !child ||
              !parent ||
              child.status !== 'PUBLISHED' ||
              parent.status !== 'PUBLISHED' ||
              parent.commandId !== command.commandId ||
              parent.inputChecksum !== command.inputChecksum ||
              parent.actorUserId !== command.actorUserId ||
              child.actorUserId !== command.actorUserId ||
              parent.snapshotVersion + 1 !== command.result.version ||
              child.input.expectedSceneVersion !== parent.snapshotVersion ||
              child.commandId !== child.id ||
              child.input.layer.ownerUserId !== patch.ownerUserId ||
              child.input.layer.width !== patch.width ||
              child.input.layer.height !== patch.height ||
              child.input.chunkManifest.length !== patch.chunkCount ||
              !parent.fogSaves.some(
                (entry) => entry.saveId === child.id && entry.ownerUserId === patch.ownerUserId
              )
            )
              throw new Error('Stored Scene geometry fog source is inconsistent.')
          }
        } else if (
          command.encoding === 'UNDO' &&
          command.undoneCommandId !== command.result.delta.undoneCommandId
        )
          throw new Error('Stored Scene undo command is inconsistent.')
        break
      }
    }
  }
  return [
    {
      kind: 'SCENE_CHECKPOINT_SOURCE',
      key: first.source.sceneId,
      revision: null,
      json: canonicalizeJson(first.source)
    },
    ...rows.map(({ key, value }) => ({
      kind: 'SCENE_CHECKPOINT_ROW',
      key,
      revision: null,
      json: canonicalizeJson(value)
    }))
  ]
}

/**
 * The source ids of the Character actors that still read their Character: the Characters whose
 * stored inputs the Run's rules read. An actor with frozen state (its Character left the Campaign)
 * reads its own frozen values instead, so it needs no Character inputs.
 */
function characterIdsOf(documents: readonly RoomDocument[]) {
  const ids = new Set<string>()
  for (const { table, fields } of documents) {
    if (table !== 'encounterRunActors') continue
    const { stateJson } = fields
    if (typeof stateJson !== 'string') throw new Error('Room actor state is invalid.')
    const actor = liveRoomActorSourceSchema.parse(JSON.parse(stateJson))
    if (actor.kind === 'CHARACTER' && !actor.frozenState) ids.add(actor.sourceId)
  }
  return [...ids]
}

/** The cached copy carries the revisions it was read at, so a bump misses. */
function cacheRecord(key: string, response: LiveRoomInputsResponse | AssignedPart): RoomRecord {
  const revisions = 'revisions' in response ? response.revisions : null
  return {
    kind: CACHE_KIND,
    key,
    revision: revisions && JSON.stringify(revisions),
    // A Character's paged documents live in the store; its response arrives with none.
    json: JSON.stringify(response)
  }
}

function definitionRecords(response: ResponseOf<'DEFINITIONS'>): RoomRecord[] {
  return [
    ...response.definitions.map((definition) => ({
      kind: DEFINITION_KIND,
      key: definition.id,
      revision: JSON.stringify(response.revisions),
      json: canonicalizeJson(definition)
    })),
    cacheRecord('DEFINITIONS', { ...response, definitions: [] })
  ]
}

function assertDefinitionScope(
  response: ResponseOf<'DEFINITIONS'>,
  campaign: Pick<ResponseOf<'CAMPAIGN_PLAY'>['campaign'], 'id' | 'gameSystemId'>
) {
  if (
    response.revisions.find(({ scope }) => scope === 'SYSTEM')?.id !== campaign.gameSystemId ||
    response.revisions.find(({ scope }) => scope === 'CAMPAIGN')?.id !== campaign.id
  )
    throw new Error('Room definition inventory has inconsistent Campaign or System scope.')
}

/** Whether every revision the cached read observed is still the revision `observed` reports. */
function isCurrent(record: RoomRecord, observed: LiveSessionRulesRevisions | null) {
  if (!observed || !record.revision) return false
  const held = (
    record.key === 'AUTHORITY' || record.key === 'DEFINITIONS'
      ? liveRoomAuthorityRevisionsSchema
      : liveSessionRulesRevisionsSchema
  ).parse(JSON.parse(record.revision))
  return held.every((entry) =>
    observed.some(
      (candidate) =>
        candidate.scope === entry.scope &&
        candidate.id === entry.id &&
        candidate.revision === entry.revision
    )
  )
}

const cacheKey = (
  scope:
    | { kind: 'CAMPAIGN_PLAY' }
    | { kind: 'CHARACTER'; characterId: string }
    | { kind: 'RUN'; encounterId: string }
    | { kind: 'SYSTEM'; part: 'SYSTEM' | 'VOCABULARY' }
) => {
  switch (scope.kind) {
    case 'CAMPAIGN_PLAY':
      return 'CAMPAIGN_PLAY'
    case 'RUN':
      return `RUN:${scope.encounterId.toLowerCase()}`
    case 'CHARACTER':
      return `CHARACTER:${scope.characterId}`
    case 'SYSTEM':
      return `SYSTEM:${scope.part}`
  }
}

/**
 * The room's rules inputs (ADR 0035, Amendment 11), read from Convex once and kept in the room store
 * (S2). {@link hydrate} loads a new epoch: the Run aggregate, its Characters, the Campaign play scope
 * and the System with its vocabulary and complete definition inventory. Stale loads refresh by revision:
 * a caller passes the revisions it currently observes (`null` for none) and a stale entry is read
 * again, replacing a Character's documents and record in one room transaction.
 */
export class RoomInputs {
  readonly #store: RoomEncounterStore
  readonly #read: RoomInputsReader
  readonly #loadContent: (manifest: ContentSnapshotManifestDto) => Promise<ContentSnapshotObject[]>
  readonly #content = new Map<string, LoadedContent>()

  constructor(
    store: RoomEncounterStore,
    read: RoomInputsReader,
    loadContent: (manifest: ContentSnapshotManifestDto) => Promise<ContentSnapshotObject[]>
  ) {
    this.#store = store
    this.#read = read
    this.#loadContent = loadContent
  }

  /**
   * Replaces the store with `encounterId`'s aggregate as Convex holds it for `epoch`. With no
   * Encounter the store holds the Campaign inputs and optional raw Scene checkpoint records.
   * A Run or Scene that changes while it is being read is read again.
   */
  async hydrate({
    epoch,
    encounterId,
    sceneId,
    checkpoint
  }: {
    epoch: string
    encounterId: string | null
    sceneId?: string | null
    checkpoint?: LiveSessionCheckpointAcknowledgement
  }) {
    const read = (scope: LiveRoomInputsScope) => this.#read(epoch, scope)
    const [
      play,
      system,
      vocabulary,
      { run, runRecord, characters },
      scene,
      authority,
      chatPages,
      definitions
    ] = await Promise.all([
      read({ kind: 'CAMPAIGN_PLAY' }).then((response) => expectKind(response, 'CAMPAIGN_PLAY')),
      read({ kind: 'SYSTEM', part: 'SYSTEM' }),
      read({ kind: 'SYSTEM', part: 'VOCABULARY' }),
      encounterId
        ? this.#readRunWithCharacters(read, encounterId)
        : Promise.resolve({ run: [], runRecord: null, characters: [] }),
      sceneId ? this.#readScene(read, sceneId) : Promise.resolve([]),
      this.#readAuthority(read),
      readPages(read, 'CHAT_METADATA', (cursor) => ({ kind: 'CHAT_METADATA', cursor })),
      this.#readDefinitions(read)
    ])
    assertDefinitionScope(definitions, play.campaign)
    const chat = chatMetadataDocuments(chatPages, authority)
    const content = await Promise.all([
      this.#readContent(play.contentSnapshots),
      ...characters.map(({ part }) => this.#readContent(this.#characterManifest(part)))
    ])
    this.#store.hydrate({
      epoch,
      checkpoint,
      documents: [
        ...authority.documents,
        ...chat,
        ...run,
        ...characters.flatMap(({ part, documents }) => {
          if (!part.inputs) throw new Error('Character inputs are missing.')
          const { owner } = part.inputs
          const { _id: playId, _creationTime: playCreated, ...fields } = owner.play
          return [
            characterHeadDocument(owner),
            { table: 'characterPlayStates', id: playId, creationTime: playCreated, fields },
            ...documents
          ]
        })
      ],
      records: [
        ...scene,
        ...(runRecord ? [runRecord] : []),
        ...definitionRecords(definitions),
        cacheRecord('AUTHORITY', { ...authority, documents: [] }),
        cacheRecord(cacheKey({ kind: 'CAMPAIGN_PLAY' }), play),
        cacheRecord(cacheKey({ kind: 'SYSTEM', part: 'SYSTEM' }), system),
        cacheRecord(cacheKey({ kind: 'SYSTEM', part: 'VOCABULARY' }), vocabulary),
        ...characters.map((character) =>
          cacheRecord(
            cacheKey({ kind: 'CHARACTER', characterId: character.part.characterId }),
            character.part
          )
        )
      ]
    })
    this.#content.clear()
    this.#content.set('CAMPAIGN_PLAY', content[0]!)
    characters.forEach(({ part }, index) =>
      this.#content.set(
        cacheKey({ kind: 'CHARACTER', characterId: part.characterId }),
        content[index + 1]!
      )
    )
  }

  play(observed: LiveSessionRulesRevisions | null, transaction?: RoomTransaction) {
    return this.#point({ kind: 'CAMPAIGN_PLAY' }, observed, 'CAMPAIGN_PLAY', transaction)
  }

  get epoch() {
    return this.#store.epoch
  }

  /** Current lease observations, without reading Convex or advancing the command sequence. */
  revisions(
    campaignId: string,
    authorization: LiveSessionRoomAuthorizationRevisions
  ): LiveSessionRulesRevisions {
    const system = this.systemSnapshot()
    return liveSessionRulesRevisionsSchema.parse([
      { scope: 'SYSTEM', id: system.id, revision: authorization.system },
      { scope: 'CAMPAIGN', id: campaignId, revision: authorization.campaign },
      { scope: 'PLAY', id: campaignId, revision: authorization.play },
      ...authorization.characters.map(({ characterId, revision }) => ({
        scope: 'CHARACTER',
        id: characterId,
        revision
      }))
    ])
  }

  /** The held vocabulary for a stored projection; command mechanics still check revisions. */
  systemSnapshot() {
    const held = this.#store.record(CACHE_KIND, cacheKey({ kind: 'SYSTEM', part: 'SYSTEM' }))
    if (!held) throw new Error('Room System inputs have not been hydrated.')
    const system = expectKind(
      liveRoomInputsResponseSchema.parse(JSON.parse(held.json)),
      'SYSTEM'
    ).system
    if (!system) throw new Error('Room System inputs are unavailable.')
    return system
  }

  /** A previously unopened Run is an initial-input read, staged with the first command using it. */
  async encounter(encounterId: string, transaction: RoomTransaction) {
    const held = await this.#store.store
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', encounterId))
      .unique()
    if (held) return
    const { run, runRecord, characters } = await this.#readRunWithCharacters(
      (scope) => this.#read(this.#requireEpoch(), scope),
      encounterId
    )
    for (const document of run) transaction.restoreDocument(document)
    transaction.setRecord(runRecord)
    for (const { part, documents } of characters) {
      if (!part.inputs) throw new Error('Character inputs are missing.')
      const key = cacheKey({ kind: 'CHARACTER', characterId: part.characterId })
      const content = await this.#readContent(this.#characterManifest(part), key)
      const play = await this.#store.store
        .query('characterPlayStates')
        .withIndex('by_characterId', (q) => q.eq('characterId', part.characterId))
        .unique()
      transaction.restoreDocument(characterHeadDocument(part.inputs.owner))
      if (!play) {
        const { _id, _creationTime, ...fields } = part.inputs.owner.play
        transaction.restoreDocument({
          table: 'characterPlayStates',
          id: _id,
          creationTime: _creationTime,
          fields
        })
        for (const document of documents) transaction.restoreDocument(document)
      }
      transaction.setRecord(cacheRecord(key, part))
      this.#content.set(key, content)
    }
  }

  /** The Campaign's ACTIVE Run in Convex when the room loaded `encounterId`, if any. */
  activeEncounterIdAtLoad(encounterId: string, transaction: RoomTransaction) {
    return this.#runAtLoad(encounterId, transaction).activeEncounterId
  }

  /**
   * Characters that held `maintainedStateId`'s dependents when the room loaded the Run. Later
   * dependents are written on Characters the room already holds.
   */
  maintenanceCharacterOwnersAtLoad(
    encounterId: string,
    maintainedStateId: string,
    transaction: RoomTransaction
  ) {
    const owners = this.#runAtLoad(encounterId, transaction).maintenanceCharacterOwners
    if (!owners) throw new Error('Room Run maintenance owners are unavailable.')
    return owners.flatMap((owner) =>
      owner.maintainedStateId === maintainedStateId ? [owner.characterId] : []
    )
  }

  #runAtLoad(encounterId: string, transaction: RoomTransaction) {
    const held = transaction.record(CACHE_KIND, cacheKey({ kind: 'RUN', encounterId }))
    if (!held) throw new Error('Room Run inputs are unavailable.')
    return expectKind(liveRoomInputsResponseSchema.parse(JSON.parse(held.json)), 'RUN')
  }

  /** Campaign facts are native rows, refreshed only when their revision changes. */
  async authority(observed: LiveSessionRulesRevisions | null, transaction: RoomTransaction) {
    const held = transaction.record(CACHE_KIND, 'AUTHORITY')
    if (held && isCurrent(held, observed)) return
    const loaded = await this.#readAuthority((scope) => this.#read(this.#requireEpoch(), scope))
    const campaigns = await this.#store.store.query('campaigns').collect()
    for (const campaign of campaigns) {
      const [memberships, assignments] = await Promise.all([
        this.#store.store
          .query('campaignMemberships')
          .withIndex('by_campaignId_status', (q) => q.eq('campaignId', campaign.id))
          .collect(),
        this.#store.store
          .query('campaignCharacterAssignments')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
          .collect()
      ])
      for (const row of [...memberships, ...assignments]) await this.#store.store.delete(row._id)
      await this.#store.store.delete(campaign._id)
    }
    for (const document of loaded.documents) transaction.restoreDocument(document)
    transaction.setRecord(cacheRecord('AUTHORITY', { ...loaded, documents: [] }))
  }

  hasAccountProfile(userId: string, transaction?: RoomTransaction) {
    const held = transaction
      ? transaction.record(CACHE_KIND, 'AUTHORITY')
      : this.#store.record(CACHE_KIND, 'AUTHORITY')
    if (!held) throw new Error('Room Campaign authority has not been hydrated.')
    return expectKind(
      liveRoomInputsResponseSchema.parse(JSON.parse(held.json)),
      'AUTHORITY'
    ).accountUserIds.includes(userId)
  }

  system(
    part: 'SYSTEM' | 'VOCABULARY',
    observed: LiveSessionRulesRevisions | null,
    transaction?: RoomTransaction
  ) {
    return this.#point({ kind: 'SYSTEM', part }, observed, 'SYSTEM', transaction)
  }

  async definition(
    definitionId: string,
    observed: LiveSessionRulesRevisions | null,
    transaction?: RoomTransaction
  ) {
    const held = transaction
      ? transaction.record(CACHE_KIND, 'DEFINITIONS')
      : this.#store.record(CACHE_KIND, 'DEFINITIONS')
    if (!held || !isCurrent(held, observed)) {
      const loaded = await this.#readDefinitions((scope) => this.#read(this.#requireEpoch(), scope))
      const campaigns = this.#store.documents('campaigns')
      if (campaigns.length !== 1) throw new Error('Room Campaign authority has inconsistent scope.')
      assertDefinitionScope(loaded, campaigns[0]!)
      const replace = (target: RoomTransaction) => {
        for (const record of target.records(DEFINITION_KIND))
          target.deleteRecord(DEFINITION_KIND, record.key)
        for (const record of target.records(CACHE_KIND))
          if (record.key.startsWith('DEFINITION:')) target.deleteRecord(CACHE_KIND, record.key)
        for (const record of definitionRecords(loaded)) target.setRecord(record)
      }
      if (transaction) replace(transaction)
      else await this.#store.transact(async (target) => replace(target))
    }
    const record = transaction
      ? transaction.record(DEFINITION_KIND, definitionId)
      : this.#store.record(DEFINITION_KIND, definitionId)
    if (!record) return { definition: null, sourceKind: null }
    const entry = liveRoomDefinitionSchema.parse(JSON.parse(record.json))
    if (entry.id !== definitionId)
      throw new Error('Room definition record has inconsistent identity.')
    return { definition: entry.definition, sourceKind: entry.sourceKind }
  }

  /** Checks the authorized Builder/content revision without reading or changing play state. */
  characterIsCurrent(
    characterId: string,
    observed: LiveSessionRulesRevisions,
    transaction: RoomTransaction
  ) {
    const held = transaction.record(CACHE_KIND, cacheKey({ kind: 'CHARACTER', characterId }))
    return held !== null && isCurrent(held, observed)
  }

  /**
   * The Character's stored inputs. A stale Builder/content entry reloads in the caller transaction,
   * retaining room-owned play and active effects.
   */
  async character(
    characterId: string,
    observed: LiveSessionRulesRevisions | null,
    transaction?: RoomTransaction
  ) {
    const key = cacheKey({ kind: 'CHARACTER', characterId })
    const held = transaction
      ? transaction.record(CACHE_KIND, key)
      : this.#store.record(CACHE_KIND, key)
    if (held && isCurrent(held, observed)) {
      const part = expectAssigned(liveRoomCharacterPartSchema.parse(JSON.parse(held.json)))
      const content = await this.#readContent(this.#characterManifest(part), key)
      this.#content.set(key, content)
      return this.#withCurrentPlay(part)
    }
    const epoch = this.#requireEpoch()
    const {
      characters: [loaded]
    } = await this.#readCharacters((scope) => this.#read(epoch, scope), [characterId])
    if (!loaded) throw new Error('Character is no longer assigned to the Campaign.')
    const content = await this.#readContent(this.#characterManifest(loaded.part), key)
    const stage = async (target: RoomTransaction) => {
      if (!loaded.part.inputs) throw new Error('Character inputs are missing.')
      target.restoreDocument(characterHeadDocument(loaded.part.inputs.owner))
      const play = await this.#store.store
        .query('characterPlayStates')
        .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
        .unique()
      if (!play) {
        if (!loaded.part.inputs) throw new Error('Character inputs are missing.')
        const { _id, _creationTime, ...fields } = loaded.part.inputs.owner.play
        target.restoreDocument({
          table: 'characterPlayStates',
          id: _id,
          creationTime: _creationTime,
          fields
        })
      }
      // Active effects are room-owned while held, just like play. A Builder refresh keeps them.
      if (!play) for (const document of loaded.documents) target.restoreDocument(document)
      target.setRecord(cacheRecord(key, loaded.part))
    }
    if (transaction) await stage(transaction)
    else await this.#store.transact(stage)
    this.#content.set(key, content)
    return this.#withCurrentPlay(loaded.part)
  }

  /** A stored input's Builder structure is joined with the room's latest play record. */
  async #withCurrentPlay(part: AssignedPart): Promise<AssignedPart> {
    if (!part.inputs) throw new Error('Character inputs are missing.')
    const play = await this.#store.store
      .query('characterPlayStates')
      .withIndex('by_characterId', (q) => q.eq('characterId', part.characterId))
      .unique()
    if (
      !play ||
      play._id !== part.inputs.owner.play._id ||
      play.userId !== part.inputs.owner.userId
    )
      throw new Error('Room Character play identity does not match its inputs.')
    readCharacterPlay(play)
    const owner = { ...part.inputs.owner, play }
    return {
      ...part,
      inputs: { ...part.inputs, owner, sheetState: readCharacterSheetState(owner) }
    }
  }

  /** Uses only the latest authorized manifest; removed shares never enter these readers. */
  async contentReaders(
    characterId: string | null,
    observed: LiveSessionRulesRevisions | null,
    transaction?: RoomTransaction
  ) {
    return createSnapshotReaders(await this.contentObjects(characterId, observed, transaction))
  }

  async contentObjects(
    characterId: string | null,
    observed: LiveSessionRulesRevisions | null,
    transaction?: RoomTransaction
  ) {
    const key = characterId ? cacheKey({ kind: 'CHARACTER', characterId }) : 'CAMPAIGN_PLAY'
    if (characterId) await this.character(characterId, observed, transaction)
    else await this.play(observed, transaction)
    const content = this.#content.get(key)
    if (!content) throw new Error('Room content has not been loaded.')
    return content.objects
  }

  async #point<Kind extends ResponseKind>(
    scope: Exclude<LiveRoomInputsScope, { kind: PagedKind | 'SCENE' }>,
    observed: LiveSessionRulesRevisions | null,
    kind: Kind,
    transaction?: RoomTransaction
  ) {
    const key = cacheKey(scope)
    const held = transaction
      ? transaction.record(CACHE_KIND, key)
      : this.#store.record(CACHE_KIND, key)
    if (held && isCurrent(held, observed)) {
      const response = expectKind(liveRoomInputsResponseSchema.parse(JSON.parse(held.json)), kind)
      const source: LiveRoomInputsResponse = response
      if (source.kind === 'CAMPAIGN_PLAY')
        this.#content.set(key, await this.#readContent(source.contentSnapshots, key))
      return response
    }
    const response = expectKind(await this.#read(this.#requireEpoch(), scope), kind)
    const source: LiveRoomInputsResponse = response
    const content =
      source.kind === 'CAMPAIGN_PLAY' ? await this.#readContent(source.contentSnapshots, key) : null
    if (transaction) transaction.setRecord(cacheRecord(key, response))
    else
      await this.#store.transact(async (target) => {
        target.setRecord(cacheRecord(key, response))
      })
    if (content) this.#content.set(key, content)
    return response
  }

  #characterManifest(part: AssignedPart) {
    if (!part.contentSnapshots) throw new Error('Character content manifest is missing.')
    return part.contentSnapshots
  }

  async #readContent(manifest: ContentSnapshotManifestDto, key?: string): Promise<LoadedContent> {
    const json = canonicalizeJson(manifest)
    const held = key ? this.#content.get(key) : null
    if (held?.manifest === json) return held
    return { manifest: json, objects: await this.#loadContent(manifest) }
  }

  #requireEpoch() {
    const { epoch } = this.#store
    if (!epoch) throw new Error('The room store has not been hydrated.')
    return epoch
  }

  async #readRun(
    read: (scope: LiveRoomInputsScope) => Promise<LiveRoomInputsResponse>,
    encounterId: string
  ) {
    for (let attempt = 0; attempt < RUN_READ_ATTEMPTS; attempt++) {
      const pages = await readPages(read, 'RUN', (cursor) => ({ kind: 'RUN', encounterId, cursor }))
      // A command between pages bumps the Run's version, so one version means one snapshot.
      if (new Set(pages.map((page) => page.encounterVersion)).size === 1)
        return {
          documents: toRoomDocuments(pages),
          record: cacheRecord(cacheKey({ kind: 'RUN', encounterId }), {
            ...pages[0]!,
            documents: [],
            continueCursor: null
          })
        }
    }
    throw new Error('The Run changed while it was being read.')
  }

  async #readAuthority(read: (scope: LiveRoomInputsScope) => Promise<LiveRoomInputsResponse>) {
    for (let attempt = 0; attempt < RUN_READ_ATTEMPTS; attempt++) {
      const pages = await readPages(read, 'AUTHORITY', (cursor) => ({ kind: 'AUTHORITY', cursor }))
      if (new Set(pages.map((page) => canonicalizeJson(page.revisions))).size !== 1) continue
      const documents = toRoomDocuments(pages)
      const campaigns = documents.filter((row) => row.table === 'campaigns')
      const campaignId = campaigns[0]?.fields.id
      if (
        campaigns.length !== 1 ||
        typeof campaignId !== 'string' ||
        documents.some(
          (row) =>
            row.table !== 'campaigns' &&
            (!['campaignMemberships', 'campaignCharacterAssignments'].includes(row.table) ||
              row.fields.campaignId !== campaignId)
        )
      )
        throw new Error('Room Campaign authority facts have inconsistent scope.')
      return {
        ...pages[0]!,
        documents,
        accountUserIds: [...new Set(pages.flatMap((page) => page.accountUserIds))],
        continueCursor: null
      }
    }
    throw new Error('Campaign authority changed while it was being read.')
  }

  async #readDefinitions(read: (scope: LiveRoomInputsScope) => Promise<LiveRoomInputsResponse>) {
    for (let attempt = 0; attempt < RUN_READ_ATTEMPTS; attempt++) {
      const pages = (
        await readPages(read, 'DEFINITIONS', (cursor) => ({ kind: 'DEFINITIONS', cursor }))
      ).map((page) => expectKind(liveRoomInputsResponseSchema.parse(page), 'DEFINITIONS'))
      if (new Set(pages.map((page) => canonicalizeJson(page.revisions))).size !== 1) continue
      const first = pages[0]!
      const systemId = first.revisions.find(({ scope }) => scope === 'SYSTEM')!.id
      const definitions = pages.flatMap((page) => page.definitions)
      const ids = new Set<string>()
      for (const entry of definitions) {
        if (ids.has(entry.id)) throw new Error('Room definition inventory repeats an identity.')
        ids.add(entry.id)
        const current = entry.definition
        if (
          current &&
          (current.id !== entry.id ||
            current.gameSystemId !== systemId ||
            current.checksum !== checksumRuleDocument(current.document))
        )
          throw new Error(
            'Room definition inventory has inconsistent identity, System or checksum.'
          )
      }
      return { ...first, definitions, continueCursor: null }
    }
    throw new Error('Definitions changed while they were being read.')
  }

  async #readScene(
    read: (scope: LiveRoomInputsScope) => Promise<LiveRoomInputsResponse>,
    sceneId: string
  ) {
    for (let attempt = 0; attempt < RUN_READ_ATTEMPTS; attempt++) {
      const pages: ResponseOf<'SCENE'>[] = []
      const cursors = new Set<string>()
      let cursor: LiveRoomSceneInputsCursor = null
      do {
        const cursorKey = canonicalizeJson(cursor)
        if (cursors.has(cursorKey)) throw new Error('Scene input continuation repeated.')
        cursors.add(cursorKey)
        const page: ResponseOf<'SCENE'> = expectKind(
          liveRoomInputsResponseSchema.parse(await read({ kind: 'SCENE', sceneId, cursor })),
          'SCENE'
        )
        if (page.source.sceneId !== sceneId)
          throw new Error('Checkpoint Scene source does not match the requested Scene.')
        pages.push(page)
        cursor = page.continueCursor
      } while (cursor)
      if (
        new Set(pages.map((page) => canonicalizeJson(page.source))).size === 1 &&
        new Set(pages.map((page) => page.sceneVersion)).size === 1
      ) {
        const definitions = await readPages(read, 'SCENE_DEFINITION', (cursor) => ({
          kind: 'SCENE_DEFINITION',
          sceneId,
          cursor
        }))
        if (
          definitions.some(
            (page) =>
              canonicalizeJson(page.source) !== canonicalizeJson(pages[0]!.source) ||
              page.header.version !== pages[0]!.sceneVersion ||
              canonicalizeJson(page.header) !== canonicalizeJson(definitions[0]!.header)
          )
        )
          continue
        return [...sceneRecords(pages), ...roomSceneDefinitionRecords(definitions)]
      }
    }
    throw new Error('The Scene changed while it was being read.')
  }

  /**
   * The Run with its assigned Characters. Convex writes no actors of a Run the room holds (D74), so
   * an actor whose Character left the Campaign or was deleted is still unfrozen here; the room's
   * departure reconcile freezes or removes it after the hydrating command commits.
   */
  async #readRunWithCharacters(
    read: (scope: LiveRoomInputsScope) => Promise<LiveRoomInputsResponse>,
    encounterId: string
  ) {
    const { documents: run, record: runRecord } = await this.#readRun(read, encounterId)
    const characterIds = characterIdsOf(run)
    const { characters } = characterIds.length
      ? await this.#readCharacters(read, characterIds)
      : { characters: [] }
    return { run, runRecord, characters }
  }

  /**
   * The Characters among `characterIds` that no longer exist, read fresh. The departure reconcile
   * removes their actors as account deletion does, instead of freezing them (D74).
   */
  async deletedCharacterIds(characterIds: readonly string[]) {
    const { deleted } = await this.#readCharacters(
      (scope) => this.#read(this.#requireEpoch(), scope),
      characterIds
    )
    return new Set(deleted)
  }

  /** Reads the Characters together; unassigned and deleted ones are reported rather than failing. */
  async #readCharacters(
    read: (scope: LiveRoomInputsScope) => Promise<LiveRoomInputsResponse>,
    characterIds: readonly string[]
  ) {
    const pages = await readPages(read, 'CHARACTERS', (cursor) => ({
      kind: 'CHARACTERS',
      characterIds: [...characterIds],
      cursor
    }))
    const assigned = new Map<string, { part: AssignedPart; documents: RoomDocument[] }>()
    const unassigned = new Set<string>()
    const deleted = new Set<string>()
    for (const part of pages.flatMap((page) => page.parts)) {
      if (part.status === 'UNASSIGNED') {
        unassigned.add(part.characterId)
        continue
      }
      if (part.status === 'DELETED') {
        deleted.add(part.characterId)
        continue
      }
      const held = assigned.get(part.characterId)
      if (held) held.documents.push(...part.documents)
      else {
        // The first part's revisions are the safe stamp: a Character that changed while its parts
        // were read is newer than the stamp, so its next comparison misses and reads again.
        if (!part.inputs || !part.contentSnapshots) throw new Error('Character inputs are missing.')
        assigned.set(part.characterId, {
          part: { ...part, documents: [] },
          documents: [...part.documents]
        })
      }
    }
    if (characterIds.some((id) => !assigned.has(id) && !unassigned.has(id) && !deleted.has(id)))
      throw new Error('A Character was not read.')
    return { characters: [...assigned.values()], deleted: [...deleted] }
  }
}
