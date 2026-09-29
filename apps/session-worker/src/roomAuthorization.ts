import type {
  LiveSessionRoomAuthorization,
  LiveSessionRoomAuthorizationInput,
  LiveSessionRoomAuthorizationResponse,
  LiveSessionRoomAuthorizationRevisions
} from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import type {
  LiveSessionTransientCapture,
  LiveSessionTransientMember
} from '@artificer-toolkit/schema/api/liveSessionTransient'
import { equalCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

import { ROOM_LIMITS } from './roomLimits.js'

type Load = (
  input: Pick<LiveSessionRoomAuthorizationInput, 'epoch' | 'known'>
) => Promise<LiveSessionRoomAuthorizationResponse>

/** Applies a read to the held cache: an omitted section is unchanged, so it must already be held. */
function mergeRoomAuthorization(
  held: LiveSessionRoomAuthorization | null,
  response: LiveSessionRoomAuthorizationResponse
): LiveSessionRoomAuthorization {
  const campaign = response.campaign ?? held?.campaign
  const preferences = response.preferences ?? held?.preferences
  const play = response.play ?? held?.play
  if (!campaign || !preferences || !play)
    throw new Error('Live Session authorization is incomplete.')
  const loaded = new Map(
    [...(held?.characters ?? []), ...response.characters].map((character) => [
      character.characterId,
      character
    ])
  )
  return {
    revisions: response.revisions,
    campaign,
    characters: response.revisions.characters.map(({ characterId }) => {
      const character = loaded.get(characterId)
      if (!character) throw new Error('Live Session authorization is incomplete.')
      return character
    }),
    preferences,
    play
  }
}

/** Whether `admission` is still a current member with the same role and membership epoch. */
export function admitsRoomMember(
  authorization: LiveSessionRoomAuthorization,
  admission: LiveSessionTransientMember
): boolean {
  return authorization.campaign.members.some(
    (member) =>
      member.userId === admission.userId &&
      member.role === admission.role &&
      member.membershipEpoch === admission.membershipEpoch
  )
}

/**
 * A player's control of each token bound to the Encounter on `scene` (D25): GM-granted control
 * while they are still a player, or their assigned Character's actor (ADR 0034 decision 1). Null
 * when the cached Encounter is not the one bound to that Scene.
 */
export function roomBoundTokenControl(
  authorization: LiveSessionRoomAuthorization,
  userId: string,
  scene: { sceneId: string; encounterId: string }
): LiveSessionTransientCapture['originBoundTokenControl'] | null {
  const { encounter } = authorization.play
  if (encounter?.sceneId !== scene.sceneId || encounter.encounterId !== scene.encounterId)
    return null
  const player = authorization.campaign.members.some(
    (member) => member.userId === userId && member.role === 'PLAYER'
  )
  const assignedCharacterId =
    authorization.campaign.assignments.find((assignment) => assignment.userId === userId)
      ?.characterId ?? null
  const actors = new Map(encounter.actors.map((actor) => [actor.id, actor]))
  return encounter.tokens.map(({ tokenId, actorId }) => {
    const actor = actors.get(actorId)
    return {
      tokenId,
      controlled:
        player &&
        !!actor &&
        (actor.controllerUserIds.includes(userId) ||
          (actor.kind === 'CHARACTER' && actor.sourceId === assignedCharacterId))
    }
  })
}

/** Whether every Character behind a cached Scene vision still has the revision it was built from. */
export function roomVisionCurrent(
  authorization: LiveSessionRoomAuthorization,
  observed: LiveSessionTransientCapture['observedCharacterRevisions']
): boolean {
  const revisions = new Map(
    authorization.revisions.characters.map(({ characterId, revision }) => [characterId, revision])
  )
  return observed.every(
    ({ characterId, revision }) =>
      revisions.has(characterId) && revisions.get(characterId) === revision
  )
}

/**
 * The room's authorization cache (ADR 0035 Amendment 14): membership, roles, Campaign Character
 * assignments, actor control, auto-roll preferences and party visibility. It is trusted for a
 * lease, and not at all once `INVALIDATE_INPUTS` marks it stale. A stale or expired cache is
 * reloaded by one read before the next command or broadcast; that read returns only changed sections.
 */
export class RoomAuthorization {
  readonly #load: Load
  #held: { epoch: string; value: LiveSessionRoomAuthorization } | null = null
  #leaseExpiresAt = 0
  #stale = false
  /** The room changed Encounter state itself, so the PLAY section reloads before previews use it. */
  #playStale = false
  /** Count invalidations, so a read that started before one does not clear it. */
  #changes = 0
  #playChanges = 0
  #reading: {
    changes: number
    playChanges: number
    epoch: string
    value: Promise<LiveSessionRoomAuthorization>
  } | null = null

  constructor(load: Load) {
    this.#load = load
  }

  /** The cache for `epoch` while its lease runs and no invalidation is pending, else null. */
  current(epoch: string, now = Date.now()): LiveSessionRoomAuthorization | null {
    return this.#held?.epoch === epoch && !this.#stale && now < this.#leaseExpiresAt
      ? this.#held.value
      : null
  }

  /** As `current`, and also null while the room's own Encounter changes have not been reloaded. */
  currentPlay(epoch: string, now = Date.now()): LiveSessionRoomAuthorization | null {
    return this.#playStale ? null : this.current(epoch, now)
  }

  invalidate(): void {
    this.#stale = true
    this.#changes += 1
  }

  invalidatePlay(): void {
    this.#playStale = true
    this.#playChanges += 1
  }

  /**
   * Renewal hook for checkpoint responses (S3): matching revisions renew the lease; different ones
   * mark the cache stale. Until checkpoints exist, each socket's re-authentication renews it by
   * `refresh`.
   */
  renew(epoch: string, revisions: LiveSessionRoomAuthorizationRevisions, now = Date.now()): void {
    if (this.#held?.epoch === epoch && equalCanonicalJson(this.#held.value.revisions, revisions))
      this.#leaseExpiresAt = now + ROOM_LIMITS.authorizationLeaseMs
    else this.invalidate()
  }

  /** Reads the current revisions and any changed sections; concurrent callers share one read. */
  refresh(epoch: string): Promise<LiveSessionRoomAuthorization> {
    const pending = this.#reading
    if (
      pending?.changes === this.#changes &&
      pending.playChanges === this.#playChanges &&
      pending.epoch === epoch
    )
      return pending.value
    const value = (pending ? pending.value.catch(() => null) : Promise.resolve(null)).then(() =>
      this.#read(epoch)
    )
    const reading = { changes: this.#changes, playChanges: this.#playChanges, epoch, value }
    this.#reading = reading
    const settle = () => {
      if (this.#reading === reading) this.#reading = null
    }
    value.then(settle, settle)
    return value
  }

  async #read(epoch: string): Promise<LiveSessionRoomAuthorization> {
    const changes = this.#changes
    const playChanges = this.#playChanges
    const startedAt = Date.now()
    const held = this.#held?.epoch === epoch ? this.#held.value : null
    const response = await this.#load({
      epoch,
      known: held ? { ...held.revisions, play: this.#playStale ? null : held.revisions.play } : null
    })
    const value = mergeRoomAuthorization(held, response)
    this.#held = { epoch, value }
    this.#leaseExpiresAt = startedAt + ROOM_LIMITS.authorizationLeaseMs
    if (changes === this.#changes) this.#stale = false
    if (playChanges === this.#playChanges) this.#playStale = false
    return value
  }
}
