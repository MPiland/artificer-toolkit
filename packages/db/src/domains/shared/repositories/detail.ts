import type { DBLike } from '#types'
import { upsertDetail } from '../upserts/detail.js'
import type { DetailRepository } from '../../../repositories/contracts.js'

export function createDetailRepository(db: DBLike): DetailRepository {
  return {
    async upsert(entity) {
      await upsertDetail(db, entity)
    },

    async findById(id) {
      const row = await db
        .selectFrom('details')
        .select(['id', 'label', 'description', 'sort_order'])
        .where('id', '=', id)
        .executeTakeFirst()

      if (!row) return null

      return {
        id: row.id,
        label: row.label,
        description: row.description,
        order: row.sort_order
      }
    },

    async findAll() {
      const rows = await db
        .selectFrom('details')
        .select(['id', 'label', 'description', 'sort_order'])
        .orderBy('sort_order')
        .execute()

      return rows.map((row) => ({
        id: row.id,
        label: row.label,
        description: row.description,
        order: row.sort_order
      }))
    }
  }
}
