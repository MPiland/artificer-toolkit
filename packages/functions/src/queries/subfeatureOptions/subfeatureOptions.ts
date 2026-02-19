import type { Database } from '@artificer-toolkit/db/types'
import type { SubfeatureOption } from '@artificer-toolkit/shared/types'
import type { ExpressionBuilder, RawBuilder, SelectQueryBuilder } from 'kysely'
import { jsonArrayFrom } from 'kysely/helpers/postgres'
import { selectSubfeatureOption } from './selectSubfeatureOption.js'

export function subfeatureOptions(
  ebX: ExpressionBuilder<Database, keyof Database>,
  fn: (
    eb2: ExpressionBuilder<Database, keyof Database>
  ) => SelectQueryBuilder<
    Database,
    keyof Database,
    { subfeature_option_id: string, position: number | null }
  >
): RawBuilder<SubfeatureOption[]> {
  const source = fn(ebX)
  const subquery = ebX
    .selectFrom('subfeature_options')
    .innerJoin(
      source.as('bridge'),
      'bridge.subfeature_option_id',
      'subfeature_options.id'
    )
    .select((eb) => [
      selectSubfeatureOption(eb, { position: eb.ref('bridge.position') }).as('value')
    ])
    .$asScalar()

  return jsonArrayFrom<SubfeatureOption>(subquery)
}
