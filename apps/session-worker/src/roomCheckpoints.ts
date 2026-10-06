import {
  liveSessionCheckpointInputSchema,
  liveSessionCheckpointResponseSchema,
  type LiveSessionCheckpointInput,
  type LiveSessionCheckpointReason,
  type LiveSessionCheckpointResponse
} from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import { LIVE_SESSION_CHECKPOINT_MAX_BYTES } from '@artificer-toolkit/schema/api/liveSessionCheckpointFence'
import {
  LIVE_SESSION_CHECKPOINT_JOURNAL_MAX_BYTES,
  type LiveSessionCheckpointAcknowledgement
} from '@artificer-toolkit/schema/api/liveSessionCheckpointJournal'
import { MAX_ROOM_INPUT_RESPONSE_DOCUMENTS } from '@artificer-toolkit/schema/api/liveRoomInputsBatch'
import { liveSessionRoomAuthorizationInputSchema } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import { encodeBase64, decodeBase64 } from '@artificer-toolkit/shared/base64'
import {
  encodeUtf8PayloadChunks,
  decodeUtf8PayloadChunks
} from '@artificer-toolkit/shared/jsonPayloadChunks'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import { buildRoomCheckpointRecords } from './roomCheckpointRecords.js'
import { adoptRevisions } from './roomAuthorization.js'
import type { RoomEncounterStore, RoomStorage } from './roomEncounterStore.js'

type FlushInput = Pick<LiveSessionCheckpointInput, 'campaignId' | 'epoch' | 'knownAuthorization'>
// Base64 expands 72,000 bytes to 96,000 SQL characters, below the statement binding limit.
const PENDING_CHUNK_BYTES = 72_000
/** Publishes acknowledged snapshot prefixes, retaining one exact retry input across eviction. */
export class RoomCheckpoints {
  readonly #store: RoomEncounterStore
  readonly #storage: RoomStorage
  readonly #publish: (
    input: LiveSessionCheckpointInput,
    reason: LiveSessionCheckpointReason
  ) => Promise<LiveSessionCheckpointResponse>
  readonly #onAcknowledge?: (
    ack: LiveSessionCheckpointAcknowledgement,
    response: LiveSessionCheckpointResponse
  ) => undefined
  readonly #onPublished?: (
    page: LiveSessionCheckpointInput,
    response: LiveSessionCheckpointResponse
  ) => void
  #flushing: {
    campaignId: string
    epoch: string
    promise: Promise<LiveSessionCheckpointResponse | null>
  } | null = null

  constructor(
    store: RoomEncounterStore,
    storage: RoomStorage,
    publish: (
      input: LiveSessionCheckpointInput,
      reason: LiveSessionCheckpointReason
    ) => Promise<LiveSessionCheckpointResponse>,
    onAcknowledge?: (
      ack: LiveSessionCheckpointAcknowledgement,
      response: LiveSessionCheckpointResponse
    ) => undefined,
    /** Runs after each page is acknowledged and compacted, with the page as sent and its response. */
    onPublished?: (
      page: LiveSessionCheckpointInput,
      response: LiveSessionCheckpointResponse
    ) => void
  ) {
    this.#store = store
    this.#storage = storage
    this.#publish = publish
    this.#onAcknowledge = onAcknowledge
    this.#onPublished = onPublished
    storage.sql.exec(`CREATE TABLE IF NOT EXISTS room_pending_checkpoint (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
      byte_length INTEGER NOT NULL,
      part_count INTEGER NOT NULL,
      input_checksum TEXT NOT NULL
    )`)
    storage.sql.exec(`CREATE TABLE IF NOT EXISTS room_pending_checkpoint_chunks (
      part INTEGER PRIMARY KEY,
      data TEXT NOT NULL
    )`)
  }

  /**
   * `reason` names the trigger of every send this flush makes; a flush already running keeps its own.
   * Resolves with the last page's response; each page's own is passed to `onPublished`.
   */
  flush(
    input: FlushInput,
    reason: LiveSessionCheckpointReason
  ): Promise<LiveSessionCheckpointResponse | null> {
    const validated = liveSessionRoomAuthorizationInputSchema.parse({
      campaignId: input.campaignId,
      epoch: input.epoch,
      known: input.knownAuthorization
    })
    if (this.#flushing) {
      if (
        validated.campaignId !== this.#flushing.campaignId ||
        validated.epoch !== this.#flushing.epoch
      )
        return Promise.reject(new Error('Concurrent checkpoint scope does not match.'))
      return this.#flushing.promise
    }
    const promise = this.#flush({ ...input, knownAuthorization: validated.known }, reason).finally(
      () => {
        this.#flushing = null
      }
    )
    this.#flushing = { campaignId: validated.campaignId, epoch: validated.epoch, promise }
    return promise
  }

  async #flush(
    scope: FlushInput,
    reason: LiveSessionCheckpointReason
  ): Promise<LiveSessionCheckpointResponse | null> {
    const throughSequence = this.#store.sequence
    let last: LiveSessionCheckpointResponse | null = null
    // Each page bumps the revisions the next one is sent with, or Convex would adopt none after the first.
    let known = scope.knownAuthorization
    for (;;) {
      const pending = await this.#store.whenClosed(() =>
        this.#nextPending({ ...scope, knownAuthorization: known }, throughSequence)
      )
      if (!pending) return last
      // The publisher receives a clone; a failed callback cannot mutate durable retry evidence.
      const response = liveSessionCheckpointResponseSchema.parse(
        await this.#publish(structuredClone(pending), reason)
      )
      const { authority } = response
      if (
        authority.campaignId !== pending.campaignId ||
        authority.epoch !== pending.epoch ||
        authority.persistedSequence !== pending.sequence ||
        authority.persistedStateChecksum !== pending.checksum
      )
        throw new Error('Checkpoint response does not acknowledge its exact committed prefix.')
      const ack = { epoch: pending.epoch, sequence: pending.sequence, checksum: pending.checksum }
      await this.#store.whenClosed(() => {
        this.#store.compact(ack, () => this.#onAcknowledge?.(ack, response))
        this.#clearPending()
      })
      this.#onPublished?.(pending, response)
      known =
        pending.knownAuthorization && adoptRevisions(pending.knownAuthorization, response.adopted)
      last = response
    }
  }

  /** The retained send, or a new one for the next journal page; null once `throughSequence` is held. */
  #nextPending(scope: FlushInput, throughSequence: number): LiveSessionCheckpointInput | null {
    for (;;) {
      const base = this.#store.checkpointSnapshot()
      if (base.epoch !== scope.epoch)
        throw new Error('Checkpoint epoch does not match the room snapshot.')
      let pending = this.#readPending()
      if (pending) {
        if (pending.campaignId !== scope.campaignId || pending.epoch !== scope.epoch)
          throw new Error('Pending checkpoint scope does not match.')
        if (pending.sequence === base.sequence && pending.checksum === base.checksum) {
          this.#clearPending()
          continue
        }
        if (pending.fromSequence !== base.sequence || pending.fromChecksum !== base.checksum)
          throw new Error('Pending checkpoint does not start at the room snapshot.')
        const { records, checksum } = this.#fold(base, pending.sequence)
        if (
          checksum !== pending.checksum ||
          sha256Hex(canonicalizeJson(records)) !== pending.payloadChecksum
        )
          throw new Error('Pending checkpoint does not match the committed room journal.')
      } else {
        if (base.sequence >= throughSequence) return null
        // One checkpoint folds the longest prefix whose records fit the atomic bound, so a save
        // normally publishes the whole unsaved journal at once and rows created and dropped within
        // it never reach Convex. The raw journal is read in bounded pages and streamed into one
        // fold, so the page size never cuts a checkpoint.
        for (let limit = throughSequence; limit > base.sequence;) {
          const { records, checksum } = this.#fold(base, limit)
          const recordsJson = canonicalizeJson(records)
          const bytes = new TextEncoder().encode(recordsJson).byteLength
          if (bytes > LIVE_SESSION_CHECKPOINT_MAX_BYTES) {
            // Records grow about linearly with the span, so a proportional step reaches a fitting
            // prefix in a few rebuilds rather than one rebuild per command.
            const span = limit - base.sequence
            limit =
              base.sequence +
              Math.max(
                span === 1 ? 0 : 1,
                Math.min(span - 1, Math.floor((span * LIVE_SESSION_CHECKPOINT_MAX_BYTES) / bytes))
              )
            continue
          }
          pending = liveSessionCheckpointInputSchema.parse({
            ...scope,
            checkpointId: crypto.randomUUID(),
            fromSequence: base.sequence,
            fromChecksum: base.checksum,
            sequence: limit,
            checksum,
            payloadChecksum: sha256Hex(recordsJson),
            records
          })
          break
        }
        if (!pending) throw new Error('One room command cannot fit a checkpoint payload.')
        this.#writePending(pending)
      }
      return pending
    }
  }

  /**
   * Folds `base.sequence..toSequence` from journal pages read lazily, one bounded page at a time.
   * `checksum` is the chain of the last entry folded; the fold validates the chain per entry.
   */
  #fold(base: ReturnType<RoomEncounterStore['checkpointSnapshot']>, toSequence: number) {
    const store = this.#store
    let checksum = base.checksum
    function* journal() {
      let sequence = base.sequence
      while (sequence < toSequence) {
        const page = store.committedWriteSets({
          epoch: base.epoch,
          fromSequence: sequence,
          fromChecksum: checksum,
          toSequence,
          maxEntries: MAX_ROOM_INPUT_RESPONSE_DOCUMENTS,
          maxBytes: LIVE_SESSION_CHECKPOINT_JOURNAL_MAX_BYTES
        })
        if (page.toSequence <= sequence) throw new Error('The room journal page made no progress.')
        yield* page.entries
        sequence = page.toSequence
        checksum = page.toChecksum
      }
    }
    const records = buildRoomCheckpointRecords({
      documents: base.documents,
      records: base.records,
      fromSequence: base.sequence,
      fromChecksum: base.checksum,
      entries: journal()
    })
    return { records, checksum }
  }

  #readPending(): LiveSessionCheckpointInput | null {
    const [frame] = this.#storage.sql
      .exec(
        'SELECT byte_length, part_count, input_checksum FROM room_pending_checkpoint WHERE singleton = 1'
      )
      .toArray()
    const rows = this.#storage.sql
      .exec('SELECT part, data FROM room_pending_checkpoint_chunks ORDER BY part')
      .toArray()
    if (!frame) {
      if (rows.length) throw new Error('Pending checkpoint chunks have no frame.')
      return null
    }
    const byteLength = frame.byte_length
    if (
      typeof byteLength !== 'number' ||
      !Number.isSafeInteger(byteLength) ||
      byteLength <= 0 ||
      frame.part_count !== Math.ceil(byteLength / PENDING_CHUNK_BYTES) ||
      rows.length !== frame.part_count
    )
      throw new Error('Pending checkpoint chunk frame is invalid.')
    const chunks = rows.map((row, index) => {
      if (row.part !== index || typeof row.data !== 'string' || row.data.length > 96_000)
        throw new Error('Pending checkpoint chunk is invalid.')
      const bytes = decodeBase64(row.data)
      if (encodeBase64(bytes) !== row.data)
        throw new Error('Pending checkpoint chunk encoding is invalid.')
      return bytes.slice().buffer
    })
    const json = decodeUtf8PayloadChunks(chunks, byteLength, PENDING_CHUNK_BYTES)
    if (sha256Hex(json) !== frame.input_checksum)
      throw new Error('Pending checkpoint checksum is invalid.')
    const pending = liveSessionCheckpointInputSchema.parse(JSON.parse(json))
    const recordsJson = canonicalizeJson(pending.records)
    if (
      canonicalizeJson(pending) !== json ||
      pending.sequence <= pending.fromSequence ||
      new TextEncoder().encode(recordsJson).byteLength > LIVE_SESSION_CHECKPOINT_MAX_BYTES ||
      sha256Hex(recordsJson) !== pending.payloadChecksum
    )
      throw new Error('Pending checkpoint payload is invalid.')
    return pending
  }

  #writePending(input: LiveSessionCheckpointInput) {
    const json = canonicalizeJson(input)
    const chunks = encodeUtf8PayloadChunks(json, PENDING_CHUNK_BYTES)
    this.#storage.transactionSync(() => {
      this.#storage.sql.exec(
        'INSERT INTO room_pending_checkpoint (singleton, byte_length, part_count, input_checksum) VALUES (1, ?, ?, ?)',
        new TextEncoder().encode(json).byteLength,
        chunks.length,
        sha256Hex(json)
      )
      chunks.forEach((chunk, part) =>
        this.#storage.sql.exec(
          'INSERT INTO room_pending_checkpoint_chunks (part, data) VALUES (?, ?)',
          part,
          encodeBase64(new Uint8Array(chunk))
        )
      )
    })
  }

  /** A fenced old epoch cannot retry its pending upload into the replacement snapshot. */
  discardFencedCheckpointInTransaction(): undefined {
    if (this.#flushing) throw new Error('The old checkpoint is still publishing.')
    this.#storage.sql.exec('DELETE FROM room_pending_checkpoint_chunks')
    this.#storage.sql.exec('DELETE FROM room_pending_checkpoint WHERE singleton = 1')
    return undefined
  }

  #clearPending() {
    this.#storage.transactionSync(() => {
      this.#storage.sql.exec('DELETE FROM room_pending_checkpoint_chunks')
      this.#storage.sql.exec('DELETE FROM room_pending_checkpoint WHERE singleton = 1')
    })
  }
}
