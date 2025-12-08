import type { Database } from '@artificer/db'
import type { TagsEnum } from '@artificer/shared/types'
import type { ExpressionBuilder, SelectQueryBuilder } from 'kysely'
import { jsonArrayFrom } from 'kysely/helpers/postgres'

export function tags(ebX: ExpressionBuilder<Database, keyof Database>, fn: (
  eb2: ExpressionBuilder<Database, keyof Database>
) => SelectQueryBuilder<
  Database,
  keyof Database,
  { tag_id: string }
>) {
  const source = fn(ebX)
  const subquery = ebX
    .selectFrom('system_tags')
    .innerJoin(
      source.as('bridge'),
      'bridge.tag_id',
      'system_tags.id'
    )
    .select([
      'name'
    ])
    .$asScalar()
    .$castTo<TagsEnum>()

  return jsonArrayFrom<TagsEnum>(subquery).$notNull()
}
