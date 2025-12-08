import type { Database } from '@artificer/db'
import type { SubfeatureFeat } from '@artificer/shared/types'
import { prerequisites } from '@functions/fragments'
import { sql, type Expression, type RawBuilder, type ExpressionBuilder } from 'kysely'
import { jsonBuildObject } from 'kysely/helpers/postgres'

export function selectSubfeatureFeat(eb: ExpressionBuilder<Database, 'subfeature_feats'>, opts?: { position?: Expression<number | null> }): RawBuilder<SubfeatureFeat> {
  return jsonBuildObject({
    id: eb.ref('id'),
    selectionCount: eb.ref('selection_count'),
    subtypeId: eb.ref('subtype_id'),
    featIds:
      eb
        .selectFrom('subfeature_feat_feats')
        .where(({ eb: eb2, and }) => and([
          eb2(eb2.ref('subfeature_feat_id'), '=', eb.ref('id')),
          eb2(eb2.ref('feat_id'), 'is not', null)
        ]))
        .select((eb2) => [
          eb2.fn.coalesce(eb2.fn.agg<string[]>('array_agg', [
            eb2
              .case()
              .when(eb.ref('use_all'), '=', true)
              .then('all')
              .else(eb2.ref('feat_id'))
              .end()
              .$notNull()
          ]), sql<string[]>`'{}'::text[]`).as('value')
        ])
        .$asScalar(),
    attributeIds:
      eb
        .selectFrom('subfeature_feat_attributes')
        .where(({ eb: eb2, and }) => and([
          eb2(eb2.ref('subfeature_feat_id'), '=', eb.ref('id')),
          eb2(eb2.ref('attribute_id'), 'is not', null)
        ]))
        .select((eb2) => [
          eb2.fn.coalesce(eb2.fn.agg<string[]>('array_agg', [
            eb2
              .case()
              .when(eb.ref('use_all'), '=', true)
              .then('all')
              .else(eb2.ref('attribute_id'))
              .end()
              .$notNull()
          ]), sql<string[]>`'{}'::text[]`).as('value')
        ])
        .$asScalar(),
    prerequisites: prerequisites(eb, (eb2) => eb2
      .selectFrom('subfeature_proficiency_prerequisites as bridge')
      .select([
        'bridge.prerequisite_id'
      ])
      .whereRef('bridge.subfeature_proficiency_id', '=', 'id')),
    position: opts?.position ?? sql<null>`null`
  })
}
