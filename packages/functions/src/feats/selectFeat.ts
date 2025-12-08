import type { Database } from '@artificer/db'
import type { Feat } from '@artificer/shared/types'
import { type ExpressionBuilder, type RawBuilder, sql } from 'kysely'
import { jsonBuildObject } from 'kysely/helpers/postgres'
import { features } from '@functions/features'
import { actions, damage, charges, range, shape, prerequisites, saveDc } from '@functions/fragments'
import { subfeatureProficiencies } from '@functions/subfeatureProficiencies'
import { subfeatureModifiers } from '@functions/subfeatureModifiers'
import { subfeatureExpertise } from '@functions/subfeatureExpertise'
import { subfeatureSenses } from '@functions/subfeatureSenses'
import { subfeatureSpells } from '@functions/subfeatureSpells'

export function selectFeat(eb: ExpressionBuilder<Database, 'feats'>): RawBuilder<Feat> {
  return jsonBuildObject({
    id: eb.ref('id'),
    label: eb.ref('label'),
    description: eb.ref('description'),
    detail: eb.ref('detail'),
    attributeIds: eb
      .selectFrom('feat_attributes')
      .whereRef('feat_id', '=', 'id')
      .select((eb2) => [
        eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
          eb2.ref('attribute_id')
        ]), sql<string[]>`'[]'::jsonb`).as('value')
      ])
      .$asScalar(),
    actions: actions(eb),
    damage: damage(eb),
    charges: charges(eb),
    range: range(eb),
    shape: shape(eb),
    targets: eb.ref('targets'),
    modifiers: subfeatureModifiers(eb, (eb2) => eb2
      .selectFrom('feat_subfeature_modifiers as bridge')
      .select([
        'bridge.subfeature_modifier_id',
        'bridge.position'
      ])
      .whereRef('feat_id', '=', 'id')
      .orderBy('bridge.position', 'asc')),
    proficiencies: subfeatureProficiencies(eb, (eb2) => eb2
      .selectFrom('feat_subfeature_proficiencies as bridge')
      .select([
        'bridge.subfeature_proficiency_id',
        'bridge.position'
      ])
      .whereRef('feat_id', '=', 'id')
      .orderBy('bridge.position', 'asc')),
    expertise: subfeatureExpertise(eb, (eb2) => eb2
      .selectFrom('feat_subfeature_expertise as bridge')
      .select([
        'bridge.subfeature_expertise_id',
        'bridge.position'
      ])
      .whereRef('feat_id', '=', 'id')
      .orderBy('bridge.position', 'asc')),
    senses: subfeatureSenses(eb, (eb2) => eb2
      .selectFrom('feat_subfeature_senses as bridge')
      .select([
        'bridge.subfeature_sense_id',
        'bridge.position'
      ])
      .whereRef('feat_id', '=', 'id')
      .orderBy('bridge.position', 'asc')),
    spells: subfeatureSpells(eb, (eb2) => eb2
      .selectFrom('feat_subfeature_spells as bridge')
      .select([
        'bridge.subfeature_spell_id',
        'bridge.position'
      ])
      .whereRef('feat_id', '=', 'id')
      .orderBy('bridge.position', 'asc')),
    prerequisites: prerequisites(eb, (eb2) => eb2
      .selectFrom('feat_prerequisites as bridge')
      .select([
        'bridge.prerequisite_id',
        'bridge.position'
      ])
      .whereRef('feat_id', '=', 'id')
      .orderBy('bridge.position', 'asc')),
    saveDc: saveDc(eb),
    selectionCount: eb.ref('selection_count'),
    levelAvailable: eb.ref('level_available'),
    features: features(eb, (eb2) => eb2
      .selectFrom('feat_features as bridge')
      .select([
        'bridge.feature_id',
        'bridge.position'
      ])
      .whereRef('feat_id', '=', 'id')
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
