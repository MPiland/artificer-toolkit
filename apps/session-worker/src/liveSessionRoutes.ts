import { encounterCommandResultDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import {
  liveSessionCharacterRulesInputSchema,
  liveSessionCharacterRulesResponseSchema
} from '@artificer-toolkit/schema/api/liveSessionCharacterRules'
import {
  liveSessionEncounterActionCommitInputSchema,
  liveSessionEncounterActionPendingInputSchema
} from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import { liveSessionEncounterConcentrationCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterConcentration'
import { liveSessionMovementBeginInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterMovement'
import {
  liveSessionEncounterRulesInputSchema,
  liveSessionEncounterRulesResponseSchema
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import {
  liveSessionEncounterTurnCommitInputSchema,
  liveSessionEncounterTurnPendingInputSchema
} from '@artificer-toolkit/schema/api/liveSessionEncounterTurn'
import {
  liveSessionMovementCommitInputSchema,
  liveSessionMovementPrepareInputSchema
} from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import { LIVE_SESSION_ROUTE_PATHS } from '@artificer-toolkit/schema/api/liveSessionRoutePaths'
import {
  liveSessionActivationInputSchema,
  liveSessionAuthorityDtoSchema,
  liveSessionBootstrapInputSchema,
  liveSessionBootstrapResponseSchema,
  liveSessionDrainReleaseInputSchema,
  liveSessionPublishInputSchema,
  liveSessionPublishResponseSchema
} from '@artificer-toolkit/schema/api/liveSessionState'
import {
  liveSessionTransientCaptureInputSchema,
  liveSessionTransientCaptureSchema
} from '@artificer-toolkit/schema/api/liveSessionTransient'
import {
  liveSessionTransientHydrationInputSchema,
  liveSessionTransientHydrationResponseSchema
} from '@artificer-toolkit/schema/api/liveSessionTransientHydration'
import { liveSessionPresentationCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessions'
import {
  sceneGeometryBeginResultSchema,
  sceneGeometryCommandResultSchema
} from '@artificer-toolkit/schema/api/sceneGeometry'
import { setCampaignLiveScenePresentationResultDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import { sceneSpatialPreparationSchema } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { z } from 'zod'

export type NativeLiveSessionEnvironment = {
  LIVE_SESSION_WORKER_SECRET: string
  CONVEX_SITE_URL: string
}

/** A private route failed or returned an invalid body; `status` is the HTTP status, 0 if none. */
export class LiveSessionRouteError extends Error {
  constructor(readonly status: number) {
    super('Live Session route request failed.')
    this.name = 'LiveSessionRouteError'
  }
}

const timeoutMs = 10_000

function safeOrigin(value: string): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new LiveSessionRouteError(0)
  }
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname))
  )
    throw new LiveSessionRouteError(0)
  return url
}

type Parser<T> = { parse(value: unknown): T }

/** Every private Convex route the Worker calls, with the contracts both sides validate. */
const liveSessionRoutes = {
  capture: {
    input: liveSessionTransientCaptureInputSchema,
    output: liveSessionTransientCaptureSchema
  },
  hydrate: {
    input: liveSessionTransientHydrationInputSchema,
    output: liveSessionTransientHydrationResponseSchema
  },
  bootstrap: { input: liveSessionBootstrapInputSchema, output: liveSessionBootstrapResponseSchema },
  activate: { input: liveSessionActivationInputSchema, output: liveSessionAuthorityDtoSchema },
  publish: { input: liveSessionPublishInputSchema, output: liveSessionPublishResponseSchema },
  present: {
    input: liveSessionPresentationCommitInputSchema,
    output: setCampaignLiveScenePresentationResultDtoSchema
  },
  beginDrain: { input: liveSessionDrainReleaseInputSchema, output: liveSessionAuthorityDtoSchema },
  release: { input: liveSessionDrainReleaseInputSchema, output: z.null() },
  characterRules: {
    input: liveSessionCharacterRulesInputSchema,
    output: liveSessionCharacterRulesResponseSchema
  },
  encounterRules: {
    input: liveSessionEncounterRulesInputSchema,
    output: liveSessionEncounterRulesResponseSchema
  },
  encounterMovementBegin: {
    input: liveSessionMovementBeginInputSchema,
    output: sceneGeometryBeginResultSchema
  },
  encounterMovementPrepare: {
    input: liveSessionMovementPrepareInputSchema,
    output: sceneSpatialPreparationSchema
  },
  encounterMovementCommit: {
    input: liveSessionMovementCommitInputSchema,
    output: sceneGeometryCommandResultSchema
  },
  encounterActionPending: {
    input: liveSessionEncounterActionPendingInputSchema,
    output: encounterCommandResultDtoSchema
  },
  encounterActionCommit: {
    input: liveSessionEncounterActionCommitInputSchema,
    output: encounterCommandResultDtoSchema
  },
  encounterTurnPending: {
    input: liveSessionEncounterTurnPendingInputSchema,
    output: encounterCommandResultDtoSchema
  },
  encounterTurnCommit: {
    input: liveSessionEncounterTurnCommitInputSchema,
    output: encounterCommandResultDtoSchema
  },
  encounterConcentrationCommit: {
    input: liveSessionEncounterConcentrationCommitInputSchema,
    output: encounterCommandResultDtoSchema
  }
} satisfies Record<
  keyof typeof LIVE_SESSION_ROUTE_PATHS,
  { input: Parser<unknown>; output: Parser<unknown> }
>

type LiveSessionRoute = keyof typeof liveSessionRoutes
type RouteInput<R extends LiveSessionRoute> = ReturnType<
  (typeof liveSessionRoutes)[R]['input']['parse']
>
type RouteOutput<R extends LiveSessionRoute> = ReturnType<
  (typeof liveSessionRoutes)[R]['output']['parse']
>

/**
 * Calls one private Convex route. `accessToken` is the initiating user's JWT; `null` is only for
 * room-owned control routes that Convex authorizes by the Worker secret and authority fences.
 */
export async function callLiveSessionRoute<R extends LiveSessionRoute>(
  environment: NativeLiveSessionEnvironment,
  accessToken: string | null,
  route: R,
  input: RouteInput<R>
): Promise<RouteOutput<R>> {
  const { input: inputSchema, output } = liveSessionRoutes[route]
  const body = JSON.stringify(inputSchema.parse(input))
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  let response: Response | undefined
  try {
    response = await fetch(
      new URL(LIVE_SESSION_ROUTE_PATHS[route], safeOrigin(environment.CONVEX_SITE_URL)),
      {
        body,
        headers: {
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
          'content-type': 'application/json',
          'x-artificer-live-session-secret': environment.LIVE_SESSION_WORKER_SECRET
        },
        method: 'POST',
        redirect: 'manual',
        signal: controller.signal
      }
    )
    if (!response.ok) throw new LiveSessionRouteError(response.status)
    // Correlated generic: the parser selected by `route` produces exactly RouteOutput<R>.
    return output.parse(await response.json()) as RouteOutput<R>
  } catch (error) {
    if (error instanceof LiveSessionRouteError) throw error
    throw new LiveSessionRouteError(response?.status ?? 0)
  } finally {
    clearTimeout(timeout)
  }
}
