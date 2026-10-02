import { constantTimeEqual } from 'better-auth/crypto'
import { makeFunctionReference } from 'convex/server'
import {
  liveSessionTransientCaptureInputSchema,
  liveSessionTransientCaptureSchema,
  type LiveSessionTransientCapture,
  type LiveSessionTransientCaptureInput
} from '@artificer-toolkit/schema/api/liveSessionTransient'
import { httpAction, type ActionCtx } from '../_generated/server'

const capture = makeFunctionReference<
  'query',
  LiveSessionTransientCaptureInput,
  LiveSessionTransientCapture
>('liveSessions/transientCapture:capture')

const noStore = { 'Cache-Control': 'no-store' }

function textResponse(body: string, status: number): Response {
  return new Response(body, {
    headers: { ...noStore, 'Content-Type': 'text/plain; charset=utf-8' },
    status
  })
}

async function authorize(
  ctx: { auth: { getUserIdentity: () => Promise<unknown> } },
  request: Request
): Promise<Response | null> {
  const secret = process.env.LIVE_SESSION_WORKER_SECRET
  if (!secret || new TextEncoder().encode(secret).byteLength < 32)
    return textResponse('Live Session capture unavailable.', 503)

  const suppliedSecret = request.headers.get('x-artificer-live-session-secret')
  if (!suppliedSecret || !constantTimeEqual(suppliedSecret, secret))
    return textResponse('Unauthorized.', 401)

  if (!(await ctx.auth.getUserIdentity())) return textResponse('Unauthorized.', 401)
  return null
}

/** A Worker-secret route that runs one member-authorized transient query. */
function transientQueryHttp<Input, Output>(
  input: { parse(value: unknown): Input },
  run: (ctx: ActionCtx, input: Input) => Promise<Output>,
  output: { parse(value: unknown): Output }
) {
  return httpAction(async (ctx, request) => {
    const denied = await authorize(ctx, request)
    if (denied) return denied

    let parsed: Input
    try {
      parsed = input.parse(await request.json())
    } catch {
      return textResponse('Invalid JSON.', 400)
    }

    try {
      const result = await run(ctx, parsed)
      return new Response(JSON.stringify(output.parse(result)), {
        headers: { ...noStore, 'Content-Type': 'application/json' },
        status: 200
      })
    } catch {
      return textResponse('Live Session capture unavailable.', 409)
    }
  })
}

export const captureHttp = transientQueryHttp(
  liveSessionTransientCaptureInputSchema,
  (ctx, input) => ctx.runQuery(capture, input),
  liveSessionTransientCaptureSchema
)
