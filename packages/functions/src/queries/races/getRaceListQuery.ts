import type { DB } from '@artificer-toolkit/functions/types'
import type { RaceListItem, RaceMeta, RaceMetaObject } from '@artificer-toolkit/shared/types'
import { details } from '#queries/fragments'
import type { NotNull } from 'kysely'

export async function getRaceListQuery(db: DB): Promise<{ items: RaceListItem[], meta: RaceMeta }> {
  const items = await db
    .selectFrom('races')
    .select((eb) => [
      'id',
      'label',
      'description',
      'quote',
      'system_id as systemId',
      details(eb, (eb2) => eb2
        .selectFrom('class_details as bridge')
        .whereRef('class_id', '=', 'id')
        .select([
          'bridge.detail_id',
          'bridge.position'
        ])
        .orderBy('position'))
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
      'category_id as id', eb.fn.agg<string[]>('array_agg', [eb.ref('id')]).distinct()
        .as('raceIds')
    ])
    .where('category_id', 'is not', null)
    .groupBy('category_id')
    .execute()

  const playable: RaceMetaObject[] = await db
    .selectFrom('races')
    .select((eb) => [
      eb.case().when('playable', '=', true)
        .then('Yes')
        .else('No')
        .end()
        .as('id'),
      eb.fn.agg<string[]>('array_agg', [eb.ref('id')])
        .distinct()
        .as('raceIds')
    ])
    .groupBy('playable')
    .execute()

  const parentRaces: RaceMetaObject[] = await db
    .selectFrom('races')
    .select((eb) => [
      'parent_race_id as id', eb.fn.agg<string[]>('array_agg', [eb.ref('id')])
        .distinct()
        .as('raceIds')
    ])
    .where('parent_race_id', 'is not', null)
    .groupBy('parent_race_id')
    .$narrowType<{ id: NotNull }>()
    .execute()

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
