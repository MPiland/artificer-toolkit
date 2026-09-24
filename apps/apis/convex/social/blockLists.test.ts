import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  SocialBlockListInput,
  SocialBlockPage
} from '@artificer-toolkit/schema/api/socialBlockLists'
import type { SocialBlockDto } from '@artificer-toolkit/schema/api/socialHub'
import { fixture } from '../../tests/fixtures/socialWriters'

const list = makeFunctionReference<'query', SocialBlockListInput, SocialBlockPage>(
  'social/blockLists:list'
)

describe('native outgoing Social block pages', () => {
  it('continues across missing counterparts, includes suspended targets and keeps direction/order/private fields', async () => {
    const base = await fixture()
    const active = await base.addActor('BlockedTarget')
    const missingAccount = await base.addActor('MissingBlockAccount')
    const expected = await base.t.run(async (ctx) => {
      const actors = await Promise.all(
        [base.owner, base.other, active, missingAccount].map((actor) =>
          ctx.db
            .query('socialProfiles')
            .withIndex('by_userId', (q) => q.eq('userId', actor.userId))
            .unique()
        )
      )
      const [owner, suspended, target, orphan] = actors
      if (!owner || !suspended || !target || !orphan) throw new Error('Missing block fixture.')
      await ctx.db.patch(suspended._id, { status: 'SUSPENDED' })
      const account = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', missingAccount.userId))
        .unique()
      if (!account) throw new Error('Missing account fixture.')
      await ctx.db.delete(account._id)
      const createdAt = '2026-01-01T00:00:00.000Z'
      for (const profile of [suspended, target, orphan]) {
        await ctx.db.insert('socialBlocks', {
          blockerProfileId: owner.id,
          blockedProfileId: profile.id,
          createdAt
        })
      }
      await ctx.db.insert('socialBlocks', {
        blockerProfileId: target.id,
        blockedProfileId: owner.id,
        createdAt
      })
      for (let index = 0; index < 18; index++) {
        await ctx.db.insert('socialBlocks', {
          blockerProfileId: owner.id,
          blockedProfileId: crypto.randomUUID(),
          createdAt: new Date(Date.parse(createdAt) + index + 1).toISOString()
        })
      }
      return [
        { profile: { profilePublicId: suspended.id, username: 'AdmissionPlayer' }, createdAt },
        { profile: { profilePublicId: target.id, username: 'BlockedTarget' }, createdAt }
      ].sort((left, right) =>
        right.profile.profilePublicId.localeCompare(left.profile.profilePublicId)
      )
    })
    const before = await base.snapshot()
    const found: SocialBlockDto[] = []
    let cursor: string | null = null
    let emptyContinuation = false
    let pages = 0
    while (true) {
      const result: SocialBlockPage = await base.owner.caller.query(list, {
        paginationOpts: { cursor, numItems: 1 }
      })
      found.push(...result.page)
      emptyContinuation ||= result.page.length === 0 && !result.isDone
      pages += 1
      expect(pages).toBeLessThan(30)
      if (result.isDone) break
      cursor = result.continueCursor
    }
    expect(emptyContinuation).toBe(true)
    expect(found).toEqual(expected)
    const reverse = await active.caller.query(list, {
      paginationOpts: { cursor: null, numItems: 4 }
    })
    expect(reverse.page).toHaveLength(1)
    expect(reverse.page[0]?.profile.username).toBe('AdmissionHost')
    expect(await base.snapshot()).toEqual(before)
  })

  it('requires an active actor and enforces shared page bounds', async () => {
    const base = await fixture()
    const input = { paginationOpts: { cursor: null, numItems: 1 } }
    await expect(base.t.query(list, input)).rejects.toThrow('Unauthenticated')
    expect((await base.owner.caller.query(list, input)).page).toEqual([])
    for (const numItems of [0, 49]) {
      await expect(
        base.owner.caller.query(list, { paginationOpts: { cursor: null, numItems } })
      ).rejects.toThrow()
    }
    await base.t.run(async (ctx) => {
      const profile = await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique()
      if (!profile) throw new Error('Missing actor profile.')
      await ctx.db.patch(profile._id, { status: 'SUSPENDED' })
    })
    await expect(base.owner.caller.query(list, input)).rejects.toThrow('An active Social profile')
  })
})
