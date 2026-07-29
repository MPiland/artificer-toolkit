import { sql } from 'kysely'
import type { DBLike, Json } from '#types'

export type CharacterBuilderDraftMode = 'create' | 'edit'
export type CharacterBuilderDraftState = 'DRAFT_ONLY' | 'ACTIVE_WITH_DRAFT'

export interface CharacterBuilderDraft {
  id: string
  characterId: string
  userId: string
  systemId: string
  label: string
  status: 'DRAFT'
  mode: CharacterBuilderDraftMode
  payload: Json
  draftState: CharacterBuilderDraftState
  baseActiveUpdatedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface SaveCharacterBuilderDraftInput {
  characterId: string
  userId: string
  systemId: string
  label: string
  mode: CharacterBuilderDraftMode
  payload: Json
  baseActiveUpdatedAt?: string | null
}

interface CharacterBuilderDraftRow {
  id: string
  character_id: string
  user_id: string
  system_id: string
  label: string
  status: 'DRAFT'
  mode: CharacterBuilderDraftMode
  payload: Json
  base_active_updated_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
  active_exists?: boolean | null
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value
}

function toNullableIsoString(value: Date | string | null): string | null {
  return value == null ? null : toIsoString(value)
}

function mapDraft(
  row: CharacterBuilderDraftRow,
  activeExists = row.active_exists ?? false
): CharacterBuilderDraft {
  return {
    id: row.id,
    characterId: row.character_id,
    userId: row.user_id,
    systemId: row.system_id,
    label: row.label,
    status: row.status,
    mode: row.mode,
    payload: row.payload,
    draftState: activeExists ? 'ACTIVE_WITH_DRAFT' : 'DRAFT_ONLY',
    baseActiveUpdatedAt: toNullableIsoString(row.base_active_updated_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  }
}

function activeExistsProjection() {
  return sql<boolean>`
    exists(
      select 1
      from characters
      where characters.id = character_builder_drafts.character_id
        and characters.status = 'ACTIVE'
    )
  `
}

async function activeCharacterExists(db: DBLike, characterId: string): Promise<boolean> {
  const result = await sql<{ exists: boolean }>`
    select exists(
      select 1
      from characters
      where id = ${characterId}
        and status = 'ACTIVE'
    ) as exists
  `.execute(db)

  return result.rows[0]?.exists ?? false
}

export function createCharacterBuilderDraftRepository(db: DBLike) {
  return {
    async findByCharacter(params: {
      characterId: string
      userId: string
    }): Promise<CharacterBuilderDraft | null> {
      const result = await sql<CharacterBuilderDraftRow>`
        select
          id,
          character_id,
          user_id,
          system_id,
          label,
          status,
          mode,
          payload,
          base_active_updated_at::text as base_active_updated_at,
          created_at::text as created_at,
          updated_at::text as updated_at,
          ${activeExistsProjection()} as active_exists
        from character_builder_drafts
        where character_id = ${params.characterId}
          and user_id = ${params.userId}
        limit 1
      `.execute(db)
      const row = result.rows[0]
      if (!row) return null

      return mapDraft(row)
    },

    async listByUser(userId: string): Promise<CharacterBuilderDraft[]> {
      const result = await sql<CharacterBuilderDraftRow>`
        select
          id,
          character_id,
          user_id,
          system_id,
          label,
          status,
          mode,
          payload,
          base_active_updated_at::text as base_active_updated_at,
          created_at::text as created_at,
          updated_at::text as updated_at,
          ${activeExistsProjection()} as active_exists
        from character_builder_drafts
        where user_id = ${userId}
        order by updated_at desc
      `.execute(db)

      return result.rows.map((row) => mapDraft(row))
    },

    async save(input: SaveCharacterBuilderDraftInput): Promise<CharacterBuilderDraft> {
      const payloadJson = JSON.stringify(input.payload)
      const result = await sql<CharacterBuilderDraftRow>`
        insert into character_builder_drafts (
          character_id,
          user_id,
          system_id,
          label,
          mode,
          payload,
          base_active_updated_at
        )
        values (
          ${input.characterId},
          ${input.userId},
          ${input.systemId},
          ${input.label},
          ${input.mode},
          ${payloadJson}::jsonb,
          ${input.baseActiveUpdatedAt ?? null}
        )
        on conflict (character_id, user_id)
        do update set
          system_id = excluded.system_id,
          label = excluded.label,
          mode = excluded.mode,
          payload = excluded.payload,
          base_active_updated_at = excluded.base_active_updated_at,
          updated_at = now()
        returning
          id,
          character_id,
          user_id,
          system_id,
          label,
          status,
          mode,
          payload,
          base_active_updated_at::text as base_active_updated_at,
          created_at::text as created_at,
          updated_at::text as updated_at
      `.execute(db)
      const row = result.rows[0]
      if (!row) {
        throw new Error(`Failed to save character builder draft "${input.characterId}".`)
      }

      return mapDraft(row, await activeCharacterExists(db, input.characterId))
    },

    async delete(params: { characterId: string; userId: string }): Promise<void> {
      await sql`
        delete from character_builder_drafts
        where character_id = ${params.characterId}
          and user_id = ${params.userId}
      `.execute(db)
    }
  }
}
