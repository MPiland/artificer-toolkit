import type { Database } from '@artificer-toolkit/db/types'
import type { System, TagsEnum, EquipmentCategoryProperty, ModifierCategoryType, ModifierTypeMethod, ModifierCategoryTypeMethod, GenericOption, AbilityGenerateMethod, GenerateOption, SystemSense, SystemSkill, SystemAction, SystemAttribute, SystemCategory, ChargeOption, SystemPrerequisite, ProficiencyLevel, MeasurementOption, MeasurementTypeEnum, MeasurementSystemEnum, Currency, CurrencyConversion } from '@artificer-toolkit/shared/types'
import { tags } from '#queries/fragments'
import { type ExpressionBuilder, type RawBuilder, sql } from 'kysely'
import { jsonBuildObject, jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres'

const genericSelect = [
  'id',
  'label',
  'tooltip',
  'short',
  'code',
  'description'
] as const

export function selectSystem(eb: ExpressionBuilder<Database, 'systems'>): RawBuilder<System> {
  return jsonBuildObject({
    id: eb.ref('id'),
    label: eb.ref('label'),
    description: eb.ref('description'),
    abilities: jsonArrayFrom<GenericOption>(
      eb
        .selectFrom('system_abilities')
        .select(genericSelect)
        .whereRef('system_id', '=', 'id')
    ),
    actions: jsonArrayFrom<SystemAction>(
      eb
        .selectFrom('system_actions')
        .select((eb2) => [
          'id',
          'label',
          'description',
          'code',
          tags(eb2, (eb3) => eb3
            .selectFrom('system_action_tags as bridge')
            .select(['bridge.tag_id'])
            .whereRef('bridge.action_id', '=', 'id'))
            .as('tags')
        ])
        .whereRef('system_id', '=', 'id')
    ),
    alignments: jsonArrayFrom<GenericOption>(
      eb
        .selectFrom('system_alignments')
        .select(genericSelect)
        .whereRef('system_id', '=', 'id')
    ),
    attributes: jsonArrayFrom<SystemAttribute>(
      eb
        .selectFrom('system_attributes')
        .select((eb2) => [
          'id',
          'label',
          'description',
          'code',
          tags(eb2, (eb3) => eb3
            .selectFrom('system_attribute_tags as bridge')
            .select(['bridge.tag_id'])
            .whereRef('bridge.attribute_id', '=', 'id')).as('tags')
        ])
        .whereRef('system_id', '=', 'id')
    ),
    categories: jsonArrayFrom<SystemCategory>(
      eb
        .selectFrom('system_categories')
        .select((eb2) => [
          'id',
          'label',
          'description',
          'code',
          tags(eb2, (eb3) => eb3
            .selectFrom('system_category_tags as bridge')
            .select(['bridge.tag_id'])
            .whereRef('bridge.category_id', '=', 'id')).as('tags')
        ])
        .whereRef('system_id', '=', 'id')
    ),
    characterSettings: jsonBuildObject({
      hitpointCalcMethods: jsonArrayFrom<GenericOption>(
        eb
          .selectFrom('system_char_opts')
          .select(genericSelect)
          .where(({ eb: eb2, and }) => and([
            eb2(eb2.ref('system_id'), '=', eb.ref('id')),
            eb2(eb2.ref('type'), '=', 'HP_CALC_MTHD')
          ]))
      ),
      advancementMethods: jsonArrayFrom<GenericOption>(
        eb
          .selectFrom('system_char_opts')
          .select(genericSelect)
          .where(({ eb: eb2, and }) => and([
            eb2(eb2.ref('system_id'), '=', eb.ref('id')),
            eb2(eb2.ref('type'), '=', 'ADV_MTHD')
          ]))
      ),
      spellPointCalcMethods: jsonArrayFrom<GenericOption>(
        eb
          .selectFrom('system_char_opts')
          .select(genericSelect)
          .where(({ eb: eb2, and }) => and([
            eb2(eb2.ref('system_id'), '=', eb.ref('id')),
            eb2(eb2.ref('type'), '=', 'SP_CALC_MTHD')
          ]))
      ),
      startingEquipmentOptions: jsonArrayFrom<GenericOption>(
        eb
          .selectFrom('system_char_opts')
          .select(genericSelect)
          .where(({ eb: eb2, and }) => and([
            eb2(eb2.ref('system_id'), '=', eb.ref('id')),
            eb2(eb2.ref('type'), '=', 'START_EQUIP')
          ]))
      )
    }),
    charges: jsonBuildObject({
      limits: jsonArrayFrom<ChargeOption>(
        eb
          .selectFrom('system_charges')
          .select((eb2) => [
            'id',
            'label',
            'description',
            'code',
            tags(eb2, (eb3) => eb3
              .selectFrom('system_charge_tags as bridge')
              .select(['bridge.tag_id'])
              .whereRef('bridge.charge_id', '=', 'id')).as('tags')
          ])
          .where(({ eb: eb2, and }) => and([
            eb2(eb2.ref('system_id'), '=', eb.ref('id')),
            eb2(eb2.ref('type'), '=', 'LIMIT')
          ]))
      ),
      resets: jsonArrayFrom<ChargeOption>(
        eb
          .selectFrom('system_charges')
          .select((eb2) => [
            'id',
            'label',
            'description',
            'code',
            tags(eb2, (eb3) => eb3
              .selectFrom('system_charge_tags as bridge')
              .select(['bridge.tag_id'])
              .whereRef('bridge.charge_id', '=', 'id')).as('tags')
          ])
          .where(({ eb: eb2, and }) => and([
            eb2(eb2.ref('system_id'), '=', eb.ref('id')),
            eb2(eb2.ref('type'), '=', 'RESET')
          ]))
      )
    }),
    conditions: jsonArrayFrom<GenericOption>(
      eb
        .selectFrom('system_conditions')
        .select(genericSelect)
        .whereRef('system_id', '=', 'id')
    ),
    currencies: jsonArrayFrom<Currency>(
      eb
        .selectFrom('system_currencies')
        .select((eb2) => [
          'id',
          'label',
          'abbreviation',
          'description',
          jsonObjectFrom<CurrencyConversion>(
            eb2
              .selectFrom('system_currency_conversions')
              .select([
                'copper',
                'silver',
                'gold',
                'electrum',
                'platinum'
              ])
              .whereRef('currency_id', '=', 'id')
          ).$notNull()
            .as('conversions')
        ])
    ),
    damageTypes: jsonArrayFrom<GenericOption>(
      eb
        .selectFrom('system_damage_types')
        .selectAll()
        .whereRef('system_id', '=', 'id')
    ),
    equipment: jsonBuildObject({
      categories: jsonArrayFrom<GenericOption>(
        eb
          .selectFrom('system_equip_opts')
          .select(genericSelect)
          .where(({ eb: eb2, and }) => and([
            eb2(eb2.ref('system_id'), '=', eb.ref('id')),
            eb2(eb2.ref('type'), '=', 'CATEGORY')
          ]))
      ),
      properties: jsonArrayFrom<GenericOption>(
        eb
          .selectFrom('system_equip_opts')
          .select(genericSelect)
          .where(({ eb: eb2, and }) => and([
            eb2(eb2.ref('system_id'), '=', eb.ref('id')),
            eb2(eb2.ref('type'), '=', 'PROPERTY')
          ]))
      ),
      categoryProperties: jsonArrayFrom<EquipmentCategoryProperty>(
        eb
          .selectFrom('system_equip_cat_props')
          .select([
            'category_id as categoryId',
            'property_id as propertyId'
          ])
          .whereRef('system_id', '=', 'id')
      ),
      rarities: jsonArrayFrom<GenericOption>(
        eb
          .selectFrom('system_equip_opts')
          .select(genericSelect)
          .where(({ eb: eb2, and }) => and([
            eb2(eb2.ref('system_id'), '=', eb.ref('id')),
            eb2(eb2.ref('type'), '=', 'RARITY')
          ]))
      )
    }),
    languages: jsonArrayFrom<GenericOption>(
      eb
        .selectFrom('system_langs')
        .select(genericSelect)
        .whereRef('system_id', '=', 'id')
    ),
    modifiers: jsonBuildObject({
      categories: jsonArrayFrom<GenericOption>(
        eb
          .selectFrom('system_mod_opts')
          .select(genericSelect)
          .where(({ eb: eb2, and }) => and([
            eb2(eb2.ref('system_id'), '=', eb.ref('id')),
            eb2(eb2.ref('type'), '=', 'CATEGORY')
          ]))
      ),
      types: jsonArrayFrom<GenericOption>(
        eb
          .selectFrom('system_mod_opts')
          .select(genericSelect)
          .where(({ eb: eb2, and }) => and([
            eb2(eb2.ref('system_id'), '=', eb.ref('id')),
            eb2(eb2.ref('type'), '=', 'TYPE')
          ]))
      ),
      methods: jsonArrayFrom<GenericOption>(
        eb
          .selectFrom('system_mod_opts')
          .select(genericSelect)
          .where(({ eb: eb2, and }) => and([
            eb2(eb2.ref('system_id'), '=', eb.ref('id')),
            eb2(eb2.ref('type'), '=', 'METHOD')
          ]))
      ),
      spellCategories: jsonArrayFrom<GenericOption>(
        eb
          .selectFrom('system_mod_opts')
          .select(genericSelect)
          .where(({ eb: eb2, and }) => and([
            eb2(eb2.ref('system_id'), '=', eb.ref('id')),
            eb2(eb2.ref('type'), '=', 'SPELL_CATEGORY')
          ]))
      ),
      categoryTypes: jsonArrayFrom<ModifierCategoryType>(
        eb
          .selectFrom('system_mod_cat_types')
          .select([
            'category_id as categoryId',
            'type_id as typeId'
          ])
          .whereRef('system_id', '=', 'id')
      ),
      typeMethods: jsonArrayFrom<ModifierTypeMethod>(
        eb
          .selectFrom('system_mod_type_mthds')
          .select([
            'type_id as typeId',
            'method_id as methodId'
          ])
          .whereRef('system_id', '=', 'id')
      ),
      categoryMethods: jsonArrayFrom<ModifierCategoryTypeMethod>(
        eb
          .selectFrom('system_mod_cat_type_mthds')
          .select([
            'category_id as categoryId',
            'type_id as typeId',
            'method_id as methodId'
          ])
          .whereRef('system_id', '=', 'id')
      )
    }),
    passives: jsonArrayFrom<GenericOption>(
      eb
        .selectFrom('system_passives')
        .select(genericSelect)
        .whereRef('system_id', '=', 'id')
    ),
    prerequisites: jsonArrayFrom<SystemPrerequisite> (
      eb
        .selectFrom('system_prereqs')
        .select((eb2) => [
          'id',
          'label',
          'description',
          'code',
          tags(eb2, (eb3) => eb3
            .selectFrom('system_prereq_tags as bridge')
            .select(['bridge.tag_id'])
            .whereRef('bridge.prereq_id', '=', 'id')).as('tags')
        ])
        .whereRef('system_id', '=', 'id')
    ),
    proficiencies: jsonBuildObject({
      levels: jsonArrayFrom<ProficiencyLevel>(
        eb
          .selectFrom('system_prof_levels')
          .select([
            'id',
            'label',
            'multiplier',
            'code'
          ])
          .whereRef('system_id', '=', 'id')
      ),
      categories: jsonArrayFrom<GenericOption>(
        eb
          .selectFrom('system_prof_cats')
          .select(genericSelect)
          .whereRef('system_id', '=', 'id')
      )
    }),
    ranges: jsonArrayFrom<GenericOption> (
      eb
        .selectFrom('system_ranges')
        .select(genericSelect)
        .whereRef('system_id', '=', 'id')
    ),
    rules: jsonBuildObject({
      measureUnits: jsonArrayFrom<MeasurementOption>(
        eb
          .selectFrom('system_measure_units')
          .select((eb2) => [
            'id',
            'label',
            'description',
            'tooltip',
            'short',
            eb2
              .selectFrom('system_measurement_systems')
              .select(['label'])
              .whereRef('id', '=', 'measurement_system_id')
              .$asScalar()
              .$castTo<MeasurementSystemEnum>()
              .as('measurementSystem'),
            jsonArrayFrom<MeasurementTypeEnum>(
              eb2
                .selectFrom('system_measurement_types as smt')
                .innerJoin('system_measure_unit_types as smu', 'smu.type_id', 'smt.id')
                .select((eb4) => [eb4.ref('label').as('value')])
                .whereRef('smu.unit_id', '=', 'id')
                .$asScalar()
                .$castTo<MeasurementTypeEnum>()
            ).as('types'),
            'code'
          ])
      ),
      measureAmounts: jsonArrayFrom<GenericOption>(
        eb
          .selectFrom('system_measure_opts')
          .select(genericSelect)
          .where(({ eb: eb2, and }) => and([eb2(eb2.ref('type'), '=', 'AMOUNT')]))
      ),
      measureRounding: jsonArrayFrom<GenericOption>(
        eb
          .selectFrom('system_measure_opts')
          .select(genericSelect)
          .where(({ eb: eb2, and }) => and([eb2(eb2.ref('type'), '=', 'ROUNDING')]))
      ),
      abilityGenerateMethods: jsonArrayFrom<AbilityGenerateMethod>(
        eb
          .selectFrom('system_abil_gen_mthds')
          .select((eb2) => [
            'id',
            'label',
            'total',
            'code',
            jsonArrayFrom<GenerateOption>(
              eb2
                .selectFrom('system_abil_gen_mthd_opts')
                .select([
                  'id',
                  'label',
                  'reduce',
                  'code'
                ])
                .whereRef('gen_method_id', '=', 'id')
            ).as('options')
          ])
          .whereRef('system_id', '=', 'id')
      )
    }),
    senses: jsonArrayFrom<SystemSense>(eb
      .selectFrom('system_senses')
      .select((eb2) => [
        'id',
        'label',
        'creature_description as creatureDescription',
        'monster_description as monsterDescription',
        'code',
        tags(eb2, (eb3) => eb3
          .selectFrom('system_sense_tags as bridge')
          .select(['bridge.tag_id'])
          .whereRef('bridge.sense_id', '=', 'id')).as('tags')
      ])
      .whereRef('system_id', '=', 'id')),
    sizes: jsonArrayFrom<GenericOption>(
      eb
        .selectFrom('system_sizes')
        .select(genericSelect)
        .whereRef('system_id', '=', 'id')
    ),
    skills: jsonArrayFrom<SystemSkill>(eb
      .selectFrom('system_skills')
      .select([
        'id',
        'label',
        'description',
        'ability_id as abilityId',
        'code'
      ])
      .whereRef('system_id', '=', 'id')),
    speeds: jsonArrayFrom<GenericOption>(
      eb
        .selectFrom('system_speeds')
        .select(genericSelect)
        .whereRef('system_id', '=', 'id')
    ),
    spells: jsonBuildObject({
      categories: jsonArrayFrom<GenericOption>(
        eb
          .selectFrom('system_spell_opts')
          .select(genericSelect)
          .where(({ eb: eb2, and }) => and([
            eb2(eb2.ref('system_id'), '=', 'id'),
            eb2(eb2.ref('type'), '=', 'CATEGORY')
          ]))
      ),
      durations: jsonArrayFrom<GenericOption>(
        eb
          .selectFrom('system_spell_opts')
          .select(genericSelect)
          .where(({ eb: eb2, and }) => and([
            eb2(eb2.ref('system_id'), '=', 'id'),
            eb2(eb2.ref('type'), '=', 'DURATION')
          ]))
      ),
      schools: jsonArrayFrom<GenericOption>(
        eb
          .selectFrom('system_spell_opts')
          .select(genericSelect)
          .where(({ eb: eb2, and }) => and([
            eb2(eb2.ref('system_id'), '=', 'id'),
            eb2(eb2.ref('type'), '=', 'SCHOOL')
          ]))
      ),
      shapes: jsonArrayFrom<GenericOption>(
        eb
          .selectFrom('system_spell_opts')
          .select(genericSelect)
          .where(({ eb: eb2, and }) => and([
            eb2(eb2.ref('system_id'), '=', 'id'),
            eb2(eb2.ref('type'), '=', 'SHAPE')
          ]))
      ),
      requirements: jsonArrayFrom<GenericOption>(
        eb
          .selectFrom('system_spell_opts')
          .select(genericSelect)
          .where(({ eb: eb2, and }) => and([
            eb2(eb2.ref('system_id'), '=', 'id'),
            eb2(eb2.ref('type'), '=', 'REQUIREMENT')
          ]))
      )
    }),
    tags: eb
      .selectFrom('system_tags')
      .select((eb2) => [eb2.fn.coalesce(eb2.fn.agg<TagsEnum[]>('json_agg', ['id']), sql<TagsEnum[]>`'[]'::jsonb`).as('value')])
      .whereRef('system_id', '=', 'id')
      .$asScalar(),
    terrains: jsonArrayFrom<GenericOption>(
      eb
        .selectFrom('system_terrains')
        .select(genericSelect)
        .whereRef('system_id', '=', 'id')
    ),
    userId: eb
      .case()
      .when(eb.ref('is_master'), 'is', true)
      .then('master')
      .else(eb.ref('user_id'))
      .end()
      .$notNull()
  })
}
