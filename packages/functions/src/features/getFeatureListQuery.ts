import type { Database } from '@artificer/db'
import type { FeatureListItem } from '@artificer/shared/types'
import type { Kysely, NotNull } from 'kysely'

export async function getFeatureListQuery(db: Kysely<Database>): Promise<FeatureListItem[]> {
  return db
    .selectFrom('features')
    .select([
      'id as id',
      'label as label',
      'description as description',
      'detail as detail'
    ])
    .$narrowType<{ label: NotNull, detail: NotNull }>()
    .execute()
    .then((rows) => rows?.length ? rows : [])
}
