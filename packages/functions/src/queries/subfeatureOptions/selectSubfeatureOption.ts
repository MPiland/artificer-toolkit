import type { Database } from '@artificer-toolkit/db/types'
import type { SubfeatureOption } from '@artificer-toolkit/shared/types'
import { type ExpressionBuilder, sql, type RawBuilder, type Expression } from 'kysely'
import { jsonArrayFrom, jsonBuildObject } from 'kysely/helpers/postgres'
import { range, shape, actions, charges, damage, saveDc, prerequisites } from '#queries/fragments'
import { subfeatureFeats } from '#queries/subfeatureFeats'
import { subfeatureModifiers } from '#queries/subfeatureModifiers'
import { subfeatureProficiencies } from '#queries/subfeatureProficiencies'
import { subfeatureExpertise } from '#queries/subfeatureExpertise'
import { subfeatureSenses } from '#queries/subfeatureSenses'
import { subfeatureSpells } from '#queries/subfeatureSpells'

export function selectSubfeatureOption(eb: ExpressionBuilder<Database, 'subfeature_options'>, opts?: { position?: Expression<number | null> }): RawBuilder<SubfeatureOption> {
  return jsonBuildObject ({
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
    feats: subfeatureFeats(eb, (eb2) => eb2
      .selectFrom('subfeature_option_subfeature_feats as bridge')
      .select([
        'bridge.subfeature_feat_id',
        'bridge.position'
      ])
      .whereRef('subfeature_option_id', '=', 'id')
      .orderBy('bridge.position', 'asc')),
    modifiers: subfeatureModifiers(eb, (eb2) => eb2
      .selectFrom('subfeature_option_subfeature_modifiers as bridge')
      .select([
        'bridge.subfeature_modifier_id',
        'bridge.position'
      ])
      .whereRef('subfeature_option_id', '=', 'id')
      .orderBy('bridge.position', 'asc')),
    proficiencies: subfeatureProficiencies(eb, (eb2) => eb2
      .selectFrom('subfeature_option_subfeature_proficiencies as bridge')
      .select([
        'bridge.subfeature_proficiency_id',
        'bridge.position'
      ])
      .whereRef('subfeature_option_id', '=', 'id')
      .orderBy('bridge.position', 'asc')),
    expertise: subfeatureExpertise(eb, (eb2) => eb2
      .selectFrom('subfeature_option_subfeature_expertise as bridge')
      .select([
        'bridge.subfeature_expertise_id',
        'bridge.position'
      ])
      .whereRef('subfeature_option_id', '=', 'id')
      .orderBy('bridge.position', 'asc')),
    senses: subfeatureSenses(eb, (eb2) => eb2
      .selectFrom('subfeature_option_subfeature_senses as bridge')
      .select([
        'bridge.subfeature_sense_id',
        'bridge.position'
      ])
      .whereRef('subfeature_option_id', '=', 'id')
      .orderBy('bridge.position', 'asc')),
    spells: subfeatureSpells(eb, (eb2) => eb2
      .selectFrom('subfeature_option_subfeature_spells as bridge')
      .select([
        'bridge.subfeature_spell_id',
        'bridge.position'
      ])
      .whereRef('subfeature_option_id', '=', 'id')
      .orderBy('bridge.position', 'asc')),
    prerequisites: prerequisites(eb, (eb2) => eb2
      .selectFrom('subfeature_option_prerequisites as bridge')
      .select([
        'bridge.prerequisite_id',
        'bridge.position'
      ])
      .whereRef('bridge.subfeature_option_id', '=', 'id')
      .orderBy('bridge.position', 'asc')),
    position: opts?.position ?? sql<null>`null`
  })
}
