import { httpRouter, type PublicHttpAction } from 'convex/server'
import { LIVE_SESSION_ROUTE_PATHS } from '@artificer-toolkit/schema/api/liveSessionRoutePaths'
import { createAuth } from './authFactory.helper'
import { authComponent } from './lib/authClient.helper'
import { captureHttp, hydrationHttp, visionRevisionsHttp } from './liveSessions/transientHttp'
import {
  activateHttp,
  beginDrainHttp,
  bootstrapHttp,
  characterRulesHttp,
  encounterActionPendingHttp,
  encounterTurnPendingHttp,
  encounterTurnCommitHttp,
  encounterActionCommitHttp,
  encounterConcentrationCommitHttp,
  encounterCleavingCommitHttp,
  encounterDisarmPendingHttp,
  encounterDisarmCommitHttp,
  encounterCommandHttp,
  encounterRouteHttp,
  encounterVoidPrepareHttp,
  encounterVoidRecordHttp,
  encounterRulesHttp,
  encounterBundleHttp,
  encounterMovementBeginHttp,
  encounterMovementPrepareHttp,
  encounterMovementObserveHttp,
  encounterMovementStageFogHttp,
  encounterMovementCommitHttp,
  sceneGeometryCommitHttp,
  externalCommitResolveHttp,
  presentHttp,
  publishHttp,
  releaseHttp
} from './liveSessions/stateHttp'

const http = httpRouter()

authComponent.registerRoutesLazy(http, createAuth, {
  trustedOrigins: [process.env.SITE_URL]
})

const liveSessionHandlers = {
  capture: captureHttp,
  visionRevisions: visionRevisionsHttp,
  hydrate: hydrationHttp,
  bootstrap: bootstrapHttp,
  activate: activateHttp,
  publish: publishHttp,
  present: presentHttp,
  beginDrain: beginDrainHttp,
  release: releaseHttp,
  characterRules: characterRulesHttp,
  encounterRules: encounterRulesHttp,
  encounterBundle: encounterBundleHttp,
  encounterMovementBegin: encounterMovementBeginHttp,
  encounterMovementPrepare: encounterMovementPrepareHttp,
  encounterMovementObserve: encounterMovementObserveHttp,
  encounterMovementStageFog: encounterMovementStageFogHttp,
  encounterMovementCommit: encounterMovementCommitHttp,
  sceneGeometryCommit: sceneGeometryCommitHttp,
  externalCommitResolve: externalCommitResolveHttp,
  encounterActionPending: encounterActionPendingHttp,
  encounterActionCommit: encounterActionCommitHttp,
  encounterTurnPending: encounterTurnPendingHttp,
  encounterTurnCommit: encounterTurnCommitHttp,
  encounterConcentrationCommit: encounterConcentrationCommitHttp,
  encounterCleavingCommit: encounterCleavingCommitHttp,
  encounterDisarmPending: encounterDisarmPendingHttp,
  encounterDisarmCommit: encounterDisarmCommitHttp,
  encounterRoute: encounterRouteHttp,
  encounterVoidPrepare: encounterVoidPrepareHttp,
  encounterVoidRecord: encounterVoidRecordHttp,
  encounterCommand: encounterCommandHttp
} satisfies Record<keyof typeof LIVE_SESSION_ROUTE_PATHS, PublicHttpAction>
for (const [route, path] of Object.entries(LIVE_SESSION_ROUTE_PATHS))
  http.route({
    handler: liveSessionHandlers[route as keyof typeof LIVE_SESSION_ROUTE_PATHS],
    method: 'POST',
    path
  })

export default http
