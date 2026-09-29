import {
  liveRoomActorSourceSchema,
  liveRoomInputsResponseSchema,
  type LiveRoomInputsCursor,
  type LiveRoomInputsResponse,
  type LiveRoomInputsScope
} from '@artificer-toolkit/schema/api/liveRoomInputs'
import {
  liveSessionRulesRevisionsSchema,
  type LiveSessionRulesRevisions
} from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { RoomDocument, RoomEncounterStore, RoomRecord } from './roomEncounterStore.js'

/** Reads one scope of the room's rules inputs from Convex, for `epoch`'s Campaign. */
export type RoomInputsReader = (
  epoch: string,
  scope: LiveRoomInputsScope
) => Promise<LiveRoomInputsResponse>

type ResponseKind = LiveRoomInputsResponse['kind']
type ResponseOf<Kind extends ResponseKind> = Extract<LiveRoomInputsResponse, { kind: Kind }>
type PagedScope = Extract<LiveRoomInputsScope, { kind: 'RUN' | 'CHARACTER' }>

/** Room records that cache one rules input each, keyed by their scope. */
const CACHE_KIND = 'ROOM_INPUT'
const RUN_READ_ATTEMPTS = 3

function expectKind<Kind extends ResponseKind>(response: LiveRoomInputsResponse, kind: Kind) {
  if (response.kind !== kind) throw new Error(`Room input ${kind} answered as ${response.kind}.`)
  // The check above is the narrowing; TypeScript cannot narrow by a generic discriminant.
  return response as ResponseOf<Kind>
}

/** Reads every page of a paged scope, in order. */
async function readPages<Kind extends 'RUN' | 'CHARACTER'>(
  read: (scope: LiveRoomInputsScope) => Promise<LiveRoomInputsResponse>,
  kind: Kind,
  scopeAt: (cursor: LiveRoomInputsCursor) => PagedScope
) {
  const pages: ResponseOf<Kind>[] = []
  let cursor: LiveRoomInputsCursor = null
  do {
    const page: ResponseOf<Kind> = expectKind(await read(scopeAt(cursor)), kind)
    pages.push(page)
    cursor = (page as ResponseOf<PagedScope['kind']>).continueCursor
  } while (cursor)
  return pages
}

function toRoomDocuments(pages: readonly { documents: readonly RoomDocument[] }[]) {
  return pages.flatMap((page) => page.documents)
}

/** The Character actors' source ids: the Characters whose stored inputs the Run's rules read. */
function characterIdsOf(documents: readonly RoomDocument[]) {
  const ids = new Set<string>()
  for (const { table, fields } of documents) {
    if (table !== 'encounterRunActors') continue
    const { stateJson } = fields
    if (typeof stateJson !== 'string') throw new Error('Room actor state is invalid.')
    const actor = liveRoomActorSourceSchema.parse(JSON.parse(stateJson))
    if (actor.kind === 'CHARACTER') ids.add(actor.sourceId)
  }
  return [...ids]
}

/** The cached copy carries the revisions it was read at, so a bump misses. */
function cacheRecord(key: string, response: LiveRoomInputsResponse): RoomRecord {
  const revisions = 'revisions' in response ? response.revisions : null
  return {
    kind: CACHE_KIND,
    key,
    revision: revisions && JSON.stringify(revisions),
    // A Character's paged documents live in the store; its response arrives with none.
    json: JSON.stringify(response)
  }
}

/** Whether every revision the cached read observed is still the revision `observed` reports. */
function isCurrent(record: RoomRecord, observed: LiveSessionRulesRevisions | null) {
  if (!observed || !record.revision) return false
  const held = liveSessionRulesRevisionsSchema.parse(JSON.parse(record.revision))
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
    | { kind: 'DEFINITION'; definitionId: string }
    | { kind: 'SYSTEM'; part: 'SYSTEM' | 'VOCABULARY' }
) => {
  switch (scope.kind) {
    case 'CAMPAIGN_PLAY':
      return 'CAMPAIGN_PLAY'
    case 'CHARACTER':
      return `CHARACTER:${scope.characterId}`
    case 'DEFINITION':
      return `DEFINITION:${scope.definitionId}`
    case 'SYSTEM':
      return `SYSTEM:${scope.part}`
  }
}

/**
 * The room's rules inputs (ADR 0035, Amendment 11), read from Convex once and kept in the room store
 * (S2). {@link hydrate} loads a new epoch: the Run aggregate, its Characters, the Campaign play scope
 * and the System with its vocabulary. The other loads are demand reads cached by their revisions:
 * a caller passes the revisions it currently observes (`null` for none) and a stale entry is read
 * again, replacing a Character's documents and record in one room transaction.
 */
export class RoomInputs {
  readonly #store: RoomEncounterStore
  readonly #read: RoomInputsReader

  constructor(store: RoomEncounterStore, read: RoomInputsReader) {
    this.#store = store
    this.#read = read
  }

  /**
   * Replaces the store with `encounterId`'s aggregate as Convex holds it for `epoch`. With no
   * Encounter the store holds only the epoch. A Run that changes while it is being read is read again.
   */
  async hydrate({ epoch, encounterId }: { epoch: string; encounterId: string | null }) {
    if (!encounterId) {
      this.#store.hydrate({ epoch, documents: [], records: [] })
      return
    }
    const read = (scope: LiveRoomInputsScope) => this.#read(epoch, scope)
    const run = await this.#readRun(read, encounterId)
    const [play, system, vocabulary, ...characters] = await Promise.all([
      read({ kind: 'CAMPAIGN_PLAY' }),
      read({ kind: 'SYSTEM', part: 'SYSTEM' }),
      read({ kind: 'SYSTEM', part: 'VOCABULARY' }),
      ...characterIdsOf(run).map((characterId) => this.#readCharacter(read, characterId))
    ])
    this.#store.hydrate({
      epoch,
      documents: [...run, ...characters.flatMap((character) => character.documents)],
      records: [
        cacheRecord(cacheKey({ kind: 'CAMPAIGN_PLAY' }), play),
        cacheRecord(cacheKey({ kind: 'SYSTEM', part: 'SYSTEM' }), system),
        cacheRecord(cacheKey({ kind: 'SYSTEM', part: 'VOCABULARY' }), vocabulary),
        ...characters.map((character) =>
          cacheRecord(
            cacheKey({ kind: 'CHARACTER', characterId: character.id }),
            character.response
          )
        )
      ]
    })
  }

  play(observed: LiveSessionRulesRevisions | null) {
    return this.#point({ kind: 'CAMPAIGN_PLAY' }, observed, 'CAMPAIGN_PLAY')
  }

  system(part: 'SYSTEM' | 'VOCABULARY', observed: LiveSessionRulesRevisions | null) {
    return this.#point({ kind: 'SYSTEM', part }, observed, 'SYSTEM')
  }

  definition(definitionId: string, observed: LiveSessionRulesRevisions | null) {
    return this.#point({ kind: 'DEFINITION', definitionId }, observed, 'DEFINITION')
  }

  /**
   * The Character's stored inputs. A stale entry is read again and its active Rule Effects replace
   * the held ones together with the record, in one command-sized transaction.
   */
  async character(characterId: string, observed: LiveSessionRulesRevisions | null) {
    const key = cacheKey({ kind: 'CHARACTER', characterId })
    const held = this.#store.record(CACHE_KIND, key)
    if (held && isCurrent(held, observed))
      return expectKind(liveRoomInputsResponseSchema.parse(JSON.parse(held.json)), 'CHARACTER')
    const epoch = this.#requireEpoch()
    const loaded = await this.#readCharacter((scope) => this.#read(epoch, scope), characterId)
    await this.#store.transact(async (transaction) => {
      const previous = await this.#store.store
        .query('characterActiveRuleEffects')
        .withIndex('by_characterId_id', (q) => q.eq('characterId', characterId))
        .collect()
      for (const row of previous) await this.#store.store.delete(row._id)
      for (const document of loaded.documents) transaction.restoreDocument(document)
      transaction.setRecord(cacheRecord(key, loaded.response))
    })
    return loaded.response
  }

  async #point<Kind extends ResponseKind>(
    scope: Exclude<LiveRoomInputsScope, { kind: 'RUN' | 'CHARACTER' }>,
    observed: LiveSessionRulesRevisions | null,
    kind: Kind
  ) {
    const key = cacheKey(scope)
    const held = this.#store.record(CACHE_KIND, key)
    if (held && isCurrent(held, observed))
      return expectKind(liveRoomInputsResponseSchema.parse(JSON.parse(held.json)), kind)
    const response = expectKind(await this.#read(this.#requireEpoch(), scope), kind)
    await this.#store.transact(async (transaction) => {
      transaction.setRecord(cacheRecord(key, response))
    })
    return response
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
        return toRoomDocuments(pages)
    }
    throw new Error('The Run changed while it was being read.')
  }

  async #readCharacter(
    read: (scope: LiveRoomInputsScope) => Promise<LiveRoomInputsResponse>,
    characterId: string
  ) {
    const pages = await readPages(read, 'CHARACTER', (cursor) => ({
      kind: 'CHARACTER',
      characterId,
      cursor
    }))
    const [first] = pages
    if (!first?.inputs) throw new Error('Character inputs are missing.')
    // The first page's revisions are the safe stamp: a Character that changed while its pages
    // were read is newer than the stamp, so its next comparison misses and reads again.
    return {
      id: characterId,
      documents: toRoomDocuments(pages),
      response: { ...first, documents: [], continueCursor: null }
    }
  }
}
