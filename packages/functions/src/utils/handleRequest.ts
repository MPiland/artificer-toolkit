import type { DBLike } from '@artificer-toolkit/db'
import { createDb, withUserContext } from '@artificer-toolkit/db'
import { createSupabaseClient } from '../clients/supabaseClient.js'

/**
 * Generic wrapper for authenticated RLS-safe requests.
 */
// packages/functions/src/utils/handleRequest.ts
export function handleRequest<TArgs extends unknown[], TResult>(
  queryFn: (db: DBLike, ...args: TArgs) => Promise<TResult>,
  getArgs: (req: Request) => TArgs
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

      // 2. Extract typed args for this route
      const args = getArgs(req)

      // 3. Create DB + run inside RLS-impersonated session
      const db = createDb()

      try {
        const result = await withUserContext(db, userId, (ctx) => queryFn(ctx, ...args))

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
