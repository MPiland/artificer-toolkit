import {
  sceneFogPatchInputSchema,
  sceneFogSaveProgressSchema,
  type SceneFogAppendInput,
  type SceneFogPatchInput,
  type SceneFogSaveProgress
} from '@artificer-toolkit/schema/api/sceneFog'
import {
  sceneFogChunkDtoSchema,
  sceneFogLayerDtoSchema
} from '@artificer-toolkit/schema/api/vttScenes'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { ROOM_LIMITS } from './roomLimits.js'
import { RoomSceneCommandRefusal, type StagedSceneFogUpload } from './roomSceneEdits.js'

interface UploadScope {
  epoch: string
  userId: string
}

// A type alias, not an interface, so it satisfies the SQL row constraint.
type UploadRow = {
  save_id: string
  command_id: string
  status: 'RECEIVING' | 'PUBLISHED'
  input_json: string
  input_checksum: string
  received_chunks: number
  expires_at: number
}

/**
 * The GM's fog patches staged over the live socket before publication (D79). Staged chunks are
 * not Scene state, so they live beside the journaled room store and never reach a checkpoint;
 * publication copies them into Scene rows. A published row keeps its identity, without chunks,
 * until its window passes so a retried begin finds the same save. Rows belong to one authority
 * epoch and are bounded per account in count; each batch is bounded by the message limits.
 */
export class RoomSceneFogUploads {
  readonly #sql: SqlStorage

  constructor(sql: SqlStorage) {
    this.#sql = sql
    sql.exec(`
      CREATE TABLE IF NOT EXISTS room_scene_fog_uploads (
        save_id TEXT PRIMARY KEY,
        epoch TEXT NOT NULL,
        user_id TEXT NOT NULL,
        command_id TEXT NOT NULL,
        status TEXT NOT NULL,
        input_json TEXT NOT NULL,
        input_checksum TEXT NOT NULL,
        received_chunks INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        UNIQUE (epoch, user_id, command_id)
      );
      CREATE TABLE IF NOT EXISTS room_scene_fog_upload_chunks (
        save_id TEXT NOT NULL,
        ordinal INTEGER NOT NULL,
        chunk_json TEXT NOT NULL,
        PRIMARY KEY (save_id, ordinal)
      )
    `)
  }

  /** Stages a new patch, or returns the progress of the same patch staged earlier. */
  begin(scope: UploadScope, input: SceneFogPatchInput, now = Date.now()): SceneFogSaveProgress {
    this.expire(now)
    const inputChecksum = checksumCanonicalJson(input)
    const [prior] = this.#sql
      .exec<UploadRow>(
        'SELECT * FROM room_scene_fog_uploads WHERE epoch = ? AND user_id = ? AND command_id = ?',
        scope.epoch,
        scope.userId,
        input.commandId
      )
      .toArray()
    if (prior) {
      if (prior.input_checksum !== inputChecksum)
        throw new RoomSceneCommandRefusal('INVALID_COMMAND', 'Scene fog command was already used.')
      return progress(prior)
    }
    const [active] = this.#sql
      .exec<{ count: number }>(
        "SELECT COUNT(*) AS count FROM room_scene_fog_uploads WHERE user_id = ? AND status = 'RECEIVING'",
        scope.userId
      )
      .toArray()
    if ((active?.count ?? 0) >= ROOM_LIMITS.maxFogUploadsPerUser)
      throw new RoomSceneCommandRefusal(
        'RATE_LIMITED',
        'Finish or wait out your other fog changes first.'
      )
    const row: UploadRow = {
      save_id: crypto.randomUUID(),
      command_id: input.commandId,
      status: 'RECEIVING',
      input_json: JSON.stringify(input),
      input_checksum: inputChecksum,
      received_chunks: 0,
      expires_at: now + ROOM_LIMITS.fogUploadWindowMs
    }
    this.#sql.exec(
      `INSERT INTO room_scene_fog_uploads
         (save_id, epoch, user_id, command_id, status, input_json, input_checksum, received_chunks, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      row.save_id,
      scope.epoch,
      scope.userId,
      row.command_id,
      row.status,
      row.input_json,
      row.input_checksum,
      row.expires_at
    )
    return progress(row)
  }

  /** Appends one batch at the next offset; an exact earlier batch replays its progress. */
  append(
    scope: UploadScope,
    commandId: string,
    input: SceneFogAppendInput,
    now = Date.now()
  ): SceneFogSaveProgress {
    const row = this.#row(scope, input.saveId.toLowerCase(), commandId.toLowerCase())
    const patch = sceneFogPatchInputSchema.parse(JSON.parse(row.input_json))
    const valid = sceneFogLayerDtoSchema.safeParse({ ...patch.layer, chunks: input.chunks })
    if (!valid.success || input.offset + input.chunks.length > patch.chunkManifest.length)
      throw new RoomSceneCommandRefusal('INVALID_COMMAND', 'Scene fog chunk batch is invalid.')
    const encoded = input.chunks.map((chunk, index) => {
      const manifest = patch.chunkManifest[input.offset + index]
      if (manifest?.index !== chunk.index || manifest.checksum !== checksumCanonicalJson(chunk))
        throw new RoomSceneCommandRefusal(
          'INVALID_COMMAND',
          'Scene fog chunk does not match its manifest.'
        )
      return JSON.stringify(chunk)
    })
    // The manifest pins every chunk's checksum, so a batch at a received offset is exactly it.
    if (input.offset + input.chunks.length <= row.received_chunks) return progress(row)
    if (row.status !== 'RECEIVING')
      throw new RoomSceneCommandRefusal(
        'INVALID_COMMAND',
        'Published Scene fog batches cannot change.'
      )
    if (row.expires_at <= now)
      throw new RoomSceneCommandRefusal('INVALID_COMMAND', 'Scene fog save expired.')
    if (input.offset !== row.received_chunks)
      throw new RoomSceneCommandRefusal(
        'INVALID_COMMAND',
        'Scene fog chunk batch offset is invalid.'
      )
    for (const [index, chunk] of encoded.entries())
      this.#sql.exec(
        'INSERT INTO room_scene_fog_upload_chunks (save_id, ordinal, chunk_json) VALUES (?, ?, ?)',
        row.save_id,
        input.offset + index,
        chunk
      )
    const received = row.received_chunks + encoded.length
    this.#sql.exec(
      'UPDATE room_scene_fog_uploads SET received_chunks = ? WHERE save_id = ?',
      received,
      row.save_id
    )
    return progress({ ...row, received_chunks: received })
  }

  /** The complete, unexpired staged patch the publication commits. */
  read(scope: UploadScope, saveId: string, commandId: string, now = Date.now()) {
    const row = this.#row(scope, saveId.toLowerCase(), commandId.toLowerCase())
    const input = sceneFogPatchInputSchema.parse(JSON.parse(row.input_json))
    if (row.status !== 'RECEIVING' || row.expires_at <= now)
      throw new RoomSceneCommandRefusal('INVALID_COMMAND', 'Scene fog save expired.')
    if (row.received_chunks !== input.chunkManifest.length)
      throw new RoomSceneCommandRefusal('INVALID_COMMAND', 'Scene fog save is incomplete.')
    const chunks = this.#sql
      .exec<{ chunk_json: string }>(
        'SELECT chunk_json FROM room_scene_fog_upload_chunks WHERE save_id = ? ORDER BY ordinal',
        row.save_id
      )
      .toArray()
      .map((chunk) => sceneFogChunkDtoSchema.parse(JSON.parse(chunk.chunk_json)))
    if (chunks.length !== input.chunkManifest.length)
      throw new Error('Staged Scene fog chunks are inconsistent.')
    return {
      saveId: row.save_id,
      input,
      inputChecksum: row.input_checksum,
      expiresAt: row.expires_at,
      chunks
    } satisfies StagedSceneFogUpload
  }

  /** Runs inside the publication's durable commit: the chunks now live in Scene rows. */
  markPublished(saveId: string): void {
    this.#sql.exec('DELETE FROM room_scene_fog_upload_chunks WHERE save_id = ?', saveId)
    this.#sql.exec(
      "UPDATE room_scene_fog_uploads SET status = 'PUBLISHED' WHERE save_id = ?",
      saveId
    )
  }

  /** Eviction and account deletion remove the account's staged patches. */
  deleteUser(userId: string): void {
    this.#sql.exec(
      'DELETE FROM room_scene_fog_upload_chunks WHERE save_id IN (SELECT save_id FROM room_scene_fog_uploads WHERE user_id = ?)',
      userId
    )
    this.#sql.exec('DELETE FROM room_scene_fog_uploads WHERE user_id = ?', userId)
  }

  /** Room release discards every staged patch. */
  clear(): void {
    this.#sql.exec('DELETE FROM room_scene_fog_upload_chunks')
    this.#sql.exec('DELETE FROM room_scene_fog_uploads')
  }

  /** The earliest window end among staged and published rows, for the room's alarm. */
  nextExpiry(): number | null {
    const [row] = this.#sql
      .exec<{ expires_at: number | null }>(
        'SELECT MIN(expires_at) AS expires_at FROM room_scene_fog_uploads'
      )
      .toArray()
    return row?.expires_at ?? null
  }

  /** Discards every row whose window has passed; the room's alarm sweeps what no begin does. */
  expire(now: number): void {
    this.#sql.exec(
      'DELETE FROM room_scene_fog_upload_chunks WHERE save_id IN (SELECT save_id FROM room_scene_fog_uploads WHERE expires_at <= ?)',
      now
    )
    this.#sql.exec('DELETE FROM room_scene_fog_uploads WHERE expires_at <= ?', now)
  }

  #row(scope: UploadScope, saveId: string, commandId: string): UploadRow {
    const [row] = this.#sql
      .exec<UploadRow>(
        'SELECT * FROM room_scene_fog_uploads WHERE save_id = ? AND epoch = ? AND user_id = ?',
        saveId,
        scope.epoch,
        scope.userId
      )
      .toArray()
    if (!row || row.command_id !== commandId)
      throw new RoomSceneCommandRefusal('INVALID_COMMAND', 'Scene fog save is unavailable.')
    return row
  }
}

function progress(row: UploadRow): SceneFogSaveProgress {
  const input = sceneFogPatchInputSchema.parse(JSON.parse(row.input_json))
  return sceneFogSaveProgressSchema.parse({
    saveId: row.save_id,
    sceneId: input.sceneId,
    commandId: row.command_id,
    status: row.status,
    receivedChunks: row.received_chunks,
    totalChunks: input.chunkManifest.length
  })
}
