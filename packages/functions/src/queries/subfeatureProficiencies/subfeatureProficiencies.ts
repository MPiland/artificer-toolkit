import type { Database } from '@artificer-toolkit/db/types'
import type { SubfeatureProficiency } from '@artificer-toolkit/shared/types'
import { type ExpressionBuilder, type RawBuilder, type SelectQueryBuilder } from 'kysely'
import { jsonArrayFrom } from 'kysely/helpers/postgres'
import { selectSubfeatureProficiency } from './selectSubfeatureProficiency.js'

export function subfeatureProficiencies(
  ebX: ExpressionBuilder<Database, keyof Database>,
  fn: (
    eb2: ExpressionBuilder<Database, keyof Database>
  ) => SelectQueryBuilder<
    Database,
    keyof Database,
    { subfeature_proficiency_id: string, position: number | null }
  >
): RawBuilder<SubfeatureProficiency[]> {
  const source = fn(ebX)
  const subquery = ebX
    .selectFrom('subfeature_proficiencies')
    .innerJoin(
      source.as('bridge'),
      'bridge.subfeature_proficiency_id',
      'subfeature_proficiencies.id'
    )
    .select((eb) => [
      selectSubfeatureProficiency(eb, { position: eb.ref('bridge.position') }).as('value')
    ])
    .$asScalar()

  return jsonArrayFrom<SubfeatureProficiency>(subquery)
}
