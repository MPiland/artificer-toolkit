import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { SocialApplicationDto } from '@artificer-toolkit/schema/api/socialHub'
import type { SocialApplicationPublicIdInput } from '@artificer-toolkit/schema/api/socialAdmissionLists'
import { fixture } from '../../tests/fixtures/socialWriters'
import { api } from '../_generated/api'
import { orderedSocialPair } from './blockInvalidation'

const getOwn = makeFunctionReference<'query', SocialApplicationPublicIdInput, SocialApplicationDto>(
  'social/applications:getOwn'
)

describe('native own application deep links', () => {
  it('returns private original prose only to the active applicant and observes block visibility', async () => {
    const base = await fixture()
    const application = await base.other.caller.mutation(api.social.applications.submit, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      message: 'A shitstorm of private application text.'
    })
    const input = { applicationPublicId: application.applicationPublicId.toUpperCase() }
    const before = await base.snapshot()
    expect(await base.other.caller.query(getOwn, input)).toEqual(application)
    await expect(base.t.query(getOwn, input)).rejects.toThrow('Unauthenticated')
    await expect(base.owner.caller.query(getOwn, input)).rejects.toThrow(
      'Social application not found.'
    )
    await expect(
      base.other.caller.query(getOwn, { applicationPublicId: crypto.randomUUID() })
    ).rejects.toThrow('Social application not found.')
    expect(await base.snapshot()).toEqual(before)
    const profiles = await base.t.run(async (ctx) => {
      const owner = await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique()
      const player = await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
        .unique()
      if (!owner || !player) throw new Error('Missing profiles.')
      const blockId = await ctx.db.insert('socialBlocks', {
        blockerProfileId: owner.id,
        blockedProfileId: player.id,
        createdAt: new Date().toISOString()
      })
      return { owner, player, blockId }
    })
    await expect(base.other.caller.query(getOwn, input)).rejects.toThrow(
      'Social admission is unavailable.'
    )
    await base.t.run(async (ctx) => {
      await ctx.db.delete(profiles.blockId)
      await ctx.db.insert('socialBlockInvalidations', {
        ...orderedSocialPair(profiles.owner, profiles.player),
        generation: 1,
        invalidatedAt: new Date().toISOString()
      })
    })
    const blocked = await base.snapshot()
    expect(await base.other.caller.query(getOwn, input)).toMatchObject({
      status: 'BLOCKED',
      version: application.version + 1,
      message: application.message
    })
    expect(await base.snapshot()).toEqual(blocked)
    await base.t.run((ctx) => ctx.db.patch(profiles.player._id, { status: 'SUSPENDED' }))
    await expect(base.other.caller.query(getOwn, input)).rejects.toThrow('An active Social profile')
  })
})
