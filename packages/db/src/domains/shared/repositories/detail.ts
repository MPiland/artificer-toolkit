import type { DBLike } from '#types'
import { upsertDetail } from '../upserts/detail.js'
import type { DetailRepository } from '../../../repositories/contracts.js'
import { uniqueIds } from '../../../repositories/batch.js'

type DetailAuthored = {
  description: string
  id: string
  label: string
  order: number
}

async function hydrateDetailsByIds(db: DBLike, ids: readonly string[]): Promise<Map<string, DetailAuthored>> {
  const distinctIds = uniqueIds(ids)
  if (distinctIds.length === 0) {
    return new Map()
  }

  const rows = await db
    .selectFrom('details')
    .select(['id', 'label', 'description', 'sort_order'])
    .where('id', 'in', distinctIds)
    .execute()
  const rowsById = new Map(rows.map((row) => [row.id, {
    id: row.id,
    label: row.label,
    description: row.description,
    order: row.sort_order
  }]))

  return new Map(distinctIds.flatMap((id) => {
    const row = rowsById.get(id)
    return row ? [[id, row]] : []
  }))
}

async function hydrateDetailById(db: DBLike, id: string) {
  const detailsById = await hydrateDetailsByIds(db, [id])
  return detailsById.get(id) ?? null
}

export function createDetailRepository(db: DBLike): DetailRepository {
  return {
    async upsert(entity) {
      await upsertDetail(db, entity)
    },

    async findById(id) {
      return hydrateDetailById(db, id)
    },

    async findByIds(ids) {
      return hydrateDetailsByIds(db, ids)
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
