import {
  LIVE_SESSION_TRY_AGAIN_MESSAGE,
  type LiveSessionCommandRejectionCodeDto
} from '@artificer-toolkit/schema/api/liveSessionCommands'
import { DOMAIN_REJECTION_MESSAGES } from '@artificer-toolkit/schema/api/domainRejections'

import { LiveSessionDomainRejectionError, LiveSessionRouteError } from './liveSessionRoutes.js'
import { RetryableCommandError } from './nativeRulesRevisions.js'

/** The admitted room member issuing the command. */
export interface LiveEncounterActor {
  campaignId: string
  authorityEpoch: string
  expectedUserId: string
  expectedRole: 'OWNER' | 'PLAYER'
}

/**
 * The room owns Encounter movement only on its presented Scene (D42): a movement decision for an
 * Encounter the presented Scene is not bound to is refused, never sent to Convex.
 */
export function sceneNotPresentedRejection(): LiveSessionDomainRejectionError {
  return new LiveSessionDomainRejectionError(409, {
    code: 'DOMAIN_REJECTED',
    reason: 'SCENE_NOT_PRESENTED',
    message: DOMAIN_REJECTION_MESSAGES.SCENE_NOT_PRESENTED
  })
}

/**
 * A command's admission or authorization changed between its start and its commit (an outside
 * change reloaded the cache, a member left, the table moved): nothing was written, so the same
 * command can be retried.
 */
export class RoomAdmissionExpiredError extends RetryableCommandError {
  constructor() {
    super('Live Session command admission expired before commit.')
  }
}

/**
 * What a member is told when a private route refuses their Encounter command without a domain
 * reason: Convex redacts the cause, so only the route's status is shown. A failure inside the room
 * itself is logged, since the member is told nothing about it.
 */
export function encounterCommandRefusal(error: unknown): {
  code: LiveSessionCommandRejectionCodeDto
  message: string
} {
  console.error('T4C2-CAUSE', error instanceof Error ? error.stack : String(error)) // TEMP
  if (error instanceof RetryableCommandError)
    return { code: 'UNAVAILABLE', message: `T4C2 ${(error as Error).stack ?? String(error)}`.slice(0, 1500) } // TEMP
  if (!(error instanceof LiveSessionRouteError))
    console.error('Live Session Encounter command failed in the room.', error)
  const status = error instanceof LiveSessionRouteError ? error.status : 0
  if (status === 409)
    return {
      code: 'STALE_STATE',
      message: 'The Encounter changed; review the current state and try again.'
    }
  // Convex ran out of time (503): nothing changed and the same command can be retried.
  if (status === 503) return { code: 'UNAVAILABLE', message: LIVE_SESSION_TRY_AGAIN_MESSAGE }
  return {
    code: 'STALE_STATE', // TEMP
    message: `T4C2 ${(error as Error).stack ?? String(error)}`.slice(0, 1500) // TEMP
  }
}
