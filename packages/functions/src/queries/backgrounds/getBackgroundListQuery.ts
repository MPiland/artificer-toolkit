import type { DB } from '@artificer-toolkit/functions/types'
import type { BackgroundListItem, BackgroundMeta, BackgroundMetaObject } from '@artificer-toolkit/shared/types'
import { details } from '#queries/fragments'

export const getBackgroundListQuery = async (db: DB): Promise<{ items: BackgroundListItem[], meta: BackgroundMeta }> => {
  const items = await db
    .selectFrom('backgrounds')
    .select((eb) => [
      'id as id',
      'label as label',
      'description as description',
      'system_id as systemId',
      details(eb, (eb2) => eb2
        .selectFrom('background_details as bridge')
        .whereRef('background_id', '=', 'id')
        .select([
          'bridge.detail_id',
          'bridge.position'
        ])
        .orderBy('position'))
        .as('details'),
      eb
        .case()
        .when(eb.ref('is_master'), 'is', true)
        .then('master')
        .else(eb.ref('user_id'))
        .end()
        .$notNull()
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
