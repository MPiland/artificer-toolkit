import type { DBLike } from '#types'
import { sql } from 'kysely'
import type { RepositoryFindAllOptions } from '../../../repositories/contracts.js'
import { details } from './fragments/index.js'

export interface ClassListItem {
  id: string
  label: string
  description: string | null
  status: string
  systemId: string
  category: string | null
  parentClassId: string | null
  subclassSelectionLevel: number | null
  details: unknown
  userId: string
  ownerUserId: string | null
  isMaster: boolean | null
}

export interface ClassMetaObject {
  id: string
  classIds: string[]
}

export interface ClassMeta {
  categories: ClassMetaObject[]
  parentClasses: ClassMetaObject[]
  multiclass: ClassMetaObject[]
  features: ClassMetaObject[]
}

export interface ClassListQueryResult {
  items: ClassListItem[]
  meta: ClassMeta
}

export const getClassListQuery = async (
  db: DBLike,
  filter?: RepositoryFindAllOptions
): Promise<ClassListQueryResult> => {
  let itemQuery = db
    .selectFrom('classes')
    .select((eb) => [
      'id',
      'label',
      'description',
      'status',
      'system_id as systemId',
      'category',
      'parent_class_id as parentClassId',
      'subclass_selection_level as subclassSelectionLevel',
      'user_id as ownerUserId',
      'is_master as isMaster',
      details(eb, (eb2) =>
        eb2
          .selectFrom('class_details as bridge')
          .whereRef('bridge.class_id', '=', 'id')
          .select(['bridge.detail_id', 'bridge.sort_order as position'])
          .orderBy('bridge.sort_order')
      ).as('details'),
      sql<string>`case when ${sql.ref('is_master')} then 'master' else ${sql.ref('user_id')}::text end`.as(
        'userId'
      )
    ])

  if (filter?.systemId) {
    itemQuery = itemQuery.where('system_id', '=', filter.systemId)
  }

  if (filter?.userId) {
    itemQuery = itemQuery.where('user_id', '=', filter.userId)
  }

  const items = await itemQuery.execute().then((rows) => (rows?.length ? rows : []))
  const classIds = items.map((item) => item.id)

  if (classIds.length === 0) {
    return {
      items,
      meta: {
        categories: [],
        parentClasses: [],
        multiclass: [],
        features: []
      }
    }
  }

  const categories: ClassMetaObject[] = (await db
    .selectFrom('classes')
    .select((eb) => [
      'category as id',
      eb.fn
        .agg<string[]>('array_agg', [eb.ref('id')])
        .distinct()
        .as('classIds')
    ])
    .where('id', 'in', classIds)
    .where('category', 'is not', null)
    .groupBy('category')
    .execute()) as ClassMetaObject[]

  const parentClasses: ClassMetaObject[] = (await db
    .selectFrom('classes')
    .select((eb) => [
      'parent_class_id as id',
      eb.fn
        .agg<string[]>('array_agg', [eb.ref('id')])
        .distinct()
        .as('classIds')
    ])
    .where('id', 'in', classIds)
    .where('parent_class_id', 'is not', null)
    .groupBy('parent_class_id')
    .execute()) as ClassMetaObject[]

  const multiclass: ClassMetaObject[] = (await db
    .selectFrom('class_multiclass')
    .select((eb) => [
      'class_id as id',
      eb.fn
        .agg<string[]>('array_agg', [eb.ref('class_id')])
        .distinct()
        .as('classIds')
    ])
    .where('class_id', 'in', classIds)
    .groupBy('class_id')
    .execute()) as ClassMetaObject[]

  const features: ClassMetaObject[] = (await db
    .selectFrom('class_features')
    .select((eb) => [
      'feature_id as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('class_id')]).as('classIds')
    ])
    .where('class_id', 'in', classIds)
    .groupBy('feature_id')
    .execute()) as ClassMetaObject[]

  return {
    items,
    meta: {
      categories,
      parentClasses,
      multiclass,
      features
    }
  }
}
