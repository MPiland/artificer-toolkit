import { sql } from 'kysely'

import type { DBLike } from '#types'

export async function requireDefaultUserContentSource(
  db: DBLike,
  gameSystemId: string,
  userId: string
): Promise<string> {
  const result = await sql<{ id: string }>`
    INSERT INTO public.content_sources (
      game_system_id, kind, owner_user_id, code, label, description
    ) VALUES (
      ${gameSystemId}::uuid, 'USER', ${userId}::uuid, 'default', 'Default homebrew source', NULL
    )
    ON CONFLICT (game_system_id, owner_user_id) WHERE kind = 'USER' AND code = 'default'
    DO UPDATE SET updated_at = public.content_sources.updated_at
    RETURNING id
  `.execute(db)
  const source = result.rows[0]
  if (!source) throw new Error('Failed to resolve the default homebrew Content Source.')
  return source.id
}
