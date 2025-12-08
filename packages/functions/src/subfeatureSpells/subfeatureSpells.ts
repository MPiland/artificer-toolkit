import type { Database } from '@artificer/db'
import type { SubfeatureSpell } from '@artificer/shared/types'
import { type ExpressionBuilder, type RawBuilder, type SelectQueryBuilder } from 'kysely'
import { jsonArrayFrom } from 'kysely/helpers/postgres'
import { selectSubfeatureSpell } from './selectSubfeatureSpell'

export function subfeatureSpells(
  ebX: ExpressionBuilder<Database, keyof Database>,
  fn: (
    eb2: ExpressionBuilder<Database, keyof Database>
  ) => SelectQueryBuilder<
    Database,
    keyof Database,
    { subfeature_spell_id: string, position: number | null }
  >
): RawBuilder<SubfeatureSpell[]> {
  const source = fn(ebX)
  const subquery = ebX
    .selectFrom('subfeature_spells')
    .innerJoin(
      source.as('bridge'),
      'bridge.subfeature_spell_id',
      'subfeature_spells.id'
    )
    .select((eb) => [
      selectSubfeatureSpell(eb, { position: eb.ref('bridge.position') }).as('value')
    ])
    .$asScalar()

  return jsonArrayFrom<SubfeatureSpell>(subquery)
}
