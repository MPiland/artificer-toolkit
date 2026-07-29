import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CharacterEvent } from '@artificer-toolkit/shared'
import type { DBLike } from '#types'
import { createCharacterEventRepository } from '../domains/subjects/repositories/characterEvent.js'

const event: CharacterEvent = {
  eventId: '00000000-0000-4000-8000-000000000001',
  characterId: '00000000-0000-4000-8000-000000000002',
  type: 'CHARACTER_SHEET_COMMAND_APPLIED',
  commandType: 'CAST_SPELL',
  commandFingerprint: 'test-cast-spell-command',
  summary: 'Cast a spell',
  occurredAt: '2026-07-11T09:00:00.000Z',
  actorId: '00000000-0000-4000-8000-000000000003',
  commandId: '00000000-0000-4000-8000-000000000004',
  schemaVersion: 1
}

function createFakeDb(
  rows: Array<{ character_id: string; command_id: string; event_data: CharacterEvent }>
) {
  const filters: Array<[string, string]> = []

  return {
    filters,
    selectFrom(table: string) {
      expect(table).toBe('character_events')
      const builder = {
        select(column: string) {
          expect(column).toBe('event_data')
          return builder
        },
        where(column: string, _operator: string, value: string) {
          filters.push([column, value])
          return builder
        },
        async executeTakeFirst() {
          return rows.find((row) =>
            filters.every(
              ([column, value]) => row[column as 'character_id' | 'command_id'] === value
            )
          )
        }
      }

      return builder
    }
  }
}

describe('createCharacterEventRepository', () => {
  it('finds an event by character and command id', async () => {
    const db = createFakeDb([
      { character_id: event.characterId, command_id: event.commandId, event_data: event }
    ])
    const repository = createCharacterEventRepository(db as unknown as DBLike)

    await expect(repository.findByCommandId(event.characterId, event.commandId)).resolves.toEqual(
      event
    )
    expect(db.filters).toEqual([
      ['character_id', event.characterId],
      ['command_id', event.commandId]
    ])
  })

  it('returns null when a command has not been persisted for the character', async () => {
    const repository = createCharacterEventRepository(createFakeDb([]) as unknown as DBLike)

    await expect(repository.findByCommandId(event.characterId, event.commandId)).resolves.toBeNull()
  })

  it('keeps canonical bootstrap and deployed migration uniqueness in sync', () => {
    const root = process.cwd()
    const canonical = readFileSync(
      join(root, 'packages/db/src/domains/subjects/tables/character_events.sql'),
      'utf8'
    )
    const generated = readFileSync(
      join(root, 'packages/db/src/domains/bootstrap/generated/create_database.bundle.sql'),
      'utf8'
    )
    const bootstrapMigration = readFileSync(
      join(root, 'supabase/migrations/20260316000100_bootstrap_bundle.sql'),
      'utf8'
    )
    const idempotencyMigration = readFileSync(
      join(root, 'supabase/migrations/20260711090000_character_event_command_idempotency.sql'),
      'utf8'
    )
    const uniqueColumns = '(character_id, command_id)'

    expect(canonical).toContain(
      'character_events_character_command_uniq UNIQUE (character_id, command_id)'
    )
    expect(generated).toContain(
      'character_events_character_command_uniq UNIQUE (character_id, command_id)'
    )
    expect(bootstrapMigration).toContain(
      'character_events_character_command_uniq UNIQUE (character_id, command_id)'
    )
    expect(idempotencyMigration).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS character_events_character_command_uniq'
    )
    expect(idempotencyMigration).toContain(uniqueColumns)
  })
})
