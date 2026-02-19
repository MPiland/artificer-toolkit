import type { DB } from '@artificer-toolkit/functions/types'
import type { SpellActionMetaObject, SpellDurationMetaObject, SpellLevelMetaObject, SpellListItem, SpellMeta, SpellMetaObject, SpellRangeMetaObject, SpellShapeMetaObject } from '@artificer-toolkit/shared/types'
import type { NotNull } from 'kysely'

export async function getSpellListQuery(db: DB): Promise<{ items: SpellListItem[], meta: SpellMeta }> {
  const items = await db
    .selectFrom('spells')
    .select((eb) => [
      'id',
      'label',
      'description',
      'system_id as systemId',
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

  const attributes: SpellMetaObject[] = await db
    .selectFrom('spell_attributes')
    .select((eb) => [
      'attribute_id as id',
      eb.fn.agg<string[]>('array_agg', [
        eb.ref('spell_id')
      ]).distinct()
        .as('spellIds')
    ])
    .groupBy('attribute_id')
    .execute()

  const primaryDamages: SpellMetaObject[] = await db
    .selectFrom('damage_fields as df')
    .innerJoin('damages as d', 'd.id', 'df.damage_id')
    .innerJoin('spells as s', 's.damage_id', 'd.id')
    .where('df.slot', '=', 'PRIMARY')
    .where('df.level', '=', 1)
    .where('df.damage_type_id', 'is not', null)
    .select((eb) => [
      'df.damage_type_id as id',
      eb.fn
        .agg<string[]>('array_agg', [
          eb.ref('s.id')
        ])
        .distinct()
        .as('spellIds')
    ])
    .$narrowType<{ id: NotNull }>()
    .groupBy('df.damage_type_id')
    .execute()

  const secondaryDamages: SpellMetaObject[] = await db
    .selectFrom('damage_fields as df')
    .innerJoin('damages as d', 'd.id', 'df.damage_id')
    .innerJoin('spells as s', 's.damage_id', 'd.id')
    .where('df.slot', '=', 'SECONDARY')
    .where('df.level', '=', 1)
    .where('df.damage_type_id', 'is not', null)
    .select((eb) => [
      'df.damage_type_id as id',
      eb.fn
        .agg<string[]>('array_agg', [
          eb.ref('s.id')
        ])
        .distinct()
        .as('spellIds')
    ])
    .$narrowType<{ id: NotNull }>()
    .groupBy('df.damage_type_id')
    .execute()

  const bonusDamages: SpellMetaObject[] = await db
    .selectFrom('damage_fields as df')
    .innerJoin('damages as d', 'd.id', 'df.damage_id')
    .innerJoin('spells as s', 's.damage_id', 'd.id')
    .where('df.slot', '=', 'BONUS')
    .where('df.level', '=', 1)
    .where('df.damage_type_id', 'is not', null)
    .select((eb) => [
      'df.damage_type_id as id',
      eb.fn
        .agg<string[]>('array_agg', [
          eb.ref('s.id')
        ])
        .distinct()
        .as('spellIds')
    ])
    .$narrowType<{ id: NotNull }>()
    .groupBy('df.damage_type_id')
    .execute()

  const castingActions: SpellActionMetaObject[] = await db
    .selectFrom('action_fields as af')
    .innerJoin('actions as a', 'a.id', 'af.action_id')
    .innerJoin('spells as s', 's.damage_id', 'a.id')
    .where('af.slot', '=', 'CASTING')
    .select((eb) => [
      'af.action_option_id as id',
      'amount',
      eb.fn
        .agg<string[]>('array_agg', [
          eb.ref('s.id')
        ])
        .distinct()
        .as('spellIds')
    ])
    .$narrowType<{ id: NotNull }>()
    .groupBy([
      'af.action_option_id',
      'amount'
    ])
    .execute()

  const secondaryActions: SpellActionMetaObject[] = await db
    .selectFrom('action_fields as af')
    .innerJoin('actions as a', 'a.id', 'af.action_id')
    .innerJoin('spells as s', 's.damage_id', 'a.id')
    .where('af.slot', '=', 'SECONDARY')
    .select((eb) => [
      'af.action_option_id as id',
      'amount',
      eb.fn
        .agg<string[]>('array_agg', [
          eb.ref('s.id')
        ])
        .distinct()
        .as('spellIds')
    ])
    .$narrowType<{ id: NotNull }>()
    .groupBy([
      'af.action_option_id',
      'amount'
    ])
    .execute()

  const bonusActions: SpellActionMetaObject[] = await db
    .selectFrom('action_fields as af')
    .innerJoin('actions as a', 'a.id', 'af.action_id')
    .innerJoin('spells as s', 's.damage_id', 'a.id')
    .where('af.slot', '=', 'BONUS')
    .select((eb) => [
      'af.action_option_id as id',
      'amount',
      eb.fn
        .agg<string[]>('array_agg', [
          eb.ref('s.id')
        ])
        .distinct()
        .as('spellIds')
    ])
    .$narrowType<{ id: NotNull }>()
    .groupBy([
      'af.action_option_id',
      'amount'
    ])
    .execute()

  const conditions: SpellMetaObject[] = await db
    .selectFrom('spell_conditions')
    .select((eb) => [
      'condition_id as id',
      eb.fn.agg<string[]>('array_agg', [
        eb.ref('spell_id')
      ]).distinct()
        .as('spellIds')
    ])
    .groupBy('condition_id')
    .execute()

  const classes: SpellMetaObject[] = await db
    .selectFrom('spell_classes')
    .select((eb) => [
      'class_id as id',
      eb.fn.agg<string[]>('array_agg', [
        eb.ref('spell_id')
      ]).distinct()
        .as('spellIds')
    ])
    .groupBy('class_id')
    .execute()

  const durations: SpellDurationMetaObject[] = await db
    .selectFrom('characteristics as c')
    .innerJoin('spells as s', 's.duration_id', 'c.id')
    .select((eb) => [
      'c.id as id',
      'c.amount as amount',
      eb.fn.agg<string[]>('array_agg', [
        eb.ref('s.id')
      ]).distinct()
        .as('spellIds')
    ])
    .where('c.type', '=', 'DURATION')
    .groupBy([
      'c.id',
      'c.amount'
    ])
    .execute()

  const ranges: SpellRangeMetaObject[] = await db
    .selectFrom('characteristics as c')
    .innerJoin('spells as s', 's.duration_id', 'c.id')
    .select((eb) => [
      'c.id as id',
      'c.unit_id as unitId',
      'c.min_amount as minAmount',
      'c.max_amount as maxAmount',
      'c.distance as distance',
      eb.fn.agg<string[]>('array_agg', [
        eb.ref('s.id')
      ]).distinct()
        .as('spellIds')
    ])
    .where('c.type', '=', 'RANGE')
    .groupBy([
      'id',
      'c.min_amount',
      'c.max_amount',
      'c.distance',
      'c.unit_id'
    ])
    .execute()

  const shapes: SpellShapeMetaObject[] = await db
    .selectFrom('characteristics as c')
    .innerJoin('spells as s', 's.duration_id', 'c.id')
    .select((eb) => [
      'c.id as id',
      'c.size as size',
      'c.unit_id as unitId',
      eb.fn.agg<string[]>('array_agg', [
        eb.ref('s.id')
      ]).distinct()
        .as('spellIds')
    ])
    .where('c.type', '=', 'SHAPE')
    .groupBy([
      'c.id',
      'c.size',
      'c.unit_id'
    ])
    .execute()

  const schools: SpellMetaObject[] = await db
    .selectFrom('spells')
    .select((eb) => [
      'school_id as id',
      eb.fn.agg<string[]>('array_agg', [
        eb.ref('id')
      ]).distinct()
        .as('spellIds')
    ])
    .groupBy([
      'school_id'
    ])
    .execute()

  const levels: SpellLevelMetaObject[] = await db
    .selectFrom('spells')
    .select((eb) => [
      'level as id',
      eb.fn.agg<string[]>('array_agg', [
        eb.ref('id')
      ]).distinct()
        .as('spellIds')
    ])
    .groupBy('level')
    .execute()

  const saveDcs: SpellMetaObject[] = await db
    .selectFrom('save_dc as sd')
    .innerJoin('spells as s', 's.save_dc_id', 'sd.id')
    .select((eb) => [
      'sd.id as id',
      eb.fn.agg<string[]>('array_agg', [
        eb.ref('id')
      ]).distinct()
        .as('spellIds')
    ])
    .groupBy('s.id')
    .execute()

  const requirements = await db
    .selectFrom('spell_requirements')
    .select((eb) => [
      'requirement_id as id',
      eb.fn.agg<string[]>('array_agg', [
        eb.ref('spell_id')
      ]).distinct()
        .as('spellIds')
    ])
    .groupBy('requirement_id')
    .execute()

  return {
    items,
    meta: {
      attributes,
      primaryDamages,
      secondaryDamages,
      bonusDamages,
      castingActions,
      secondaryActions,
      bonusActions,
      conditions,
      classes,
      durations,
      ranges,
      shapes,
      schools,
      levels,
      saveDcs,
      requirements
    }
  }
}
