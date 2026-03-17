import type { DBLike } from '#types'

interface SpellListItem {
  id: string
  label: string
  description: string | null
  systemId: string
  userId: string
}

interface SpellMetaObject {
  id: string
  spellIds: string[]
}

interface SpellLevelMetaObject {
  id: number
  spellIds: string[]
}

interface SpellMeta {
  attributes: SpellMetaObject[]
  classes: SpellMetaObject[]
  schools: SpellMetaObject[]
  levels: SpellLevelMetaObject[]
  castingTimeUnits: SpellMetaObject[]
}

export async function getSpellListQuery(db: DBLike): Promise<{ items: SpellListItem[], meta: SpellMeta }> {
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
      'attribute_code as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('spell_id')]).distinct().as('spellIds')
    ])
    .groupBy('attribute_code')
    .execute()

  const classes: SpellMetaObject[] = await db
    .selectFrom('spell_classes')
    .select((eb) => [
      'class_id as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('spell_id')]).distinct().as('spellIds')
    ])
    .groupBy('class_id')
    .execute()

  const schools: SpellMetaObject[] = await db
    .selectFrom('spells')
    .select((eb) => [
      'magic_school_id as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('id')]).distinct().as('spellIds')
    ])
    .where('magic_school_id', 'is not', null)
    .groupBy('magic_school_id')
    .execute() as SpellMetaObject[]

  const levels: SpellLevelMetaObject[] = await db
    .selectFrom('spells')
    .select((eb) => [
      'level as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('id')]).distinct().as('spellIds')
    ])
    .groupBy('level')
    .execute() as SpellLevelMetaObject[]

  const castingTimeUnits: SpellMetaObject[] = await db
    .selectFrom('spells')
    .select((eb) => [
      'casting_time_unit as id',
      eb.fn.agg<string[]>('array_agg', [eb.ref('id')]).distinct().as('spellIds')
    ])
    .where('casting_time_unit', 'is not', null)
    .groupBy('casting_time_unit')
    .execute() as SpellMetaObject[]

  return {
    items,
    meta: {
      attributes,
      classes,
      schools,
      levels,
      castingTimeUnits
    }
  }
}
