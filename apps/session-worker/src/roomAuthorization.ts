import {
  liveSessionRoomAuthorizationSchema,
  liveSessionRoomPlayAuthorizationSchema,
  type LiveSessionRoomAuthorization,
  type LiveSessionRoomAuthorizationInput,
  type LiveSessionRoomAuthorizationResponse,
  type LiveSessionRoomAuthorizationRevisions
} from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import type { LiveSessionCheckpointAdoption } from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import type {
  LiveSessionRoomSceneCapture,
  LiveSessionTransientMember
} from '@artificer-toolkit/schema/api/liveSessionTransient'
import { controlsActorOrOwner } from '@artificer-toolkit/shared/campaign/actorOwnership'
import { controlsAssignedCharacter } from '@artificer-toolkit/shared/campaign/characterControl'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import { z } from 'zod'

import type { RoomStorage } from './roomEncounterStore.js'
import { ROOM_LIMITS } from './roomLimits.js'

/**
 * Each Encounter-bound token and whether a player controls its bound actor. Bound tokens follow
 * actor control, never the Scene token's `controlledByUserIds` (ADR 0034).
 */
export type BoundTokenControl = { tokenId: string; controlled: boolean }[]

type Load = (
  input: Pick<LiveSessionRoomAuthorizationInput, 'epoch' | 'known'>
) => Promise<LiveSessionRoomAuthorizationResponse>

/** What a hibernated room keeps of the cache: the lease and everything that can end or bound it. */
const persistedAuthorizationSchema = z.strictObject({
  held: z.nullable(
    z.strictObject({ epoch: z.string().min(1), value: liveSessionRoomAuthorizationSchema })
  ),
  leaseExpiresAt: z.number(),
  stale: z.boolean(),
  playStale: z.boolean(),
  localPlay: z.nullable(
    z.strictObject({ epoch: z.string().min(1), value: liveSessionRoomPlayAuthorizationSchema })
  )
})

function readPersistedAuthorization(state: unknown) {
  try {
    return persistedAuthorizationSchema.parse(JSON.parse(String(state)))
  } catch {
    return null
  }
}

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
 * while they are still a player, or the actor of a Character assigned to them or whose control the
 * GM granted them (ADR 0034 decision 1, D162), or an actor owned by one they control. Null
 * when the cached Encounter is not the one bound to that Scene.
 */
export function roomBoundTokenControl(
  authorization: LiveSessionRoomAuthorization,
  userId: string,
  scene: { sceneId: string; encounterId: string }
): BoundTokenControl | null {
  const { encounter } = authorization.play
  if (encounter?.sceneId !== scene.sceneId || encounter.encounterId !== scene.encounterId)
    return null
  const player = authorization.campaign.members.some(
    (member) => member.userId === userId && member.role === 'PLAYER'
  )
  const { assignments } = authorization.campaign
  const actors = new Map(encounter.actors.map((actor) => [actor.id, actor]))
  return encounter.tokens.map(({ tokenId, actorId }) => {
    const actor = actors.get(actorId)
    return {
      tokenId,
      controlled:
        player &&
        !!actor &&
        controlsActorOrOwner(
          actor,
          (ownerId) => actors.get(ownerId),
          (candidate) =>
            candidate.controllerUserIds.includes(userId) ||
            (candidate.kind === 'CHARACTER' &&
              controlsAssignedCharacter(
                assignments.find((assignment) => assignment.characterId === candidate.sourceId),
                userId
              ))
        )
    }
  })
}

/** `revisions` after a checkpoint's own writes: each adopted PLAY or Character revision replaces its old one. */
export function adoptRevisions(
  revisions: LiveSessionRoomAuthorizationRevisions,
  adopted: LiveSessionCheckpointAdoption
): LiveSessionRoomAuthorizationRevisions {
  const characters = new Map(
    adopted.characters.map(({ characterId, revision }) => [characterId, revision])
  )
  return {
    ...revisions,
    play: adopted.play ?? revisions.play,
    characters: revisions.characters.map(({ characterId, revision }) => ({
      characterId,
      revision: characters.get(characterId) ?? revision
    }))
  }
}

/**
 * A cached Scene vision's Character revisions after a checkpoint's own writes. Only a revision the
 * vision was built from at the `sent` revision follows the adoption; a Character someone else
 * changed in between keeps its old revision, so the vision still rebuilds.
 */
export function adoptSceneVisionRevisions(
  observed: LiveSessionRoomSceneCapture['observedCharacterRevisions'],
  sent: LiveSessionRoomAuthorizationRevisions,
  adopted: LiveSessionCheckpointAdoption
): LiveSessionRoomSceneCapture['observedCharacterRevisions'] {
  const sentRevisions = new Map(
    sent.characters.map(({ characterId, revision }) => [characterId, revision])
  )
  const adoptedRevisions = new Map(
    adopted.characters.map(({ characterId, revision }) => [characterId, revision])
  )
  return observed.map(({ characterId, revision }) => ({
    characterId,
    revision:
      sentRevisions.get(characterId) === revision
        ? (adoptedRevisions.get(characterId) ?? revision)
        : revision
  }))
}

/** Whether every Character behind a cached Scene vision still has the revision it was built from. */
export function roomVisionCurrent(
  authorization: LiveSessionRoomAuthorization,
  observed: LiveSessionRoomSceneCapture['observedCharacterRevisions']
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
 * The cache survives hibernation in room SQLite: a woken room trusts it for the rest of its lease,
 * and an invalidation made before sleep is still pending after it. Reads in flight do not survive.
 */
export class RoomAuthorization {
  readonly #load: Load
  readonly #sql: RoomStorage['sql']
  /** The state text last written, so an unchanged state is not written again. */
  #saved: string | null = null
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

  constructor(load: Load, sql: RoomStorage['sql']) {
    this.#load = load
    this.#sql = sql
    sql.exec(`
      CREATE TABLE IF NOT EXISTS room_authorization (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        state TEXT NOT NULL
      )
    `)
    const row = sql.exec('SELECT state FROM room_authorization WHERE id = 1').toArray()[0]
    if (!row) return
    const restored = readPersistedAuthorization(row.state)
    if (!restored) {
      sql.exec('DELETE FROM room_authorization WHERE id = 1')
      return
    }
    this.#held = restored.held
    this.#leaseExpiresAt = restored.leaseExpiresAt
    this.#stale = restored.stale
    this.#playStale = restored.playStale
    this.#localPlay = restored.localPlay
    this.#saved = String(row.state)
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
    this.#persist()
  }

  invalidatePlay(): void {
    this.#localPlay = null
    this.#playStale = true
    this.#playChanges += 1
    this.#persist()
  }

  /** Room-owned control changes stay visible while their checkpoint is still pending. */
  applyPlay(epoch: string, play: LiveSessionRoomAuthorization['play']): void {
    if (this.#held?.epoch !== epoch) throw new Error('Room authorization epoch changed.')
    this.#localPlay = { epoch, value: play }
    this.#held.value = { ...this.#held.value, play }
    this.#playStale = false
    this.#playChanges += 1
    this.#persist()
  }

  /** Party visibility follows native play immediately, including an unpublished checkpoint suffix. */
  applyCharacters(epoch: string, characters: LiveSessionRoomAuthorization['characters']): void {
    if (this.#held?.epoch !== epoch) throw new Error('Room authorization epoch changed.')
    this.#held.value = { ...this.#held.value, characters }
    this.#persist()
  }

  acknowledgePlay(epoch: string): void {
    if (this.#localPlay?.epoch === epoch) this.#localPlay = null
    this.#persist()
  }

  /**
   * Takes the PLAY and Character revisions a checkpoint's own writes bumped, so those writes do not
   * look like someone else's change. Applies only while the cache still holds the revisions the
   * checkpoint was sent with; the lease is untouched. A revision not adopted stays old, and the
   * next read fetches that section.
   */
  adopt(
    epoch: string,
    sent: LiveSessionRoomAuthorizationRevisions,
    adopted: LiveSessionCheckpointAdoption
  ): void {
    if (
      this.#held?.epoch !== epoch ||
      canonicalizeJson(this.#held.value.revisions) !== canonicalizeJson(sent)
    )
      return
    this.#held.value = { ...this.#held.value, revisions: adoptRevisions(sent, adopted) }
    // A read that started before the checkpoint may return pre-checkpoint revisions.
    if (this.#reading) this.invalidate()
    else this.#persist()
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
    this.#persist()
    return value
  }

  #persist(): void {
    const state = JSON.stringify({
      held: this.#held,
      leaseExpiresAt: this.#leaseExpiresAt,
      stale: this.#stale,
      playStale: this.#playStale,
      localPlay: this.#localPlay
    } satisfies z.infer<typeof persistedAuthorizationSchema>)
    if (state === this.#saved) return
    this.#sql.exec(
      `INSERT INTO room_authorization (id, state) VALUES (1, ?)
       ON CONFLICT (id) DO UPDATE SET state = excluded.state`,
      state
    )
    this.#saved = state
  }
}
