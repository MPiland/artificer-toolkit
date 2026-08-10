import { ZodError, type ZodType } from 'zod'
import type { DBLike } from '@artificer-toolkit/db'
import { createDb, withUserContext } from '@artificer-toolkit/db'
import { resolveRequestUserId } from './requestUser.js'

function validationErrorResponse(issues: unknown): Response {
  return new Response(JSON.stringify({ error: 'Validation failed', issues }), {
    status: 422,
    headers: { 'Content-Type': 'application/json' }
  })
}

type AuthoringHandler<TBody, TResult> = (
  db: DBLike,
  body: TBody,
  userId: string,
  req: Request
) => Promise<TResult>

export function handleAuthoringRequest<TBody, TResult>(
  schema: ZodType<TBody>,
  handler: AuthoringHandler<TBody, TResult>
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    try {
      const userId = await resolveRequestUserId(req)
      if (!userId) return new Response('Unauthorized', { status: 401 })

      const raw = await req.json()
      const parsedBody = schema.safeParse(raw)
      if (!parsedBody.success) return validationErrorResponse(parsedBody.error.issues)

      const db = createDb()
      try {
        const result = await withUserContext(db, userId, (ctx) =>
          handler(ctx, parsedBody.data, userId, req)
        )
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      } finally {
        await db.destroy()
      }
    } catch (err) {
      if (err instanceof ZodError) {
        return validationErrorResponse(err.issues)
      }

      if (err instanceof Error && err.name === 'NodeRuntimeInputError') {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      if (err instanceof Error && err.name === 'AuthoredDraftNotFoundError') {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
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

      if (err instanceof Error && err.name === 'AuthoredContentOwnershipError') {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      if (err instanceof Error && err.name === 'CharacterBuilderDraftConflictError') {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      if (err instanceof Error && err.name === 'AuthoredContentConflictError') {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      if (err instanceof Error && err.name === 'AuthoredContentCreationRateLimitError') {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      if (err instanceof Error && err.name === 'NotFoundError') {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      if (err instanceof Error && err.name === 'ConcurrencyError') {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      if (err instanceof Error && err.name === 'CharacterSheetCommandError') {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      console.error(err)
      return new Response('Internal Server Error', { status: 500 })
    }
  }
}
