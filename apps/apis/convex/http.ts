import { httpRouter, type PublicHttpAction } from 'convex/server'
import { LIVE_SESSION_ROUTE_PATHS } from '@artificer-toolkit/schema/api/liveSessionRoutePaths'
import { createAuth } from './authFactory.helper'
import { authComponent } from './lib/authClient.helper'
import { captureHttp, hydrationHttp } from './liveSessions/transientHttp'
import {
  activateHttp,
  recoverStorageHttp,
  beginDrainHttp,
  bootstrapHttp,
  presentHttp,
  checkpointHttp,
  checkpointStageHttp,
  checkpointPartHttp,
  checkpointCommitHttp,
  releaseHttp,
  roomAuthorizationHttp,
  roomInputsHttp
} from './liveSessions/stateHttp'

const http = httpRouter()

authComponent.registerRoutesLazy(http, createAuth, {
  trustedOrigins: [process.env.SITE_URL]
})

const liveSessionHandlers = {
  capture: captureHttp,
  hydrate: hydrationHttp,
  roomAuthorization: roomAuthorizationHttp,
  roomInputs: roomInputsHttp,
  bootstrap: bootstrapHttp,
  activate: activateHttp,
  recoverStorage: recoverStorageHttp,
  checkpoint: checkpointHttp,
  checkpointStage: checkpointStageHttp,
  checkpointPart: checkpointPartHttp,
  checkpointCommit: checkpointCommitHttp,
  present: presentHttp,
  beginDrain: beginDrainHttp,
  release: releaseHttp
} satisfies Record<keyof typeof LIVE_SESSION_ROUTE_PATHS, PublicHttpAction>
for (const [route, path] of Object.entries(LIVE_SESSION_ROUTE_PATHS))
  http.route({
    handler: liveSessionHandlers[route as keyof typeof LIVE_SESSION_ROUTE_PATHS],
    method: 'POST',
    path
  })

export default http
