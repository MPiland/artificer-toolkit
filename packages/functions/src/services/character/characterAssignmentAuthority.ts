import { sql } from 'kysely'

import type { DBLike } from '@artificer-toolkit/db'

/**
 * Serializes the no-row-yet assignment decision for one Character. This is
 * intentionally not an aggregate or occurrence lock: it exists solely while
 * there is no assignment row to lock.
 */
export async function lockCharacterAssignmentAuthority(
  db: DBLike,
  characterId: string
): Promise<void> {
  await sql`
    select pg_advisory_xact_lock(
      hashtextextended(
        'character-assignment-authority:' || ${characterId}::uuid::text,
        0
      )
    )
  `.execute(db)
}
