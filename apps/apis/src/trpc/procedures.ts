import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import { toAuthoredValidationIssues } from '@artificer-toolkit/schema/api/content'
import { requireUserId, type TrpcContext } from './dbContext.js'

const authoredValidationMutationPathPattern =
  /^content\.(backgrounds|classes|creatures|equipment|feats|races|spells|vehicles)\.(activate|activateDraft|saveDraft)$/

const t = initTRPC.context<TrpcContext>().create({
  errorFormatter: ({ error, path, shape }) => {
    const validationIssues =
      Boolean(path && authoredValidationMutationPathPattern.test(path)) &&
      (error.code === 'BAD_REQUEST' || error.code === 'UNPROCESSABLE_CONTENT') &&
      error.cause instanceof z.ZodError
        ? toAuthoredValidationIssues(error.cause.issues)
        : undefined

    return {
      ...shape,
      data: {
        ...shape.data,
        ...(validationIssues ? { validationIssues } : {})
      }
    }
  }
})

export const createTRPCRouter = t.router
export const publicProcedure = t.procedure

const API_PROCEDURE_TRACE_ENV = 'ARTIFICER_API_PROCEDURE_TRACE'
const procedureCounts = new Map<string, number>()
const runtimeGlobals = globalThis as typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>
  }
}

function shouldTraceApiProcedure(): boolean {
  return runtimeGlobals.process?.env?.[API_PROCEDURE_TRACE_ENV] === '1'
}

function nextProcedureCount(path: string): number {
  const count = (procedureCounts.get(path) ?? 0) + 1
  procedureCounts.set(path, count)
  return count
}

export const authenticatedProcedure = t.procedure.use(async ({ ctx, next, path, type }) => {
  requireUserId(ctx)
  if (ctx.invitationSetupPending) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Complete account setup before using product data.'
    })
  }

  const startedAt = Date.now()
  const result = await next({ ctx })

  if (shouldTraceApiProcedure()) {
    console.info(
      '[artificer-api-procedure]',
      JSON.stringify({
        count: nextProcedureCount(path),
        durationMs: Date.now() - startedAt,
        ok: result.ok,
        path,
        type
      })
    )
  }

  return result
})

export const idInputSchema = z.object({
  id: z.string().min(1)
})

export const okResponseSchema = z.object({
  ok: z.literal(true)
})
