import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import type { LiveSessionJoinOptionsDto } from '@artificer-toolkit/schema/api/liveSessionIdentity'
import { createEncounterSceneFixture } from '../../tests/fixtures/encounterScene'
import { assertConvexOwnsSceneLiveState } from './authorityGuard'

afterEach(() => vi.useRealTimers())

type Authority = {
  campaignId: string
  epoch: string
  phase: 'ACTIVATING' | 'DO_ACTIVE' | 'DRAINING'
  activationFingerprint: string
  activationExpiresAt?: number
  persistedSequence: number
  persistedStateChecksum: string
  finalSequence?: number
  finalStateChecksum?: string
  createdAt: string
  updatedAt: string
}

const claim = makeFunctionReference<'mutation', LiveSessionJoinOptionsDto, Authority>(
  'liveSessions/authority:claim'
)
const authorizeAdmission = makeFunctionReference<
  'mutation',
  LiveSessionJoinOptionsDto & { expiresAt: number },
  unknown
>('liveSessions/admission:authorize')
const commitActivation = makeFunctionReference<
  'mutation',
  LiveSessionJoinOptionsDto & {
    epoch: string
    activationFingerprint: string
    stateChecksum: string
  },
  Authority
>('liveSessions/authority:commitActivation')
const advancePersisted = makeFunctionReference<
  'mutation',
  LiveSessionJoinOptionsDto & {
    epoch: string
    expectedStateChecksum: string
    sequence: number
    stateChecksum: string
  },
  Authority
>('liveSessions/authority:advancePersisted')
const beginDrain = makeFunctionReference<
  'mutation',
  LiveSessionJoinOptionsDto & {
    epoch: string
    finalSequence: number
    finalStateChecksum: string
  },
  Authority
>('liveSessions/authority:beginDrain')
const release = makeFunctionReference<
  'mutation',
  LiveSessionJoinOptionsDto & {
    epoch: string
    finalSequence: number
    finalStateChecksum: string
  },
  null
>('liveSessions/authority:release')

it('fences one Campaign authority epoch through claim, publication, drain, and release', async () => {
  const base = await createEncounterSceneFixture()
  const input = { campaignId: base.campaign.id }
  const sessions = await base.t.run((ctx) =>
    ctx.db
      .query('campaignSessions')
      .withIndex('by_campaignId_id', (q) => q.eq('campaignId', input.campaignId))
      .collect()
  )
  expect(sessions).toEqual([])
  // Any ACTIVE member opens the table; a PLAYER may claim first without any Session.
  const playerFirst = await base.owner.caller.mutation(claim, input)
  const [ownerClaim, playerClaim] = await Promise.all([
    base.other.caller.mutation(claim, input),
    base.owner.caller.mutation(claim, input)
  ])
  expect(playerClaim.epoch).toBe(playerFirst.epoch)
  expect(ownerClaim.epoch).toBe(playerFirst.epoch)
  const renewedClaim = await base.other.caller.mutation(claim, input)
  expect(renewedClaim.epoch).toBe(ownerClaim.epoch)
  expect(renewedClaim.activationExpiresAt).toBeGreaterThanOrEqual(ownerClaim.activationExpiresAt!)

  const initialStateChecksum = 'a'.repeat(64)
  await expect(
    base.t.mutation(commitActivation, {
      ...input,
      epoch: ownerClaim.epoch,
      activationFingerprint: '0'.repeat(64),
      stateChecksum: initialStateChecksum
    })
  ).rejects.toThrow('activation fingerprint is stale')

  const active = await base.t.mutation(commitActivation, {
    ...input,
    epoch: ownerClaim.epoch,
    activationFingerprint: ownerClaim.activationFingerprint,
    stateChecksum: initialStateChecksum
  })
  await expect(
    base.t.mutation(commitActivation, {
      ...input,
      epoch: ownerClaim.epoch,
      activationFingerprint: ownerClaim.activationFingerprint,
      stateChecksum: initialStateChecksum
    })
  ).resolves.toEqual(active)

  const firstChecksum = '1'.repeat(64)
  await expect(
    base.t.mutation(advancePersisted, {
      ...input,
      epoch: active.epoch,
      expectedStateChecksum: active.persistedStateChecksum,
      sequence: 2,
      stateChecksum: firstChecksum
    })
  ).rejects.toThrow('not contiguous')
  const first = await base.t.mutation(advancePersisted, {
    ...input,
    epoch: active.epoch,
    expectedStateChecksum: active.persistedStateChecksum,
    sequence: 1,
    stateChecksum: firstChecksum
  })
  await expect(
    base.t.mutation(advancePersisted, {
      ...input,
      epoch: active.epoch,
      expectedStateChecksum: active.persistedStateChecksum,
      sequence: 1,
      stateChecksum: firstChecksum
    })
  ).resolves.toEqual(first)

  const finalChecksum = '2'.repeat(64)
  const draining = await base.t.mutation(beginDrain, {
    ...input,
    epoch: active.epoch,
    finalSequence: 2,
    finalStateChecksum: finalChecksum
  })
  await expect(
    base.t.mutation(release, {
      ...input,
      epoch: active.epoch,
      finalSequence: 2,
      finalStateChecksum: finalChecksum
    })
  ).rejects.toThrow('final publication is incomplete')
  await base.t.mutation(advancePersisted, {
    ...input,
    epoch: active.epoch,
    expectedStateChecksum: draining.persistedStateChecksum,
    sequence: 2,
    stateChecksum: finalChecksum
  })
  await expect(
    base.t.mutation(release, {
      ...input,
      epoch: active.epoch,
      finalSequence: 2,
      finalStateChecksum: finalChecksum
    })
  ).resolves.toBeNull()
  await expect(
    base.t.mutation(release, {
      ...input,
      epoch: active.epoch,
      finalSequence: 2,
      finalStateChecksum: finalChecksum
    })
  ).resolves.toBeNull()
})

it('expires an abandoned activation, reopens direct writes, and replaces the epoch', async () => {
  const base = await createEncounterSceneFixture()
  const input = { campaignId: base.campaign.id }
  const original = await base.other.caller.mutation(claim, input)
  expect(original.activationExpiresAt).toBeGreaterThan(Date.now())
  await expect(
    base.t.run((ctx) => assertConvexOwnsSceneLiveState(ctx, input.campaignId, base.sceneId))
  ).rejects.toThrow('currently owned')

  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('campaignLiveAuthorities')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', input.campaignId))
      .unique()
    if (!row || row.epoch !== original.epoch) throw new Error('Missing live authority.')
    await ctx.db.patch(row._id, { activationExpiresAt: Date.now() - 1 })
  })
  await expect(
    base.t.run((ctx) => assertConvexOwnsSceneLiveState(ctx, input.campaignId, base.sceneId))
  ).resolves.toBeNull()
  await expect(
    base.t.mutation(commitActivation, {
      ...input,
      epoch: original.epoch,
      activationFingerprint: original.activationFingerprint,
      stateChecksum: 'a'.repeat(64)
    })
  ).rejects.toThrow('authority is stale')
  const replacement = await base.other.caller.mutation(claim, input)
  expect(replacement.epoch).not.toBe(original.epoch)
  expect(replacement.activationExpiresAt).toBeGreaterThan(Date.now())
  await expect(
    base.t.mutation(commitActivation, {
      ...input,
      epoch: original.epoch,
      activationFingerprint: original.activationFingerprint,
      stateChecksum: 'a'.repeat(64)
    })
  ).rejects.toThrow('authority is stale')
})

it('rejects invalid activation deadlines before claiming authority', async () => {
  const base = await createEncounterSceneFixture()
  const input = { campaignId: base.campaign.id }
  for (const expiresAt of [Date.now() - 1, Number.MAX_SAFE_INTEGER + 1]) {
    await expect(
      base.other.caller.mutation(authorizeAdmission, { ...input, expiresAt })
    ).rejects.toThrow('activation expiry is invalid')
  }
  const row = await base.t.run((ctx) =>
    ctx.db
      .query('campaignLiveAuthorities')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', input.campaignId))
      .unique()
  )
  expect(row).toBeNull()
})

it('renews the same activation epoch without shortening its expiry', async () => {
  const base = await createEncounterSceneFixture()
  const input = { campaignId: base.campaign.id }
  vi.useFakeTimers()
  const first = await base.other.caller.mutation(claim, input)
  vi.setSystemTime(Date.now() + 30_000)
  const renewed = await base.other.caller.mutation(claim, input)
  expect(renewed.epoch).toBe(first.epoch)
  expect(renewed.activationExpiresAt).toBeGreaterThan(first.activationExpiresAt!)
  vi.setSystemTime(first.activationExpiresAt! + 1)
  await expect(
    base.t.run((ctx) => assertConvexOwnsSceneLiveState(ctx, input.campaignId, base.sceneId))
  ).rejects.toThrow('currently owned')
  vi.setSystemTime(renewed.activationExpiresAt! + 1)
  await expect(
    base.t.run((ctx) => assertConvexOwnsSceneLiveState(ctx, input.campaignId, base.sceneId))
  ).resolves.toBeNull()
})

it('uses the updated time for a preexisting activation without an expiry', async () => {
  const base = await createEncounterSceneFixture()
  const input = { campaignId: base.campaign.id }
  const claimed = await base.other.caller.mutation(claim, input)
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('campaignLiveAuthorities')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', input.campaignId))
      .unique()
    if (!row) throw new Error('Missing live authority.')
    await ctx.db.patch(row._id, { activationExpiresAt: undefined })
  })
  vi.useFakeTimers()
  vi.setSystemTime(Date.parse(claimed.updatedAt) + 60_001)
  await expect(
    base.t.run((ctx) => assertConvexOwnsSceneLiveState(ctx, input.campaignId, base.sceneId))
  ).resolves.toBeNull()
})

it('keeps active authority fenced after the activation deadline', async () => {
  const base = await createEncounterSceneFixture()
  const input = { campaignId: base.campaign.id }
  vi.useFakeTimers()
  const claimed = await base.other.caller.mutation(claim, input)
  const active = await base.t.mutation(commitActivation, {
    ...input,
    epoch: claimed.epoch,
    activationFingerprint: claimed.activationFingerprint,
    stateChecksum: 'a'.repeat(64)
  })
  expect(active.activationExpiresAt).toBeUndefined()
  vi.setSystemTime(claimed.activationExpiresAt! + 1)
  await expect(
    base.t.run((ctx) => assertConvexOwnsSceneLiveState(ctx, input.campaignId, base.sceneId))
  ).rejects.toThrow('currently owned')
  await expect(
    base.t.mutation(commitActivation, {
      ...input,
      epoch: claimed.epoch,
      activationFingerprint: claimed.activationFingerprint,
      stateChecksum: 'a'.repeat(64)
    })
  ).resolves.toEqual(active)
})

it('caps how far reissued tickets extend an unused activation reservation', async () => {
  const base = await createEncounterSceneFixture()
  const input = { campaignId: base.campaign.id }
  vi.useFakeTimers()
  const startedAt = Math.ceil(Date.now() / 1_000) * 1_000
  vi.setSystemTime(startedAt)
  const original = await base.other.caller.mutation(claim, input)
  // Fixture identities last one minute, so the reservation is aged in storage instead of by clock.
  const createdAt = startedAt - 4 * 60_000
  const reservationEnd = createdAt + 5 * 60_000
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('campaignLiveAuthorities')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', input.campaignId))
      .unique()
    if (!row) throw new Error('Missing live authority.')
    await ctx.db.patch(row._id, {
      createdAt: new Date(createdAt).toISOString(),
      activationExpiresAt: startedAt + 10_000
    })
  })
  vi.setSystemTime(startedAt + 5_000)
  const capped = await base.other.caller.mutation(claim, input)
  expect(capped.epoch).toBe(original.epoch)
  expect(capped.activationExpiresAt).toBe(reservationEnd)
  vi.setSystemTime(startedAt + 30_000)
  const reissued = await base.other.caller.mutation(claim, input)
  expect(reissued.epoch).toBe(original.epoch)
  expect(reissued.activationExpiresAt).toBe(reservationEnd)
  vi.setSystemTime(reservationEnd)
  await expect(
    base.t.run((ctx) => assertConvexOwnsSceneLiveState(ctx, input.campaignId, base.sceneId))
  ).resolves.toBeNull()
  await expect(
    base.t.mutation(commitActivation, {
      ...input,
      epoch: original.epoch,
      activationFingerprint: original.activationFingerprint,
      stateChecksum: 'a'.repeat(64)
    })
  ).rejects.toThrow('authority is stale')
})

it('limits ticket admission per user and refills the burst over time', async () => {
  const base = await createEncounterSceneFixture()
  const input = { campaignId: base.campaign.id }
  vi.useFakeTimers()
  const admit = () =>
    base.other.caller.mutation(authorizeAdmission, { ...input, expiresAt: Date.now() + 60_000 })
  for (let attempt = 0; attempt < 10; attempt++) await admit()
  const before = await base.t.run((ctx) =>
    ctx.db
      .query('campaignLiveAuthorities')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', input.campaignId))
      .unique()
  )
  vi.setSystemTime(Date.now() + 1_000)
  await expect(admit()).rejects.toThrow('Too many live table connection attempts')
  expect(
    await base.t.run((ctx) =>
      ctx.db
        .query('campaignLiveAuthorities')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', input.campaignId))
        .unique()
    )
  ).toEqual(before)
  await expect(
    base.owner.caller.mutation(authorizeAdmission, { ...input, expiresAt: Date.now() + 60_000 })
  ).resolves.toMatchObject({ campaignId: input.campaignId })
  vi.setSystemTime(Date.now() + 1_000)
  await expect(admit()).resolves.toMatchObject({ campaignId: input.campaignId })
  await expect(admit()).rejects.toThrow('Too many live table connection attempts')
})
