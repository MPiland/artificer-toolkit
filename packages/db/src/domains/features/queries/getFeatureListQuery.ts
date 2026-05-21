import type { DBLike } from '#types'

interface FeatureListItem { id: string; label: string; description: string | null }

export async function getFeatureListQuery(db: DBLike): Promise<FeatureListItem[]> {
  return db
    .selectFrom('features')
    .select([
      'id as id',
      'label as label',
      'description as description'
    ])
    .execute()
    .then((rows) => rows?.length ? rows : [])
}
