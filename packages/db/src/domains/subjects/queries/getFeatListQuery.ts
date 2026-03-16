import type { DBLike } from '#types'

interface FeatListItem { id: string; label: string; description: string; detail: string | null; systemId: string; userId: string }
interface FeatMetaObject { id: string; featIds: string[] }
interface FeatMeta { features: FeatMetaObject[] }

export async function getFeatListQuery(db: DBLike): Promise<{ items: FeatListItem[], meta: FeatMeta }> {
  const items = await db
    .selectFrom('feats')
    .select((eb) => [
      'id as id',
      'label as label',
      'description as description',
      'detail as detail',
      'system_id as systemId',
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
