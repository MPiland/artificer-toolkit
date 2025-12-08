import type { Database } from '@artificer/db'
import type { Class, Multiclass, MulticlassRequirementGroup, MulticlassRequirementAbility, Spellcasting, Subtype, MulticlassType, MulticlassLogic, MulticlassRequirement } from '@artificer/shared/types'
import { features } from '@functions/features'
import { charges, details, startingEquipment } from '@functions/fragments'
import { subfeatureProficiencies } from '@functions/subfeatureProficiencies'
import { type ExpressionBuilder, type RawBuilder, sql, type NotNull } from 'kysely'
import { jsonBuildObject, jsonObjectFrom, jsonArrayFrom } from 'kysely/helpers/postgres'

function classSpellcasting(
  eb: ExpressionBuilder<Database, 'classes'>
) {
  return jsonObjectFrom<Spellcasting>(
    eb
      .selectFrom('class_spellcasting')
      .select((eb2) => [
        'magic_name as magicName',
        'ability_id as abilityId',
        'max_spell_level as maxSpellLevel',
        // Charges Array
        charges(eb2).as('charges'),
        eb2
          .selectFrom('class_spellcasting_attributes')
          .where('class_id', '=', eb.ref('id'))
          .select((eb3) => [
            eb3.fn
              .coalesce(
                eb3.fn.agg<string[]>('json_agg', [
                  eb3.ref('attribute_id')
                ]),
                sql<string[]>`'[]'::jsonb`
              )
              .as('value')
          ])
          .as('attributeIds'),
        // Prepare Limit
        jsonObjectFrom(
          eb2
            .selectFrom('class_spell_prepare_level')
            .where('class_id', '=', eb.ref('id'))
            .select((eb3) => [
              'measurement_id as measurementId',
              'rounding_id as roundingId',
              // methods array
              eb3
                .selectFrom('class_spell_prepare_methods')
                .where('class_id', '=', eb.ref('id'))
                .select((eb4) => [
                  eb4.fn.coalesce(
                    eb4.fn.agg<string[]>('json_agg', [
                      eb4.ref('method_id')
                    ]),
                    sql<string[]>`'[]'::jsonb`
                  )
                    .as('value')
                ])
                .as('methodIds')
            ])
            .$narrowType<{ methodIds: NotNull }>()
        )
          .as('prepareLimit'),
        // Spell limits
        jsonArrayFrom(
          eb2
            .selectFrom('class_level_attributes')
            .where('class_id', '=', eb.ref('id'))
            .select((eb3) => [
              'level as classLevel',
              'spells_known_limit as spellsLimit',
              'cantrips_known_limit as cantripsLimit',
              // slot levels array
              jsonArrayFrom(
                eb3
                  .selectFrom('class_level_spell_slots')
                  .where((w) => w.and([
                    w('class_id', '=', eb.ref('id')),
                    w('level', '=', eb3.ref('level'))
                  ]))
                  .select([
                    'slot_level as spellLevel',
                    'slot_count as slotCount'
                  ])
              ).as('slots')
            ])
            .orderBy('level', 'asc')
        ).as('spellLimits')
      ])
      .whereRef('class_id', '=', 'id')
  )
}

function multiclassAbility(eb: ExpressionBuilder<Database, 'class_multiclass_rule'>): RawBuilder<MulticlassRequirementAbility> {
  return jsonBuildObject({
    id: eb.ref('id'),
    abilityId: eb.ref('ability_id').$notNull(),
    minAmount: eb.ref('min_amount').$notNull(),
    type: sql<MulticlassType>`'ABILITY'`
  })
}

function multiclassGroup(eb: ExpressionBuilder<Database, 'class_multiclass_rule'>): RawBuilder<MulticlassRequirementGroup> {
  return jsonBuildObject({
    id: eb.ref('id'),
    logic: eb.ref('logic').$castTo<MulticlassLogic>()
      .$notNull(),
    type: sql<MulticlassType>`'GROUP'`,
    children: jsonArrayFrom(
      multiclassType(eb)
    )
  })
}

function multiclassType(eb: ExpressionBuilder<Database, 'class_multiclass' | 'class_multiclass_rule'>) {
  return jsonObjectFrom<MulticlassRequirement>(
    eb
      .selectFrom('class_multiclass_rule')
      .where(({ eb: eb3, or }) => or([
        eb3.and([
          eb3(eb3.ref('multiclass_id'), '=', eb.ref('id')),
          eb3(eb3.ref('parent_id'), 'is', null)
        ]),
        eb3(eb3.ref('parent_id'), '=', eb.ref('id'))
      ]))
      .select((eb2) => eb2
        .case()
        .when(eb2.ref('logic'), 'is not', null)
        .then(multiclassGroup(eb2))
        .else(multiclassAbility(eb2))
        .end()
        .as('value'))
      .$asScalar()
  ).$notNull()
}

function classMulticlass(
  eb: ExpressionBuilder<Database, 'classes'>
) {
  return jsonObjectFrom<Multiclass>(
    eb
      .selectFrom('class_multiclass')
      .whereRef('class_id', '=', 'id')
      .select((eb2) => [
        eb2.ref('class_multiclass.id').as('id'),
        // requirement tree
        multiclassType(eb2 as ExpressionBuilder<Database, 'class_multiclass'>)
          .as('requirements'),

        // proficiencies
        subfeatureProficiencies(eb2, (eb3) => eb3
          .selectFrom('class_multiclass_subfeature_proficiencies as bridge')
          .whereRef('bridge.class_multiclass_id', '=', eb.ref('id'))
          .select([
            'bridge.subfeature_proficiency_id',
            'bridge.position'
          ])
          .orderBy('bridge.position', 'asc')).as('proficiencies')
      ])
      .$narrowType<{ requirements: NotNull }>()
  )
}

export function selectClass(eb: ExpressionBuilder<Database, 'classes'>): RawBuilder<Class> {
  return jsonBuildObject({
    id: eb.ref('id'),
    label: eb.ref('label'),
    description: eb.ref('description'),
    categoryId: eb.ref('category_id'),
    parentClassId: eb.ref('parent_class_id'),
    subtypes: jsonArrayFrom <Subtype>(eb
      .selectFrom('class_subtypes')
      .whereRef('class_id', '=', 'id')
      .select([
        'id',
        'label',
        'position'
      ])
      .orderBy('position')),
    attributeIds: eb
      .selectFrom('class_attributes')
      .where(({ eb: eb2, and }) => and([
        eb2(eb2.ref('class_id'), '=', eb.ref('id')),
        eb2(eb2.ref('attribute_id'), 'is not', null)
      ]))
      .select((eb2) => [
        eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
          eb2.ref('attribute_id')
        ]), sql<string[]>`'[]'::jsonb`).as('value')
      ])
      .$asScalar(),
    proficiencies: subfeatureProficiencies(eb, (eb2) => eb2
      .selectFrom('class_subfeature_proficiencies as bridge')
      .select([
        'bridge.subfeature_proficiency_id',
        'bridge.position'
      ])
      .whereRef('class_id', '=', 'id')
      .orderBy('bridge.position', 'asc')),
    details: details(eb, (eb2) => eb2
      .selectFrom('class_details as bridge')
      .select([
        'bridge.detail_id',
        'bridge.position'
      ])
      .whereRef('bridge.class_id', '=', 'id')
      .orderBy('bridge.position', 'asc')),
    startingGold: eb
      .selectFrom('class_starting_gold')
      .whereRef('class_id', '=', 'id')
      .select([
        'multiplier',
        'currency_id as currencyId',
        'die_config as dieConfig'
      ]),
    multiclass: classMulticlass(eb),
    spellcasting: classSpellcasting(eb),
    hitpoint: eb
      .selectFrom('class_hitpoint')
      .whereRef('class_id', '=', 'id')
      .select([
        'ability_id as abilityId',
        'die_config as dieConfig'
      ]),
    equipment: eb
      .case()
      .when(eb.ref('starting_equipment_id'), 'is not', null)
      .then(startingEquipment(eb))
      .else(null)
      .end(),
    features: features(eb, (eb2) => eb2
      .selectFrom('class_features as bridge')
      .select([
        'bridge.feature_id',
        'bridge.position'
      ])
      .whereRef('class_id', '=', 'id')
      .orderBy('bridge.position', 'asc')),
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
