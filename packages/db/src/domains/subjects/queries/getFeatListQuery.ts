import type { DBLike } from '#types'
import { sql } from 'kysely'

interface FeatListItem { id: string; label: string; description: string; status: string; systemId: string; userId: string; ownerUserId: string | null; isMaster: boolean | null }
interface FeatMetaObject { id: string; featIds: string[] }
interface FeatMeta { features: FeatMetaObject[] }

export async function getFeatListQuery(db: DBLike): Promise<{ items: FeatListItem[], meta: FeatMeta }> {
  const items = await db
    .selectFrom('feats')
    .select((eb) => [
      'id as id',
      'label as label',
      'description as description',
      'status as status',
      'system_id as systemId',
      'user_id as ownerUserId',
      'is_master as isMaster',
      sql<string>`case when ${sql.ref('is_master')} then 'master' else ${sql.ref('user_id')}::text end`
        .as('userId')
    ])
    .execute()
    .then((rows) => rows?.length ? rows : [])

  const features: FeatMetaObject[] = await db
    .selectFrom('feat_features')
    .select((eb) => [
      'feature_id as id',
      eb.fn.agg<string[]>('array_agg', [
        eb.ref('feat_id')
      ]).as('featIds')
    ])
    .groupBy('feature_id')
    .execute()

  return {
    items,
    meta: {
      features
    }
  }
}
