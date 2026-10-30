import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { listActiveRuleEffects } from '@artificer-toolkit/encounter-persistence/effectStore'
import type { LiveSessionWebSocketServerMessageDto } from '@artificer-toolkit/schema/api/liveSessions'
import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import type { EncounterSpellSummon } from '@artificer-toolkit/rules-runtime/character/sheetSpellSummon'
import { readRoomCharacterConcentration } from './roomCharacterConcentration.js'
import { readRoomCharacterSummons } from './roomCharacterSummons.js'
import { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'
import { projectRoomCharacterSheetForViewer } from './roomCharacterSheetProjection.js'
import type { RoomEncounterStore } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'
import { admitsRoomMember, roomCharacterInputsKey } from './roomAuthorization.js'

export interface FeedMember {
  membershipEpoch: string
  role: 'OWNER' | 'PLAYER'
  userId: string
}

export interface FeedScope {
  authorityEpoch: string
  campaignId: string
}

interface Subscription {
  characterId: string
  /** The play stream version, input revisions and owned summons' hit points last pushed; null until the first push. */
  pushedKey: string | null
}

/** The Characters the campaign's ACTIVE Runs hold in the room, as live actors. */
export async function heldCharacterIds(
  store: RoomEncounterStore,
  campaignId: string
): Promise<Set<string>> {
  const held = new Set<string>()
  for (const run of store.documents('encounterRuns')) {
    const state = readRunState(run)
    if (state.status !== 'ACTIVE' || state.campaignId !== campaignId) continue
    for (const actor of await readRunActors({ db: store.store }, state))
      if (actor.kind === 'CHARACTER' && actor.frozenState === null) held.add(actor.sourceId)
  }
  return held
}

/**
 * The held Character Sheets pushed to their owner's and the Campaign GM's sockets (D73). A socket
 * holds at most one subscription; every push re-admits it against the current authorization and
 * the active Run, so a lost assignment or hold silently ends the subscription.
 */
export class RoomCharacterSheetFeed {
  readonly #subscriptions = new Map<WebSocket, Subscription>()

  constructor(
    private readonly dependencies: {
      store: RoomEncounterStore
      inputs: RoomInputs
      authorize: (scope: FeedScope) => Promise<LiveSessionRoomAuthorization>
      admission: (socket: WebSocket) => FeedMember | null
      scope: (socket: WebSocket) => FeedScope | null
      send: (socket: WebSocket, message: LiveSessionWebSocketServerMessageDto) => void
      remember: (socket: WebSocket) => void
    }
  ) {}

  get size(): number {
    return this.#subscriptions.size
  }

  subscribe(socket: WebSocket, characterId: string): void {
    this.restore(socket, characterId.toLowerCase())
    this.dependencies.remember(socket)
  }

  drop(socket: WebSocket): void {
    if (this.#subscriptions.delete(socket)) this.dependencies.remember(socket)
  }

  /** The Character this socket subscribed to: all that survives hibernation. */
  saved(socket: WebSocket): string | null {
    return this.#subscriptions.get(socket)?.characterId ?? null
  }

  /** Resubscribes a woken socket; the next push sends its Sheet again. */
  restore(socket: WebSocket, characterId: string): void {
    this.#subscriptions.set(socket, { characterId, pushedKey: null })
  }

  /** Pushes every subscribed Sheet whose play stream version changed since its last push. */
  async push(): Promise<void> {
    const { store, inputs } = this.dependencies
    const stale = new Map<
      string,
      {
        authorization: LiveSessionRoomAuthorization
        characterId: string
        member: FeedMember
        pushedKey: string
        scope: FeedScope
        sockets: WebSocket[]
        summons: EncounterSpellSummon[]
      }
    >()
    for (const [socket, subscription] of this.#subscriptions) {
      const member = this.dependencies.admission(socket)
      const scope = this.dependencies.scope(socket)
      const admitted =
        member && scope ? await this.#admit(scope, member, subscription.characterId) : null
      if (!member || !scope || !admitted) {
        this.drop(socket)
        continue
      }
      const play = await store.store
        .query('characterPlayStates')
        .withIndex('by_characterId', (query) => query.eq('characterId', subscription.characterId))
        .unique()
      if (!play) {
        this.drop(socket)
        continue
      }
      // Run actors change outside the Character's stream, so their live hit points key the push too.
      const summons = await readRoomCharacterSummons(
        store,
        scope.campaignId,
        subscription.characterId
      )
      const summonsKey = summons
        .map(
          ({ actor }) =>
            `${actor.id}/${actor.currentHitPoints}/${actor.maxHitPoints}/${actor.tempHitPoints}`
        )
        .join(',')
      const pushedKey = `${play.streamVersion}:${roomCharacterInputsKey(admitted.authorization, subscription.characterId)}:${summonsKey}`
      if (pushedKey === subscription.pushedKey) continue
      // The viewer kind decides the redactions, so one projection serves each kind.
      const key = `${subscription.characterId}:${admitted.viewer}:${pushedKey}`
      const group = stale.get(key) ?? {
        authorization: admitted.authorization,
        characterId: subscription.characterId,
        member,
        pushedKey,
        scope,
        sockets: [],
        summons
      }
      group.sockets.push(socket)
      stale.set(key, group)
    }
    for (const {
      authorization,
      characterId,
      member,
      pushedKey,
      scope,
      sockets,
      summons
    } of stale.values()) {
      // No transaction: preparation is read-only for product state (reconciliation writes need one), so a push never writes outside a journaled transaction; the next command's transaction reconciles and a later push shows it.
      const facts = await prepareRoomLiveCharacterSheet(
        store,
        inputs,
        {
          campaignId: scope.campaignId,
          authorityEpoch: scope.authorityEpoch,
          characterId,
          expectedUserId: member.userId,
          expectedRole: member.role
        },
        inputs.revisions(scope.campaignId, authorization.revisions)
      )
      const sheet = projectRoomCharacterSheetForViewer(
        facts,
        await listActiveRuleEffects(
          { db: store.store },
          { kind: 'CHARACTER', characterId },
          { ownerVerified: true }
        ),
        facts.campaignContext.viewer,
        await readRoomCharacterConcentration(store, scope.campaignId, characterId),
        summons
      )
      const streamVersion = facts.active.play.streamVersion
      for (const socket of sockets) {
        const subscription = this.#subscriptions.get(socket)
        // The socket may have left or resubscribed while the Sheet was prepared.
        if (subscription?.characterId !== characterId) continue
        subscription.pushedKey = pushedKey
        this.dependencies.send(socket, {
          type: 'CHARACTER_SHEET',
          characterId,
          sheet,
          streamVersion
        })
      }
    }
  }

  /** Only the Character's owner or the Campaign GM, while an active Run holds the Character. */
  async #admit(scope: FeedScope, member: FeedMember, characterId: string) {
    const authorization = await this.dependencies.authorize(scope)
    if (!admitsRoomMember(authorization, member)) return null
    const assigned = authorization.campaign.assignments.find(
      (entry) => entry.characterId === characterId
    )
    const character = authorization.characters.find((entry) => entry.characterId === characterId)
    if (
      !assigned ||
      !character ||
      assigned.userId !== character.ownerUserId ||
      (member.role !== 'OWNER' && assigned.userId !== member.userId) ||
      !(await heldCharacterIds(this.dependencies.store, scope.campaignId)).has(characterId)
    )
      return null
    return {
      authorization,
      viewer: character.ownerUserId === member.userId ? 'CHARACTER_OWNER' : 'CAMPAIGN_OWNER'
    } as const
  }
}
