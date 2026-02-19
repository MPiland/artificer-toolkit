import type { Database } from '@artificer-toolkit/db/types'
import type { Feature, OptionsByLevel } from '@artificer-toolkit/shared/types'
import { type ExpressionBuilder, sql, type Expression, type RawBuilder } from 'kysely'
import { jsonBuildObject, jsonArrayFrom } from 'kysely/helpers/postgres'
import { range, shape, actions, charges, damage, saveDc, prerequisites } from '#queries/fragments'
import { subfeatureFeats } from '#queries/subfeatureFeats'
import { subfeatureModifiers } from '#queries/subfeatureModifiers'
import { subfeatureProficiencies } from '#queries/subfeatureProficiencies'
import { subfeatureExpertise } from '#queries/subfeatureExpertise'
import { subfeatureSenses } from '#queries/subfeatureSenses'
import { subfeatureSpells } from '#queries/subfeatureSpells'
import { subfeatureOptions } from '#queries/subfeatureOptions'

function featureOptionsByLevel(eb: ExpressionBuilder<Database, 'features'>) {
  return jsonArrayFrom<OptionsByLevel>(
    eb
      .selectFrom('feature_subfeature_options_by_level')
      .whereRef('feature_id', '=', 'id')
      .select([
        'level',
        'count',
        'replace_count as replaceCount'
      ])
  )
}

export function selectFeature(eb: ExpressionBuilder<Database, 'features'>, opts?: { position?: Expression<number | null> }): RawBuilder<Feature> {
  return jsonBuildObject({
    id: eb.ref('id'),
    label: eb.ref('label'),
    description: eb.ref('description'),
    categoryId: eb.ref('category_id').$notNull(),
    detail: eb.ref('detail'),
    targets: eb.ref('targets'),
    attributeIds: eb
      .selectFrom('subfeature_option_attributes')
      .whereRef('subfeature_option_id', '=', eb.ref('id'))
      .select((eb2) => [
        eb2.fn.coalesce(
          jsonArrayFrom<string>(eb2.ref('attribute_id')),
          sql<string[]>`'{}'::text[]`
        ).as('value')
      ])
      .$asScalar(),
    actions: actions(eb),
    saveDc: saveDc(eb),
    damage: damage(eb),
    charges: charges(eb),
    range: range(eb),
    shape: shape(eb),
    options: subfeatureOptions(eb, (eb2) => eb2
      .selectFrom('feature_subfeature_options as bridge')
      .select([
        'bridge.subfeature_option_id',
        'bridge.position'
      ])
      .whereRef('feature_id', '=', 'id')
      .orderBy('bridge.position', 'asc')),
    feats: subfeatureFeats(eb, (eb2) => eb2
      .selectFrom('feature_subfeature_feats as bridge')
      .select([
        'bridge.subfeature_feat_id',
        'bridge.position'
      ])
      .whereRef('feature_id', '=', 'id')),
    modifiers: subfeatureModifiers(eb, (eb2) => eb2
      .selectFrom('feature_subfeature_modifiers as bridge')
      .select([
        'bridge.subfeature_modifier_id',
        'bridge.position'
      ])
      .whereRef('feature_id', '=', 'id')
      .orderBy('bridge.position', 'asc')),
    proficiencies: subfeatureProficiencies(eb, (eb2) => eb2
      .selectFrom('feature_subfeature_proficiencies as bridge')
      .select([
        'bridge.subfeature_proficiency_id',
        'bridge.position'
      ])
      .whereRef('feature_id', '=', 'id')
      .orderBy('bridge.position', 'asc')),
    expertise: subfeatureExpertise(eb, (eb2) => eb2
      .selectFrom('feature_subfeature_expertise as bridge')
      .select([
        'bridge.subfeature_expertise_id',
        'bridge.position'
      ])
      .whereRef('feature_id', '=', 'id')
      .orderBy('bridge.position', 'asc')),
    senses: subfeatureSenses(eb, (eb2) => eb2
      .selectFrom('feature_subfeature_senses as bridge')
      .select([
        'bridge.subfeature_sense_id',
        'bridge.position'
      ])
      .whereRef('feature_id', '=', 'id')
      .orderBy('bridge.position', 'asc')),
    spells: subfeatureSpells(eb, (eb2) => eb2
      .selectFrom('feature_subfeature_spells as bridge')
      .select([
        'bridge.subfeature_spell_id',
        'bridge.position'
      ])
      .whereRef('feature_id', '=', 'id')
      .orderBy('bridge.position', 'asc')),
    prerequisites: prerequisites(eb, (eb2) => eb2
      .selectFrom('feature_prerequisites as bridge')
      .select(['bridge.prerequisite_id'])
      .whereRef('bridge.feature_id', '=', 'id')
      .orderBy('bridge.position', 'asc')),
    optionsByLevel: featureOptionsByLevel(eb),
    levelAvailable: eb
      .selectFrom('feature_levels')
      .whereRef('feature_id', '=', 'id')
      .select((eb2) => [
        eb2.fn.agg<string>('string_agg', [
          eb2.ref('level').$castTo<string>(),
          sql`', '`
        ]).as('value')
      ])
      .$asScalar(),
    position: opts?.position ?? sql<null>`null`
  })
}
