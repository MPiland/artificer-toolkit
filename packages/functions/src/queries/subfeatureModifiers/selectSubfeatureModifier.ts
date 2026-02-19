import type { Database } from '@artificer-toolkit/db/types'
import type { ModifierEffects, ModifierScalePerLevel, SubfeatureModifier, ModifierTargets, UsesPerLevel } from '@artificer-toolkit/shared/types'
import { damage, prerequisites } from '#queries/fragments'
import { type ExpressionBuilder, sql, type NotNull, type RawBuilder, type Expression } from 'kysely'
import { jsonArrayFrom, jsonBuildObject, jsonObjectFrom } from 'kysely/helpers/postgres'

function modifierEffects(eb: ExpressionBuilder<Database, 'subfeature_modifiers'>): RawBuilder<ModifierEffects | null> {
  return jsonObjectFrom<ModifierEffects>(
    eb
      .selectFrom('subfeature_modifier_effects')
      .whereRef('subfeature_modifier_id', '=', eb.ref('id'))
      .select((eb2) => [
        'min_amount as minAmount',
        'max_amount as maxAmount',
        'set_amount as setAmount',
        'add_amount as addAmount',
        'multiplier',
        'die_config as dieConfig',
        'distance',
        'unit_id as unitId',
        'amount',
        'ability_id as abilityId',
        'size',
        eb2.fn.coalesce(jsonArrayFrom<ModifierScalePerLevel>(
          eb2
            .selectFrom('subfeature_modifier_per_level')
            .whereRef('subfeature_modifier_id', '=', eb2.ref('subfeature_modifier_id'))
            .select([
              'level',
              'die_config as dieConfig',
              'set_amount as setAmount'
            ])
            .orderBy('level', 'asc')
        ), sql<ModifierScalePerLevel[]>`'[]'::jsonb`).as('scalePerLevel'),
        eb2.fn.coalesce(jsonArrayFrom<UsesPerLevel>(
          eb2
            .selectFrom('subfeature_modifier_per_level')
            .whereRef('subfeature_modifier_id', '=', eb2.ref('subfeature_modifier_id'))
            .select([
              'level',
              'uses'
            ])
            .orderBy('level', 'asc')
            .$narrowType<{ uses: NotNull }>()
        ), sql<UsesPerLevel[]>`'[]'::jsonb`).as('usesPerLevel'),
        damage(eb2).as('damage')
      ])
  )
}

function modifierTargets(eb: ExpressionBuilder<Database, 'subfeature_modifiers'>, code: Expression<string>): RawBuilder<ModifierTargets | null> {
  return jsonObjectFrom<ModifierTargets>(
    eb
      .selectFrom('subfeature_modifier_targets as t')
      .innerJoin(
        'system_mod_opts as spell_opt',
        'spell_opt.id',
        't.spell_category_id'
      )
      .where('t.subfeature_modifier_id', '=', eb.ref('id'))
      .select((eb2) => [
        eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
          eb2
            .case()
            .when(
              eb2.and([
                eb2(eb.ref('use_all'), '=', true),
                eb2(eb2.ref('t.ability_id'), 'is not', null),
                eb2(code, '=', 'ABILITY_SCORE')
              ])
            )
            .then('all')
            .else(eb2.ref('t.ability_id'))
            .end()
            .$notNull()
        ]), sql<string[]>`'[]'::jsonb`)
          .as('abilityIds'),
        eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
          eb2
            .case()
            .when(
              eb2.and([
                eb2(eb.ref('use_all'), '=', true),
                eb2(eb2.ref('t.skill_id'), 'is not', null),
                eb2(code, '=', 'SKILL_CHECK')
              ])
            )
            .then('all')
            .else(eb2.ref('t.skill_id'))
            .end()
            .$notNull()
        ]), sql<string[]>`'[]'::jsonb`)
          .as('skillIds'),
        eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
          eb2
            .case()
            .when(
              eb2.and([
                eb2(eb.ref('use_all'), '=', true),
                eb2(eb2.ref('t.save_ability_id'), 'is not', null),
                eb2(code, '=', 'SAVE_ABILITY')
              ])
            )
            .then('all')
            .else(eb2.ref('t.save_ability_id'))
            .end()
            .$notNull()
        ]), sql<string[]>`'[]'::jsonb`)
          .as('saveAbilityIds'),
        eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
          eb2
            .case()
            .when(
              eb2.and([
                eb2(eb.ref('use_all'), '=', true),
                eb2(eb2.ref('t.damage_type_id'), 'is not', null),
                eb2(code, '=', 'DAMAGE_SAVE'),
                eb2(code, '=', 'DAMAGE_TYPE')
              ])
            )
            .then('all')
            .else(eb2.ref('t.damage_type_id'))
            .end()
            .$notNull()
        ]), sql<string[]>`'[]'::jsonb`)
          .as('damageTypeIds'),
        eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
          eb2
            .case()
            .when(
              eb2.and([
                eb2(eb.ref('use_all'), '=', true),
                eb2(eb2.ref('t.condition_id'), 'is not', null),
                eb2(code, '=', 'CONDITION_SAVE'),
                eb2(code, '=', 'CONDITION')
              ])
            )
            .then('all')
            .else(eb2.ref('t.condition_id'))
            .end()
            .$notNull()
        ]), sql<string[]>`'[]'::jsonb`)
          .as('conditionIds'),
        eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
          eb2
            .case()
            .when(
              eb2.and([
                eb2(eb.ref('use_all'), '=', true),
                eb2(eb2.ref('t.speed_id'), 'is not', null),
                eb2(code, '=', 'SPEED')
              ])
            )
            .then('all')
            .else(eb2.ref('t.speed_id'))
            .end()
            .$notNull()
        ]), sql<string[]>`'[]'::jsonb`)
          .as('speedIds'),
        eb2
          .case()
          .when(eb2.and([
            eb2(code, '=', 'SPELL'),
            eb2(eb2.ref('t.spell_id'), 'is not', null)
          ]))
          .then(eb2.ref('t.spell_id'))
          .else(null)
          .end()
          .as('spellId'),
        eb2
          .case()
          .when(
            eb2.and([
              eb2(code, '=', 'SPELL'),
              eb2(eb2.ref('spell_opt.code'), '=', 'SPELL_RANGE'),
              eb2(eb2.ref('t.range_id'), 'is not', null)
            ])
          )
          .then(eb2.ref('t.range_id'))
          .else(null)
          .end()
          .as('rangeId'),
        eb2
          .case()
          .when(
            eb2.and([
              eb2(code, '=', 'SPELL'),
              eb2(eb2.ref('spell_opt.code'), '=', 'SPELL_SHAPE'),
              eb2(eb2.ref('t.shape_id'), 'is not', null)
            ])
          )
          .then(eb2.ref('t.shape_id'))
          .else(null)
          .end()
          .as('shapeId'),
        eb2
          .case()
          .when(
            eb2.and([
              eb2(code, '=', 'SPELL'),
              eb2(eb2.ref('spell_opt.code'), '=', 'SPELL_DURATION'),
              eb2(eb2.ref('t.duration_id'), 'is not', null)
            ])
          )
          .then(eb2.ref('t.duration_id'))
          .else(null)
          .end()
          .as('durationId'),
        eb2
          .case()
          .when(eb2.and([
            eb2(eb2.ref('t.charge_limit_id'), 'is not', null),
            eb2(code, '=', 'CHARGE_LIMIT')
          ]))
          .then(eb2.ref('t.charge_limit_id'))
          .else(null)
          .end()
          .as('chargeLimitId'),
        eb2
          .case()
          .when(eb2.and([
            eb2(eb2.ref('t.charge_reset_id'), 'is not', null),
            eb2(code, '=', 'CHARGE_RESET')
          ]))
          .then(eb2.ref('t.charge_reset_id'))
          .else(null)
          .end()
          .as('chargeResetId'),
        eb2
          .case()
          .when(
            eb2.and([
              eb2.or([
                eb2.and([
                  eb2(eb2.ref('t.charge_reset_id'), 'is not', null),
                  eb2(code, '=', 'CHARGE_RESET')
                ]),
                eb2.and([
                  eb2(eb2.ref('t.charge_limit_id'), 'is not', null),
                  eb2(code, '=', 'CHARGE_LIMIT')
                ])
              ]),
              eb2(eb2.ref('t.feature_id'), 'is not', null)
            ])
          )
          .then(eb2.ref('t.feature_id'))
          .else(null)
          .end()
          .as('featureId'),
        eb2
          .case()
          .when(
            eb2.and([
              eb2(code, '=', 'SPELL'),
              eb2(eb2.ref('t.spell_category_id'), 'is not', null)
            ])
          )
          .then(eb2.ref('t.spell_category_id'))
          .else(null)
          .end()
          .as('spellCategoryId')
      ])
  )
}

export function selectSubfeatureModifier(eb: ExpressionBuilder<Database, 'subfeature_modifiers'>, opts?: { position?: Expression<number | null> }): RawBuilder<SubfeatureModifier> {
  const code = eb
    .selectFrom('system_mod_opts as opt')
    .whereRef('opt.id', '=', eb.ref('category_id'))
    .select(['opt.code'])
    .$asScalar()

  return jsonBuildObject({
    id: eb.ref('id'),
    subtypeId: eb.ref('subtype_id'),
    selectionCount: eb.ref('selection_count'),
    categoryId: eb.ref('category_id'),
    typeId: eb.ref('type_id'),
    methodId: eb.ref('method_id'),
    methodAbilityId: eb.ref('method_ability_id'),
    methodSkillId: eb.ref('method_skill_id'),
    attributeIds: eb
      .selectFrom('subfeature_modifier_attributes')
      .where(({ eb: eb2, and }) => and([
        eb2(eb2.ref('subfeature_modifier_id'), '=', eb.ref('id')),
        eb2(eb2.ref('attribute_id'), 'is not', null)
      ]))
      .select((eb2) => [
        eb2.fn.coalesce(
          eb2.fn.agg<string[]>('json_agg', ['attribute_id']),
          sql<string[]>`'[]'::jsonb`
        ).as('value')
      ])
      .$asScalar(),
    prerequisites: prerequisites(eb, (eb2) => eb2
      .selectFrom('subfeature_modifier_prerequisites as bridge')
      .select(['bridge.prerequisite_id'])
      .whereRef('bridge.subfeature_modifier_id', '=', 'id')),
    targets: modifierTargets(eb, code),
    effects: modifierEffects(eb),
    position: opts?.position ?? sql<null>`null`
  })
}
