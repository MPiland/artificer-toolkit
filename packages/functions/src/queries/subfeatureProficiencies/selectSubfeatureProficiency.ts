import type { Database } from '@artificer-toolkit/db/types'
import type { ProficiencyProperties, SubfeatureProficiency } from '@artificer-toolkit/shared/types'
import { prerequisites } from '#queries/fragments'
import { type ExpressionBuilder, type RawBuilder, sql, type Expression } from 'kysely'
import { jsonBuildObject } from 'kysely/helpers/postgres'

function proficiencyProperties(eb: ExpressionBuilder<Database, 'subfeature_proficiencies'>, code: Expression<string>): RawBuilder<ProficiencyProperties> {
  return jsonBuildObject({
    equipCategoryId: eb.ref('equipment_category_id')
      .$notNull(),
    propertyIds: eb
      .selectFrom('subfeature_proficiency_equipment_properties')
      .where(({ eb: eb2, and }) => and([
        eb2(eb2.ref('subfeature_proficiency_id'), '=', eb.ref('id')),
        eb2(eb2.ref('property_id'), 'is not', null)
      ]))
      .select((eb2) => [
        eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
          eb2
            .case()
            .when(eb2.and([
              eb2(eb.ref('use_all'), '=', true),
              eb2(code, '=', 'EQUIPMENT_PROPERTIES')
            ]))
            .then('all')
            .else(eb2.ref('property_id'))
            .end()
            .$notNull()
        ]), sql<string[]>`'[]'::jsonb`).as('value')
      ])
      .$asScalar(),
    equipmentIds:
        eb
          .selectFrom('subfeature_proficiency_equipment')
          .where(({ eb: eb2, and }) => and([
            eb2(eb2.ref('subfeature_proficiency_id'), '=', eb.ref('id')),
            eb2(eb2.ref('equipment_id'), 'is not', null)
          ]))
          .select((eb2) => [
            eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
              eb2
                .case()
                .when(eb2.and([
                  eb2(eb.ref('use_all'), '=', true),
                  eb2(code, '=', 'EQUIPMENT')
                ]))
                .then('all')
                .else(eb2.ref('equipment_id'))
                .end()
                .$notNull()
            ]), sql<string[]>`'[]'::jsonb`).as('value')
          ])
          .$asScalar()
  })
}

export function selectSubfeatureProficiency(eb: ExpressionBuilder<Database, 'subfeature_proficiencies'>, opts?: { position?: Expression<number | null> }): RawBuilder<SubfeatureProficiency> {
  const code = eb
    .selectFrom('system_prof_cats as cat')
    .whereRef('cat.id', '=', eb.ref('category_id'))
    .select(['cat.code'])
    .$asScalar()

  return jsonBuildObject({
    id: eb.ref('id'),
    subtypeId: eb.ref('subtype_id'),
    categoryId: eb.ref('category_id'),
    levelId: eb.ref('level_id'),
    roundingId: eb.ref('rounding_id'),
    selectionCount: eb.ref('selection_count'),
    attributeIds: eb
      .selectFrom('subfeature_proficiency_attributes')
      .where(({ eb: eb2, and }) => and([
        eb2(eb2.ref('subfeature_proficiency_id'), '=', eb.ref('id')),
        eb2(eb2.ref('attribute_id'), 'is not', null)
      ]))
      .select((eb2) => [
        eb2.fn.coalesce(
          eb2.fn.agg<string[]>('json_agg', ['attribute_id']),
          sql<string[]>`'[]'::jsonb`
        ).as('value')
      ])
      .$asScalar(),
    skillIds: eb
      .selectFrom('subfeature_proficiency_skills')
      .where(({ eb: eb2, and }) => and([
        eb2(eb2.ref('subfeature_proficiency_id'), '=', eb.ref('id')),
        eb2(eb2.ref('skill_id'), 'is not', null),
        eb2(code, '=', 'SKILLS')
      ]))
      .select((eb2) => [
        eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
          eb2
            .case()
            .when(eb.ref('use_all'), '=', true)
            .then('all')
            .else(eb2.ref('skill_id'))
            .end()
            .$notNull()
        ]), sql<string[]>`'[]'::jsonb`).as('value')
      ])
      .$asScalar(),
    languageIds: eb
      .selectFrom('subfeature_proficiency_languages')
      .where(({ eb: eb2, and }) => and([
        eb2(eb2.ref('subfeature_proficiency_id'), '=', eb.ref('id')),
        eb2(eb2.ref('language_id'), 'is not', null),
        eb2(code, '=', 'LANGUAGES')
      ]))
      .select((eb2) => [
        eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
          eb2
            .case()
            .when(eb.ref('use_all'), '=', true)
            .then('all')
            .else(eb2.ref('language_id'))
            .end()
            .$notNull()
        ]), sql<string[]>`'[]'::jsonb`).as('value')
      ])
      .$asScalar(),
    saveAbilityIds: eb
      .selectFrom('subfeature_proficiency_ability_saves')
      .where(({ eb: eb2, and }) => and([
        eb2(eb2.ref('subfeature_proficiency_id'), '=', eb.ref('id')),
        eb2(eb2.ref('ability_id'), 'is not', null),
        eb2(code, '=', 'SAVE_ABILITY')
      ]))
      .select((eb2) => [
        eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
          eb2
            .case()
            .when(eb.ref('use_all'), '=', true)
            .then('all')
            .else(eb2.ref('ability_id'))
            .end()
            .$notNull()
        ]), sql<string[]>`'[]'::jsonb`).as('value')
      ])
      .$asScalar(),
    properties: eb
      .case()
      .when(code, '<>', 'EQUIPMENT_PROPERTIES')
      .then(null)
      .else(proficiencyProperties(eb, code))
      .end(),
    equipment: eb
      .case()
      .when(code, '=', 'EQUIPMENT')
      .then(null)
      .else(proficiencyProperties(eb, code))
      .end(),
    prerequisites: prerequisites(eb, (eb2) => eb2
      .selectFrom('subfeature_proficiency_prerequisites as bridge')
      .select(['bridge.prerequisite_id'])
      .whereRef('bridge.subfeature_proficiency_id', '=', 'id')),
    position: opts?.position ?? sql<null>`null`
  })
}
