import { describe, expect, it, vi } from 'vitest'
import type {
  LiveSessionRoomAuthorizationInput,
  LiveSessionRoomAuthorizationResponse
} from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import {
  admitsRoomMember,
  RoomAuthorization,
  roomBoundTokenControl,
  roomVisionCurrent
} from './roomAuthorization.js'
import { ROOM_LIMITS } from './roomLimits.js'

const id = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
const epoch = id(1)
const ownerId = id(2)
const playerId = id(3)
const otherPlayerId = id(4)
const characterId = id(5)
const otherCharacterId = id(6)
const encounterId = id(7)
const sceneId = id(8)
const tokenId = id(9)
const otherTokenId = id(10)
const characterActorId = id(11)
const creatureActorId = id(12)
const membershipEpoch = '2026-09-28T00:00:00.000Z'
const preferencesDigest = (index: number) => String(index).repeat(64)

type Response = LiveSessionRoomAuthorizationResponse
type Known = LiveSessionRoomAuthorizationInput['known']

function members(...players: string[]) {
  return [
    { membershipEpoch, role: 'OWNER' as const, userId: ownerId },
    ...players.map((userId) => ({ membershipEpoch, role: 'PLAYER' as const, userId }))
  ]
}

/** A full first read: two players, each with an assigned Character on the bound Encounter. */
function fullResponse(): Response {
  return {
    revisions: {
      system: null,
      campaign: id(100),
      play: id(200),
      characters: [
        { characterId, revision: id(300) },
        { characterId: otherCharacterId, revision: id(301) }
      ],
      preferences: preferencesDigest(1)
    },
    campaign: {
      ownerUserId: ownerId,
      members: members(playerId, otherPlayerId),
      assignments: [
        { characterId, userId: playerId },
        { characterId: otherCharacterId, userId: otherPlayerId }
      ]
    },
    characters: [
      {
        characterId,
        ownerUserId: playerId,
        partyVisibility: { sheet: true, health: 'EXACT' }
      },
      {
        characterId: otherCharacterId,
        ownerUserId: otherPlayerId,
        partyVisibility: { sheet: false, health: 'HIDDEN' }
      }
    ],
    preferences: [
      { userId: ownerId, autoRollDice: false, gmRollVisibility: 'PUBLIC', username: 'TableGm' },
      { userId: playerId, autoRollDice: true, gmRollVisibility: 'PUBLIC', username: 'TablePlayer' },
      {
        userId: otherPlayerId,
        autoRollDice: false,
        gmRollVisibility: 'PUBLIC',
        username: 'OtherPlayer'
      }
    ],
    play: {
      encounter: {
        encounterId,
        sceneId,
        healthDisplayDefault: 'HIDDEN',
        actors: [
          {
            id: characterActorId,
            kind: 'CHARACTER',
            sourceId: characterId,
            controllerUserIds: [],
            healthDisplay: null
          },
          {
            id: creatureActorId,
            kind: 'CREATURE',
            sourceId: null,
            controllerUserIds: [otherPlayerId],
            healthDisplay: 'BAR'
          }
        ],
        tokens: [
          { tokenId, actorId: characterActorId },
          { tokenId: otherTokenId, actorId: creatureActorId }
        ]
      }
    }
  }
}

/** A cache whose reads answer from `responses` in order and record what the room already knew. */
function cacheWith(...responses: Response[]) {
  const known: Known[] = []
  const load = vi.fn(async (input: Pick<LiveSessionRoomAuthorizationInput, 'epoch' | 'known'>) => {
    known.push(input.known)
    const response = responses.shift()
    if (!response) throw new Error('Unexpected authorization read.')
    return response
  })
  return { cache: new RoomAuthorization(load), known, load }
}

/** An unchanged read: the current revisions and no sections. */
function unchanged(response: Response): Response {
  return { revisions: response.revisions, characters: [] }
}

describe('room authorization cache', () => {
  it('loads every section once, then reads only revisions and keeps unchanged sections', async () => {
    const first = fullResponse()
    const { cache, known } = cacheWith(first, unchanged(first))

    const loaded = await cache.refresh(epoch)
    const renewed = await cache.refresh(epoch)

    expect(known).toEqual([null, first.revisions])
    expect(renewed).toEqual(loaded)
    expect(cache.current(epoch)).toBe(renewed)
    expect(cache.current(id(99))).toBeNull()
  })

  it('refuses the cache past its lease until a read renews it', async () => {
    const first = fullResponse()
    const { cache } = cacheWith(first, unchanged(first))
    const start = Date.now()
    await cache.refresh(epoch)

    expect(cache.current(epoch, start + ROOM_LIMITS.authorizationLeaseMs - 1_000)).not.toBeNull()
    expect(cache.current(epoch, Date.now() + ROOM_LIMITS.authorizationLeaseMs)).toBeNull()
    await cache.refresh(epoch)
    expect(cache.current(epoch)).not.toBeNull()
  })

  it('is refused from an invalidation until the next read, which an earlier read cannot satisfy', async () => {
    const first = fullResponse()
    let release: (value: Response) => void = () => undefined
    const load = vi
      .fn<(input: { known: Known }) => Promise<Response>>()
      .mockResolvedValueOnce(first)
      .mockImplementationOnce(() => new Promise((resolve) => (release = resolve)))
      .mockResolvedValueOnce(unchanged(first))
    const cache = new RoomAuthorization(load)
    await cache.refresh(epoch)

    cache.invalidate()
    expect(cache.current(epoch)).toBeNull()
    const racing = cache.refresh(epoch)
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2))
    // A notice arriving while that read runs needs a read that starts after it.
    cache.invalidate()
    release(unchanged(first))
    await racing
    expect(cache.current(epoch)).toBeNull()
    await cache.refresh(epoch)
    expect(cache.current(epoch)).not.toBeNull()
    expect(load).toHaveBeenCalledTimes(3)
  })

  it('shares one read between concurrent callers', async () => {
    const first = fullResponse()
    const { cache, load } = cacheWith(first)
    await Promise.all([cache.refresh(epoch), cache.refresh(epoch), cache.refresh(epoch)])
    expect(load).toHaveBeenCalledOnce()
  })

  it('renews its lease from matching checkpoint revisions and invalidates on any other', async () => {
    const first = fullResponse()
    const { cache } = cacheWith(first)
    await cache.refresh(epoch)
    const later = Date.now() + ROOM_LIMITS.authorizationLeaseMs - 1

    cache.renew(epoch, first.revisions, later)
    expect(cache.current(epoch, later + 1)).not.toBeNull()
    cache.renew(epoch, { ...first.revisions, campaign: id(101) })
    expect(cache.current(epoch)).toBeNull()
  })

  it('requires a full authorization read for an incomplete checkpoint on an empty epoch cache', () => {
    const first = fullResponse()
    const { cache, load } = cacheWith(first)
    expect(cache.acceptCheckpoint(epoch, unchanged(first))).toBe(false)
    for (const section of ['campaign', 'preferences', 'play'] as const)
      expect(cache.acceptCheckpoint(epoch, { ...first, [section]: undefined })).toBe(false)
    expect(cache.acceptCheckpoint(epoch, { ...first, characters: first.characters.slice(1) })).toBe(
      false
    )
    expect(cache.current(epoch)).toBeNull()
    expect(cache.acceptCheckpoint(epoch, first)).toBe(true)
    expect(cache.currentPlay(epoch)).toEqual(first)
    expect(cache.acceptCheckpoint(id(99), unchanged(first))).toBe(false)
    expect(() =>
      cache.acceptCheckpoint(epoch, {
        ...unchanged(first),
        revisions: {
          ...first.revisions,
          characters: [...first.revisions.characters, { characterId: id(99), revision: id(399) }]
        }
      })
    ).toThrow('incomplete')
    expect(load).not.toHaveBeenCalled()
  })

  it('merges checkpoint sections and renews the lease without reading or replacing pending local PLAY', async () => {
    const first = fullResponse()
    const checkpoint: Response = {
      revisions: {
        ...first.revisions,
        play: id(201),
        characters: [
          { characterId, revision: id(310) },
          { characterId: otherCharacterId, revision: id(301) }
        ],
        preferences: preferencesDigest(2)
      },
      characters: [
        {
          characterId,
          ownerUserId: playerId,
          partyVisibility: { sheet: false, health: 'HIDDEN' }
        }
      ],
      preferences: first.preferences!.map((preference) =>
        preference.userId === playerId ? { ...preference, autoRollDice: false } : preference
      ),
      play: first.play
    }
    const { cache, load } = cacheWith(first)
    await cache.refresh(epoch)
    const localPlay = {
      encounter: {
        ...first.play!.encounter!,
        actors: first.play!.encounter!.actors.map((actor) =>
          actor.id === creatureActorId ? { ...actor, controllerUserIds: [playerId] } : actor
        )
      }
    }
    cache.applyPlay(epoch, localPlay)
    const acceptedAt = Date.now() + ROOM_LIMITS.authorizationLeaseMs
    expect(cache.acceptCheckpoint(epoch, checkpoint, acceptedAt)).toBe(true)
    const current = cache.currentPlay(epoch, acceptedAt)!
    expect(current.revisions).toEqual(checkpoint.revisions)
    expect(current.characters[0]).toEqual(checkpoint.characters[0])
    expect(current.preferences).toEqual(checkpoint.preferences)
    expect(current.campaign).toEqual(first.campaign)
    expect(current.play).toEqual(localPlay)
    expect(roomBoundTokenControl(current, playerId, { sceneId, encounterId })?.[1]).toEqual({
      tokenId: otherTokenId,
      controlled: true
    })
    expect(cache.current(epoch, acceptedAt + ROOM_LIMITS.authorizationLeaseMs - 1)).not.toBeNull()
    expect(cache.current(epoch, acceptedAt + ROOM_LIMITS.authorizationLeaseMs)).toBeNull()
    cache.acknowledgePlay(epoch)
    expect(
      cache.acceptCheckpoint(
        epoch,
        { ...unchanged(checkpoint), play: checkpoint.play },
        acceptedAt + 1
      )
    ).toBe(true)
    expect(cache.currentPlay(epoch, acceptedAt + 1)?.play).toEqual(checkpoint.play)
    expect(load).toHaveBeenCalledOnce()
  })

  it('keeps invalidated admissions closed through a checkpoint and an older in-flight read', async () => {
    const first = fullResponse()
    const checkpoint: Response = {
      revisions: {
        ...first.revisions,
        campaign: id(101),
        characters: [{ characterId, revision: id(300) }]
      },
      campaign: {
        ownerUserId: ownerId,
        members: members(playerId),
        assignments: [{ characterId, userId: playerId }]
      },
      characters: []
    }
    const { cache, load } = cacheWith(first, checkpoint)
    await cache.refresh(epoch)
    cache.invalidate()
    cache.invalidatePlay()
    cache.acceptCheckpoint(epoch, checkpoint)
    expect(cache.current(epoch)).toBeNull()
    expect(cache.currentPlay(epoch)).toBeNull()
    expect(load).toHaveBeenCalledOnce()
    let release: (value: Response) => void = () => undefined
    load.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)))
    const racing = cache.refresh(epoch)
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2))
    cache.acceptCheckpoint(epoch, checkpoint)
    expect(cache.current(epoch)).toBeNull()
    release(first)
    await racing
    expect(cache.current(epoch)).toBeNull()
    expect(cache.currentPlay(epoch)).toBeNull()
    const refreshed = await cache.refresh(epoch)
    expect(cache.currentPlay(epoch)).toBe(refreshed)
    expect(
      admitsRoomMember(refreshed, {
        membershipEpoch,
        role: 'PLAYER',
        userId: otherPlayerId
      })
    ).toBe(false)
    expect(load).toHaveBeenCalledTimes(3)
  })

  it('drops a removed member and their GM-granted control at the next read', async () => {
    const first = fullResponse()
    // The departure removed the member; its Encounter controller entry may still be stored.
    const removed: Response = {
      revisions: {
        ...first.revisions,
        campaign: id(102),
        characters: [{ characterId, revision: id(300) }]
      },
      campaign: {
        ownerUserId: ownerId,
        members: members(playerId),
        assignments: [{ characterId, userId: playerId }]
      },
      characters: []
    }
    const { cache } = cacheWith(first, removed)
    const loaded = await cache.refresh(epoch)
    const departing = { membershipEpoch, role: 'PLAYER' as const, userId: otherPlayerId }
    expect(admitsRoomMember(loaded, departing)).toBe(true)
    expect(roomBoundTokenControl(loaded, otherPlayerId, { sceneId, encounterId })).toEqual([
      { tokenId, controlled: false },
      { tokenId: otherTokenId, controlled: true }
    ])

    cache.invalidate()
    const current = await cache.refresh(epoch)
    expect(admitsRoomMember(current, departing)).toBe(false)
    expect(roomBoundTokenControl(current, otherPlayerId, { sceneId, encounterId })).toEqual([
      { tokenId, controlled: false },
      { tokenId: otherTokenId, controlled: false }
    ])
    expect(current.characters.map((character) => character.characterId)).toEqual([characterId])
  })

  it('follows an ownership transfer: new roles and membership epochs, never the old admissions', async () => {
    const first = fullResponse()
    const transferredAt = '2026-09-28T01:00:00.000Z'
    const transferred: Response = {
      revisions: { ...first.revisions, campaign: id(103) },
      campaign: {
        ownerUserId: playerId,
        members: [
          { membershipEpoch: transferredAt, role: 'PLAYER', userId: ownerId },
          { membershipEpoch: transferredAt, role: 'OWNER', userId: playerId },
          { membershipEpoch, role: 'PLAYER', userId: otherPlayerId }
        ],
        assignments: first.campaign!.assignments
      },
      characters: []
    }
    const { cache } = cacheWith(first, transferred)
    await cache.refresh(epoch)
    cache.invalidate()
    const current = await cache.refresh(epoch)

    expect(admitsRoomMember(current, { membershipEpoch, role: 'OWNER', userId: ownerId })).toBe(
      false
    )
    expect(admitsRoomMember(current, { membershipEpoch, role: 'PLAYER', userId: playerId })).toBe(
      false
    )
    expect(
      admitsRoomMember(current, { membershipEpoch: transferredAt, role: 'OWNER', userId: playerId })
    ).toBe(true)
    // The new GM's control does not come from player grants.
    expect(roomBoundTokenControl(current, playerId, { sceneId, encounterId })).toEqual([
      { tokenId, controlled: false },
      { tokenId: otherTokenId, controlled: false }
    ])
  })

  it('moves Character-actor control with a Campaign Character assignment change', async () => {
    const first = fullResponse()
    const reassigned: Response = {
      revisions: { ...first.revisions, campaign: id(104) },
      campaign: {
        ...first.campaign!,
        assignments: [
          { characterId, userId: otherPlayerId },
          { characterId: otherCharacterId, userId: playerId }
        ]
      },
      characters: []
    }
    const { cache } = cacheWith(first, reassigned)
    const before = await cache.refresh(epoch)
    expect(roomBoundTokenControl(before, playerId, { sceneId, encounterId })?.[0]).toEqual({
      tokenId,
      controlled: true
    })
    cache.invalidate()
    const after = await cache.refresh(epoch)
    expect(roomBoundTokenControl(after, playerId, { sceneId, encounterId })?.[0]).toEqual({
      tokenId,
      controlled: false
    })
    expect(roomBoundTokenControl(after, otherPlayerId, { sceneId, encounterId })?.[0]).toEqual({
      tokenId,
      controlled: true
    })
  })

  it('applies "Party can view" and a health-display change before the next broadcast', async () => {
    const first = fullResponse()
    const hidden: Response = {
      revisions: {
        ...first.revisions,
        characters: [
          { characterId, revision: id(310) },
          { characterId: otherCharacterId, revision: id(301) }
        ]
      },
      characters: [
        {
          characterId,
          ownerUserId: playerId,
          partyVisibility: { sheet: false, health: 'HIDDEN' }
        }
      ]
    }
    const { cache, known } = cacheWith(first, hidden)
    await cache.refresh(epoch)

    // A CHARACTER notice makes the cache unusable, so the next broadcast must read first.
    cache.invalidate()
    expect(cache.current(epoch)).toBeNull()
    const current = await cache.refresh(epoch)
    expect(known[1]?.characters).toEqual(first.revisions.characters)
    expect(current.characters).toEqual([
      { characterId, ownerUserId: playerId, partyVisibility: { sheet: false, health: 'HIDDEN' } },
      first.characters[1]
    ])
  })

  it('reloads the PLAY section after the room changes Encounter state, without blocking commands', async () => {
    const first = fullResponse()
    const granted: Response = {
      revisions: { ...first.revisions, play: id(201) },
      characters: [],
      play: {
        encounter: {
          ...first.play!.encounter!,
          actors: first.play!.encounter!.actors.map((actor) =>
            actor.id === creatureActorId ? { ...actor, controllerUserIds: [playerId] } : actor
          )
        }
      }
    }
    const { cache, known } = cacheWith(first, granted)
    await cache.refresh(epoch)
    cache.invalidatePlay()
    expect(cache.current(epoch)).not.toBeNull()
    expect(cache.currentPlay(epoch)).toBeNull()

    const current = await cache.refresh(epoch)
    expect(known[1]?.play).toBeNull()
    expect(cache.currentPlay(epoch)).toBe(current)
    expect(roomBoundTokenControl(current, playerId, { sceneId, encounterId })?.[1]).toEqual({
      tokenId: otherTokenId,
      controlled: true
    })
    expect(roomBoundTokenControl(current, playerId, { sceneId, encounterId: id(98) })).toBeNull()
  })

  it('keeps local token control through a concurrent read and later stale PLAY refresh', async () => {
    const first = fullResponse()
    const stale: Response = {
      revisions: { ...first.revisions, play: id(201) },
      characters: [],
      play: first.play
    }
    let release: (value: Response) => void = () => undefined
    const load = vi
      .fn<(input: { known: Known }) => Promise<Response>>()
      .mockResolvedValueOnce(first)
      .mockImplementationOnce(() => new Promise((resolve) => (release = resolve)))
      .mockResolvedValueOnce({ ...stale, revisions: { ...stale.revisions, play: id(202) } })
    const cache = new RoomAuthorization(load)
    await cache.refresh(epoch)
    const racing = cache.refresh(epoch)
    expect(cache.refresh(epoch)).toBe(racing)
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2))
    const localPlay = {
      encounter: {
        ...first.play!.encounter!,
        actors: first.play!.encounter!.actors.map((actor) =>
          actor.id === creatureActorId ? { ...actor, controllerUserIds: [playerId] } : actor
        )
      }
    }
    cache.applyPlay(epoch, localPlay)
    expect(
      roomBoundTokenControl(cache.currentPlay(epoch)!, playerId, { sceneId, encounterId })?.[1]
    ).toEqual({
      tokenId: otherTokenId,
      controlled: true
    })
    release(stale)
    expect((await racing).play).toEqual(localPlay)
    const refreshed = await cache.refresh(epoch)
    expect(refreshed.revisions.play).toBe(id(202))
    expect(cache.currentPlay(epoch)?.play).toEqual(localPlay)
    expect(roomBoundTokenControl(refreshed, playerId, { sceneId, encounterId })?.[1]).toEqual({
      tokenId: otherTokenId,
      controlled: true
    })
  })

  it('exposes persisted PLAY after acknowledgement and a changed checkpoint revision', async () => {
    const first = fullResponse()
    const persisted: Response = {
      revisions: { ...first.revisions, play: id(201) },
      characters: [],
      play: first.play
    }
    const { cache, known } = cacheWith(first, persisted)
    await cache.refresh(epoch)
    cache.applyPlay(epoch, {
      encounter: {
        ...first.play!.encounter!,
        actors: first.play!.encounter!.actors.map((actor) =>
          actor.id === creatureActorId ? { ...actor, controllerUserIds: [playerId] } : actor
        )
      }
    })
    cache.acknowledgePlay(epoch)
    cache.renew(epoch, persisted.revisions)
    expect(cache.currentPlay(epoch)).toBeNull()
    const current = await cache.refresh(epoch)
    expect(known[1]?.play).toBe(first.revisions.play)
    expect(cache.currentPlay(epoch)?.play).toEqual(persisted.play)
    expect(roomBoundTokenControl(current, playerId, { sceneId, encounterId })?.[1]).toEqual({
      tokenId: otherTokenId,
      controlled: false
    })
  })

  it('refuses a foreign epoch apply and clears the local PLAY overlay on invalidation', async () => {
    const first = fullResponse()
    const { cache, known } = cacheWith(first, { ...unchanged(first), play: first.play })
    await cache.refresh(epoch)
    const localPlay = {
      encounter: {
        ...first.play!.encounter!,
        actors: first.play!.encounter!.actors.map((actor) =>
          actor.id === creatureActorId ? { ...actor, controllerUserIds: [playerId] } : actor
        )
      }
    }
    cache.applyPlay(epoch, localPlay)
    expect(() => cache.applyPlay(id(99), first.play!)).toThrow('epoch changed')
    expect(cache.currentPlay(epoch)?.play).toEqual(localPlay)
    cache.invalidatePlay()
    expect(cache.currentPlay(epoch)).toBeNull()
    const current = await cache.refresh(epoch)
    expect(known[1]?.play).toBeNull()
    expect(cache.currentPlay(epoch)?.play).toEqual(first.play)
    expect(roomBoundTokenControl(current, playerId, { sceneId, encounterId })?.[1]).toEqual({
      tokenId: otherTokenId,
      controlled: false
    })
  })

  it('holds auto-roll preferences until their digest changes', async () => {
    const first = fullResponse()
    const changed: Response = {
      revisions: { ...first.revisions, preferences: preferencesDigest(2) },
      characters: [],
      preferences: first.preferences!.map((preference) =>
        preference.userId === otherPlayerId ? { ...preference, autoRollDice: true } : preference
      )
    }
    const { cache } = cacheWith(first, changed)
    await cache.refresh(epoch)
    cache.invalidate()
    const current = await cache.refresh(epoch)
    expect(current.preferences).toContainEqual({
      userId: otherPlayerId,
      autoRollDice: true,
      gmRollVisibility: 'PUBLIC',
      username: 'OtherPlayer'
    })
  })

  it('fails closed on a read that omits a section it never loaded', async () => {
    const first = fullResponse()
    const { cache } = cacheWith(unchanged(first))
    await expect(cache.refresh(epoch)).rejects.toThrow('incomplete')
    expect(cache.current(epoch)).toBeNull()
  })

  it('checks Scene vision against the cached Character revisions', async () => {
    const first = fullResponse()
    const { cache } = cacheWith(first)
    const current = await cache.refresh(epoch)
    expect(roomVisionCurrent(current, [{ characterId, revision: id(300) }])).toBe(true)
    expect(roomVisionCurrent(current, [{ characterId, revision: id(399) }])).toBe(false)
    expect(roomVisionCurrent(current, [{ characterId: id(97), revision: null }])).toBe(false)
  })
})
