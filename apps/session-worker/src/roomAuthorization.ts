import type {
  LiveSessionRoomAuthorization,
  LiveSessionRoomAuthorizationInput,
  LiveSessionRoomAuthorizationResponse,
  LiveSessionRoomAuthorizationRevisions
} from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import type { LiveSessionCheckpointAdoption } from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import type {
  LiveSessionTransientCapture,
  LiveSessionTransientMember
} from '@artificer-toolkit/schema/api/liveSessionTransient'

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
 * What a Character's projection is built from besides its play state: the System, Campaign and
 * Character revisions. A feed that remembers it pushes again after a Builder or content edit that
 * leaves the play stream version unchanged.
 */
export function roomCharacterInputsKey(
  authorization: LiveSessionRoomAuthorization,
  characterId: string
): string {
  const { system, campaign, characters } = authorization.revisions
  return `${system}:${campaign}:${characters.find((entry) => entry.characterId === characterId)?.revision}`
}

/**
 * The room's authorization cache (ADR 0035 Amendment 14): membership, roles, Campaign Character
 * assignments, actor control, auto-roll preferences and party visibility. It is trusted for a
 * lease, and not at all once `INVALIDATE_INPUTS` marks it stale. A stale or expired cache is
 * reloaded by one read before the next command or broadcast; that read returns only changed sections.
 * A checkpoint never renews it; the room does, by one read per half-lease while members are connected.
 */
export class RoomAuthorization {
  readonly #load: Load
  #held: { epoch: string; value: LiveSessionRoomAuthorization } | null = null
  #leaseExpiresAt = 0
  #stale = false
  /** The room changed Encounter state itself, so the PLAY section reloads before previews use it. */
  #playStale = false
  #localPlay: { epoch: string; value: LiveSessionRoomAuthorization['play'] } | null = null
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
    this.#localPlay = null
    this.#playStale = true
    this.#playChanges += 1
  }

  /** Room-owned control changes stay visible while their checkpoint is still pending. */
  applyPlay(epoch: string, play: LiveSessionRoomAuthorization['play']): void {
    if (this.#held?.epoch !== epoch) throw new Error('Room authorization epoch changed.')
    this.#localPlay = { epoch, value: play }
    this.#held.value = { ...this.#held.value, play }
    this.#playStale = false
    this.#playChanges += 1
  }

  /** Party visibility follows native play immediately, including an unpublished checkpoint suffix. */
  applyCharacters(epoch: string, characters: LiveSessionRoomAuthorization['characters']): void {
    if (this.#held?.epoch !== epoch) throw new Error('Room authorization epoch changed.')
    this.#held.value = { ...this.#held.value, characters }
  }

  acknowledgePlay(epoch: string): void {
    if (this.#localPlay?.epoch === epoch) this.#localPlay = null
  }

  /**
   * Takes the PLAY and Character revisions a checkpoint's own writes bumped, so those writes do not
   * look like someone else's change. Applies only while the cache still holds the revisions the
   * checkpoint was sent with; the lease is untouched. A revision not adopted stays old, and the
   * next read fetches that section.
   */
  adopt(
    epoch: string,
    sent: LiveSessionRoomAuthorizationRevisions | null,
    adopted: LiveSessionCheckpointAdoption
  ): void {
    if (!sent || this.#held?.epoch !== epoch || this.#held.value.revisions !== sent) return
    const characters = new Map(
      adopted.characters.map(({ characterId, revision }) => [characterId, revision])
    )
    this.#held.value = {
      ...this.#held.value,
      revisions: {
        ...sent,
        play: adopted.play ?? sent.play,
        characters: sent.characters.map(({ characterId, revision }) => ({
          characterId,
          revision: characters.get(characterId) ?? revision
        }))
      }
    }
    // A read that started before the checkpoint may return pre-checkpoint revisions.
    if (this.#reading) this.invalidate()
  }

  /** Whether half the lease has passed since the last read, so a renewal read should start. */
  renewalDue(now = Date.now()): boolean {
    return this.#held !== null && now >= this.#leaseExpiresAt - ROOM_LIMITS.authorizationLeaseMs / 2
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
    const value = mergeRoomAuthorization(
      this.#held?.epoch === epoch ? this.#held.value : null,
      response
    )
    if (this.#localPlay?.epoch === epoch) value.play = this.#localPlay.value
    this.#held = { epoch, value }
    this.#leaseExpiresAt = startedAt + ROOM_LIMITS.authorizationLeaseMs
    if (changes === this.#changes) this.#stale = false
    if (playChanges === this.#playChanges) this.#playStale = false
    return value
  }
}
