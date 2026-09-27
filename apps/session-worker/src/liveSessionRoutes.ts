import {
  domainRejectionErrorDataSchema,
  type DomainRejectionErrorData
} from '@artificer-toolkit/schema/api/domainRejections'
import { encounterCommandResultDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import {
  liveSessionCharacterRulesInputSchema,
  liveSessionCharacterRulesResponseSchema
} from '@artificer-toolkit/schema/api/liveSessionCharacterRules'
import {
  liveSessionEncounterActionCommitInputSchema,
  liveSessionEncounterActionPendingInputSchema
} from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import {
  liveSessionEncounterCommandInputSchema,
  liveSessionEncounterRollCommitInputSchema,
  liveSessionEncounterRollDiceSchema,
  liveSessionEncounterRollInputSchema,
  liveSessionEncounterRouteInputSchema,
  liveSessionEncounterRouteResponseSchema,
  liveSessionEncounterVoidInputSchema,
  liveSessionEncounterVoidPreparedSchema
} from '@artificer-toolkit/schema/api/liveSessionEncounterCommand'
import {
  liveSessionEncounterCaptureBundleInputSchema,
  liveSessionEncounterCaptureBundleSchema
} from '@artificer-toolkit/schema/api/liveSessionEncounterCaptureBundle'
import { liveSessionEncounterBasicActionCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import { liveSessionEncounterCleavingCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterCleaving'
import { liveSessionEncounterConcentrationCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterConcentration'
import {
  liveSessionEncounterDisarmCommitInputSchema,
  liveSessionEncounterDisarmPendingInputSchema
} from '@artificer-toolkit/schema/api/liveSessionEncounterDisarm'
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
  liveSessionEncounterBindingCommitInputSchema,
  liveSessionExternalCommitResolveInputSchema,
  liveSessionExternalCommitResolveResponseSchema,
  liveSessionMovementCommitInputSchema,
  liveSessionMovementCommitResponseSchema,
  liveSessionMovementPrepareInputSchema,
  liveSessionSceneGeometryCommitInputSchema,
  liveSessionSceneGeometryObserveInputSchema,
  liveSessionSceneGeometrySaveResponseSchema,
  liveSessionSceneGeometryStageFogInputSchema
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
  liveSessionTransientCaptureSchema,
  liveSessionVisionRevisionsInputSchema,
  liveSessionVisionRevisionsSchema
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
import {
  bindEncounterToPresentedSceneResultDtoSchema,
  setCampaignLiveScenePresentationResultDtoSchema
} from '@artificer-toolkit/schema/api/vttScenes'
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

/** A private route refused an expected domain command; the rejection message is user-safe. */
export class LiveSessionDomainRejectionError extends LiveSessionRouteError {
  constructor(
    status: number,
    readonly rejection: DomainRejectionErrorData
  ) {
    super(status)
    this.name = 'LiveSessionDomainRejectionError'
  }
}

/** How long the room waits for a private route before treating its outcome as unknown. */
export const LIVE_SESSION_ROUTE_TIMEOUT_MS = 10_000

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
  visionRevisions: {
    input: liveSessionVisionRevisionsInputSchema,
    output: liveSessionVisionRevisionsSchema
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
  encounterBundle: {
    input: liveSessionEncounterCaptureBundleInputSchema,
    output: liveSessionEncounterCaptureBundleSchema
  },
  encounterMovementBegin: {
    input: liveSessionMovementBeginInputSchema,
    output: sceneGeometryBeginResultSchema
  },
  encounterMovementPrepare: {
    input: liveSessionMovementPrepareInputSchema,
    output: sceneSpatialPreparationSchema
  },
  encounterMovementObserve: {
    input: liveSessionSceneGeometryObserveInputSchema,
    output: liveSessionSceneGeometrySaveResponseSchema
  },
  encounterMovementStageFog: {
    input: liveSessionSceneGeometryStageFogInputSchema,
    output: liveSessionSceneGeometrySaveResponseSchema
  },
  encounterMovementCommit: {
    input: liveSessionMovementCommitInputSchema,
    output: liveSessionMovementCommitResponseSchema
  },
  sceneGeometryCommit: {
    input: liveSessionSceneGeometryCommitInputSchema,
    output: sceneGeometryCommandResultSchema
  },
  encounterBindingCommit: {
    input: liveSessionEncounterBindingCommitInputSchema,
    output: bindEncounterToPresentedSceneResultDtoSchema
  },
  externalCommitResolve: {
    input: liveSessionExternalCommitResolveInputSchema,
    output: liveSessionExternalCommitResolveResponseSchema
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
  },
  encounterCleavingCommit: {
    input: liveSessionEncounterCleavingCommitInputSchema,
    output: encounterCommandResultDtoSchema
  },
  encounterDisarmPending: {
    input: liveSessionEncounterDisarmPendingInputSchema,
    output: encounterCommandResultDtoSchema
  },
  encounterDisarmCommit: {
    input: liveSessionEncounterDisarmCommitInputSchema,
    output: encounterCommandResultDtoSchema
  },
  encounterBasicActionCommit: {
    input: liveSessionEncounterBasicActionCommitInputSchema,
    output: encounterCommandResultDtoSchema
  },
  encounterRoute: {
    input: liveSessionEncounterRouteInputSchema,
    output: liveSessionEncounterRouteResponseSchema
  },
  encounterVoidPrepare: {
    input: liveSessionEncounterVoidInputSchema,
    output: liveSessionEncounterVoidPreparedSchema
  },
  encounterVoidRecord: {
    input: liveSessionEncounterVoidInputSchema,
    output: encounterCommandResultDtoSchema
  },
  encounterRollDice: {
    input: liveSessionEncounterRollInputSchema,
    output: liveSessionEncounterRollDiceSchema
  },
  encounterRollCommit: {
    input: liveSessionEncounterRollCommitInputSchema,
    output: encounterCommandResultDtoSchema
  },
  encounterCommand: {
    input: liveSessionEncounterCommandInputSchema,
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
  const timeout = setTimeout(() => controller.abort(), LIVE_SESSION_ROUTE_TIMEOUT_MS)
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
    if (!response.ok) {
      const rejection = domainRejectionErrorDataSchema.safeParse(
        await response.json().catch(() => null)
      )
      throw rejection.success
        ? new LiveSessionDomainRejectionError(response.status, rejection.data)
        : new LiveSessionRouteError(response.status)
    }
    // Correlated generic: the parser selected by `route` produces exactly RouteOutput<R>.
    return output.parse(await response.json()) as RouteOutput<R>
  } catch (error) {
    if (error instanceof LiveSessionRouteError) throw error
    throw new LiveSessionRouteError(response?.status ?? 0)
  } finally {
    clearTimeout(timeout)
  }
}
