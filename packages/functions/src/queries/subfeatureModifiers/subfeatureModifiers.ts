import type { Database } from '@artificer-toolkit/db/types'
import type { SubfeatureModifier } from '@artificer-toolkit/shared/types'
import { type ExpressionBuilder, type RawBuilder, type SelectQueryBuilder } from 'kysely'
import { jsonArrayFrom } from 'kysely/helpers/postgres'
import { selectSubfeatureModifier } from './selectSubfeatureModifier.js'

export function subfeatureModifiers(
  ebX: ExpressionBuilder<Database, keyof Database>,
  fn: (
    eb2: ExpressionBuilder<Database, keyof Database>
  ) => SelectQueryBuilder<
    Database,
    keyof Database,
    { subfeature_modifier_id: string, position: number | null }
  >
): RawBuilder<SubfeatureModifier[]> {
  const source = fn(ebX)
  const subquery = ebX
    .selectFrom('subfeature_modifiers')
    .innerJoin(
      source.as('bridge'),
      'bridge.subfeature_modifier_id',
      'subfeature_modifiers.id'
    )
    .select((eb) => [
      selectSubfeatureModifier(eb, { position: eb.ref('bridge.position') }).as('value')
    ])
    .$asScalar()

  return jsonArrayFrom<SubfeatureModifier>(subquery)
}
