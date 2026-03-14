import type { DBLike } from '#types'
import type { CharacterAuthored } from '@artificer-toolkit/shared'

export async function upsertCharacter(
  _db: DBLike,
  json_data: CharacterAuthored
) {
  throw new Error(
    `Kysely character upsert is not implemented yet for character ${json_data.id}. ` +
    'The legacy SQL upsert function was removed as part of the Phase 4 Kysely-first migration.'
  )
}
