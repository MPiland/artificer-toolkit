import type { EncounterPersistenceTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import {
  readEncounterActorSides,
  readEncounterDecisionSettlement,
  readEncounterPreparedPending,
  readEncounterSessionState
} from '@artificer-toolkit/encounter-persistence/sessionReads'
import { readEncounterTimelinePage } from '@artificer-toolkit/encounter-persistence/timelinePages'
import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import type {
  EncounterSessionFrameDto,
  LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import { admitsRoomMember } from './roomAuthorization.js'
import type { FeedMember, FeedScope } from './roomCharacterSheetFeed.js'
import { roomEncounterReadTransaction } from './roomEncounterReadPorts.js'
import type { RoomEncounterStore } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'

/** The newest timeline page the room pushes, as `timelineReads` serves it by default. */
const TIMELINE_LIMIT = 50

interface Subscription {
  timeline: boolean
  /** The frame last sent, serialized; an identical frame is not sent again. */
  sent: string | null
  /** A player's last shown pending decision, kept to say how it was settled (D39). */
  shown: { encounterId: string; occurrenceId: string; occurrenceVersion: number } | null
}

type HeldFrame = Extract<EncounterSessionFrameDto, { held: true }>
/** A frame before the socket's own settled decision is added. */
type BuiltFrame = { held: false } | Omit<HeldFrame, 'settlement'>

/**
 * The Encounter session the room holds, pushed to the sockets that subscribed to it. One
 * subscription per socket; every push re-admits the socket against the current authorization and
 * reads only Runs the room already holds, so a push never loads a Run. Frames are built with the
 * same readers as Convex's `activeReads`, `projectionReads` and `timelineReads`.
 */
export class RoomEncounterSessionFeed {
  readonly #subscriptions = new Map<WebSocket, Subscription>()

  constructor(
    private readonly dependencies: {
      store: RoomEncounterStore
      inputs: RoomInputs
      authorize: (scope: FeedScope) => Promise<LiveSessionRoomAuthorization>
      admission: (socket: WebSocket) => FeedMember | null
      scope: (socket: WebSocket) => FeedScope | null
      send: (socket: WebSocket, message: LiveSessionWebSocketServerMessageDto) => void
    }
  ) {}

  get size(): number {
    return this.#subscriptions.size
  }

  subscribe(socket: WebSocket, timeline: boolean): void {
    this.#subscriptions.set(socket, { timeline, sent: null, shown: null })
  }

  drop(socket: WebSocket): void {
    this.#subscriptions.delete(socket)
  }

  /** Sends each subscribed socket its session when it differs from the last one sent. */
  async push(): Promise<void> {
    const groups = new Map<
      string,
      {
        authorization: LiveSessionRoomAuthorization
        member: FeedMember
        scope: FeedScope
        timeline: boolean
        sockets: WebSocket[]
      }
    >()
    for (const [socket, subscription] of this.#subscriptions) {
      const member = this.dependencies.admission(socket)
      const scope = this.dependencies.scope(socket)
      const authorization = member && scope ? await this.dependencies.authorize(scope) : null
      if (!member || !scope || !authorization || !admitsRoomMember(authorization, member)) {
        this.#subscriptions.delete(socket)
        continue
      }
      // The member decides the projection and the timeline flag its content, so one build serves a group.
      const key = `${member.userId}:${subscription.timeline}`
      const group = groups.get(key) ?? {
        authorization,
        member,
        scope,
        timeline: subscription.timeline,
        sockets: []
      }
      group.sockets.push(socket)
      groups.set(key, group)
    }
    for (const { authorization, member, scope, timeline, sockets } of groups.values()) {
      const frame = await this.#build(authorization, member, scope, timeline)
      for (const socket of sockets) {
        const subscription = this.#subscriptions.get(socket)
        // The socket may have left or resubscribed while the frame was built.
        if (subscription?.timeline !== timeline) continue
        const session = frame.held
          ? {
              ...frame,
              settlement: await this.#settle(authorization, member, scope, subscription, frame)
            }
          : frame
        const serialized = JSON.stringify(session)
        if (serialized === subscription.sent) continue
        subscription.sent = serialized
        this.dependencies.send(socket, { type: 'ENCOUNTER_SESSION', session })
      }
    }
  }

  async #transaction(
    authorization: LiveSessionRoomAuthorization,
    member: FeedMember,
    scope: FeedScope
  ): Promise<EncounterPersistenceTransaction> {
    const { store, inputs } = this.dependencies
    return roomEncounterReadTransaction({
      store,
      inputs,
      authorization,
      campaignId: scope.campaignId,
      epoch: scope.authorityEpoch,
      userId: member.userId,
      observed: inputs.revisions(scope.campaignId, authorization.revisions)
    })
  }

  /** The member's frame without its settled decision: held while the room holds a Run they read. */
  async #build(
    authorization: LiveSessionRoomAuthorization,
    member: FeedMember,
    scope: FeedScope,
    timeline: boolean
  ): Promise<BuiltFrame> {
    const { store } = this.dependencies
    const rows = store
      .documents('encounterRuns')
      .filter((run) => run.campaignId === scope.campaignId)
    const active = rows.find((run) => run.status === 'ACTIVE') ?? null
    const prepared = rows.filter((run) => run.status === 'PREPARED')
    if (!active && prepared.length === 0) return { held: false }
    const transaction = await this.#transaction(authorization, member, scope)
    const { campaign, membership } = await transaction.ports.requireCampaignAuthority(
      scope.campaignId,
      member.userId
    )
    const preparedPending = active
      ? []
      : await readEncounterPreparedPending(transaction, { rows: prepared, campaign, membership })
    if (!active && preparedPending.length === 0) return { held: false }
    const state = await readEncounterSessionState(transaction, {
      row: active,
      campaign,
      membership
    })
    return {
      held: true,
      version:
        active?.version ?? Math.max(...preparedPending.map(({ encounter }) => encounter.version)),
      state,
      preparedPending,
      actorSides:
        active && membership.role === 'OWNER'
          ? await readEncounterActorSides(transaction, active, campaign)
          : null,
      timeline:
        active && timeline
          ? await readEncounterTimelinePage({
              campaignId: campaign.id,
              player: membership.role !== 'OWNER',
              runVersion: active.version,
              cursorVersion: null,
              limit: TIMELINE_LIMIT,
              scan: ({ visibility, beforeVersion }) =>
                visibility
                  ? transaction.db
                      .query('encounterRunCommands')
                      .withIndex('by_encounterId_visibility_version', (q) =>
                        q
                          .eq('encounterId', active.id)
                          .eq('visibility', visibility)
                          .lt('version', beforeVersion)
                      )
                      .order('desc')
                  : transaction.db
                      .query('encounterRunCommands')
                      .withIndex('by_encounterId_version', (q) =>
                        q.eq('encounterId', active.id).lt('version', beforeVersion)
                      )
                      .order('desc'),
              read: async (command) => command
            })
          : null
    }
  }

  /**
   * How the decision this player was shown ended, once it leaves `pending` (D39): the memory is the
   * last pending decision pushed to this socket, and an answer ends it.
   */
  async #settle(
    authorization: LiveSessionRoomAuthorization,
    member: FeedMember,
    scope: FeedScope,
    subscription: Subscription,
    frame: Omit<HeldFrame, 'settlement'>
  ): Promise<HeldFrame['settlement']> {
    const { encounter, pending } = frame.state
    if (member.role === 'OWNER' || !encounter) return null
    if (pending) {
      subscription.shown = {
        encounterId: encounter.id,
        occurrenceId: pending.occurrenceId,
        occurrenceVersion: pending.occurrenceVersion
      }
      return null
    }
    const { shown } = subscription
    if (!shown) return null
    if (shown.encounterId !== encounter.id) {
      subscription.shown = null
      return null
    }
    const outcome = await readEncounterDecisionSettlement(
      await this.#transaction(authorization, member, scope),
      shown
    )
    if (outcome === 'ANSWER') subscription.shown = null
    return (
      outcome && {
        occurrenceId: shown.occurrenceId,
        occurrenceVersion: shown.occurrenceVersion,
        outcome
      }
    )
  }
}
