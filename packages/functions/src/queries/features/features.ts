import { Database } from '@artificer-toolkit/db'
import type { Feature } from '@artificer-toolkit/shared/types'
import { type ExpressionBuilder, type RawBuilder, type SelectQueryBuilder } from 'kysely'
import { jsonArrayFrom } from 'kysely/helpers/postgres'
import { selectFeature } from './selectFeature.js'

export function features(
  ebX: ExpressionBuilder<Database, keyof Database>,
  fn: (
    eb2: ExpressionBuilder<Database, keyof Database>
  ) => SelectQueryBuilder<
    Database,
    keyof Database,
    { feature_id: string, position: number | null }
  >
): RawBuilder<Feature[]> {
  const source = fn(ebX)
  const subquery = ebX
    .selectFrom('features')
    .innerJoin(
      source.as('bridge'),
      'bridge.feature_id',
      'features.id'
    )
    .select((eb) => [
      selectFeature(eb, { position: eb.ref('bridge.position') }).as('value')
    ])
    .$asScalar()

  return jsonArrayFrom<Feature>(subquery)
}
