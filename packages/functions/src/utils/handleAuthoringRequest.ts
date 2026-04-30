import { ZodError, type ZodType } from 'zod'
import type { DBLike } from '@artificer-toolkit/db'
import { createDb, withUserContext } from '@artificer-toolkit/db'
import { createSupabaseClient } from '../clients/supabaseClient.js'

function validationErrorResponse(issues: unknown): Response {
  return new Response(
    JSON.stringify({ error: 'Validation failed', issues }),
    { status: 422, headers: { 'Content-Type': 'application/json' } }
  )
}

type AuthoringHandler<TBody, TResult> = (
  db: DBLike,
  body: TBody,
  userId: string,
  req: Request
) => Promise<TResult>

/**
 * Generic wrapper for authenticated RLS-safe authoring requests (POST/PUT).
 *
 * Two call signatures:
 *   handleAuthoringRequest(schema, handler)   — Zod schema validates body, returns 422 on failure
 *   handleAuthoringRequest(handler, parseBody) — legacy identity-function form (kept for compat)
 */
export function handleAuthoringRequest<TBody, TResult>(
  schema: ZodType<TBody>,
  handler: AuthoringHandler<TBody, TResult>
): (req: Request) => Promise<Response>
export function handleAuthoringRequest<TBody, TResult>(
  handler: AuthoringHandler<TBody, TResult>,
  parseBody: (raw: unknown) => TBody
): (req: Request) => Promise<Response>
export function handleAuthoringRequest<TBody, TResult>(
  schemaOrHandler: ZodType<TBody> | AuthoringHandler<TBody, TResult>,
  handlerOrParseBody: AuthoringHandler<TBody, TResult> | ((raw: unknown) => TBody)
): (req: Request) => Promise<Response> {
  // Determine which overload was called
  const isZodSchema = schemaOrHandler != null && typeof (schemaOrHandler as ZodType<TBody>).parse === 'function'

  const handler = isZodSchema
    ? (handlerOrParseBody as AuthoringHandler<TBody, TResult>)
    : (schemaOrHandler as AuthoringHandler<TBody, TResult>)

  const parseBody = isZodSchema
    ? null
    : (handlerOrParseBody as (raw: unknown) => TBody)

  const schema = isZodSchema
    ? (schemaOrHandler as ZodType<TBody>)
    : null

  return async (req: Request): Promise<Response> => {
    try {
      // 1. Auth
      const jwt = req.headers.get('authorization')?.replace('Bearer ', '')
      if (!jwt) return new Response('Missing token', { status: 401 })

      const supabase = createSupabaseClient()
      const { data, error } = await supabase.auth.getUser(jwt)
      if (error || !data.user) return new Response('Unauthorized', { status: 401 })

      const userId = data.user.id

      // 2. Parse and validate body
      const raw = await req.json()
      let body: TBody

      if (schema) {
        const result = schema.safeParse(raw)
        if (!result.success) return validationErrorResponse(result.error.issues)
        body = result.data
      } else {
        body = parseBody!(raw)
      }

      // 3. Create DB + run inside RLS-impersonated session
      const db = createDb()
      try {
        const result = await withUserContext(db, userId, (ctx) => handler(ctx, body, userId, req))
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      } finally {
        await db.destroy()
      }
    } catch (err) {
      if (err instanceof ZodError) {
        return validationErrorResponse(err.issues)
      }

      if (err instanceof Error && err.name === 'NodeRuntimeInputError') {
        return new Response(
          JSON.stringify({ error: err.message }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      if (err instanceof Error && err.name === 'AuthoredDraftNotFoundError') {
        return new Response(
          JSON.stringify({ error: err.message }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        )
      }

      if (err instanceof Error && err.name === 'AuthoredDraftSubjectMismatchError') {
        return validationErrorResponse([
          {
            code: 'custom',
            path: ['subjectId'],
            message: err.message
          }
        ])
      }

      console.error(err)
      return new Response('Internal Server Error', { status: 500 })
    }
  }
}
