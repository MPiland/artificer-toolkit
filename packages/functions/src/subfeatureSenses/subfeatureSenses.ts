import type { Database } from '@artificer/db'
import type { SubfeatureSense } from '@artificer/shared/types'
import { type ExpressionBuilder, type RawBuilder, type SelectQueryBuilder } from 'kysely'
import { jsonArrayFrom } from 'kysely/helpers/postgres'
import { selectSubfeatureSense } from './selectSubfeatureSense'

export function subfeatureSenses(
  ebX: ExpressionBuilder<Database, keyof Database>,
  fn: (
    eb2: ExpressionBuilder<Database, keyof Database>
  ) => SelectQueryBuilder<
    Database,
    keyof Database,
    { subfeature_sense_id: string, position: number | null }
  >
): RawBuilder<SubfeatureSense[]> {
  const source = fn(ebX)
  const subquery = ebX
    .selectFrom('subfeature_senses')
    .innerJoin(
      source.as('bridge'),
      'bridge.subfeature_sense_id',
      'subfeature_senses.id'
    )
    .select((eb) => [
      selectSubfeatureSense(eb, { position: eb.ref('bridge.position') }).as('value')
    ])
    .$asScalar()

  return jsonArrayFrom<SubfeatureSense>(subquery)
}
