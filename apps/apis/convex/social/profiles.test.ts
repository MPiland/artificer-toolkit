import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type {
  SocialEligibilityDto,
  UpdateSocialContentPreferenceInput
} from '@artificer-toolkit/schema/api/socialHub'
import {
  advanceAccountDeletionToProvider,
  drainScheduledWork,
  scheduledSince
} from '../../tests/fixtures/accountDeletion'
import { fixture } from '../../tests/fixtures/characters'
import { internal } from '../_generated/api'

const get = makeFunctionReference<'query', Record<string, never>, SocialEligibilityDto>(
  'social/profiles:getEligibility'
)
const initialize = makeFunctionReference<'mutation', Record<string, never>, SocialEligibilityDto>(
  'social/profiles:initialize'
)
const update = makeFunctionReference<
  'mutation',
  { input: UpdateSocialContentPreferenceInput },
  SocialEligibilityDto
>('social/profiles:updatePreference')

describe('native private Social eligibility and preferences', () => {
  it('authenticates every operation, reads without creating, and initializes one actor-scoped profile under contention', async () => {
    const { t, owner, other } = await fixture()
    await expect(t.query(get, {})).rejects.toThrow('Unauthenticated')
    await expect(t.mutation(initialize, {})).rejects.toThrow('Unauthenticated')
    await expect(t.mutation(update, { input: { contentPreference: 'STANDARD' } })).rejects.toThrow(
      'Unauthenticated'
    )
    expect(await owner.caller.query(get, {})).toEqual({
      eligible: false,
      profilePublicId: null,
      adultAttestedAt: null,
      contentPreference: 'STANDARD',
      status: null
    })
    expect(await t.run((ctx) => ctx.db.query('socialProfiles').take(1))).toEqual([])
    const [first, replay] = await Promise.all([
      owner.caller.mutation(initialize, {}),
      owner.caller.mutation(initialize, {})
    ])
    expect(replay).toEqual(first)
    expect(first).toMatchObject({
      eligible: true,
      adultAttestedAt: null,
      contentPreference: 'STANDARD',
      status: 'ACTIVE'
    })
    expect(first.profilePublicId).not.toBe(owner.userId)
    const otherProfile = await other.caller.mutation(initialize, {})
    expect(otherProfile.profilePublicId).not.toBe(first.profilePublicId)
    const before = await t.run((ctx) => ctx.db.query('socialProfiles').take(3))
    expect(before).toHaveLength(2)
    await expect(owner.caller.mutation(initialize, {})).resolves.toEqual(first)
    expect(await t.run((ctx) => ctx.db.query('socialProfiles').take(3))).toEqual(before)
  })

  it('stores only the first adult attestation and preserves it when the private preference changes', async () => {
    const { t, owner } = await fixture()
    const standard = await owner.caller.mutation(update, {
      input: { contentPreference: 'STANDARD' }
    })
    const mature = await owner.caller.mutation(update, {
      input: { contentPreference: 'MATURE', birthDate: '1900-01-01' }
    })
    expect(mature.profilePublicId).toBe(standard.profilePublicId)
    expect(mature.adultAttestedAt).not.toBeNull()
    const reverted = await owner.caller.mutation(update, {
      input: { contentPreference: 'STANDARD' }
    })
    expect(reverted.adultAttestedAt).toBe(mature.adultAttestedAt)
    await expect(
      owner.caller.mutation(update, { input: { contentPreference: 'MATURE' } })
    ).resolves.toEqual(mature)
    const stored = await t.run((ctx) =>
      ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', owner.userId))
        .unique()
    )
    expect(stored).toMatchObject({
      version: 3,
      adultAttestedAt: mature.adultAttestedAt,
      contentPreference: 'MATURE'
    })
    expect(stored).not.toHaveProperty('birthDate')
    expect(JSON.stringify(stored)).not.toContain('1900-01-01')
    expect(Object.keys(mature).sort()).toEqual([
      'adultAttestedAt',
      'contentPreference',
      'eligible',
      'profilePublicId',
      'status'
    ])
  })

  it('rejects missing, invalid, future and underage attestations without creating or changing a profile', async () => {
    const { t, owner } = await fixture()
    for (const input of [
      { contentPreference: 'MATURE' },
      { contentPreference: 'MATURE', birthDate: '2026-02-31' },
      { contentPreference: 'MATURE', birthDate: '2999-01-01' },
      { contentPreference: 'MATURE', birthDate: new Date().toISOString().slice(0, 10) }
    ] as const) {
      await expect(owner.caller.mutation(update, { input })).rejects.toThrow()
    }
    expect(await t.run((ctx) => ctx.db.query('socialProfiles').take(1))).toEqual([])
    const initial = await owner.caller.mutation(initialize, {})
    await expect(
      owner.caller.mutation(update, { input: { contentPreference: 'MATURE' } })
    ).rejects.toThrow('at least 18')
    await expect(owner.caller.query(get, {})).resolves.toEqual(initial)
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', owner.userId))
          .unique()
      )
    ).toMatchObject({ version: 0 })
  })

  it('does not let initialization or preference writes restore a suspended profile or target another actor', async () => {
    const { t, owner, other } = await fixture()
    const initial = await owner.caller.mutation(initialize, {})
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', owner.userId))
        .unique()
      if (!row) throw new Error('Missing Social profile.')
      await ctx.db.patch(row._id, { status: 'SUSPENDED' })
    })
    const suspended = { ...initial, status: 'SUSPENDED', eligible: false }
    await expect(owner.caller.mutation(initialize, {})).resolves.toEqual(suspended)
    await expect(
      owner.caller.mutation(update, { input: { contentPreference: 'STANDARD' } })
    ).resolves.toEqual(suspended)
    const forged = makeFunctionReference<'mutation', { userId: string }, SocialEligibilityDto>(
      'social/profiles:initialize'
    )
    await expect(other.caller.mutation(forged, { userId: owner.userId })).rejects.toThrow()
    const forgedStatus = makeFunctionReference<
      'mutation',
      { input: { contentPreference: 'STANDARD'; status: 'ACTIVE' } },
      SocialEligibilityDto
    >('social/profiles:updatePreference')
    await expect(
      owner.caller.mutation(forgedStatus, {
        input: { contentPreference: 'STANDARD', status: 'ACTIVE' }
      })
    ).rejects.toThrow()
    expect(await other.caller.query(get, {})).toMatchObject({
      profilePublicId: null,
      eligible: false
    })
  })

  it('fails closed on corrupt mature preference evidence and deletes only the departing account profile', async ({
    onTestFinished
  }) => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const { t, owner, other } = await fixture()
    await owner.caller.mutation(initialize, {})
    const otherInitial = await other.caller.mutation(initialize, {})
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', owner.userId))
        .unique()
      if (!row) throw new Error('Missing Social profile.')
      await ctx.db.patch(row._id, { contentPreference: 'MATURE' })
    })
    await expect(owner.caller.query(get, {})).rejects.toThrow('adult attestation')
    const account = await t.run((ctx) =>
      ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', owner.userId))
        .unique()
    )
    if (!account) throw new Error('Missing account.')
    const before = await advanceAccountDeletionToProvider(t, account.authUserId, owner.userId)
    await t.mutation(internal.auth.onDelete, { model: 'user', doc: { _id: account.authUserId } })
    await drainScheduledWork(t)
    expect(await scheduledSince(t, before)).toEqual([
      { name: 'accountDeletionFinish:purge', state: 'success' },
      { name: 'notifications/delivery:purgeRecipient', state: 'success' },
      { name: 'media/assets:purgeAccount', state: 'success' },
      { name: 'social/accountCleanup:run', state: 'success' }
    ])
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', owner.userId))
          .unique()
      )
    ).toBeNull()
    await expect(other.caller.query(get, {})).resolves.toEqual(otherInitial)
  })
})
