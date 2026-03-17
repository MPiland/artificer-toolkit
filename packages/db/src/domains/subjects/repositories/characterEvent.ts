import type { DBLike } from '#types'
import type { CharacterEvent } from '@artificer-toolkit/shared'

/**
 * Persisted row shape for the character_events table.
 * Mirrors the SQL schema in tables/character_events.sql.
 */
export interface CharacterEventRow {
  event_id: string
  character_id: string
  event_type: string
  event_data: Record<string, unknown>
  schema_version: number
  actor_id: string
  command_id: string
  occurred_at: string
}

export interface CharacterEventRepository {
  /**
   * Appends a single event to the character_events table.
   */
  append(event: CharacterEvent): Promise<void>

  /**
   * Appends multiple events atomically (within a transaction).
   */
  appendBatch(events: CharacterEvent[]): Promise<void>

  /**
   * Returns all events for a character in chronological order.
   */
  listByCharacter(characterId: string): Promise<CharacterEvent[]>
}

export function createCharacterEventRepository(db: DBLike): CharacterEventRepository {
  return {
    async append(event) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = db.insertInto('character_events' as any)
      await table.values({
        event_id: (event as CharacterEvent & { eventId: string }).eventId,
        character_id: event.characterId,
        event_type: event.type,
        event_data: event as unknown as Record<string, unknown>,
        schema_version: event.schemaVersion,
        actor_id: event.actorId,
        command_id: event.commandId,
        occurred_at: event.occurredAt,
      }).execute()
    },

    async appendBatch(events) {
      if (events.length === 0) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = db.insertInto('character_events' as any)
      await table.values(
        events.map((event) => ({
          event_id: (event as CharacterEvent & { eventId: string }).eventId,
          character_id: event.characterId,
          event_type: event.type,
          event_data: event as unknown as Record<string, unknown>,
          schema_version: event.schemaVersion,
          actor_id: event.actorId,
          command_id: event.commandId,
          occurred_at: event.occurredAt,
        }))
      ).execute()
    },

    async listByCharacter(characterId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = await (db.selectFrom('character_events' as any) as any)
        .selectAll()
        .where('character_id', '=', characterId)
        .orderBy('occurred_at', 'asc')
        .execute() as CharacterEventRow[]

      return rows.map((row) => row.event_data as unknown as CharacterEvent)
    },
  }
}
