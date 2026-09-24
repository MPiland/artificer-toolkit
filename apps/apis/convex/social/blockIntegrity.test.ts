import { makeFunctionReference } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  socialBlockInputSchema,
  SocialBlockDto
} from '@artificer-toolkit/schema/api/socialHub'
import { fixture } from '../../tests/fixtures/socialWriters'

const create = makeFunctionReference<
  'mutation',
  z.input<typeof socialBlockInputSchema>,
  SocialBlockDto
>('social/blocks:create')
const remove = makeFunctionReference<'mutation', z.input<typeof socialBlockInputSchema>, null>(
  'social/blocks:remove'
)

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('retained Social block integrity', () => {
  it.each(['missing', 'corrupt', 'valid', 'unmarked orphan'] as const)(
    'handles a deleted target with %s retained evidence',
    async (state) => {
      const base = await fixture()
      try {
        const target = await base.t.run((ctx) =>
          ctx.db
            .query('socialProfiles')
            .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
            .unique()
        )
        if (!target) throw new Error('Missing target.')
        await base.owner.caller.mutation(create, { profilePublicId: target.id })
        await base.t.run(async (ctx) => {
          await ctx.db.delete(target._id)
          const event = await ctx.db.query('socialBlockInvalidations').first()
          if (!event) throw new Error('Missing event.')
          if (state === 'missing' || state === 'unmarked orphan') await ctx.db.delete(event._id)
          if (state === 'corrupt')
            await ctx.db.patch(
              event._id,
              event.firstUserId === base.owner.userId
                ? { firstUserId: crypto.randomUUID() }
                : { secondUserId: crypto.randomUUID() }
            )
          if (state === 'unmarked orphan') {
            const block = await ctx.db.query('socialBlocks').first()
            if (!block) throw new Error('Missing block.')
            await ctx.db.patch(block._id, { invalidationGeneration: undefined })
          }
        })
        const before = await base.snapshot()
        if (state === 'missing' || state === 'corrupt') {
          await expect(
            base.owner.caller.mutation(remove, { profilePublicId: target.id })
          ).rejects.toThrow('Social block invalidation is unavailable.')
          expect(await base.snapshot()).toEqual(before)
          expect(await base.t.run((ctx) => ctx.db.query('socialBlocks').collect())).toHaveLength(1)
        } else {
          await expect(
            base.owner.caller.mutation(remove, { profilePublicId: target.id })
          ).resolves.toBeNull()
          expect(await base.t.run((ctx) => ctx.db.query('socialBlocks').collect())).toEqual([])
        }
      } finally {
        await base.t.finishAllScheduledFunctions(vi.runAllTimers)
      }
    }
  )
})
