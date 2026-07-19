import type { DBLike } from '#types'
import { sql } from 'kysely'
import type { RepositoryFindAllOptions } from '../../../repositories/contracts.js'
import { details } from './fragments/index.js'

export interface RaceListItem {
  id: string
  label: string
  description: string | null
  quote: string | null
  status: string
  systemId: string
  category: string
  parentRaceId: string | null
  selectionMode: string | null
  details: unknown
  userId: string
  ownerUserId: string | null
  isMaster: boolean | null
}

export interface RaceMetaObject {
  id: string
  raceIds: string[]
}

export interface RaceMeta {
  categories: RaceMetaObject[]
  selectionModes: RaceMetaObject[]
  parentRaces: RaceMetaObject[]
  features: RaceMetaObject[]
}

export interface RaceListQueryResult {
  items: RaceListItem[]
  meta: RaceMeta
}

export async function getRaceListQuery(
  db: DBLike,
  filter?: RepositoryFindAllOptions
): Promise<RaceListQueryResult> {
  let itemQuery = db
    .selectFrom('races')
    .select((eb) => [
      'id',
      'label',
      'description',
      'quote',
      'status',
      'system_id as systemId',
      'category',
      'parent_race_id as parentRaceId',
      'selection_mode as selectionMode',
      'user_id as ownerUserId',
      'is_master as isMaster',
      details(eb, (eb2) => eb2
        .selectFrom('race_details as bridge')
        .whereRef('bridge.race_id', '=', 'id')
        .select([
          'bridge.detail_id',
          'bridge.sort_order as position'
        ])
        .orderBy('bridge.sort_order'))
        .as('details'),
      sql<string>`case when ${sql.ref('is_master')} then 'master' else ${sql.ref('user_id')}::text end`
        .as('userId')
    ])

  if (filter?.systemId) {
    itemQuery = itemQuery.where('system_id', '=', filter.systemId)
  }

  if (filter?.userId) {
    itemQuery = itemQuery.where('user_id', '=', filter.userId)
  }

  const items = await itemQuery.execute()
    .then((rows) => rows?.length ? rows : [])
  const raceIds = items.map((item) => item.id)

  if (raceIds.length === 0) {
    return {
      items,
      meta: {
        categories: [],
        selectionModes: [],
        parentRaces: [],
        features: []
      }
    }
  }

  const categories: RaceMetaObject[] = await db
    .selectFrom('races')
    .select((eb) => [
      'category as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('id')]).distinct().as('raceIds')
    ])
    .where('id', 'in', raceIds)
    .where('category', 'is not', null)
    .groupBy('category')
    .execute() as RaceMetaObject[]

  const selectionModes: RaceMetaObject[] = await db
    .selectFrom('races')
    .select((eb) => [
      'selection_mode as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('id')]).distinct().as('raceIds')
    ])
    .where('id', 'in', raceIds)
    .where('selection_mode', 'is not', null)
    .groupBy('selection_mode')
    .execute() as RaceMetaObject[]

  const parentRaces: RaceMetaObject[] = await db
    .selectFrom('races')
    .select((eb) => [
      'parent_race_id as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('id')]).distinct().as('raceIds')
    ])
    .where('id', 'in', raceIds)
    .where('parent_race_id', 'is not', null)
    .groupBy('parent_race_id')
    .execute() as RaceMetaObject[]

  const features: RaceMetaObject[] = await db
    .selectFrom('race_features')
    .select((eb) => [
      'feature_id as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('race_id')]).as('raceIds')
    ])
    .where('race_id', 'in', raceIds)
    .groupBy('feature_id')
    .execute()

  return {
    items,
    meta: {
      categories,
      selectionModes,
      parentRaces,
      features
    }
  }
}
