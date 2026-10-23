import { describe, expect, it, vi } from 'vitest'
import type {
  LiveSessionRoomAuthorizationInput,
  LiveSessionRoomAuthorizationResponse
} from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import {
  adoptRevisions,
  adoptSceneVisionRevisions,
  admitsRoomMember,
  RoomAuthorization,
  roomBoundTokenControl,
  roomVisionCurrent
} from './roomAuthorization.js'
import { ROOM_LIMITS } from './roomLimits.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'

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
  const { storage } = createNodeSqliteRoomStorage()
  return { cache: new RoomAuthorization(load, storage.sql), known, load, storage }
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
    const cache = new RoomAuthorization(load, createNodeSqliteRoomStorage().storage.sql)
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

  it('asks for a renewal read once half the lease has passed, and a read restarts the count', async () => {
    const first = fullResponse()
    const { cache } = cacheWith(first, unchanged(first))
    const start = Date.now()
    expect(cache.renewalDue(start)).toBe(false)
    await cache.refresh(epoch)
    const half = ROOM_LIMITS.authorizationLeaseMs / 2

    expect(cache.renewalDue(start + half - 1_000)).toBe(false)
    expect(cache.renewalDue(Date.now() + half)).toBe(true)
    await cache.refresh(epoch)
    expect(cache.renewalDue()).toBe(false)
  })

  it('adopts the revisions its own checkpoint bumped without renewing the lease or replacing local PLAY', async () => {
    const first = fullResponse()
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
    const sent = cache.current(epoch)!.revisions

    cache.adopt(epoch, sent, { play: id(201), characters: [{ characterId, revision: id(310) }] })

    const current = cache.currentPlay(epoch)!
    expect(current.revisions).toEqual({
      ...first.revisions,
      play: id(201),
      characters: [
        { characterId, revision: id(310) },
        { characterId: otherCharacterId, revision: id(301) }
      ]
    })
    expect(current.play).toEqual(localPlay)
    expect(current.campaign).toEqual(first.campaign)
    expect(cache.current(epoch, Date.now() + ROOM_LIMITS.authorizationLeaseMs)).toBeNull()
    expect(cache.renewalDue(Date.now() + ROOM_LIMITS.authorizationLeaseMs / 2)).toBe(true)
    expect(load).toHaveBeenCalledOnce()
  })

  it('adopts nothing when the cache is not the one the checkpoint was sent with', async () => {
    const first = fullResponse()
    const outside = { ...first.revisions, campaign: id(101) }
    const { cache } = cacheWith(first, { revisions: outside, characters: [] })
    await cache.refresh(epoch)
    const adopted = { play: id(201), characters: [{ characterId, revision: id(310) }] }

    cache.adopt(id(99), cache.current(epoch)!.revisions, adopted)
    const stale = cache.current(epoch)!.revisions
    await cache.refresh(epoch)
    cache.adopt(epoch, stale, adopted)

    expect(cache.current(epoch)!.revisions).toEqual(outside)
  })

  it('adopts the checkpoint sent with revisions equal to the cached ones, not only the same object', async () => {
    const first = fullResponse()
    const { cache } = cacheWith(first)
    await cache.refresh(epoch)

    cache.adopt(epoch, structuredClone(first.revisions), { play: id(201), characters: [] })

    expect(cache.current(epoch)!.revisions).toEqual({ ...first.revisions, play: id(201) })
  })

  it('advances revisions page by page with adoptRevisions', () => {
    const { revisions } = fullResponse()
    expect(adoptRevisions(revisions, { characters: [] })).toEqual(revisions)
    expect(
      adoptRevisions(revisions, {
        play: id(201),
        characters: [{ characterId: otherCharacterId, revision: id(311) }]
      })
    ).toEqual({
      ...revisions,
      play: id(201),
      characters: [
        { characterId, revision: id(300) },
        { characterId: otherCharacterId, revision: id(311) }
      ]
    })
  })

  it('moves a cached Scene vision onto a checkpoint-adopted Character revision only from the sent one', () => {
    const { revisions } = fullResponse()
    const adopted = {
      characters: [
        { characterId, revision: id(310) },
        { characterId: otherCharacterId, revision: id(311) }
      ]
    }
    expect(
      adoptSceneVisionRevisions(
        [
          { characterId, revision: id(300) },
          // Built from a revision that is not the one the checkpoint was sent with.
          { characterId: otherCharacterId, revision: id(399) }
        ],
        revisions,
        adopted
      )
    ).toEqual([
      { characterId, revision: id(310) },
      { characterId: otherCharacterId, revision: id(399) }
    ])
    expect(
      adoptSceneVisionRevisions([{ characterId, revision: id(300) }], revisions, {
        characters: []
      })
    ).toEqual([{ characterId, revision: id(300) }])
  })

  it('keeps a revision the checkpoint did not adopt, so the next read fetches that section', async () => {
    const first = fullResponse()
    const { cache, known } = cacheWith(first, unchanged(first))
    await cache.refresh(epoch)

    cache.adopt(epoch, cache.current(epoch)!.revisions, { characters: [] })
    await cache.refresh(epoch)

    expect(known[1]).toEqual(first.revisions)
  })

  it('keeps admissions closed when an adoption lands during an older in-flight read', async () => {
    const first = fullResponse()
    const removed: Response = {
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
    const { cache, load } = cacheWith(first, removed)
    await cache.refresh(epoch)
    const sent = cache.current(epoch)!.revisions
    let release: (value: Response) => void = () => undefined
    load.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)))
    const racing = cache.refresh(epoch)
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2))
    cache.adopt(epoch, sent, { play: id(202), characters: [] })
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

  it('gives a granted member control of the Character actor and takes it back at the next read (D162)', async () => {
    const first = fullResponse()
    const granted: Response = {
      revisions: { ...first.revisions, campaign: id(104) },
      campaign: {
        ownerUserId: ownerId,
        members: members(playerId, otherPlayerId),
        assignments: [
          { characterId, userId: playerId, controllerUserIds: [otherPlayerId] },
          { characterId: otherCharacterId, userId: otherPlayerId }
        ]
      },
      characters: []
    }
    const revoked: Response = {
      revisions: { ...first.revisions, campaign: id(105) },
      campaign: { ...granted.campaign!, assignments: first.campaign!.assignments },
      characters: []
    }
    const { cache } = cacheWith(first, granted, revoked)
    const bound = { sceneId, encounterId }
    expect(roomBoundTokenControl(await cache.refresh(epoch), otherPlayerId, bound)).toEqual([
      { tokenId, controlled: false },
      { tokenId: otherTokenId, controlled: true }
    ])
    cache.invalidate()
    const current = await cache.refresh(epoch)
    expect(roomBoundTokenControl(current, otherPlayerId, bound)).toEqual([
      { tokenId, controlled: true },
      { tokenId: otherTokenId, controlled: true }
    ])
    // The owner keeps control, and the grant reaches no other Character's actor.
    expect(roomBoundTokenControl(current, playerId, bound)).toEqual([
      { tokenId, controlled: true },
      { tokenId: otherTokenId, controlled: false }
    ])
    cache.invalidate()
    expect(roomBoundTokenControl(await cache.refresh(epoch), otherPlayerId, bound)).toEqual([
      { tokenId, controlled: false },
      { tokenId: otherTokenId, controlled: true }
    ])
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

  it('gives an owned actor the control of its owner without a controller list of its own', async () => {
    const summonId = id(13)
    const summonTokenId = id(14)
    const first = fullResponse()
    const withSummon: Response = {
      ...first,
      play: {
        encounter: {
          ...first.play!.encounter!,
          actors: [
            ...first.play!.encounter!.actors,
            {
              id: summonId,
              kind: 'CREATURE',
              sourceId: null,
              controllerUserIds: [],
              owner: { ownerActorId: creatureActorId },
              healthDisplay: null
            }
          ],
          tokens: [...first.play!.encounter!.tokens, { tokenId: summonTokenId, actorId: summonId }]
        }
      }
    }
    const { cache } = cacheWith(withSummon)
    const loaded = await cache.refresh(epoch)
    const summonControl = (userId: string) =>
      roomBoundTokenControl(loaded, userId, { sceneId, encounterId })?.find(
        (token) => token.tokenId === summonTokenId
      )?.controlled
    // The creature is granted to the other player; its summon follows without being granted.
    expect(summonControl(otherPlayerId)).toBe(true)
    expect(summonControl(playerId)).toBe(false)
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
    const cache = new RoomAuthorization(load, createNodeSqliteRoomStorage().storage.sql)
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
    cache.invalidate()
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

  describe('across hibernation', () => {
    const woken = (storage: ReturnType<typeof createNodeSqliteRoomStorage>['storage']) =>
      new RoomAuthorization(async () => {
        throw new Error('A woken room within its lease reads nothing.')
      }, storage.sql)

    it('trusts the restored cache for the rest of its lease', async () => {
      const first = fullResponse()
      const { cache, storage } = cacheWith(first)
      const loaded = await cache.refresh(epoch)

      const restored = woken(storage)

      expect(restored.current(epoch)).toEqual(loaded)
      expect(restored.current(epoch, Date.now() + ROOM_LIMITS.authorizationLeaseMs)).toBeNull()
    })

    it('keeps an invalidation made before sleep', async () => {
      const first = fullResponse()
      const { cache, storage } = cacheWith(first)
      await cache.refresh(epoch)
      cache.invalidate()
      cache.invalidatePlay()

      const restored = woken(storage)

      expect(restored.current(epoch)).toBeNull()
      expect(restored.currentPlay(epoch)).toBeNull()
    })

    it('keeps party visibility applied before sleep', async () => {
      const first = fullResponse()
      const { cache, storage } = cacheWith(first)
      await cache.refresh(epoch)
      cache.applyCharacters(epoch, [])

      expect(woken(storage).current(epoch)?.characters).toEqual([])
    })

    it('starts empty when the stored row is corrupt', async () => {
      const first = fullResponse()
      const { cache, storage } = cacheWith(first)
      await cache.refresh(epoch)
      storage.sql.exec('UPDATE room_authorization SET state = \'{"held":42}\'')

      expect(woken(storage).current(epoch)).toBeNull()
      expect(storage.sql.exec('SELECT state FROM room_authorization').toArray()).toEqual([])
    })
  })
})
