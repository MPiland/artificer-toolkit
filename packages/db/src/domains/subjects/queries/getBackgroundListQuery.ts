import type { DBLike } from '#types'
import { sql } from 'kysely'
import { details } from './fragments/index.js'

interface BackgroundListItem { id: string; label: string; description: string | null; status: string; systemId: string; details: unknown; userId: string; ownerUserId: string | null; isMaster: boolean | null }
interface BackgroundMetaObject { id: string; backgroundIds: string[] }
interface BackgroundMeta { features: BackgroundMetaObject[] }

export const getBackgroundListQuery = async (db: DBLike): Promise<{ items: BackgroundListItem[], meta: BackgroundMeta }> => {
  const items = await db
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
    .execute()
    .then((rows) => rows?.length ? rows : [])

  const features: BackgroundMetaObject[] = await db
    .selectFrom('background_features')
    .select((eb) => [
      'feature_id as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('background_id')]).as('backgroundIds')
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
