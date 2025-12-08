import type { Database } from '@artificer/db'
import type { SubfeatureFeat } from '@artificer/shared/types'
import { type ExpressionBuilder, type RawBuilder, type SelectQueryBuilder } from 'kysely'
import { jsonArrayFrom } from 'kysely/helpers/postgres'
import { selectSubfeatureFeat } from './selectSubfeatureFeat'

export function subfeatureFeats(
  ebX: ExpressionBuilder<Database, keyof Database>,
  fn: (
    eb2: ExpressionBuilder<Database, keyof Database>
  ) => SelectQueryBuilder<
    Database,
    keyof Database,
    { subfeature_feat_id: string, position: number | null }
  >
): RawBuilder<SubfeatureFeat[]> {
  const source = fn(ebX)
  const subquery = ebX
    .selectFrom('subfeature_feats')
    .innerJoin(
      source.as('bridge'),
      'bridge.subfeature_feat_id',
      'subfeature_feats.id'
    )
    .select((eb) => [
      selectSubfeatureFeat(eb, { position: eb.ref('bridge.position') }).as('value')
    ])
    .$asScalar()

  return jsonArrayFrom<SubfeatureFeat>(subquery)
}
