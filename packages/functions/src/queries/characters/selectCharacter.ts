import type { Database } from '@artificer-toolkit/db'
import type { Character } from '@artificer-toolkit/shared'
import type { ExpressionBuilder, RawBuilder } from 'kysely'
import { jsonObjectFrom } from 'kysely/helpers/postgres'

export function selectCharacter(eb: ExpressionBuilder<Database, 'characters'>): RawBuilder<Character> {
  return jsonObjectFrom({
    id: eb.ref('id'),
    label: eb.ref('label'),
    description: eb.ref('description'),
    advancementId: eb.ref('advancement_id')
  })
}
