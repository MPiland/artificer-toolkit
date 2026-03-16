import type { DBLike } from '@artificer-toolkit/db'
import { createDb, withUserContext } from '@artificer-toolkit/db'
import { createSupabaseClient } from '../clients/supabaseClient.js'

/**
 * Generic wrapper for authenticated RLS-safe authoring requests (POST/PUT).
 * Parses the request body, authenticates, sets RLS context, then runs the handler.
 * Phase 7 replaces the identity parseBody with Zod schema parsing.
 */
export function handleAuthoringRequest<TBody, TResult>(
  handler: (db: DBLike, body: TBody, userId: string) => Promise<TResult>,
  parseBody: (raw: unknown) => TBody
) {
  return async (req: Request): Promise<Response> => {
    try {
      // 1. Auth
      const jwt = req.headers.get('authorization')?.replace('Bearer ', '')
      if (!jwt) return new Response('Missing token', { status: 401 })

      const supabase = createSupabaseClient()
      const { data, error } = await supabase.auth.getUser(jwt)
      if (error || !data.user) return new Response('Unauthorized', { status: 401 })

      const userId = data.user.id

      // 2. Parse body
      const raw = await req.json()
      const body = parseBody(raw)

      // 3. Create DB + run inside RLS-impersonated session
      const db = createDb()

      try {
        const result = await withUserContext(db, userId, (ctx) => handler(ctx, body, userId))

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      } finally {
        await db.destroy()
      }
    } catch (err) {
      console.error(err)
      return new Response('Internal Server Error', { status: 500 })
    }
  }
}
