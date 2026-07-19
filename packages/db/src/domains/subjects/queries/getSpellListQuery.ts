import type { DBLike } from '#types'
import { sql } from 'kysely'
import type { RepositoryFindAllOptions } from '../../../repositories/contracts.js'

export interface SpellListItem {
  id: string
  label: string
  description: string | null
  status: string
  systemId: string
  magicSchoolId: string | null
  level: number
  castingTimeUnit: string
  castingTimeAmount: number
  materialDescription: string | null
  userId: string
  ownerUserId: string | null
  isMaster: boolean | null
}

export interface SpellMetaObject {
  id: string
  label?: string
  spellIds: string[]
}

export interface SpellLevelMetaObject {
  id: number
  spellIds: string[]
}

export interface SpellMeta {
  attributes: SpellMetaObject[]
  classes: SpellMetaObject[]
  schools: SpellMetaObject[]
  levels: SpellLevelMetaObject[]
  castingTimeUnits: SpellMetaObject[]
}

export interface SpellListQueryResult {
  items: SpellListItem[]
  meta: SpellMeta
}

export async function getSpellListQuery(
  db: DBLike,
  filter?: RepositoryFindAllOptions
): Promise<SpellListQueryResult> {
  let itemQuery = db
    .selectFrom('spells')
    .select([
      'id',
      'label',
      'description',
      'status',
      'system_id as systemId',
      'level',
      'magic_school_id as magicSchoolId',
      'casting_time_unit as castingTimeUnit',
      'casting_time_amount as castingTimeAmount',
      'material_description as materialDescription',
      'user_id as ownerUserId',
      'is_master as isMaster',
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
  const spellIds = items.map((item) => item.id)

  if (spellIds.length === 0) {
    return {
      items,
      meta: {
        attributes: [],
        classes: [],
        schools: [],
        levels: [],
        castingTimeUnits: []
      }
    }
  }

  const attributes: SpellMetaObject[] = await db
    .selectFrom('spell_attributes')
    .select((eb) => [
      'attribute_code as id',
      eb.fn
        .agg<string[]>('array_agg', [eb.ref('spell_id')])
        .distinct()
        .as('spellIds')
    ])
    .where('spell_id', 'in', spellIds)
    .groupBy('attribute_code')
    .execute()

  const classes: SpellMetaObject[] = await db
    .selectFrom('spell_classes')
    .innerJoin('classes', 'classes.id', 'spell_classes.class_id')
    .select((eb) => [
      'spell_classes.class_id as id',
      'classes.label as label',
      eb.fn
        .agg<string[]>('array_agg', [eb.ref('spell_classes.spell_id')])
        .distinct()
        .as('spellIds')
    ])
    .where('spell_classes.spell_id', 'in', spellIds)
    .groupBy(['spell_classes.class_id', 'classes.label'])
    .execute()

  const schools: SpellMetaObject[] = (await db
    .selectFrom('spells')
    .innerJoin('magic_schools', 'magic_schools.id', 'spells.magic_school_id')
    .select((eb) => [
      'spells.magic_school_id as id',
      'magic_schools.label as label',
      eb.fn
        .agg<string[]>('array_agg', [eb.ref('spells.id')])
        .distinct()
        .as('spellIds')
    ])
    .where('spells.id', 'in', spellIds)
    .where('spells.magic_school_id', 'is not', null)
    .groupBy(['spells.magic_school_id', 'magic_schools.label'])
    .execute()) as SpellMetaObject[]

  const levels: SpellLevelMetaObject[] = (await db
    .selectFrom('spells')
    .select((eb) => [
      'level as id',
      eb.fn
        .agg<string[]>('array_agg', [eb.ref('id')])
        .distinct()
        .as('spellIds')
    ])
    .where('id', 'in', spellIds)
    .groupBy('level')
    .execute()) as SpellLevelMetaObject[]

  const castingTimeUnits: SpellMetaObject[] = (await db
    .selectFrom('spells')
    .select((eb) => [
      'casting_time_unit as id',
      eb.fn
        .agg<string[]>('array_agg', [eb.ref('id')])
        .distinct()
        .as('spellIds')
    ])
    .where('id', 'in', spellIds)
    .where('casting_time_unit', 'is not', null)
    .groupBy('casting_time_unit')
    .execute()) as SpellMetaObject[]

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
