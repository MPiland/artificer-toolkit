import { api } from '@artificer-toolkit/apis/convex/api'
import { LIVE_SESSION_REAUTHENTICATION_LEAD_MS } from '@artificer-toolkit/schema/api/liveSessionIdentity'
import type { LiveCampaignSummaryDto } from '@artificer-toolkit/schema/api/liveSessions'
import type { ConvexReactClient } from 'convex/react'
import { betterAuthClient } from '#app/auth/betterAuthClient'
import {
  createLiveSessionConnection,
  type LiveSessionCharacterSheetPush,
  type LiveSessionConnection,
  type LiveSessionConnectionOptions,
  type LiveSessionConnectionStatus,
  type LiveSessionDurableState,
  type LiveSessionEncounterSessionPush
} from './liveSessionClient'

/** What one caller reads from the shared connection; the room feeds are the union of every caller's. */
export interface LiveSessionFollow {
  campaignSummary: boolean
  encounterSession: { timeline: boolean } | null
}

/** One caller's event handlers; a callback runs only while that caller follows its feed. */
export type LiveSessionListener = Omit<
  LiveSessionConnectionOptions,
  'createSocket' | 'getAccessToken' | 'getTicket' | 'url'
>

/** A caller's hold on its Campaign's shared connection. */
export interface LiveSessionLease {
  /** Commands, reads and transients ride the shared socket; acks settle only for the sender. */
  commands: Pick<
    LiveSessionConnection,
    'readEncounter' | 'sendTransient' | 'submitCommand' | 'submitSceneFog'
  >
  follow: (next: LiveSessionFollow) => void
  release: () => void
}

interface Subscriber {
  follow: LiveSessionFollow
  listener: LiveSessionListener
}

/** The newest frames, replayed to a caller that joins after the room pushed them. */
interface LatestFrames {
  campaignSummary: LiveCampaignSummaryDto | null
  characterSheet: LiveSessionCharacterSheetPush | null
  durableState: LiveSessionDurableState | null
  encounterSession: LiveSessionEncounterSessionPush | null
  status: LiveSessionConnectionStatus
}

interface SharedConnection {
  connection: LiveSessionConnection
  latest: LatestFrames
  subscribers: Set<Subscriber>
}

/**
 * Reads `exp` from the access token's payload, or 0 when it has none, so the token is not reused. The
 * room verifies the token; the client only schedules reuse.
 */
function accessTokenExpiresAtMs(token: string): number {
  try {
    const payload = token.split('.')[1] ?? ''
    const claims: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    const exp = typeof claims === 'object' && claims !== null && 'exp' in claims ? claims.exp : null
    return typeof exp === 'number' ? exp * 1000 : 0
  } catch {
    return 0
  }
}

// The room refuses a user's fifth socket (ROOM_LIMITS.maxSocketsPerUser) and one Sheet feed per
// socket, so a tab holds one connection per Campaign and held Character Sheet, not one per panel.
const sharedConnections = new Map<string, SharedConnection>()

function openSharedConnection({
  campaignId,
  characterSheetId,
  convex,
  url
}: {
  campaignId: string
  characterSheetId: string | null
  convex: ConvexReactClient
  url: string
}): SharedConnection {
  const subscribers = new Set<Subscriber>()
  const latest: LatestFrames = {
    campaignSummary: null,
    characterSheet: null,
    durableState: null,
    encounterSession: null,
    status: 'CONNECTING'
  }
  const each = (run: (subscriber: Subscriber) => void) => {
    for (const subscriber of [...subscribers]) run(subscriber)
  }
  // Reused until the room would challenge it again, so a woken room's re-challenge costs no fetch.
  let cachedToken: { expiresAtMs: number; value: string } | null = null
  const connection = createLiveSessionConnection({
    getAccessToken: async () => {
      if (
        cachedToken &&
        cachedToken.expiresAtMs - Date.now() > LIVE_SESSION_REAUTHENTICATION_LEAD_MS
      ) {
        return cachedToken.value
      }
      const result = await betterAuthClient.convex.token({ fetchOptions: { throw: false } })
      const accessToken = result.data?.token
      if (!accessToken) throw new Error('Unable to authenticate live play.')
      cachedToken = { expiresAtMs: accessTokenExpiresAtMs(accessToken), value: accessToken }
      return accessToken
    },
    getTicket: () => convex.action(api.liveSessions.tickets.issue, { campaignId }),
    onError: (error) => each((subscriber) => subscriber.listener.onError(error)),
    onCampaignChatEntry: (entry) =>
      each((subscriber) => subscriber.listener.onCampaignChatEntry?.(entry)),
    onPrivateRoll: (roll) => each((subscriber) => subscriber.listener.onPrivateRoll?.(roll)),
    onCampaignSummary: (summary) => {
      latest.campaignSummary = summary
      each((subscriber) => {
        if (subscriber.follow.campaignSummary) subscriber.listener.onCampaignSummary?.(summary)
      })
    },
    onCharacterSheet: (push) => {
      latest.characterSheet = push
      each((subscriber) => subscriber.listener.onCharacterSheet?.(push))
    },
    onEncounterSession: (session) => {
      latest.encounterSession = session
      each((subscriber) => {
        if (subscriber.follow.encounterSession) subscriber.listener.onEncounterSession?.(session)
      })
    },
    onCommandRejected: (rejection) =>
      each((subscriber) => subscriber.listener.onCommandRejected?.(rejection)),
    onDurableState: (state) => {
      latest.durableState = state
      each((subscriber) => subscriber.listener.onDurableState?.(state))
    },
    onStatus: (status) => {
      latest.status = status
      // Without the room, Convex is the source again until the room pushes a fresh frame.
      if (status !== 'CONNECTED') {
        latest.campaignSummary = null
        latest.encounterSession = null
      }
      each((subscriber) => subscriber.listener.onStatus(status))
    },
    onTransient: (message) => each((subscriber) => subscriber.listener.onTransient(message)),
    url
  })
  if (characterSheetId) connection.subscribeCharacterSheet(characterSheetId)
  return { connection, latest, subscribers }
}

/** The room feeds the connection requests: what any caller follows, at the widest timeline. */
function requestFollowedFeeds({ connection, latest, subscribers }: SharedConnection) {
  const follows = [...subscribers].map((subscriber) => subscriber.follow)
  const sessions = follows.flatMap((follow) => follow.encounterSession ?? [])
  const followsSummary = follows.some((follow) => follow.campaignSummary)
  connection.subscribeCampaignSummary(followsSummary)
  connection.subscribeEncounterSession(
    sessions.length > 0 ? { timeline: sessions.some((session) => session.timeline) } : null
  )
  if (!followsSummary) latest.campaignSummary = null
  if (sessions.length === 0) latest.encounterSession = null
}

/**
 * Joins the Campaign's shared connection, opening it for the first caller and closing it when the
 * last caller releases. `characterSheetId` selects the connection that holds that Character's Sheet
 * feed, which the room allows once per socket; callers without one share the Campaign's own.
 */
export function acquireCampaignLiveConnection({
  campaignId,
  characterSheetId,
  convex,
  listener,
  url
}: {
  campaignId: string
  characterSheetId: string | null
  convex: ConvexReactClient
  listener: LiveSessionListener
  url: string
}): LiveSessionLease {
  const key = `${campaignId}\n${characterSheetId ?? ''}`
  const shared =
    sharedConnections.get(key) ??
    openSharedConnection({ campaignId, characterSheetId, convex, url })
  sharedConnections.set(key, shared)
  const subscriber: Subscriber = {
    follow: { campaignSummary: false, encounterSession: null },
    listener
  }
  shared.subscribers.add(subscriber)
  listener.onStatus(shared.latest.status)
  if (shared.latest.durableState) listener.onDurableState?.(shared.latest.durableState)
  if (shared.latest.characterSheet) listener.onCharacterSheet?.(shared.latest.characterSheet)
  const { connection } = shared
  return {
    commands: connection,
    follow(next) {
      subscriber.follow = next
      requestFollowedFeeds(shared)
      // The room pushes a feed only when its frame changed, so a caller that starts following
      // later reads the frame the connection already holds.
      const { campaignSummary, encounterSession } = shared.latest
      if (next.campaignSummary && campaignSummary) listener.onCampaignSummary?.(campaignSummary)
      if (next.encounterSession && encounterSession) listener.onEncounterSession?.(encounterSession)
    },
    release() {
      if (!shared.subscribers.delete(subscriber)) return
      if (shared.subscribers.size > 0) {
        requestFollowedFeeds(shared)
        return
      }
      sharedConnections.delete(key)
      connection.close()
    }
  }
}
