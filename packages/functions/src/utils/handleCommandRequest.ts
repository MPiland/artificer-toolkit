import type { ZodType } from 'zod'
import { createDb, withUserContext } from '@artificer-toolkit/db'
import { ConcurrencyError } from '@artificer-toolkit/db'
import { createSupabaseClient } from '../clients/supabaseClient.js'
import { NotFoundError } from '../services/character/lifecycleService.js'

/**
 * Wrapper for the single character command dispatch route.
 *
 * Extracts `:id` from the URL path (last segment before /commands),
 * reads `expectedVersion` from the validated body, and delegates to
 * the provided dispatch function.
 *
 * HTTP status mapping:
 *   200 — command accepted, returns { newState, events }
 *   401 — missing or invalid token
 *   404 — character not found or not initialized
 *   409 — stream_version conflict (concurrent command)
 *   422 — Zod validation failure
 *   500 — unexpected error
 */
export function handleCommandRequest<TCommand extends { expectedVersion: number }>(
  schema: ZodType<TCommand>,
  dispatchFn: (
    characterId: string,
    expectedVersion: number,
    command: TCommand,
    db: import('@artificer-toolkit/db').DBLike
  ) => Promise<unknown>
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

      // 2. Extract character ID from path (…/characters/:id/commands)
      const url = new URL(req.url)
      const segments = url.pathname.split('/').filter(Boolean)
      const commandsIdx = segments.lastIndexOf('commands')
      const characterId = commandsIdx > 0 ? segments[commandsIdx - 1] : undefined
      if (!characterId) {
        return new Response(
          JSON.stringify({ error: 'Could not resolve character ID from path' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // 3. Validate body
      const raw = await req.json()
      const parsed = schema.safeParse(raw)
      if (!parsed.success) {
        return new Response(
          JSON.stringify({ error: 'Validation failed', issues: parsed.error.issues }),
          { status: 422, headers: { 'Content-Type': 'application/json' } }
        )
      }

      const command = parsed.data

      // 4. Dispatch inside RLS session
      const db = createDb()
      try {
        const result = await withUserContext(db, userId, (ctx) =>
          dispatchFn(characterId, command.expectedVersion, command, ctx)
        )
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      } finally {
        await db.destroy()
      }
    } catch (err) {
      if (err instanceof NotFoundError) {
        return new Response(
          JSON.stringify({ error: err.message }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        )
      }
      if (err instanceof ConcurrencyError) {
        return new Response(
          JSON.stringify({ error: err.message }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        )
      }
      console.error(err)
      return new Response('Internal Server Error', { status: 500 })
    }
  }
}
