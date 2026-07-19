import type { DBLike } from '#types'
import { sql } from 'kysely'
import type { RepositoryFindAllOptions } from '../../../repositories/contracts.js'
import { details } from './fragments/index.js'

export interface BackgroundListItem { id: string; label: string; description: string | null; status: string; systemId: string; details: unknown; userId: string; ownerUserId: string | null; isMaster: boolean | null }
export interface BackgroundMetaObject { id: string; backgroundIds: string[] }
export interface BackgroundMeta { features: BackgroundMetaObject[] }

export interface BackgroundListQueryResult {
  items: BackgroundListItem[]
  meta: BackgroundMeta
}

export const getBackgroundListQuery = async (
  db: DBLike,
  filter?: RepositoryFindAllOptions
): Promise<BackgroundListQueryResult> => {
  let itemQuery = db
    .selectFrom('backgrounds')
    .select((eb) => [
      'id as id',
      'label as label',
      'description as description',
      'status as status',
      'system_id as systemId',
      'user_id as ownerUserId',
      'is_master as isMaster',
      details(eb, (eb2) => eb2
        .selectFrom('background_details as bridge')
        .whereRef('bridge.background_id', '=', 'id')
        .select([
          'bridge.detail_id',
          'bridge.sort_order as position'
        ])
        .orderBy('bridge.sort_order'))
        .as('details'),
      sql<string>`case when ${sql.ref('is_master')} then 'master' else ${sql.ref('user_id')}::text end`
        .as('userId')
    ])

  if (filter?.systemId) {
    itemQuery = itemQuery.where('system_id', '=', filter.systemId)
  }

  if (filter?.userId) {
    itemQuery = itemQuery.where('user_id', '=', filter.userId)
  }

  const items = await itemQuery.execute()
    .then((rows) => rows?.length ? rows : [])
  const backgroundIds = items.map((item) => item.id)

  if (backgroundIds.length === 0) {
    return {
      items,
      meta: {
        features: []
      }
    }
  }

  const features: BackgroundMetaObject[] = await db
    .selectFrom('background_features')
    .select((eb) => [
      'feature_id as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('background_id')]).as('backgroundIds')
    ])
    .where('background_id', 'in', backgroundIds)
    .groupBy('feature_id')
    .execute()

  return {
    items,
    meta: {
      features
    }
  }
}
