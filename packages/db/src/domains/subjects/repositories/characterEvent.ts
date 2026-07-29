import type { DBLike } from '#types'
import type { Json } from '../../../types/supabase.database.js'
import type { CharacterEvent } from '@artificer-toolkit/shared'

export interface CharacterEventRepository {
  /** Appends a single event to the character_events table. */
  append(event: CharacterEvent): Promise<void>

  /** Appends multiple events atomically (within a transaction). */
  appendBatch(events: CharacterEvent[]): Promise<void>

  /** Returns all events for a character in chronological order. */
  listByCharacter(characterId: string): Promise<CharacterEvent[]>

  /** Returns the event previously persisted for an idempotent command, if any. */
  findByCommandId(characterId: string, commandId: string): Promise<CharacterEvent | null>
}

function toRow(event: CharacterEvent) {
  return {
    event_id: event.eventId,
    character_id: event.characterId,
    event_type: event.type,
    event_data: event as unknown as Json,
    schema_version: event.schemaVersion,
    actor_id: event.actorId,
    command_id: event.commandId,
    occurred_at: event.occurredAt
  }
}

export function createCharacterEventRepository(db: DBLike): CharacterEventRepository {
  return {
    async append(event) {
      await db.insertInto('character_events').values(toRow(event)).execute()
    },

    async appendBatch(events) {
      if (events.length === 0) return
      await db.insertInto('character_events').values(events.map(toRow)).execute()
    },

    async listByCharacter(characterId) {
      const rows = await db
        .selectFrom('character_events')
        .selectAll()
        .where('character_id', '=', characterId)
        .orderBy('occurred_at', 'asc')
        .execute()

      return rows.map((row) => row.event_data as unknown as CharacterEvent)
    },

    async findByCommandId(characterId, commandId) {
      const row = await db
        .selectFrom('character_events')
        .select('event_data')
        .where('character_id', '=', characterId)
        .where('command_id', '=', commandId)
        .executeTakeFirst()

      return row ? (row.event_data as unknown as CharacterEvent) : null
    }
  }
}
