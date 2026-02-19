import type { Database } from '@artificer-toolkit/db/types'
import type { SubfeatureExpertise } from '@artificer-toolkit/shared/types'
import { type ExpressionBuilder, type RawBuilder, type SelectQueryBuilder } from 'kysely'
import { jsonArrayFrom } from 'kysely/helpers/postgres'
import { selectSubfeatureExpertise } from './selectSubfeatureExpertise.js'

export function subfeatureExpertise(
  ebX: ExpressionBuilder<Database, keyof Database>,
  fn: (
    eb2: ExpressionBuilder<Database, keyof Database>
  ) => SelectQueryBuilder<
    Database,
    keyof Database,
    { subfeature_expertise_id: string, position: number | null }
  >
): RawBuilder<SubfeatureExpertise[]> {
  const source = fn(ebX)
  const subquery = ebX
    .selectFrom('subfeature_expertise')
    .innerJoin(
      source.as('bridge'),
      'bridge.subfeature_expertise_id',
      'subfeature_expertise.id'
    )
    .select((eb) => [
      selectSubfeatureExpertise(eb, { position: eb.ref('bridge.position') }).as('value')
    ])
    .$asScalar()

  return jsonArrayFrom<SubfeatureExpertise>(subquery)
}
