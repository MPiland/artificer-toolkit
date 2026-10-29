import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import {
  ENTITLEMENT_LIMITS,
  ENTITLEMENT_PRICING
} from '@artificer-toolkit/shared/account/entitlements'
import { zeroAccountUsage } from '@artificer-toolkit/schema/projections/accountUsage'
import { deleteAccountCompletely } from '../tests/fixtures/accountDeletion'
import { fixture, input } from '../tests/fixtures/characters'
import { api, internal } from './_generated/api'
import { setTier } from './accountEntitlements'

const setTierReference = makeFunctionReference<
  'mutation',
  { userId: string; tier: 'FREE' | 'PLAYER' | 'GM' | 'PRO_GM' },
  null
>('accountEntitlements:setTier')

describe('manual account entitlement assignment', () => {
  it('projects only the authenticated account with current tier, counters and media usage', async () => {
    const { t, owner, other } = await fixture()
    await expect(t.query(api.accountEntitlements.get, {})).rejects.toThrow('Unauthenticated')
    expect(await owner.caller.query(api.accountEntitlements.get, {})).toEqual({
      tier: 'FREE',
      limits: ENTITLEMENT_LIMITS.FREE,
      pricing: ENTITLEMENT_PRICING.FREE,
      usage: { ...zeroAccountUsage, storageBytes: 0 }
    })
    const draft = await owner.caller.mutation(api.characters.drafts.create, input())
    await t.mutation(setTierReference, { userId: owner.userId, tier: 'GM' })
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', owner.userId))
        .unique()
      if (!profile) throw new Error('Missing owner profile.')
      await ctx.db.patch(profile._id, { mediaBytes: 128 })
    })
    expect(await owner.caller.query(api.accountEntitlements.get, {})).toEqual({
      tier: 'GM',
      limits: ENTITLEMENT_LIMITS.GM,
      pricing: ENTITLEMENT_PRICING.GM,
      usage: { ...zeroAccountUsage, personalCharacters: 1, storageBytes: 128 }
    })
    expect((await other.caller.query(api.accountEntitlements.get, {})).usage).toEqual({
      ...zeroAccountUsage,
      storageBytes: 0
    })
    await expect(
      owner.caller.query(api.accountEntitlements.get, {
        // @ts-expect-error Caller cannot choose another account for the usage projection.
        userId: other.userId
      })
    ).rejects.toThrow()
    await owner.caller.mutation(api.characters.drafts.discard, {
      id: draft.characterId,
      expectedDraftId: draft.id
    })
    expect(
      (await owner.caller.query(api.accountEntitlements.get, {})).usage.personalCharacters
    ).toBe(0)
  })

  it('refuses incomplete backfill totals', async () => {
    const { t, owner } = await fixture()
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', owner.userId))
        .unique()
      if (!profile) throw new Error('Missing owner profile.')
      await ctx.db.patch(profile._id, { entitlementUsageReady: false })
    })
    await expect(owner.caller.query(api.accountEntitlements.get, {})).rejects.toThrow(
      'backfill is incomplete'
    )
  })

  it('upserts canonical tiers without changing the same-tier record identity', async () => {
    const { t, owner } = await fixture()
    expect(setTier.isInternal).toBe(true)
    await t.mutation(setTierReference, { userId: owner.userId.toUpperCase(), tier: 'GM' })
    const assigned = await t.run((ctx) =>
      ctx.db
        .query('accountEntitlements')
        .withIndex('by_userId', (q) => q.eq('userId', owner.userId))
        .unique()
    )
    expect(assigned).toMatchObject({ userId: owner.userId, tier: 'GM' })
    if (!assigned) throw new Error('Missing assigned entitlement.')
    await t.mutation(setTierReference, { userId: owner.userId, tier: 'GM' })
    expect(await t.run((ctx) => ctx.db.get(assigned._id))).toEqual(assigned)
    await t.mutation(setTierReference, { userId: owner.userId, tier: 'FREE' })
    expect(await t.run((ctx) => ctx.db.get(assigned._id))).toMatchObject({ tier: 'FREE' })
  })

  it('rejects missing and invalid targets without writing an entitlement', async () => {
    const { t } = await fixture()
    for (const userId of ['invalid', crypto.randomUUID()])
      await expect(t.mutation(setTierReference, { userId, tier: 'GM' })).rejects.toThrow()
    await expect(
      // @ts-expect-error Publicly invalid tier must also fail runtime validation.
      t.mutation(setTierReference, { userId: crypto.randomUUID(), tier: 'ADMIN' })
    ).rejects.toThrow()
    expect(await t.run((ctx) => ctx.db.query('accountEntitlements').collect())).toEqual([])
  })

  it('removes the deleted account tier without touching another account', async ({
    onTestFinished
  }) => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const { t, owner, other } = await fixture()
    await t.mutation(setTierReference, { userId: owner.userId, tier: 'GM' })
    await t.mutation(setTierReference, { userId: other.userId, tier: 'PRO_GM' })
    const profile = await t.run((ctx) =>
      ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', owner.userId))
        .unique()
    )
    if (!profile) throw new Error('Missing account profile.')
    await t.run(async (ctx) => {
      for (let index = 0; index < 65; index++)
        await ctx.db.insert('accountUsageEntries', {
          resource: 'savedEncounters',
          sourceId: crypto.randomUUID(),
          ownerUserId: owner.userId
        })
      await ctx.db.insert('accountUsageEntries', {
        resource: 'savedEncounters',
        sourceId: crypto.randomUUID(),
        ownerUserId: other.userId
      })
    })
    await expect(
      t.mutation(internal.accountUsage.purgeRecipient, { userId: owner.userId })
    ).rejects.toThrow('Cannot purge an active account')
    await deleteAccountCompletely(t, profile.authUserId)
    expect(await t.run((ctx) => ctx.db.query('accountUsageEntries').collect())).toEqual([
      expect.objectContaining({ ownerUserId: other.userId })
    ])
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('accountEntitlements')
          .withIndex('by_userId', (q) => q.eq('userId', owner.userId))
          .unique()
      )
    ).toBeNull()
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('accountEntitlements')
          .withIndex('by_userId', (q) => q.eq('userId', other.userId))
          .unique()
      )
    ).toMatchObject({ tier: 'PRO_GM' })
  })
})
