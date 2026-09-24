import { constantTimeEqual } from 'better-auth/crypto'
import { makeFunctionReference } from 'convex/server'
import { z } from 'zod'
import { httpAction } from '../_generated/server'

const bootstrap = makeFunctionReference<'query', JsonObject, unknown>(
  'liveSessions/bootstrap:bootstrap'
)
const activate = makeFunctionReference<'mutation', JsonObject, unknown>(
  'liveSessions/state:activate'
)
const publish = makeFunctionReference<'mutation', JsonObject, unknown>('liveSessions/state:publish')
const present = makeFunctionReference<'mutation', JsonObject, unknown>(
  'scenes/presentations:setFromRoom'
)
const beginDrain = makeFunctionReference<'mutation', JsonObject, unknown>(
  'liveSessions/authority:beginDrain'
)
const release = makeFunctionReference<'mutation', JsonObject, unknown>(
  'liveSessions/authority:release'
)
const characterRules = makeFunctionReference<'query', JsonObject, unknown>(
  'liveSessions/characterRulesCapture:capture'
)
const encounterRules = makeFunctionReference<'query', JsonObject, unknown>(
  'liveSessions/encounterRulesCapture:capture'
)
const encounterMovementBegin = makeFunctionReference<'mutation', JsonObject, unknown>(
  'liveSessions/encounterMovement:begin'
)
const encounterMovementPrepare = makeFunctionReference<'mutation', JsonObject, unknown>(
  'liveSessions/encounterMovement:prepare'
)
const encounterMovementCommit = makeFunctionReference<'mutation', JsonObject, unknown>(
  'liveSessions/encounterMovement:commit'
)
const encounterActionPending = makeFunctionReference<'mutation', JsonObject, unknown>(
  'liveSessions/encounterAction:commitPending'
)
const encounterTurnPending = makeFunctionReference<'mutation', JsonObject, unknown>(
  'liveSessions/encounterTurn:commitPending'
)
const encounterTurnCommit = makeFunctionReference<'mutation', JsonObject, unknown>(
  'liveSessions/encounterTurnCommit:commit'
)
const encounterActionCommit = makeFunctionReference<'mutation', JsonObject, unknown>(
  'liveSessions/encounterActionCommit:commit'
)
const encounterConcentrationCommit = makeFunctionReference<'mutation', JsonObject, unknown>(
  'liveSessions/encounterConcentrationCommit:commit'
)
const jsonObjectSchema = z.record(z.string(), z.json())
type JsonObject = z.infer<typeof jsonObjectSchema>
const noStore = { 'Cache-Control': 'no-store' }

export const bootstrapHttp = httpAction(async (ctx, request) => {
  const denied = await authorize(ctx, request, true)
  if (denied) return denied
  const input = await parseBody(request)
  if (input instanceof Response) return input
  try {
    const result = await ctx.runQuery(bootstrap, input)
    return jsonResponse(result)
  } catch {
    return textResponse('Live Session bootstrap unavailable.', 409)
  }
})

export const characterRulesHttp = httpAction(async (ctx, request) => {
  const denied = await authorize(ctx, request, true)
  if (denied) return denied
  const input = await parseBody(request)
  if (input instanceof Response) return input
  try {
    return jsonResponse(await ctx.runQuery(characterRules, input))
  } catch {
    return textResponse('Live Session Character inputs unavailable.', 409)
  }
})

export const encounterRulesHttp = httpAction(async (ctx, request) => {
  const denied = await authorize(ctx, request, true)
  if (denied) return denied
  const input = await parseBody(request)
  if (input instanceof Response) return input
  try {
    return jsonResponse(await ctx.runQuery(encounterRules, input))
  } catch {
    return textResponse('Live Session Encounter inputs unavailable.', 409)
  }
})

export const encounterMovementBeginHttp = httpAction(async (ctx, request) => {
  const denied = await authorize(ctx, request, true)
  if (denied) return denied
  const input = await parseBody(request)
  if (input instanceof Response) return input
  try {
    return jsonResponse(await ctx.runMutation(encounterMovementBegin, input))
  } catch {
    return textResponse('Live Session movement preparation unavailable.', 409)
  }
})

export const encounterMovementPrepareHttp = httpAction(async (ctx, request) => {
  const denied = await authorize(ctx, request, true)
  if (denied) return denied
  const input = await parseBody(request)
  if (input instanceof Response) return input
  try {
    return jsonResponse(await ctx.runMutation(encounterMovementPrepare, input))
  } catch {
    return textResponse('Live Session movement evidence unavailable.', 409)
  }
})

export const encounterMovementCommitHttp = httpAction(async (ctx, request) => {
  const denied = await authorize(ctx, request, true)
  if (denied) return denied
  const input = await parseBody(request)
  if (input instanceof Response) return input
  try {
    return jsonResponse(await ctx.runMutation(encounterMovementCommit, input))
  } catch {
    return textResponse('Live Session movement commit unavailable.', 409)
  }
})

export const encounterActionPendingHttp = httpAction(async (ctx, request) => {
  const denied = await authorize(ctx, request, true)
  if (denied) return denied
  const input = await parseBody(request)
  if (input instanceof Response) return input
  try {
    return jsonResponse(await ctx.runMutation(encounterActionPending, input))
  } catch {
    return textResponse('Live Session pending action unavailable.', 409)
  }
})

export const encounterTurnPendingHttp = httpAction(async (ctx, request) => {
  const denied = await authorize(ctx, request, true)
  if (denied) return denied
  const input = await parseBody(request)
  if (input instanceof Response) return input
  try {
    return jsonResponse(await ctx.runMutation(encounterTurnPending, input))
  } catch {
    return textResponse('Live Session pending turn unavailable.', 409)
  }
})

export const encounterActionCommitHttp = httpAction(async (ctx, request) => {
  const denied = await authorize(ctx, request, true)
  if (denied) return denied
  const input = await parseBody(request)
  if (input instanceof Response) return input
  try {
    return jsonResponse(await ctx.runMutation(encounterActionCommit, input))
  } catch {
    return textResponse('Live Session action commit unavailable.', 409)
  }
})

export const encounterTurnCommitHttp = httpAction(async (ctx, request) => {
  const denied = await authorize(ctx, request, true)
  if (denied) return denied
  const input = await parseBody(request)
  if (input instanceof Response) return input
  try {
    return jsonResponse(await ctx.runMutation(encounterTurnCommit, input))
  } catch {
    return textResponse('Live Session turn commit unavailable.', 409)
  }
})

export const encounterConcentrationCommitHttp = httpAction(async (ctx, request) => {
  const denied = await authorize(ctx, request, true)
  if (denied) return denied
  const input = await parseBody(request)
  if (input instanceof Response) return input
  try {
    return jsonResponse(await ctx.runMutation(encounterConcentrationCommit, input))
  } catch {
    return textResponse('Live Session concentration commit unavailable.', 409)
  }
})

export const activateHttp = httpAction(async (ctx, request) => {
  const denied = await authorize(ctx, request, false)
  if (denied) return denied
  const input = await parseBody(request)
  if (input instanceof Response) return input
  try {
    return jsonResponse(await ctx.runMutation(activate, input))
  } catch {
    return textResponse('Live Session activation unavailable.', 409)
  }
})

export const publishHttp = httpAction(async (ctx, request) => {
  const denied = await authorize(ctx, request, false)
  if (denied) return denied
  const input = await parseBody(request)
  if (input instanceof Response) return input
  try {
    const result = await ctx.runMutation(publish, input)
    return jsonResponse(result)
  } catch {
    return textResponse('Live Session publication unavailable.', 409)
  }
})

export const presentHttp = httpAction(async (ctx, request) => {
  const denied = await authorize(ctx, request, false)
  if (denied) return denied
  const input = await parseBody(request)
  if (input instanceof Response) return input
  try {
    return jsonResponse(await ctx.runMutation(present, input))
  } catch {
    return textResponse('Live Session presentation unavailable.', 409)
  }
})

export const beginDrainHttp = httpAction(async (ctx, request) => {
  const denied = await authorize(ctx, request, false)
  if (denied) return denied
  const input = await parseBody(request)
  if (input instanceof Response) return input
  try {
    return jsonResponse(await ctx.runMutation(beginDrain, input))
  } catch {
    return textResponse('Live Session drain unavailable.', 409)
  }
})

export const releaseHttp = httpAction(async (ctx, request) => {
  const denied = await authorize(ctx, request, false)
  if (denied) return denied
  const input = await parseBody(request)
  if (input instanceof Response) return input
  try {
    return jsonResponse(await ctx.runMutation(release, input))
  } catch {
    return textResponse('Live Session release unavailable.', 409)
  }
})

async function authorize(
  ctx: { auth: { getUserIdentity: () => Promise<unknown> } },
  request: Request,
  requireUserIdentity: boolean
): Promise<Response | null> {
  const secret = process.env.LIVE_SESSION_WORKER_SECRET
  if (!secret || new TextEncoder().encode(secret).byteLength < 32)
    return textResponse('Live Session state unavailable.', 503)
  const supplied = request.headers.get('x-artificer-live-session-secret')
  if (!supplied || !constantTimeEqual(supplied, secret)) return textResponse('Unauthorized.', 401)
  if (requireUserIdentity && !(await ctx.auth.getUserIdentity()))
    return textResponse('Unauthorized.', 401)
  return null
}

async function parseBody(request: Request): Promise<JsonObject | Response> {
  try {
    // Exact args and returns are validated by the referenced internal Convex function.
    return jsonObjectSchema.parse(await request.json())
  } catch {
    return textResponse('Invalid JSON.', 400)
  }
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { ...noStore, 'Content-Type': 'application/json' },
    status: 200
  })
}

function textResponse(body: string, status: number): Response {
  return new Response(body, {
    headers: { ...noStore, 'Content-Type': 'text/plain; charset=utf-8' },
    status
  })
}
