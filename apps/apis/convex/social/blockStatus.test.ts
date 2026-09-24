import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type { socialBlockInputSchema } from '@artificer-toolkit/schema/api/socialHub'
import type { SocialBlockStatus } from '@artificer-toolkit/schema/api/socialBlockLists'
import { fixture } from '../../tests/fixtures/socialWriters'

const getStatus = makeFunctionReference<
  'query',
  z.input<typeof socialBlockInputSchema>,
  SocialBlockStatus
>('social/blocks:getStatus')

describe('native private outgoing block status', () => {
  it('reads the caller direction through suspension and hides deleted counterparts', async () => {
    const base = await fixture()
    const [owner, target] = await base.t.run(async (ctx) =>
      Promise.all([
        ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
          .unique(),
        ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
          .unique()
      ])
    )
    if (!owner || !target) throw new Error('Missing profiles.')
    const input = { profilePublicId: target.id.toUpperCase() }
    expect(await base.owner.caller.query(getStatus, input)).toEqual({ blocked: false })
    expect(
      await base.owner.caller.query(getStatus, { profilePublicId: crypto.randomUUID() })
    ).toEqual({ blocked: false })
    await base.t.run((ctx) =>
      ctx.db.insert('socialBlocks', {
        blockerProfileId: owner.id,
        blockedProfileId: target.id,
        createdAt: new Date().toISOString()
      })
    )
    expect(await base.owner.caller.query(getStatus, input)).toEqual({ blocked: true })
    expect(await base.other.caller.query(getStatus, { profilePublicId: owner.id })).toEqual({
      blocked: false
    })
    await base.t.run((ctx) => ctx.db.patch(target._id, { status: 'SUSPENDED' }))
    expect(await base.owner.caller.query(getStatus, input)).toEqual({ blocked: true })
    await base.t.run((ctx) => ctx.db.delete(target._id))
    const before = await base.snapshot()
    expect(await base.owner.caller.query(getStatus, input)).toEqual({ blocked: false })
    expect(await base.snapshot()).toEqual(before)
  })

  it('requires an active actor and validates public UUIDs', async () => {
    const base = await fixture()
    const input = { profilePublicId: crypto.randomUUID() }
    await expect(base.t.query(getStatus, input)).rejects.toThrow('Unauthenticated')
    await expect(
      base.owner.caller.query(getStatus, { profilePublicId: 'not-a-profile-id' })
    ).rejects.toThrow()
    await base.t.run(async (ctx) => {
      const actor = await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique()
      if (!actor) throw new Error('Missing actor.')
      await ctx.db.patch(actor._id, { status: 'SUSPENDED' })
    })
    await expect(base.owner.caller.query(getStatus, input)).rejects.toThrow(
      'An active Social profile'
    )
  })
})
