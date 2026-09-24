import { makeFunctionReference } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  SocialApplicationDto,
  SubmitSocialApplicationInput
} from '@artificer-toolkit/schema/api/socialHub'
import { fixture } from '../../tests/fixtures/socialWriters'
import * as intents from '../notifications/intents'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const submit = makeFunctionReference<
  'mutation',
  SubmitSocialApplicationInput,
  SocialApplicationDto
>('social/applications:submit')
const cleanup = makeFunctionReference<
  'mutation',
  {
    firstProfileId: string
    secondProfileId: string
    firstUserId: string
    secondUserId: string
    generation: number
    invalidatedAt: string
    phase: 'APPLICATION_FIRST' | 'APPLICATION_SECOND'
    cursor: string | null
  },
  null
>('social/blockCleanup:run')

async function pairFixture() {
  const base = await fixture()
  const [host, participant] = await base.t.run(async (ctx) => [
    await ctx.db
      .query('socialProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
      .unique(),
    await ctx.db
      .query('socialProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
      .unique()
  ])
  if (!host || !participant) throw new Error('Missing Social profiles.')
  const [first, second] = host.id < participant.id ? [host, participant] : [participant, host]
  return { base, host, participant, first, second }
}

describe('native Social block cleanup', () => {
  it.each([true, false])(
    'keeps first invalidation time and versions with newer job first=%s',
    async (newerFirst) => {
      const { base, host, participant, first, second } = await pairFixture()
      const source = await base.other.caller.mutation(submit, {
        listingPublicId: base.listing.listingPublicId,
        expectedListingVersion: base.listing.version,
        message: 'Must retain the first safety event time.'
      })
      const firstTime = '2030-01-01T00:00:00.000Z'
      const secondTime = '2030-01-02T00:00:00.000Z'
      const [generationOneId, generationTwoId] = await base.t.run(async (ctx) => {
        await ctx.db.insert('socialBlockInvalidations', {
          firstProfileId: first.id,
          secondProfileId: second.id,
          firstUserId: first.userId,
          secondUserId: second.userId,
          generation: 1,
          invalidatedAt: firstTime
        })
        await ctx.db.insert('socialBlockInvalidations', {
          firstProfileId: first.id,
          secondProfileId: second.id,
          firstUserId: first.userId,
          secondUserId: second.userId,
          generation: 2,
          invalidatedAt: secondTime
        })
        const original = await ctx.db
          .query('socialApplications')
          .withIndex('by_publicId', (q) => q.eq('id', source.applicationPublicId))
          .unique()
        if (!original) throw new Error('Missing application.')
        const { _id, _creationTime, ...stored } = original
        const ids = [crypto.randomUUID(), crypto.randomUUID()]
        for (const [index, id] of ids.entries())
          await ctx.db.insert('socialApplications', {
            ...stored,
            id,
            blockGeneration: index + 1
          })
        return ids
      })
      const phase = participant.id === first.id ? 'APPLICATION_FIRST' : 'APPLICATION_SECOND'
      for (const generation of newerFirst ? [2, 1] : [1, 2])
        await base.t.mutation(cleanup, {
          firstProfileId: first.id,
          secondProfileId: second.id,
          firstUserId: first.userId,
          secondUserId: second.userId,
          generation,
          invalidatedAt: generation === 1 ? firstTime : secondTime,
          phase,
          cursor: null
        })
      const row = await base.t.run((ctx) =>
        ctx.db
          .query('socialApplications')
          .withIndex('by_publicId', (q) => q.eq('id', source.applicationPublicId))
          .unique()
      )
      expect(row).toMatchObject({ status: 'BLOCKED', blockedAt: firstTime, version: 1 })
      await base.t.finishAllScheduledFunctions(vi.runAllTimers)
      const final = await base.snapshot()
      expect(
        final.applications.find((record) => record.id === source.applicationPublicId)
      ).toMatchObject({ status: 'BLOCKED', blockedAt: firstTime, version: 1 })
      expect(final.applications.find((record) => record.id === generationOneId)).toMatchObject({
        status: 'BLOCKED',
        blockedAt: secondTime,
        version: 1
      })
      expect(final.applications.find((record) => record.id === generationTwoId)).toMatchObject({
        status: 'SUBMITTED',
        blockedAt: null,
        version: 0
      })
      expect(host.userId).not.toBe(participant.id)
    }
  )

  it('rolls back an entire cleanup page and its continuation when cancellation fails', async () => {
    const { base, participant, first, second } = await pairFixture()
    const source = await base.other.caller.mutation(submit, {
      listingPublicId: base.listing.listingPublicId,
      expectedListingVersion: base.listing.version,
      message: 'Atomic page rollback.'
    })
    const event = {
      firstProfileId: first.id,
      secondProfileId: second.id,
      firstUserId: first.userId,
      secondUserId: second.userId,
      generation: 1,
      invalidatedAt: new Date().toISOString()
    }
    await base.t.run(async (ctx) => {
      await ctx.db.insert('socialBlockInvalidations', event)
      const original = await ctx.db
        .query('socialApplications')
        .withIndex('by_publicId', (q) => q.eq('id', source.applicationPublicId))
        .unique()
      if (!original) throw new Error('Missing application.')
      const { _id, _creationTime, ...stored } = original
      for (let index = 0; index < 24; index++)
        await ctx.db.insert('socialApplications', {
          ...stored,
          id: crypto.randomUUID()
        })
    })
    const before = await base.snapshot()
    const beforeScheduled = await base.t.run((ctx) =>
      ctx.db.system.query('_scheduled_functions').collect()
    )
    const original = intents.cancelNotification
    let calls = 0
    const fault = vi.spyOn(intents, 'cancelNotification').mockImplementation(async (ctx, input) => {
      await original(ctx, input)
      calls += 1
      if (calls === 2) throw new Error('Injected page cancellation failure')
    })
    const args = {
      ...event,
      phase:
        participant.id === first.id
          ? ('APPLICATION_FIRST' as const)
          : ('APPLICATION_SECOND' as const),
      cursor: null
    }
    try {
      await expect(base.t.mutation(cleanup, args)).rejects.toThrow(
        'Injected page cancellation failure'
      )
    } finally {
      fault.mockRestore()
    }
    expect(calls).toBe(2)
    expect(await base.snapshot()).toEqual(before)
    expect(
      await base.t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())
    ).toEqual(beforeScheduled)
    await base.t.mutation(cleanup, args)
    await base.t.finishAllScheduledFunctions(vi.runAllTimers)
    const after = await base.snapshot()
    expect(after.applications).toHaveLength(25)
    expect(
      after.applications.every(
        (row) =>
          row.status === 'BLOCKED' && row.version === 1 && row.blockedAt === event.invalidatedAt
      )
    ).toBe(true)
    expect(after.notifications.every((row) => row.status === 'CANCELLED')).toBe(true)
  })
})
