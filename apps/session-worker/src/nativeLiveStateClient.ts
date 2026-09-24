import {
  liveSessionActivationInputSchema,
  liveSessionAuthorityDtoSchema,
  liveSessionBootstrapInputSchema,
  liveSessionBootstrapResponseSchema,
  liveSessionDrainReleaseInputSchema,
  liveSessionPublishInputSchema,
  liveSessionPublishResponseSchema,
  type LiveSessionActivationInput,
  type LiveSessionAuthorityDto,
  type LiveSessionBootstrapInput,
  type LiveSessionBootstrapResponse,
  type LiveSessionDrainReleaseInput,
  type LiveSessionPublishInput,
  type LiveSessionPublishResponse
} from '@artificer-toolkit/schema/api/liveSessionState'
import {
  liveSessionPresentationCommitInputSchema,
  type LiveSessionPresentationCommitInput
} from '@artificer-toolkit/schema/api/liveSessions'
import { setCampaignLiveScenePresentationResultDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'

import { z } from 'zod'

import type { SessionWorkerEnvironment } from './environment.js'
import { requestNativeLiveSession } from './nativeSceneClient.js'

export function bootstrapNativeLiveSession(
  environment: Pick<SessionWorkerEnvironment, 'LIVE_SESSION_WORKER_SECRET' | 'CONVEX_SITE_URL'>,
  accessToken: string,
  input: LiveSessionBootstrapInput
): Promise<LiveSessionBootstrapResponse> {
  return requestNativeLiveSession(
    environment,
    accessToken,
    '/live-sessions/bootstrap',
    liveSessionBootstrapInputSchema.parse(input),
    (body) => liveSessionBootstrapResponseSchema.parse(body)
  )
}

export function activateNativeLiveSession(
  environment: Pick<SessionWorkerEnvironment, 'LIVE_SESSION_WORKER_SECRET' | 'CONVEX_SITE_URL'>,
  input: LiveSessionActivationInput
): Promise<LiveSessionAuthorityDto> {
  return requestNativeLiveSession(
    environment,
    null,
    '/live-sessions/activate',
    liveSessionActivationInputSchema.parse(input),
    (body) => liveSessionAuthorityDtoSchema.parse(body)
  )
}

export function beginDrainNativeLiveSession(
  environment: Pick<SessionWorkerEnvironment, 'LIVE_SESSION_WORKER_SECRET' | 'CONVEX_SITE_URL'>,
  input: LiveSessionDrainReleaseInput
): Promise<LiveSessionAuthorityDto> {
  return requestNativeLiveSession(
    environment,
    null,
    '/live-sessions/begin-drain',
    liveSessionDrainReleaseInputSchema.parse(input),
    (body) => liveSessionAuthorityDtoSchema.parse(body)
  )
}

export function releaseNativeLiveSession(
  environment: Pick<SessionWorkerEnvironment, 'LIVE_SESSION_WORKER_SECRET' | 'CONVEX_SITE_URL'>,
  input: LiveSessionDrainReleaseInput
): Promise<null> {
  return requestNativeLiveSession(
    environment,
    null,
    '/live-sessions/release',
    liveSessionDrainReleaseInputSchema.parse(input),
    (body) => z.null().parse(body)
  )
}

export function publishNativeLiveSession(
  environment: Pick<SessionWorkerEnvironment, 'LIVE_SESSION_WORKER_SECRET' | 'CONVEX_SITE_URL'>,
  input: LiveSessionPublishInput
): Promise<LiveSessionPublishResponse> {
  return requestNativeLiveSession(
    environment,
    null,
    '/live-sessions/publish',
    liveSessionPublishInputSchema.parse(input),
    (body) => liveSessionPublishResponseSchema.parse(body)
  )
}

export function presentNativeLiveSessionScene(
  environment: Pick<SessionWorkerEnvironment, 'LIVE_SESSION_WORKER_SECRET' | 'CONVEX_SITE_URL'>,
  input: LiveSessionPresentationCommitInput
) {
  return requestNativeLiveSession(
    environment,
    null,
    '/live-sessions/present',
    liveSessionPresentationCommitInputSchema.parse(input),
    (body) => setCampaignLiveScenePresentationResultDtoSchema.parse(body)
  )
}
