import {
  liveSessionCheckpointInputSchema,
  liveSessionCheckpointResponseSchema,
  type LiveSessionCheckpointInput,
  type LiveSessionCheckpointReason,
  type LiveSessionCheckpointResponse
} from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import { LIVE_SESSION_CHECKPOINT_MAX_BYTES } from '@artificer-toolkit/schema/api/liveSessionCheckpointFence'
import type { LiveSessionCheckpointAcknowledgement } from '@artificer-toolkit/schema/api/liveSessionCheckpointJournal'
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
    ) => undefined
  ) {
    this.#store = store
    this.#storage = storage
    this.#publish = publish
    this.#onAcknowledge = onAcknowledge
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

  /** `reason` names the trigger of every send this flush makes; a flush already running keeps its own. */
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
        const page = this.#journal(base, pending.sequence)
        if (
          !page.complete ||
          page.toChecksum !== pending.checksum ||
          sha256Hex(canonicalizeJson(this.#records(base, page.entries))) !== pending.payloadChecksum
        )
          throw new Error('Pending checkpoint does not match the committed room journal.')
      } else {
        if (base.sequence >= throughSequence) return last
        const page = this.#journal(base, throughSequence)
        for (let count = page.entries.length; count > 0; count--) {
          const entries = page.entries.slice(0, count)
          const records = this.#records(base, entries)
          const recordsJson = canonicalizeJson(records)
          if (new TextEncoder().encode(recordsJson).byteLength > LIVE_SESSION_CHECKPOINT_MAX_BYTES)
            continue
          const terminal = entries.at(-1)!
          pending = liveSessionCheckpointInputSchema.parse({
            ...scope,
            checkpointId: crypto.randomUUID(),
            fromSequence: base.sequence,
            fromChecksum: base.checksum,
            sequence: terminal.sequence,
            checksum: terminal.chainChecksum,
            payloadChecksum: sha256Hex(recordsJson),
            records
          })
          break
        }
        if (!pending) throw new Error('One room command cannot fit a checkpoint payload.')
        this.#writePending(pending)
      }
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
      this.#store.compact(ack, () => this.#onAcknowledge?.(ack, response))
      this.#clearPending()
      last = response
    }
  }

  #journal(base: ReturnType<RoomEncounterStore['checkpointSnapshot']>, toSequence: number) {
    return this.#store.committedWriteSets({
      epoch: base.epoch,
      fromSequence: base.sequence,
      fromChecksum: base.checksum,
      toSequence,
      maxEntries: MAX_ROOM_INPUT_RESPONSE_DOCUMENTS,
      maxBytes: LIVE_SESSION_CHECKPOINT_MAX_BYTES
    })
  }

  #records(
    base: ReturnType<RoomEncounterStore['checkpointSnapshot']>,
    entries: ReturnType<RoomEncounterStore['committedWriteSets']>['entries']
  ) {
    return buildRoomCheckpointRecords({
      documents: base.documents,
      records: base.records,
      fromSequence: base.sequence,
      fromChecksum: base.checksum,
      entries
    })
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
