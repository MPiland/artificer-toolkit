import { sql } from 'kysely'
import { rollRecordDtoSchema, type RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import type { DBLike, Json } from '#types'
import { withTransaction } from '../utils/index.js'

interface RollHistoryRow {
  id: string
  character_id: string | null
  character_label: string
  source: Json
  system_id: string
  ruleset_code: string
  ruleset_version: string
  normalized_expression: string
  evidence: Json
  created_at: Date | string
}

function toRollRecord(row: RollHistoryRow): RollRecordDto {
  return rollRecordDtoSchema.parse({
    id: row.id,
    characterId: row.character_id,
    characterLabel: row.character_label,
    source: row.source,
    ruleset: {
      systemId: row.system_id,
      code: row.ruleset_code,
      version: row.ruleset_version
    },
    normalizedExpression: row.normalized_expression,
    evidence: row.evidence,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at
  })
}

export function createRollHistoryRepository(db: DBLike) {
  return {
    async findCharacterContext(characterId: string, userId: string) {
      return (
        (await db
          .selectFrom('characters')
          .innerJoin('systems', 'systems.id', 'characters.system_id')
          .select([
            'characters.id as characterId',
            'characters.label as characterLabel',
            'systems.id as systemId',
            'systems.ruleset_code as rulesetCode',
            'systems.ruleset_version as rulesetVersion'
          ])
          .where('characters.id', '=', characterId)
          .where('characters.user_id', '=', userId)
          .executeTakeFirst()) ?? null
      )
    },

    async insertAndTrim(userId: string, record: RollRecordDto): Promise<RollRecordDto> {
      return withTransaction(db, async (trx) => {
        await sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`.execute(trx)
        const row = (await trx
          .insertInto('user_roll_history')
          .values({
            id: record.id,
            user_id: userId,
            character_id: record.characterId,
            character_label: record.characterLabel,
            source: record.source,
            system_id: record.ruleset.systemId,
            ruleset_code: record.ruleset.code,
            ruleset_version: record.ruleset.version,
            normalized_expression: record.normalizedExpression,
            evidence: record.evidence,
            created_at: record.createdAt
          })
          .returningAll()
          .executeTakeFirstOrThrow()) as RollHistoryRow

        await sql`
          delete from user_roll_history
          where user_id = ${userId}
            and id not in (
              select id
              from user_roll_history
              where user_id = ${userId}
              order by created_at desc, id desc
              limit 20
            )
        `.execute(trx)

        return toRollRecord(row)
      })
    },

    async listForUser(userId: string): Promise<RollRecordDto[]> {
      const rows = (await db
        .selectFrom('user_roll_history')
        .selectAll()
        .where('user_id', '=', userId)
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .limit(20)
        .execute()) as RollHistoryRow[]

      return rows.map(toRollRecord)
    },

    async findAvailableByIdForUser(id: string, userId: string): Promise<RollRecordDto | null> {
      const row = (await db
        .selectFrom('user_roll_history')
        .selectAll()
        .where('id', '=', id)
        .where('user_id', '=', userId)
        .where('consumed_at', 'is', null)
        .executeTakeFirst()) as RollHistoryRow | undefined

      return row ? toRollRecord(row) : null
    },

    async consumeForUser(id: string, userId: string): Promise<boolean> {
      const row = await db
        .updateTable('user_roll_history')
        .set({ consumed_at: new Date().toISOString() })
        .where('id', '=', id)
        .where('user_id', '=', userId)
        .where('consumed_at', 'is', null)
        .returning('id')
        .executeTakeFirst()
      return Boolean(row)
    },

    async discardForUser(id: string, userId: string): Promise<void> {
      await db
        .deleteFrom('user_roll_history')
        .where('id', '=', id)
        .where('user_id', '=', userId)
        .where('consumed_at', 'is', null)
        .executeTakeFirst()
    },

    async clearForUser(userId: string): Promise<void> {
      await db.deleteFrom('user_roll_history').where('user_id', '=', userId).executeTakeFirst()
    }
  }
}
