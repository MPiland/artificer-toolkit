import { httpRouter } from 'convex/server'
import { createAuth } from './authFactory.helper'
import { authComponent } from './lib/authClient.helper'
import { captureHttp, hydrationHttp } from './liveSessions/transientHttp'
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
  encounterRulesHttp,
  encounterMovementBeginHttp,
  encounterMovementPrepareHttp,
  encounterMovementCommitHttp,
  presentHttp,
  publishHttp,
  releaseHttp
} from './liveSessions/stateHttp'

const http = httpRouter()

authComponent.registerRoutesLazy(http, createAuth, {
  trustedOrigins: [process.env.SITE_URL]
})

http.route({ handler: captureHttp, method: 'POST', path: '/live-sessions/capture' })
http.route({ handler: hydrationHttp, method: 'POST', path: '/live-sessions/hydrate' })
http.route({ handler: bootstrapHttp, method: 'POST', path: '/live-sessions/bootstrap' })
http.route({ handler: characterRulesHttp, method: 'POST', path: '/live-sessions/character-rules' })
http.route({ handler: encounterRulesHttp, method: 'POST', path: '/live-sessions/encounter-rules' })
http.route({
  handler: encounterMovementBeginHttp,
  method: 'POST',
  path: '/live-sessions/encounter-movement-begin'
})
http.route({
  handler: encounterMovementPrepareHttp,
  method: 'POST',
  path: '/live-sessions/encounter-movement-prepare'
})
http.route({
  handler: encounterMovementCommitHttp,
  method: 'POST',
  path: '/live-sessions/encounter-movement'
})
http.route({
  handler: encounterActionPendingHttp,
  method: 'POST',
  path: '/live-sessions/encounter-action-pending'
})
http.route({
  handler: encounterTurnPendingHttp,
  method: 'POST',
  path: '/live-sessions/encounter-turn-pending'
})
http.route({
  handler: encounterTurnCommitHttp,
  method: 'POST',
  path: '/live-sessions/encounter-turn'
})
http.route({
  handler: encounterActionCommitHttp,
  method: 'POST',
  path: '/live-sessions/encounter-action'
})
http.route({ handler: activateHttp, method: 'POST', path: '/live-sessions/activate' })
http.route({
  handler: encounterConcentrationCommitHttp,
  method: 'POST',
  path: '/live-sessions/encounter-concentration'
})
http.route({ handler: publishHttp, method: 'POST', path: '/live-sessions/publish' })
http.route({ handler: presentHttp, method: 'POST', path: '/live-sessions/present' })
http.route({ handler: beginDrainHttp, method: 'POST', path: '/live-sessions/begin-drain' })
http.route({ handler: releaseHttp, method: 'POST', path: '/live-sessions/release' })

export default http
