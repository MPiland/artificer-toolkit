import type { DBLike } from '#types'
import { sql } from 'kysely'
import { details } from './fragments/index.js'

interface RaceListItem {
  id: string
  label: string
  description: string | null
  quote: string | null
  status: string
  systemId: string
  category: string
  details: unknown
  userId: string
  ownerUserId: string | null
  isMaster: boolean | null
}

interface RaceMetaObject {
  id: string
  raceIds: string[]
}

interface RaceMeta {
  categories: RaceMetaObject[]
  selectionModes: RaceMetaObject[]
  parentRaces: RaceMetaObject[]
  features: RaceMetaObject[]
}

export async function getRaceListQuery(db: DBLike): Promise<{ items: RaceListItem[], meta: RaceMeta }> {
  const items = await db
    .selectFrom('races')
    .select((eb) => [
      'id',
      'label',
      'description',
      'quote',
      'status',
      'system_id as systemId',
      'category',
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
    .execute()
    .then((rows) => rows?.length ? rows : [])

  const categories: RaceMetaObject[] = await db
    .selectFrom('races')
    .select((eb) => [
      'category as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('id')]).distinct().as('raceIds')
    ])
    .where('category', 'is not', null)
    .groupBy('category')
    .execute() as RaceMetaObject[]

  const selectionModes: RaceMetaObject[] = await db
    .selectFrom('races')
    .select((eb) => [
      'selection_mode as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('id')]).distinct().as('raceIds')
    ])
    .where('selection_mode', 'is not', null)
    .groupBy('selection_mode')
    .execute() as RaceMetaObject[]

  const parentRaces: RaceMetaObject[] = await db
    .selectFrom('races')
    .select((eb) => [
      'parent_race_id as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('id')]).distinct().as('raceIds')
    ])
    .where('parent_race_id', 'is not', null)
    .groupBy('parent_race_id')
    .execute() as RaceMetaObject[]

  const features: RaceMetaObject[] = await db
    .selectFrom('race_features')
    .select((eb) => [
      'feature_id as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('race_id')]).as('raceIds')
    ])
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
