import type { DBLike } from '#types'
import type { CharacterBuildState } from '@artificer-toolkit/shared'

export interface CharacterRow {
  id: string
  system_id: string
  user_id: string
  label: string
  description: string | null
  build_state: CharacterBuildState | null
  stream_version: number
  created_at: string
  updated_at: string
}

export interface CharacterRepository {
  /** Insert a new character row with an initial build_state and stream_version = 1. */
  create(params: {
    id: string
    systemId: string
    userId: string
    label: string
    buildState: CharacterBuildState
  }): Promise<void>

  /** Load the character row including build_state. Returns null if not found. */
  findById(id: string): Promise<CharacterRow | null>

  /**
   * Atomically update build_state and stream_version.
   * Throws ConcurrencyError if the current stream_version !== expectedVersion.
   */
  updateBuildState(params: {
    id: string
    buildState: CharacterBuildState
    expectedVersion: number
  }): Promise<void>

  /** List all characters for a user (minimal projection for list views). */
  listByUser(userId: string): Promise<Pick<CharacterRow, 'id' | 'label' | 'system_id' | 'stream_version'>[]>
}

/** Thrown when a concurrent command has already advanced the stream_version. */
export class ConcurrencyError extends Error {
  constructor(characterId: string, expected: number) {
    super(`Character "${characterId}" stream_version conflict: expected ${expected}.`)
    this.name = 'ConcurrencyError'
  }
}

export function createCharacterRepository(db: DBLike): CharacterRepository {
  return {
    async create({ id, systemId, userId, label, buildState }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any)
        .insertInto('characters')
        .values({
          id,
          system_id: systemId,
          user_id: userId,
          label,
          build_state: buildState as unknown as Record<string, unknown>,
          stream_version: 1,
        })
        .execute()
    },

    async findById(id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = await (db as any)
        .selectFrom('characters')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst() as CharacterRow | undefined

      return row ?? null
    },

    async updateBuildState({ id, buildState, expectedVersion }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (db as any)
        .updateTable('characters')
        .set({
          build_state: buildState as unknown as Record<string, unknown>,
          stream_version: expectedVersion + 1,
          updated_at: new Date().toISOString(),
        })
        .where('id', '=', id)
        .where('stream_version', '=', expectedVersion)
        .executeTakeFirst()

      // Kysely UpdateResult has numUpdatedRows as a BigInt
      const updated = typeof result?.numUpdatedRows === 'bigint'
        ? result.numUpdatedRows
        : BigInt(result?.numUpdatedRows ?? 0)

      if (updated === 0n) {
        throw new ConcurrencyError(id, expectedVersion)
      }
    },

    async listByUser(userId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = await (db as any)
        .selectFrom('characters')
        .select(['id', 'label', 'system_id', 'stream_version'])
        .where('user_id', '=', userId)
        .orderBy('updated_at', 'desc')
        .execute() as Pick<CharacterRow, 'id' | 'label' | 'system_id' | 'stream_version'>[]

      return rows
    },
  }
}
