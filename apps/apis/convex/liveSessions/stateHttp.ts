import { constantTimeEqual } from 'better-auth/crypto'
import { domainRejectionErrorDataSchema } from '@artificer-toolkit/schema/api/domainRejections'
import { makeFunctionReference } from 'convex/server'
import { ConvexError } from 'convex/values'
import { z } from 'zod'
import { httpAction, type ActionCtx } from '../_generated/server'

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
const encounterBundle = makeFunctionReference<'query', JsonObject, unknown>(
  'liveSessions/encounterCaptureBundle:capture'
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
const encounterRoute = makeFunctionReference<'query', JsonObject, unknown>(
  'liveSessions/encounterRoute:route'
)
const encounterCommand = makeFunctionReference<'action', JsonObject, unknown>(
  'liveSessions/encounterCommand:execute'
)
const jsonObjectSchema = z.record(z.string(), z.json())
type JsonObject = z.infer<typeof jsonObjectSchema>
const noStore = { 'Cache-Control': 'no-store' }

export const bootstrapHttp = liveStateHttp(
  true,
  'Live Session bootstrap unavailable.',
  (ctx, input) => ctx.runQuery(bootstrap, input)
)
export const characterRulesHttp = liveStateHttp(
  true,
  'Live Session Character inputs unavailable.',
  (ctx, input) => ctx.runQuery(characterRules, input)
)
export const encounterRulesHttp = liveStateHttp(
  true,
  'Live Session Encounter inputs unavailable.',
  (ctx, input) => ctx.runQuery(encounterRules, input)
)
export const encounterBundleHttp = liveStateHttp(
  true,
  'Live Session Encounter inputs unavailable.',
  (ctx, input) => ctx.runQuery(encounterBundle, input)
)
export const encounterMovementBeginHttp = liveStateHttp(
  true,
  'Live Session movement preparation unavailable.',
  (ctx, input) => ctx.runMutation(encounterMovementBegin, input)
)
export const encounterMovementPrepareHttp = liveStateHttp(
  true,
  'Live Session movement evidence unavailable.',
  (ctx, input) => ctx.runMutation(encounterMovementPrepare, input)
)
export const encounterMovementCommitHttp = liveStateHttp(
  true,
  'Live Session movement commit unavailable.',
  (ctx, input) => ctx.runMutation(encounterMovementCommit, input)
)
export const encounterActionPendingHttp = liveStateHttp(
  true,
  'Live Session pending action unavailable.',
  (ctx, input) => ctx.runMutation(encounterActionPending, input)
)
export const encounterTurnPendingHttp = liveStateHttp(
  true,
  'Live Session pending turn unavailable.',
  (ctx, input) => ctx.runMutation(encounterTurnPending, input)
)
export const encounterActionCommitHttp = liveStateHttp(
  true,
  'Live Session action commit unavailable.',
  (ctx, input) => ctx.runMutation(encounterActionCommit, input)
)
export const encounterTurnCommitHttp = liveStateHttp(
  true,
  'Live Session turn commit unavailable.',
  (ctx, input) => ctx.runMutation(encounterTurnCommit, input)
)
export const encounterConcentrationCommitHttp = liveStateHttp(
  true,
  'Live Session concentration commit unavailable.',
  (ctx, input) => ctx.runMutation(encounterConcentrationCommit, input)
)
export const encounterRouteHttp = liveStateHttp(
  true,
  'Live Session Encounter route unavailable.',
  (ctx, input) => ctx.runQuery(encounterRoute, input)
)
export const encounterCommandHttp = liveStateHttp(
  true,
  'Live Session Encounter command unavailable.',
  (ctx, input) => ctx.runAction(encounterCommand, input)
)
export const activateHttp = liveStateHttp(
  false,
  'Live Session activation unavailable.',
  (ctx, input) => ctx.runMutation(activate, input)
)
export const publishHttp = liveStateHttp(
  false,
  'Live Session publication unavailable.',
  (ctx, input) => ctx.runMutation(publish, input)
)
export const presentHttp = liveStateHttp(
  false,
  'Live Session presentation unavailable.',
  (ctx, input) => ctx.runMutation(present, input)
)
export const beginDrainHttp = liveStateHttp(
  false,
  'Live Session drain unavailable.',
  (ctx, input) => ctx.runMutation(beginDrain, input)
)
export const releaseHttp = liveStateHttp(false, 'Live Session release unavailable.', (ctx, input) =>
  ctx.runMutation(release, input)
)

/** Worker-secret routes; `requireUserIdentity` additionally requires the forwarded user token. */
function liveStateHttp(
  requireUserIdentity: boolean,
  unavailableMessage: string,
  run: (ctx: ActionCtx, input: JsonObject) => Promise<unknown>
) {
  return httpAction(async (ctx, request) => {
    const denied = await authorize(ctx, request, requireUserIdentity)
    if (denied) return denied
    const input = await parseBody(request)
    if (input instanceof Response) return input
    try {
      return jsonResponse(await run(ctx, input))
    } catch (error) {
      // Only expected domain rejections reach the room; every other failure stays redacted.
      const rejection =
        error instanceof ConvexError ? domainRejectionErrorDataSchema.safeParse(error.data) : null
      if (rejection?.success) return jsonResponse(rejection.data, 422)
      return textResponse(unavailableMessage, 409)
    }
  })
}

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

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    headers: { ...noStore, 'Content-Type': 'application/json' },
    status
  })
}

function textResponse(body: string, status: number): Response {
  return new Response(body, {
    headers: { ...noStore, 'Content-Type': 'text/plain; charset=utf-8' },
    status
  })
}
