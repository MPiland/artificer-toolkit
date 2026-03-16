import type { DBLike } from '#types'

interface SystemListItem {
  id: string
  label: string
  description: string | null
}

export async function getSystemListQuery(db: DBLike): Promise<SystemListItem[]> {
  return await db
    .selectFrom('systems')
    .select([
      'id',
      'label',
      'description'
    ])
    .execute()
    .then((rows) => rows?.length ? rows : [])
}
