import type { Database } from '@artificer-toolkit/db/types'
import type { AbilityScore, EquipPrerequisite, Prerequisite, PrerequisiteRole } from '@artificer-toolkit/shared/types'
import { type ExpressionBuilder, sql, type RawBuilder, type SelectQueryBuilder } from 'kysely'
import { jsonArrayFrom, jsonBuildObject, jsonObjectFrom } from 'kysely/helpers/postgres'

export function selectPrerequisite(eb: ExpressionBuilder<Database, 'prerequisites'>): RawBuilder<Prerequisite> {
  return jsonBuildObject({
    id: eb.ref('id'),
    role: eb.ref('role').$castTo<PrerequisiteRole>(),
    position: eb.ref('position'),
    categoryId: eb.ref('category_id').$notNull(),
    skillIds: eb
      .selectFrom('prerequisite_skills')
      .whereRef('prerequisite_id', '=', eb.ref('id'))
      .select((eb2) => [
        eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
          'skill_id'
        ]), sql<string[]>`'[]'::jsonb`).as('value')
      ])
      .$asScalar(),
    spellIds: eb
      .selectFrom('prerequisite_spells')
      .whereRef('prerequisite_id', '=', eb.ref('id'))
      .select((eb2) => [
        eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
          'spell_id'
        ]), sql<string[]>`'[]'::jsonb`).as('value')
      ])
      .$asScalar(),
    sizeIds: eb
      .selectFrom('prerequisite_sizes')
      .whereRef('prerequisite_id', '=', eb.ref('id'))
      .select((eb2) => [
        eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
          'size_id'
        ]), sql<string[]>`'[]'::jsonb`).as('value')
      ])
      .$asScalar(),
    featureIds: eb
      .selectFrom('prerequisite_features')
      .whereRef('prerequisite_id', '=', eb.ref('id'))
      .select((eb2) => [
        eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
          'feature_id'
        ]), sql<string[]>`'[]'::jsonb`).as('value')
      ])
      .$asScalar(),
    subfeatureOptionIds: eb
      .selectFrom('prerequisite_subfeature_options')
      .whereRef('prerequisite_id', '=', eb.ref('id'))
      .select((eb2) => [
        eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
          'subfeature_option_id'
        ]), sql<string[]>`'[]'::jsonb`).as('value')
      ])
      .$asScalar(),
    abilityScore: jsonObjectFrom<AbilityScore>(
      eb
        .selectFrom('prerequisite_abilities')
        .whereRef('prerequisite_id', '=', eb.ref('id'))
        .select((eb2) => [
          eb.ref('ability_score').as('score'),
          jsonArrayFrom<string>(
            eb2.ref('ability_id')
          ).as('abilityIds')
        ])
    ),
    equipment: jsonArrayFrom<EquipPrerequisite>(
      eb
        .selectFrom('prerequisite_equipment')
        .whereRef('prerequisite_id', '=', eb.ref('id'))
        .select((eb2) => [
          eb.ref('equip_category_id')
            .$notNull()
            .as('equipCategoryId'),
          eb.ref('number_equipped').as('numberEquipped'),
          eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
            'equipment_id'
          ]), sql<string[]>`'[]'::jsonb`).as('equipmentIds'),
          eb2
            .selectFrom('prerequisite_properties')
            .whereRef('prerequisite_id', '=', eb.ref('id'))
            .select((eb3) => [
              eb3.fn.coalesce(eb3.fn.agg<string[]>('json_agg', [
                'property_id'
              ]), sql<string[]>`'[]'::jsonb`).as('value')
            ])
            .as('propertyIds')
        ])
    )
  })
}

export function prerequisites(
  ebX: ExpressionBuilder<Database, keyof Database>,
  fn: (
    eb2: ExpressionBuilder<Database, keyof Database>
  ) => SelectQueryBuilder<
    Database,
    keyof Database,
    { prerequisite_id: string }
  >
): RawBuilder<Prerequisite[]> {
  const source = fn(ebX)
  const subquery = ebX
    .selectFrom('prerequisites')
    .innerJoin(
      source.as('bridge'),
      'bridge.prerequisite_id',
      'prerequisites.id'
    )
    .select((eb) => [
      selectPrerequisite(eb).as('value')
    ])
    .$asScalar()

  return jsonArrayFrom<Prerequisite>(subquery)
}
