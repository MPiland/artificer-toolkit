import type { Database } from '@artificer/db'
import type { FeatureSpellFilters, SpellsByLevel, SubfeatureSpell } from '@artificer/shared/types'
import { charges, prerequisites } from '@functions/fragments'
import { type NotNull, type ExpressionBuilder, sql, type RawBuilder, type Expression } from 'kysely'
import { jsonArrayFrom, jsonBuildObject } from 'kysely/helpers/postgres'

function subfeatureSpellsByLevel(
  eb: ExpressionBuilder<Database, 'subfeature_spells'>
) {
  return jsonArrayFrom<SpellsByLevel>(
    eb
      .selectFrom('subfeature_spell_by_level as sfsl')
      .whereRef('sfsl.subfeature_spell_id', '=', 'subfeature_spells.id')
      .select((eb2) => [
        'sfsl.level',
        'sfsl.spell_level as spellLevel',
        eb2
          .selectFrom('subfeature_spell_by_level_spells as sfsls')
          .where(({ eb: eb2, and }) => and([
            eb2(eb2.ref('sfsls.subfeature_spell_id'), '=', eb.ref('id')),
            eb2(eb2.ref('sfsls.level'), '=', eb2.ref('sfsl.level'))
          ]))
          .select((eb2) => [
            eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
              eb2
                .case()
                .when(eb2.ref('use_all'), '=', true)
                .then('all')
                .else(eb2.ref('spell_id'))
                .end()
                .$notNull()
            ]), sql<string[]>`'[]'::jsonb`).as('value')
          ])
          .as('spellIds')
      ])
      .$narrowType<{ spellIds: NotNull, level: NotNull }>()
  )
}

function subfeatureSpellFilters(eb: ExpressionBuilder<Database, 'subfeature_spells'>): RawBuilder<FeatureSpellFilters> {
  return jsonBuildObject({
    classIds: eb
      .selectFrom('subfeature_spell_class_limits as sfscl')
      .whereRef('sfscl.subfeature_spell_id', '=', 'id')
      .select((eb2) => [
        eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
          'sfscl.class_id'
        ]), sql<string[]>`'[]'::jsonb`).as('value')
      ])
      .$asScalar(),
    levels: eb
      .selectFrom('subfeature_spell_level_limits as sfsll')
      .whereRef('sfsll.subfeature_spell_id', '=', 'id')
      .select((eb2) => [
        eb2.fn.coalesce(eb2.fn.agg<number[]>('json_agg', [
          'sfsll.level'
        ]), sql<number[]>`'[]'::jsonb`).as('value')
      ])
      .$asScalar(),
    attributeIds: eb
      .selectFrom('subfeature_spell_attribute_limits as sfsal')
      .whereRef('sfsal.subfeature_spell_id', '=', 'id')
      .select((eb2) => [
        eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
          'sfsal.attribute_id'
        ]), sql<string[]>`'[]'::jsonb`).as('value')
      ])
      .$asScalar()
  })
}

export function selectSubfeatureSpell(eb: ExpressionBuilder<Database, 'subfeature_spells'>, opts?: { position?: Expression<number | null> }): RawBuilder<SubfeatureSpell> {
  return jsonBuildObject({
    id: eb.ref('id'),
    subtypeId: eb.ref('subtype_id'),
    abilityId: eb.ref('ability_id'),
    spellLevel: eb.ref('spell_level'),
    selectionCount: eb.ref('selection_count'),
    attributeIds: eb
      .selectFrom('subfeature_spell_attributes')
      .where(({ eb: eb, and }) => and([
        eb('subfeature_spell_id', '=', eb.ref('id')),
        eb('attribute_id', 'is not', null)
      ]))
      .select((eb) => [
        eb.fn.coalesce(eb.fn.agg<string[]>('json_agg', [
          'attribute_id'
        ]), sql<string[]>`'[]'::jsonb`)
          .as('value')
      ])
      .$asScalar(),
    filters: subfeatureSpellFilters(eb),
    spellIds: eb
      .selectFrom('subfeature_spell_spells')
      .where(({ eb: eb, and }) => and([
        eb('subfeature_spell_id', '=', eb.ref('id')),
        eb('spell_id', 'is not', null)
      ]))
      .select((eb) => [
        eb.fn.coalesce(jsonArrayFrom<string>(
          eb.case()
            .when(eb.ref('use_all'), '=', true)
            .then('all')
            .else(eb.ref('spell_id'))
            .end()
        ), sql<string[]>`'[]'::jsonb`).as('value')
      ])
      .$asScalar(),
    prerequisites: prerequisites(eb, (eb2) => eb2
      .selectFrom('subfeature_spell_prerequisites as bridge')
      .select([
        'bridge.prerequisite_id'
      ])
      .whereRef('bridge.subfeature_spell_id', '=', 'id')),
    spellsByLevel: subfeatureSpellsByLevel(eb),
    charges: charges(eb as ExpressionBuilder<Database, 'subfeature_spells'>),
    position: opts?.position ?? sql<null>`null`
  })
}
