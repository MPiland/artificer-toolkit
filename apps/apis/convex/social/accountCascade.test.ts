import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { campaignStoredInviteSchema } from '@artificer-toolkit/schema/projections/campaignPersistence'
import { advanceAccountDeletionToProvider } from '../../tests/fixtures/accountDeletion'
import { fixture } from '../../tests/fixtures/socialWriters'
import { api, components, internal } from '../_generated/api'

const cleanup = makeFunctionReference<
  'mutation',
  { userId: string; profileId: string | null },
  null
>('social/accountCleanup:run')

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('atomically schedules bounded, retry-safe account cascades and immediately hides deleted targets', async () => {
  const base = await fixture()
  const profiles = await base.t.run((ctx) => ctx.db.query('socialProfiles').collect())
  const victim = profiles.find((profile) => profile.userId === base.other.userId)!
  const host = profiles.find((profile) => profile.userId === base.owner.userId)!
  await base.owner.caller.mutation(api.social.blocks.create, { profilePublicId: victim.id })
  await base.t.finishAllScheduledFunctions(vi.runAllTimers)
  const peerIds: string[] = []
  for (let i = 0; i < 17; i++) {
    const actor = await base.addActor(`CascadePeer${i}`)
    const profile = await base.t.run((ctx) =>
      ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', actor.userId))
        .unique()
    )
    if (!profile) throw new Error('Missing cascade peer.')
    peerIds.push(profile.id)
  }
  const now = new Date().toISOString()
  const statuses = ['PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED'] as const
  // Bulk historical rows exercise every cascade index beyond its eight-row transaction page.
  const sentinel = await base.t.run(async (ctx) => {
    for (let i = 0; i < 9; i++) {
      await ctx.db.insert('socialBlocks', {
        blockerProfileId: victim.id,
        blockedProfileId: peerIds[i]!,
        createdAt: now
      })
      if (i < 8)
        await ctx.db.insert('socialBlocks', {
          blockerProfileId: peerIds[i + 9]!,
          blockedProfileId: victim.id,
          createdAt: now
        })
      const status = statuses[i % statuses.length]!
      for (const createdByVictim of [true, false]) {
        await ctx.db.insert(
          'campaignInvites',
          campaignStoredInviteSchema.parse({
            id: crypto.randomUUID(),
            listingId: base.listing.listingPublicId,
            createdBy: createdByVictim ? victim.userId : host.userId,
            recipientUserId: createdByVictim ? host.userId : victim.userId,
            recipientUsername: createdByVictim ? 'AdmissionHost' : 'AdmissionPlayer',
            listingVersion: base.listing.version,
            status,
            version: 1,
            createdAt: now,
            updatedAt: now,
            expiresAt: status === 'EXPIRED' ? now : new Date(Date.now() + 86_400_000).toISOString(),
            respondedAt: status === 'ACCEPTED' || status === 'DECLINED' ? now : null,
            revokedAt: status === 'REVOKED' ? now : null,
            expiredAt: status === 'EXPIRED' ? now : null
          })
        )
      }
    }
    return await ctx.db.insert('socialBlocks', {
      blockerProfileId: host.id,
      blockedProfileId: peerIds[0]!,
      createdAt: now
    })
  })
  const snapshot = () =>
    base.t.run(async (ctx) => ({
      blocks: await ctx.db.query('socialBlocks').collect(),
      invites: await ctx.db.query('campaignInvites').collect(),
      events: await ctx.db.query('socialBlockInvalidations').collect(),
      jobs: await ctx.db.system.query('_scheduled_functions').collect(),
      accounts: await ctx.db.query('userProfiles').collect(),
      profiles: await ctx.db.query('socialProfiles').collect()
    }))
  const args = { userId: victim.userId, profileId: victim.id }
  const account = (await snapshot()).accounts.find((row) => row.userId === victim.userId)!
  // Every earlier staged step runs first (ADR 0040); the provider delete is the last commit.
  await advanceAccountDeletionToProvider(base.t, account.authUserId, victim.userId)
  const before = await snapshot()
  await base.t.mutation(cleanup, args)
  expect(await snapshot()).toEqual(before)
  await expect(
    base.t.run(async (ctx) => {
      await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: { model: 'user', where: [{ field: '_id', value: account.authUserId }] },
        onDeleteHandle: await createFunctionHandle(internal.auth.onDelete)
      })
      throw new Error('Rollback account deletion')
    })
  ).rejects.toThrow('Rollback account deletion')
  expect(await snapshot()).toEqual(before)
  await base.t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.deleteOne, {
      input: { model: 'user', where: [{ field: '_id', value: account.authUserId }] },
      onDeleteHandle: await createFunctionHandle(internal.auth.onDelete)
    })
  )
  await expect(
    base.owner.caller.query(api.social.blocks.getStatus, {
      profilePublicId: victim.id
    })
  ).resolves.toEqual({ blocked: false })
  const deleted = await snapshot()
  expect(deleted.blocks).toEqual(before.blocks)
  expect(deleted.invites).toEqual(before.invites)
  await base.t.mutation(cleanup, args)
  const firstPage = await snapshot()
  expect(firstPage.blocks).toHaveLength(3)
  expect(firstPage.invites).toHaveLength(2)
  // Resume using the durable scheduled chain after the first batch has committed.
  await base.t.finishAllScheduledFunctions(vi.runAllTimers)
  const after = await snapshot()
  expect(after.blocks).toEqual(before.blocks.filter((row) => row._id === sentinel))
  expect(after.invites).toEqual([])
  expect(after.events).toEqual(before.events)
  expect(after.jobs.every((job) => job.state.kind === 'success')).toBe(true)
  expect(after.accounts).toEqual(before.accounts.filter((row) => row.userId !== victim.userId))
  expect(after.profiles).toEqual(before.profiles.filter((row) => row.userId !== victim.userId))
  await base.t.mutation(cleanup, args)
  expect(await snapshot()).toEqual(after)
})
