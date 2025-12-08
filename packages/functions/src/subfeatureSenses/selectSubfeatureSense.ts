import type { Database } from '@artificer/db'
import type { SubfeatureSense } from '@artificer/shared/types'
import { prerequisites } from '@functions/fragments'
import { type ExpressionBuilder, type Expression, type RawBuilder, sql } from 'kysely'
import { jsonBuildObject } from 'kysely/helpers/postgres'

export function selectSubfeatureSense(eb: ExpressionBuilder<Database, 'subfeature_senses'>, opts?: { position?: Expression<number | null> }): RawBuilder<SubfeatureSense> {
  return jsonBuildObject({
    id: eb.ref('id'),
    subtypeId: eb.ref('subtype_id'),
    selectionCount: eb.ref('selection_count'),
    attributeIds:
        eb
          .selectFrom('subfeature_sense_attributes')
          .where(({ eb: eb2, and }) => and([
            eb2(eb2.ref('subfeature_sense_id'), '=', eb.ref('id')),
            eb2(eb2.ref('attribute_id'), 'is not', null)
          ]))
          .select((eb2) => [
            eb2.fn.coalesce(
              eb2.fn.agg<string[]>('json_agg', [
                'attribute_id'
              ]),
              sql<string[]>`'[]'::jsonb`
            ).as('value')
          ])
          .$asScalar(),
    senseIds: eb
      .selectFrom('subfeature_sense_senses')
      .whereRef('subfeature_sense_id', '=', eb.ref('id'))
      .select((eb2) => [
        eb2.fn.coalesce(eb2.fn.agg<string[]>('json_agg', [
          eb2
            .case()
            .when(eb.ref('use_all'), '=', true)
            .then('all')
            .else(eb2.ref('sense_id'))
            .end()
        ]), sql<string[]>`'[]'::jsonb`).as('value')
      ])
      .$asScalar(),
    prerequisites: prerequisites(eb, (eb2) => eb2
      .selectFrom('subfeature_sense_prerequisites as bridge')
      .select([
        'bridge.prerequisite_id'
      ])
      .whereRef('bridge.subfeature_sense_id', '=', 'id')),
    position: opts?.position ?? sql<null>`null`
  })
}
