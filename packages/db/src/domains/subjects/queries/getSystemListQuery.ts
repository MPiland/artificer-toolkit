import type { DBLike } from '#types'
import { sql } from 'kysely'

interface SystemListItem {
  id: string
  label: string
  description: string | null
  rulesetCode: string
  rulesetVersion: string
  userId: string
}

export async function getSystemListQuery(db: DBLike): Promise<SystemListItem[]> {
  return await db
    .selectFrom('systems')
    .select([
      'id',
      'label',
      'description',
      'ruleset_code as rulesetCode',
      'ruleset_version as rulesetVersion',
      sql<string>`coalesce(${sql.ref('user_id')}::text, 'master')`.as('userId')
    ])
    .execute()
    .then((rows) => (rows?.length ? rows : []))
}
