import type { Database } from '#types'
import type { DetailAuthored } from '@artificer-toolkit/shared'
import type { ExpressionBuilder, RawBuilder, SelectQueryBuilder, Expression } from 'kysely'
import { jsonArrayFrom, jsonBuildObject } from 'kysely/helpers/postgres'

function selectDetail(
  eb: ExpressionBuilder<Database, 'details'>,
  opts: { position: Expression<number> }
): RawBuilder<DetailAuthored> {
  return jsonBuildObject({
    id: eb.ref('id'),
    label: eb.ref('label'),
    description: eb.ref('description'),
    order: opts.position
  })
}

export function details(
  ebX: ExpressionBuilder<Database, keyof Database>,
  fn: (
    eb2: ExpressionBuilder<Database, keyof Database>
  ) => SelectQueryBuilder<Database, keyof Database, { detail_id: string; position: number }>
): RawBuilder<DetailAuthored[]> {
  const source = fn(ebX)

  const subquery = ebX
    .selectFrom('details')
    .innerJoin(source.as('bridge'), 'bridge.detail_id', 'details.id')
    .select((eb) => [selectDetail(eb, { position: eb.ref('bridge.position') }).as('value')])
    .$asScalar()

  return jsonArrayFrom<DetailAuthored>(subquery)
}
