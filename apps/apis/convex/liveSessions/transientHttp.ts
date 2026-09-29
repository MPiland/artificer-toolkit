import { constantTimeEqual } from 'better-auth/crypto'
import { makeFunctionReference } from 'convex/server'
import {
  liveSessionTransientCaptureInputSchema,
  liveSessionTransientCaptureSchema,
  type LiveSessionTransientCapture,
  type LiveSessionTransientCaptureInput
} from '@artificer-toolkit/schema/api/liveSessionTransient'
import {
  liveSessionTransientHydrationInputSchema,
  liveSessionTransientHydrationResponseSchema,
  type LiveSessionTransientHydrationInput,
  type LiveSessionTransientHydrationResponse
} from '@artificer-toolkit/schema/api/liveSessionTransientHydration'
import type {
  SceneCurrentEntityPage,
  SceneCurrentEntityPageInput
} from '@artificer-toolkit/schema/api/sceneRecipient'
import type {
  SceneFogChunksPage,
  SceneFogChunksPageInput,
  SceneFogLayersPage,
  SceneFogLayersPageInput
} from '@artificer-toolkit/schema/api/sceneFog'
import type {
  SceneSessionCharacterVisionInput,
  SceneSessionCharacterVisionResult,
  SceneSessionVisionBindingsInput,
  SceneSessionVisionBindingsPage,
  SceneSessionVisionRunsInput,
  SceneSessionVisionRunsPage
} from '@artificer-toolkit/schema/api/sceneSessionVision'
import { httpAction, type ActionCtx } from '../_generated/server'

const capture = makeFunctionReference<
  'query',
  LiveSessionTransientCaptureInput,
  LiveSessionTransientCapture
>('liveSessions/transientCapture:capture')
const currentEntities = makeFunctionReference<
  'query',
  SceneCurrentEntityPageInput,
  SceneCurrentEntityPage
>('scenes/recipientReads:currentEntities')
const fogLayers = makeFunctionReference<'query', SceneFogLayersPageInput, SceneFogLayersPage>(
  'scenes/transientFogReads:layers'
)
const fogChunks = makeFunctionReference<'query', SceneFogChunksPageInput, SceneFogChunksPage>(
  'scenes/transientFogReads:chunks'
)
const visionRuns = makeFunctionReference<
  'query',
  SceneSessionVisionRunsInput,
  SceneSessionVisionRunsPage
>('scenes/sessionVision:runs')
const visionBindings = makeFunctionReference<
  'query',
  SceneSessionVisionBindingsInput,
  SceneSessionVisionBindingsPage
>('scenes/sessionVision:bindings')
const visionCharacter = makeFunctionReference<
  'query',
  SceneSessionCharacterVisionInput,
  SceneSessionCharacterVisionResult
>('scenes/sessionVision:character')

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

function requireSceneFence(
  captureResult: LiveSessionTransientCapture,
  request: LiveSessionTransientHydrationInput['request']
) {
  const header = captureResult.sceneHeader
  if (!header || request.sceneId !== header.id) throw new Error('Live Scene snapshot is stale.')
  const expectedVersion =
    'expectedSceneVersion' in request ? request.expectedSceneVersion : request.expectedVersion
  if (expectedVersion !== header.version) throw new Error('Live Scene snapshot is stale.')
  return header
}

function requireVisionFence(
  captureResult: LiveSessionTransientCapture,
  request: Extract<LiveSessionTransientHydrationInput['request'], { kind: `VISION_${string}` }>
) {
  const header = requireSceneFence(captureResult, request)
  const presentation = captureResult.presentation
  const freshness = captureResult.visionFreshness
  if (
    !presentation ||
    !freshness ||
    request.campaignId !== captureResult.campaignId ||
    request.systemId !== captureResult.systemId ||
    presentation.version !== request.expectedPresentationVersion
  )
    throw new Error('Scene vision snapshot is stale.')
  if (
    request.freshness.system !== freshness.system ||
    request.freshness.campaign !== freshness.campaign ||
    request.freshness.play !== freshness.play
  )
    throw new Error('Scene vision snapshot is stale.')
  return header
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

export const hydrationHttp = httpAction(async (ctx, request) => {
  const denied = await authorize(ctx, request)
  if (denied) return denied

  let input: LiveSessionTransientHydrationInput
  try {
    input = liveSessionTransientHydrationInputSchema.parse(await request.json())
  } catch {
    return textResponse('Invalid JSON.', 400)
  }

  try {
    const requestInput = input.request
    const captureResult = await ctx.runQuery(capture, {
      ...input.authority,
      mode:
        requestInput.kind === 'ENTITIES' ||
        requestInput.kind === 'FOG_LAYERS' ||
        requestInput.kind === 'FOG_CHUNKS'
          ? 'AUTHORITY'
          : 'FULL',
      observedCharacterRevisions: [],
      recipientUserIds: []
    })
    let result: LiveSessionTransientHydrationResponse
    switch (requestInput.kind) {
      case 'ENTITIES':
        requireSceneFence(captureResult, requestInput)
        {
          const { kind: _kind, ...readerInput } = requestInput
          result = {
            kind: requestInput.kind,
            result: await ctx.runQuery(currentEntities, readerInput)
          }
        }
        break
      case 'FOG_LAYERS':
        requireSceneFence(captureResult, requestInput)
        {
          const { kind: _kind, ...readerInput } = requestInput
          result = { kind: requestInput.kind, result: await ctx.runQuery(fogLayers, readerInput) }
        }
        break
      case 'FOG_CHUNKS':
        requireSceneFence(captureResult, requestInput)
        {
          const { kind: _kind, ...readerInput } = requestInput
          result = { kind: requestInput.kind, result: await ctx.runQuery(fogChunks, readerInput) }
        }
        break
      case 'VISION_RUNS':
        requireVisionFence(captureResult, requestInput)
        {
          const { kind: _kind, ...readerInput } = requestInput
          result = { kind: requestInput.kind, result: await ctx.runQuery(visionRuns, readerInput) }
        }
        break
      case 'VISION_BINDINGS':
        requireVisionFence(captureResult, requestInput)
        {
          const { kind: _kind, ...readerInput } = requestInput
          result = {
            kind: requestInput.kind,
            result: await ctx.runQuery(visionBindings, readerInput)
          }
        }
        break
      case 'VISION_CHARACTER':
        requireVisionFence(captureResult, requestInput)
        {
          const { kind: _kind, ...readerInput } = requestInput
          result = {
            kind: requestInput.kind,
            result: await ctx.runQuery(visionCharacter, readerInput)
          }
        }
        break
    }
    return new Response(JSON.stringify(liveSessionTransientHydrationResponseSchema.parse(result)), {
      headers: { ...noStore, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch {
    return textResponse('Live Session capture unavailable.', 409)
  }
})
