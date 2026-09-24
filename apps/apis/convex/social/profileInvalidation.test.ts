import { makeFunctionReference } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fixture, snapshot } from '../../tests/fixtures/socialAdmission'
import { orderedSocialPair } from './blockInvalidation'
import { readAdmissionInvalidation } from './admissionInvalidation'

const cleanup = makeFunctionReference<
  'mutation',
  {
    profileId: string
    userId: string
    generation: number
    invalidatedAt: string
    phase: 'APPLICATION' | 'INVITATION'
    cursor: null
  },
  null
>('social/profileModerationCleanup:run')

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('profile invalidation history', () => {
  it.each(['PROFILE', 'BLOCK'] as const)(
    'retains %s when it commits first at a tied display time',
    async (first) => {
      const base = await fixture()
      const before = await snapshot(base)
      const profiles = await base.t.run(async (ctx) => ({
        host: await ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
          .unique(),
        player: await ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
          .unique()
      }))
      if (!profiles.host || !profiles.player) throw new Error('Missing Social profiles.')
      const { host, player } = profiles
      const invalidatedAt = base.campaign.createdAt
      for (const kind of [first, first === 'PROFILE' ? 'BLOCK' : 'PROFILE']) {
        await base.t.run(async (ctx) => {
          if (kind === 'PROFILE') {
            await ctx.db.insert('socialProfileInvalidations', {
              profileId: player.id,
              userId: player.userId,
              generation: 1,
              invalidatedAt,
              committedAt: ctx.db.vars.commitTs
            })
            await ctx.db.patch(player._id, { invalidationGeneration: 1 })
          } else {
            await ctx.db.insert('socialBlockInvalidations', {
              ...orderedSocialPair(host, player),
              generation: 1,
              invalidatedAt,
              committedAt: ctx.db.vars.commitTs
            })
          }
        })
      }
      expect(
        await base.t.run((ctx) =>
          readAdmissionInvalidation(
            ctx,
            host.userId,
            { profileId: player.id },
            0,
            { id: base.listingId, generation: 0 },
            {}
          )
        )
      ).toMatchObject({ kind: first, invalidatedAt })
      for (const phase of ['APPLICATION', 'INVITATION'] as const)
        await base.t.mutation(cleanup, {
          profileId: player.id,
          userId: player.userId,
          generation: 1,
          invalidatedAt,
          phase,
          cursor: null
        })
      const after = await snapshot(base)
      expect(after.applications.find((row) => row.id === base.applicationId)).toMatchObject({
        status: first === 'BLOCK' ? 'BLOCKED' : 'EXPIRED',
        version: 3
      })
      expect(after.invites.find((row) => row.id === base.inviteId)).toMatchObject({
        status: first === 'BLOCK' ? 'REVOKED' : 'EXPIRED',
        version: 3
      })
      expect(after.memberships).toEqual(before.memberships)
      expect(after.applications.find((row) => row.id === base.acceptedApplicationId)).toEqual(
        before.applications.find((row) => row.id === base.acceptedApplicationId)
      )
    }
  )

  it.each([false, true])(
    'keeps each request at its first later suspension with reversed cleanup=%s',
    async (reversed) => {
      const base = await fixture()
      const player = await base.t.run((ctx) =>
        ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
          .unique()
      )
      if (!player) throw new Error('Missing Social profile.')
      const times = [
        base.campaign.createdAt,
        new Date(Date.parse(base.campaign.createdAt) + 1).toISOString()
      ]
      for (const generation of [1, 2]) {
        await base.t.run(async (ctx) => {
          await ctx.db.insert('socialProfileInvalidations', {
            profileId: player.id,
            userId: player.userId,
            generation,
            invalidatedAt: times[generation - 1]!,
            committedAt: ctx.db.vars.commitTs
          })
          await ctx.db.patch(player._id, { invalidationGeneration: generation })
          if (generation === 1) {
            const row = await ctx.db
              .query('socialApplications')
              .withIndex('by_publicId', (q) => q.eq('id', base.applicationId))
              .unique()
            if (!row) throw new Error('Missing request.')
            // This application was created after the first restoration; the invitation predates it.
            await ctx.db.patch(row._id, { participantProfileGeneration: 1 })
          }
        })
      }
      for (const generation of reversed ? [2, 1] : [1, 2]) {
        for (const phase of ['APPLICATION', 'INVITATION'] as const)
          await base.t.mutation(cleanup, {
            profileId: player.id,
            userId: player.userId,
            generation,
            invalidatedAt: times[generation - 1]!,
            phase,
            cursor: null
          })
      }
      const after = await snapshot(base)
      expect(after.applications.find((row) => row.id === base.applicationId)).toMatchObject({
        status: 'EXPIRED',
        expiredAt: times[1],
        version: 3
      })
      expect(after.invites.find((row) => row.id === base.inviteId)).toMatchObject({
        status: 'EXPIRED',
        expiredAt: times[0],
        version: 3
      })
    }
  )
})
