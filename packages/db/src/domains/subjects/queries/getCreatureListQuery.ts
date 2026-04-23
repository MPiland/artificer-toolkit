import type { DBLike } from '#types'
import { details } from './fragments/index.js'

interface CreatureListItem {
  id: string
  label: string
  description: string | null
  status: string
  systemId: string
  details: unknown
  userId: string
}

interface CreatureMetaObject {
  id: string
  creatureIds: string[]
}

interface CreatureMeta {
  categories: CreatureMetaObject[]
  creatureTypes: CreatureMetaObject[]
  challengeRatings: CreatureMetaObject[]
  features: CreatureMetaObject[]
}

export async function getCreatureListQuery(db: DBLike): Promise<{ items: CreatureListItem[], meta: CreatureMeta }> {
  const items = await db
    .selectFrom('creatures')
    .select((eb) => [
      'id',
      'label',
      'description',
      'status',
      'system_id as systemId',
      details(eb, (eb2) => eb2
        .selectFrom('creature_details as bridge')
        .whereRef('bridge.creature_id', '=', 'id')
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

  const categories: CreatureMetaObject[] = await db
    .selectFrom('creatures')
    .select((eb) => [
      'category as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('id')]).distinct()
        .as('creatureIds')
    ])
    .where('category', 'is not', null)
    .groupBy('category')
    .execute() as CreatureMetaObject[]

  const creatureTypes: CreatureMetaObject[] = await db
    .selectFrom('creatures')
    .select((eb) => [
      'creature_type_id as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('id')]).distinct()
        .as('creatureIds')
    ])
    .where('creature_type_id', 'is not', null)
    .groupBy('creature_type_id')
    .execute() as CreatureMetaObject[]

  const challengeRatings: CreatureMetaObject[] = await db
    .selectFrom('creatures')
    .select((eb) => [
      'challenge_rating_id as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('id')]).distinct()
        .as('creatureIds')
    ])
    .where('challenge_rating_id', 'is not', null)
    .groupBy('challenge_rating_id')
    .execute() as CreatureMetaObject[]

  const features: CreatureMetaObject[] = await db
    .selectFrom('creature_features')
    .select((eb) => [
      'feature_id as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('creature_id')]).as('creatureIds')
    ])
    .groupBy('feature_id')
    .execute()

  return {
    items,
    meta: {
      categories,
      creatureTypes,
      challengeRatings,
      features
    }
  }
}
