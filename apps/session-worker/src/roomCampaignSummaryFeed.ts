import { listActiveRuleEffects } from '@artificer-toolkit/encounter-persistence/effectStore'
import { presentEncounterRun } from '@artificer-toolkit/encounter-persistence/sessionReads'
import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import type {
  LiveCampaignSummaryDto,
  LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import { admitsRoomMember, roomCharacterInputsKey } from './roomAuthorization.js'
import { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'
import { heldCharacterIds, type FeedMember, type FeedScope } from './roomCharacterSheetFeed.js'
import { projectRoomCharacterSheetForViewer } from './roomCharacterSheetProjection.js'
import { roomEncounterReadTransaction, type RoomSceneTokens } from './roomEncounterReadPorts.js'
import type { RoomEncounterStore } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'

interface Subscription {
  /** What the last build read, so an unchanged room skips the build. */
  inputsKey: string | null
  /** The summary last sent, serialized; an identical summary is not sent again. */
  sent: string | null
}

type Viewer = 'CAMPAIGN_OWNER' | 'CHARACTER_OWNER' | 'PARTY_MEMBER'

/**
 * The live Campaign summary (ADR 0035 Amendment 19): the held Characters' hit points and
 * conditions and the ACTIVE Run's round and current actor, pushed to subscribed sockets so the
 * Campaign page needs no polling. It never widens what Convex shows the member: a Character
 * appears only if the member could read its common Sheet slice (owner, GM or party-visible Sheet),
 * through the Sheet feed's viewer projection, and only the ACTIVE Run appears, through the same
 * player projection as the Encounter feed.
 */
export class RoomCampaignSummaryFeed {
  readonly #subscriptions = new Map<WebSocket, Subscription>()

  constructor(
    private readonly dependencies: {
      store: RoomEncounterStore
      inputs: RoomInputs
      authorize: (scope: FeedScope) => Promise<LiveSessionRoomAuthorization>
      admission: (socket: WebSocket) => FeedMember | null
      scope: (socket: WebSocket) => FeedScope | null
      sceneTokens: (scope: FeedScope) => RoomSceneTokens
      send: (socket: WebSocket, message: LiveSessionWebSocketServerMessageDto) => void
      remember: (socket: WebSocket) => void
    }
  ) {}

  get size(): number {
    return this.#subscriptions.size
  }

  subscribe(socket: WebSocket): void {
    this.restore(socket)
    this.dependencies.remember(socket)
  }

  drop(socket: WebSocket): void {
    if (this.#subscriptions.delete(socket)) this.dependencies.remember(socket)
  }

  /** Whether this socket subscribed: all that survives hibernation. */
  saved(socket: WebSocket): boolean {
    return this.#subscriptions.has(socket)
  }

  /** Resubscribes a woken socket; the next push sends its summary again. */
  restore(socket: WebSocket): void {
    this.#subscriptions.set(socket, { inputsKey: null, sent: null })
  }

  /** Sends each subscribed socket its summary when it differs from the last one sent. */
  async push(): Promise<void> {
    const { store } = this.dependencies
    // Facts and entries are shared across the sockets of one push.
    const entries = new Map<string, Promise<LiveCampaignSummaryDto['characters'][number]>>()
    const encounters = new Map<string, Promise<LiveCampaignSummaryDto['encounter']>>()
    const held = new Map<string, Promise<Set<string>>>()
    for (const [socket, subscription] of this.#subscriptions) {
      const member = this.dependencies.admission(socket)
      const scope = this.dependencies.scope(socket)
      const authorization = member && scope ? await this.dependencies.authorize(scope) : null
      if (!member || !scope || !authorization || !admitsRoomMember(authorization, member)) {
        this.drop(socket)
        continue
      }
      const heldIds = await memo(held, scope.campaignId, () =>
        heldCharacterIds(store, scope.campaignId)
      )
      const active =
        store
          .documents('encounterRuns')
          .find((run) => run.campaignId === scope.campaignId && run.status === 'ACTIVE') ?? null
      const visible = active
        ? [...heldIds].flatMap((characterId) => {
            const viewer = this.#viewer(authorization, member, characterId)
            return viewer ? [{ characterId, viewer }] : []
          })
        : []
      const play = await Promise.all(
        visible.map(({ characterId }) =>
          store.store
            .query('characterPlayStates')
            .withIndex('by_characterId', (query) => query.eq('characterId', characterId))
            .unique()
        )
      )
      const inputsKey = [
        active ? `${active.id}:${active.version}:${member.role}:${member.userId}` : 'none',
        ...visible.map(
          ({ characterId, viewer }, index) =>
            `${characterId}:${viewer}:${play[index]?.streamVersion}:${roomCharacterInputsKey(authorization, characterId)}`
        )
      ].join('|')
      if (inputsKey === subscription.inputsKey) continue
      const summary: LiveCampaignSummaryDto = {
        characters: await Promise.all(
          visible.map(({ characterId, viewer }, index) =>
            memo(
              entries,
              `${characterId}:${viewer}:${play[index]?.streamVersion}:${roomCharacterInputsKey(authorization, characterId)}`,
              () => this.#character(authorization, scope, characterId, viewer)
            )
          )
        ),
        encounter: active
          ? await memo(encounters, `${member.userId}:${active.version}`, () =>
              this.#encounter(authorization, scope, member, active.id)
            )
          : null
      }
      const serialized = JSON.stringify(summary)
      // The socket may have left or resubscribed while the summary was built.
      const current = this.#subscriptions.get(socket)
      if (current !== subscription) continue
      subscription.inputsKey = inputsKey
      if (serialized === subscription.sent) continue
      subscription.sent = serialized
      this.dependencies.send(socket, { type: 'CAMPAIGN_SUMMARY', summary })
    }
  }

  /**
   * How `member` reads the Character's common Sheet slice, or null if Convex would refuse it: the
   * Character must be assigned to its owner, and a member who is neither its owner nor the GM
   * needs a party-visible Sheet.
   */
  #viewer(
    authorization: LiveSessionRoomAuthorization,
    member: FeedMember,
    characterId: string
  ): Viewer | null {
    const assigned = authorization.campaign.assignments.find(
      (entry) => entry.characterId === characterId
    )
    const character = authorization.characters.find((entry) => entry.characterId === characterId)
    if (!assigned || !character || assigned.userId !== character.ownerUserId) return null
    if (character.ownerUserId === member.userId) return 'CHARACTER_OWNER'
    if (member.role === 'OWNER') return 'CAMPAIGN_OWNER'
    return character.partyVisibility.sheet ? 'PARTY_MEMBER' : null
  }

  async #character(
    authorization: LiveSessionRoomAuthorization,
    scope: FeedScope,
    characterId: string,
    viewer: Viewer
  ): Promise<LiveCampaignSummaryDto['characters'][number]> {
    const { store, inputs } = this.dependencies
    const ownerUserId = authorization.characters.find(
      (entry) => entry.characterId === characterId
    )?.ownerUserId
    if (!ownerUserId) throw new Error('Summary Character is not in the authorization cache.')
    // Read-only preparation, as in the Sheet feed: a push never writes outside a journaled transaction.
    const facts = await prepareRoomLiveCharacterSheet(
      store,
      inputs,
      {
        campaignId: scope.campaignId,
        authorityEpoch: scope.authorityEpoch,
        characterId,
        expectedUserId: ownerUserId,
        expectedRole: ownerUserId === authorization.campaign.ownerUserId ? 'OWNER' : 'PLAYER'
      },
      inputs.revisions(scope.campaignId, authorization.revisions)
    )
    const { overview } = projectRoomCharacterSheetForViewer(
      facts,
      await listActiveRuleEffects(
        { db: store.store },
        { kind: 'CHARACTER', characterId },
        { ownerVerified: true }
      ),
      viewer
    )
    return {
      characterId,
      currentHitPoints: overview.currentHitPoints,
      maxHitPoints: overview.maxHitPoints,
      tempHitPoints: overview.tempHitPoints,
      conditions: overview.conditions
    }
  }

  async #encounter(
    authorization: LiveSessionRoomAuthorization,
    scope: FeedScope,
    member: FeedMember,
    runId: string
  ): Promise<LiveCampaignSummaryDto['encounter']> {
    const { store, inputs } = this.dependencies
    const row = store.documents('encounterRuns').find((run) => run.id === runId)
    if (row?.status !== 'ACTIVE') return null
    const transaction = await roomEncounterReadTransaction({
      store,
      inputs,
      authorization,
      campaignId: scope.campaignId,
      epoch: scope.authorityEpoch,
      userId: member.userId,
      observed: inputs.revisions(scope.campaignId, authorization.revisions),
      sceneTokens: this.dependencies.sceneTokens(scope)
    })
    const { campaign, membership } = await transaction.ports.requireCampaignAuthority(
      scope.campaignId,
      member.userId
    )
    const run = await presentEncounterRun(transaction, row, campaign, membership)
    return {
      encounterId: run.id,
      status: 'ACTIVE',
      round: run.round,
      currentActorId: run.currentActorId
    }
  }
}

function memo<T>(cache: Map<string, Promise<T>>, key: string, build: () => Promise<T>): Promise<T> {
  const cached = cache.get(key)
  if (cached) return cached
  const built = build()
  cache.set(key, built)
  return built
}
