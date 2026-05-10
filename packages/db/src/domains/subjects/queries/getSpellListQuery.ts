import type { DBLike } from '#types'
import { sql } from 'kysely'

interface SpellListItem {
  id: string
  label: string
  description: string | null
  status: string
  systemId: string
  magicSchoolId: string | null
  castingTimeUnit: string
  castingTimeAmount: number
  userId: string
  ownerUserId: string | null
  isMaster: boolean | null
}

interface SpellMetaObject {
  id: string
  label?: string
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
      'status',
      'system_id as systemId',
      'level',
      'magic_school_id as magicSchoolId',
      'casting_time_unit as castingTimeUnit',
      'casting_time_amount as castingTimeAmount',
      'user_id as ownerUserId',
      'is_master as isMaster',
      sql<string>`case when ${sql.ref('is_master')} then 'master' else ${sql.ref('user_id')}::text end`
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
    .innerJoin('classes', 'classes.id', 'spell_classes.class_id')
    .select((eb) => [
      'spell_classes.class_id as id',
      'classes.label as label',
      eb.fn.agg<string[]>('array_agg', [eb.ref('spell_classes.spell_id')]).distinct().as('spellIds')
    ])
    .groupBy(['spell_classes.class_id', 'classes.label'])
    .execute()

  const schools: SpellMetaObject[] = await db
    .selectFrom('spells')
    .innerJoin('magic_schools', 'magic_schools.id', 'spells.magic_school_id')
    .select((eb) => [
      'spells.magic_school_id as id',
      'magic_schools.label as label',
      eb.fn.agg<string[]>('array_agg', [eb.ref('spells.id')]).distinct().as('spellIds')
    ])
    .where('spells.magic_school_id', 'is not', null)
    .groupBy(['spells.magic_school_id', 'magic_schools.label'])
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
