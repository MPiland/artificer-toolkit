import type { DBLike } from '#types'
import { sql } from 'kysely'
import type { RepositoryFindAllOptions } from '../../../repositories/contracts.js'

export interface FeatListItem {
  id: string
  label: string
  description: string
  status: string
  systemId: string
  userId: string
  ownerUserId: string | null
  isMaster: boolean | null
}
export interface FeatMetaObject {
  id: string
  featIds: string[]
}
export interface FeatMeta {
  features: FeatMetaObject[]
}

export interface FeatListQueryResult {
  items: FeatListItem[]
  meta: FeatMeta
}

export async function getFeatListQuery(
  db: DBLike,
  filter?: RepositoryFindAllOptions
): Promise<FeatListQueryResult> {
  let itemQuery = db
    .selectFrom('feats')
    .select([
      'id as id',
      'label as label',
      'description as description',
      'status as status',
      'system_id as systemId',
      'user_id as ownerUserId',
      'is_master as isMaster',
      sql<string>`case when ${sql.ref('is_master')} then 'master' else ${sql.ref('user_id')}::text end`.as(
        'userId'
      )
    ])

  if (filter?.systemId) {
    itemQuery = itemQuery.where('system_id', '=', filter.systemId)
  }

  if (filter?.userId) {
    itemQuery = itemQuery.where('user_id', '=', filter.userId)
  }

  const items = await itemQuery.execute().then((rows) => (rows?.length ? rows : []))
  const featIds = items.map((item) => item.id)

  if (featIds.length === 0) {
    return {
      items,
      meta: {
        features: []
      }
    }
  }

  const features: FeatMetaObject[] = await db
    .selectFrom('feat_features')
    .select((eb) => [
      'feature_id as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('feat_id')]).as('featIds')
    ])
    .where('feat_id', 'in', featIds)
    .groupBy('feature_id')
    .execute()

  return {
    items,
    meta: {
      features
    }
  }
}
