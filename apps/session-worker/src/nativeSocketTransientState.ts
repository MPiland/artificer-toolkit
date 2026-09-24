import { z } from 'zod'

const pathSchema = z
  .array(z.strictObject({ x: z.number().finite(), y: z.number().finite() }))
  .min(1)
  .max(256)
type TokenPath = z.infer<typeof pathSchema>

interface TransientRow extends Record<string, SqlStorageValue> {
  sequence: number
  scene_id: string | null
  baseline_version: number | null
  path_json: string | null
}

/** Per-stream state survives hibernation without growing the 16 KiB WebSocket attachment. */
export class NativeSocketTransientState {
  constructor(private readonly storage: DurableObjectStorage) {
    storage.sql.exec(`CREATE TABLE IF NOT EXISTS native_socket_transients (
      socket_id TEXT NOT NULL,
      stream_key TEXT NOT NULL,
      sequence INTEGER NOT NULL CHECK (sequence >= 0),
      scene_id TEXT,
      baseline_version INTEGER,
      path_json TEXT,
      PRIMARY KEY (socket_id, stream_key)
    )`)
  }

  read(socketId: string, streamKey: string) {
    const row = this.storage.sql
      .exec<TransientRow>(
        `SELECT sequence, scene_id, baseline_version, path_json
       FROM native_socket_transients WHERE socket_id = ? AND stream_key = ?`,
        socketId,
        streamKey
      )
      .toArray()[0]
    if (!row) return null
    if (!Number.isSafeInteger(row.sequence) || row.sequence < 0)
      throw new Error('Stored transient sequence is invalid.')
    return {
      sequence: row.sequence,
      sceneId: row.scene_id,
      baselineVersion: row.baseline_version,
      path: row.path_json === null ? null : pathSchema.parse(JSON.parse(row.path_json))
    }
  }

  retain(
    socketId: string,
    streamKey: string,
    sequence: number,
    sceneId: string,
    baselineVersion: number,
    path?: TokenPath
  ): void {
    this.storage.sql.exec(
      `INSERT INTO native_socket_transients (socket_id, stream_key, sequence, scene_id, baseline_version, path_json)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (socket_id, stream_key) DO UPDATE SET
         sequence = excluded.sequence, scene_id = excluded.scene_id,
         baseline_version = excluded.baseline_version, path_json = excluded.path_json
       WHERE excluded.sequence > native_socket_transients.sequence`,
      socketId,
      streamKey,
      sequence,
      sceneId,
      baselineVersion,
      path ? JSON.stringify(path) : null
    )
  }

  forget(socketId: string): void {
    this.storage.sql.exec('DELETE FROM native_socket_transients WHERE socket_id = ?', socketId)
  }

  forgetClosedSockets(liveSocketIds: ReadonlySet<string>): void {
    const stored = this.storage.sql
      .exec<{ socket_id: string }>('SELECT DISTINCT socket_id FROM native_socket_transients')
      .toArray()
    this.storage.transactionSync(() => {
      for (const row of stored) if (!liveSocketIds.has(row.socket_id)) this.forget(row.socket_id)
    })
  }
}
