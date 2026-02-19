import type { DB } from '@artificer-toolkit/functions/types'
import type { ClassListItem, ClassMeta, ClassMetaObject, ClassMultiClassMetaObject } from '@artificer-toolkit/shared/types'
import { details } from '#queries/fragments'
import type { NotNull } from 'kysely'

export const getClassListQuery = async (db: DB): Promise<{ items: ClassListItem[], meta: ClassMeta }> => {
  const items = await db
    .selectFrom('classes')
    .select((eb) => [
      'id',
      'label',
      'description',
      'system_id as systemId',
      details(eb, (eb2) => eb2
        .selectFrom('class_details as bridge')
        .whereRef('bridge.class_id', '=', 'id')
        .select([
          'bridge.detail_id',
          'bridge.position'
        ])
        .orderBy('bridge.position'))
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

  const categories: ClassMetaObject[] = await db
    .selectFrom('classes')
    .select((eb) => [
      'category_id as id', eb.fn.agg<string[]>('array_agg', [eb.ref('id')]).distinct()
        .as('classIds')
    ])
    .where('category_id', 'is not', null)
    .groupBy('category_id')
    .execute()

  const parentClasses: ClassMetaObject[] = await db
    .selectFrom('classes')
    .select((eb) => [
      'parent_class_id as id', eb.fn.agg<string[]>('array_agg', [eb.ref('id')])
        .distinct()
        .as('classIds')
    ])
    .where('parent_class_id', 'is not', null)
    .groupBy('parent_class_id')
    .$narrowType<{ id: NotNull }>()
    .execute()

  const multiclassAbilities: ClassMultiClassMetaObject[] = await db
    .selectFrom('class_multiclass_rule as leaf')
    .innerJoin('class_multiclass_rule as parent', 'parent.id', 'leaf.parent_id')
    .innerJoin('class_multiclass as cm', 'cm.id', 'leaf.multiclass_id')
    .where('leaf.logic', 'is', null) // leaf nodes only (ABILITY)
    .select((eb) => [
      'leaf.ability_id as id',
      'leaf.min_amount as amount',
      eb.ref('parent.logic').$castTo<'AND' | 'OR'>()
        .$notNull()
        .as('logic'),
      eb.fn
        .agg<string[]>('array_agg', [eb.ref('cm.class_id')])
        .distinct()
        .as('classIds')
    ])
    .$narrowType<{ id: NotNull, amount: NotNull }>()
    .groupBy([
      'leaf.ability_id',
      'leaf.min_amount',
      'parent.logic'
    ])
    .execute()

  const features: ClassMetaObject[] = await db
    .selectFrom('class_features')
    .select((eb) => [
      'feature_id as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('class_id')]).as('classIds')
    ])
    .groupBy('feature_id')
    .execute()

  return {
    items,
    meta: {
      categories,
      parentClasses,
      multiclassAbilities,
      features
    }
  }
}
