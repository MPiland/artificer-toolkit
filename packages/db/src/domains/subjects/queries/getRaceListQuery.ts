import type { DBLike } from '#types'
import { details } from './fragments/index.js'

interface RaceListItem {
  id: string
  label: string
  description: string | null
  quote: string | null
  systemId: string
  details: unknown
  userId: string
}

interface RaceMetaObject {
  id: string
  raceIds: string[]
}

interface RaceMeta {
  categories: RaceMetaObject[]
  playable: RaceMetaObject[]
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
      'system_id as systemId',
      details(eb, (eb2) => eb2
        .selectFrom('race_details as bridge')
        .whereRef('bridge.race_id', '=', 'id')
        .select([
          'bridge.detail_id',
          'bridge.sort_order as position'
        ])
        .orderBy('bridge.sort_order'))
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

  const categories: RaceMetaObject[] = await db
    .selectFrom('races')
    .select((eb) => [
      'category as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('id')]).distinct().as('raceIds')
    ])
    .where('category', 'is not', null)
    .groupBy('category')
    .execute() as RaceMetaObject[]

  const playable: RaceMetaObject[] = await db
    .selectFrom('races')
    .select((eb) => [
      eb.case()
        .when('playable', '=', true).then('Yes')
        .else('No')
        .end()
        .as('id'),
      eb.fn.agg<string[]>('array_agg', [eb.ref('id')]).distinct().as('raceIds')
    ])
    .groupBy('playable')
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
      playable,
      parentRaces,
      features
    }
  }
}
