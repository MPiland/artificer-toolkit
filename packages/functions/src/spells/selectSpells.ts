import type { Database } from '@artificer/db'
import type { Spell, UpcastLevel } from '@artificer/shared/types'
import { actions, saveDc, shape, range, duration, damage } from '@functions/fragments'
import type { RawBuilder } from 'kysely'
import { type ExpressionBuilder, sql } from 'kysely'
import { jsonBuildObject, jsonArrayFrom } from 'kysely/helpers/postgres'

export function selectSpell(eb: ExpressionBuilder<Database, 'spells'>): RawBuilder<Spell> {
  return jsonBuildObject({
    id: eb.ref('id'),
    label: eb.ref('label'),
    description: eb.ref('description'),
    level: eb.ref('level'),
    schoolId: eb.ref('school_id'),
    classIds: eb
      .selectFrom('spell_classes')
      .select((eb2) => [
        eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
          'class_id'
        ]), sql<string[]>`'[]'::jsonb`).as('value')
      ])
      .whereRef('spell_id', '=', 'id')
      .$asScalar(),
    attributeIds: eb
      .selectFrom('spell_attributes')
      .select((eb2) => [
        eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
          'attribute_id'
        ]), sql<string[]>`'[]'::jsonb`).as('value')
      ])
      .whereRef('spell_id', '=', 'id')
      .$asScalar(),
    actions: actions(eb),
    targets: eb.ref('targets'),
    saveDc: saveDc(eb),
    upcast: jsonBuildObject({
      attributeIds: eb
        .selectFrom('spell_upcast_attributes')
        .select((eb2) => [
          eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
            'attribute_id'
          ]), sql<string[]>`'[]'::jsonb`).as('value')
        ])
        .whereRef('spell_id', '=', 'id')
        .$asScalar(),
      levels: jsonArrayFrom<UpcastLevel>(
        eb
          .selectFrom('spell_upcast_levels')
          .select((eb2) => [
            'level',
            damage(eb2).as('damage'),
            duration(eb2).as('duration'),
            range(eb2).as('range'),
            shape(eb2).as('shape'),
            'targets'
          ])
          .whereRef('spell_id', '=', 'id')
      )
    }),
    conditionIds: eb
      .selectFrom('spell_conditions')
      .select((eb2) => [
        eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
          'condition_id'
        ]), sql<string[]>`'[]'::jsonb`).as('value')
      ])
      .whereRef('spell_id', '=', 'id')
      .$asScalar(),
    requirementIds: eb
      .selectFrom('spell_requirements')
      .select((eb2) => [
        eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
          'requirement_id'
        ]), sql<string[]>`'[]'::jsonb`).as('value')
      ])
      .whereRef('spell_id', '=', 'id')
      .$asScalar(),
    range: range(eb).$notNull(),
    shape: shape(eb),
    duration: duration(eb).$notNull(),
    damage: damage(eb),
    materialDescription: eb.ref('material_description'),
    userId: eb
      .case()
      .when(eb.ref('is_master'), 'is', true)
      .then('master')
      .else(eb.ref('user_id'))
      .end()
      .$notNull(),
    systemId: eb.ref('system_id')
  })
}
