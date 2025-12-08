import { createDb, withUserContext } from '@artificer/db'
import { createSupabaseClient } from '../clients/supabaseClient'

/**
 * Generic wrapper for authenticated RLS-safe requests.
 *
 * @param queryFn A function that receives a Kysely instance and returns a Promise of query results.
 */
export function handleRequest<T>(queryFn: (ctx: any, userId: string) => Promise<T>) {
  return async (req: Request): Promise<Response> => {
    try {
      // Extract and verify JWT
      const jwt = req.headers.get('authorization')?.replace('Bearer ', '')
      if (!jwt) return new Response('Missing token', { status: 401 })

      const supabase = createSupabaseClient()
      const { data, error } = await supabase.auth.getUser(jwt)
      if (error || !data.user) return new Response('Unauthorized', { status: 401 })

      // Run the query inside RLS context
      const db = createDb()
      try {
        const result = await withUserContext(db, data.user.id, (ctx) => queryFn(ctx, data.user.id))
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      } finally {
        await db.destroy()
      }
    } catch (err: any) {
      console.error(err)
      return new Response('Internal Server Error', { status: 500 })
    }
  }
}
