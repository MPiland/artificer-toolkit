import type { DBLike } from '#types'
import { sql } from 'kysely'

interface SystemListItem {
  id: string
  label: string
  description: string | null
  rulesetCode: string
  rulesetVersion: string
  userId: string
  rulesCatalogues: Array<{ id: string; label: string; description: string | null }>
}

export async function getSystemListQuery(db: DBLike): Promise<SystemListItem[]> {
  const [systems, catalogues] = await Promise.all([
    db
      .selectFrom('systems')
      .select([
        'id',
        'label',
        'description',
        'ruleset_code as rulesetCode',
        'ruleset_version as rulesetVersion',
        sql<string>`coalesce(${sql.ref('user_id')}::text, 'master')`.as('userId')
      ])
      .orderBy('label')
      .execute(),
    db
      .selectFrom('rules_catalogues')
      .select(['id', 'game_system_id as gameSystemId', 'label', 'description'])
      .orderBy('label')
      .execute()
  ])
  const cataloguesBySystem = new Map<string, SystemListItem['rulesCatalogues']>()
  for (const catalogue of catalogues) {
    const existing = cataloguesBySystem.get(catalogue.gameSystemId) ?? []
    existing.push({
      id: catalogue.id,
      label: catalogue.label,
      description: catalogue.description
    })
    cataloguesBySystem.set(catalogue.gameSystemId, existing)
  }

  return systems.map((system) => ({
    ...system,
    rulesCatalogues: cataloguesBySystem.get(system.id) ?? []
  }))
}
