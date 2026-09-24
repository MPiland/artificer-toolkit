import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { api, components } from '../_generated/api'
import { publicationFixture } from '../../tests/fixtures/publication'
import { setFixturePlayerTier } from './development'

it('limits reversible Player-tier setup to empty disposable development accounts', async () => {
  const { t, first } = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    []
  )
  const command = makeFunctionReference<'mutation', { userId: string; enabled: boolean }, null>(
    'content/development:setFixturePlayerTier'
  )
  const input = { userId: first.userId, enabled: true }
  expect(setFixturePlayerTier.isInternal).toBe(true)
  await expect(t.mutation(command, input)).rejects.toThrow('Fixture account is required')
  await t.run(async (ctx) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', first.userId))
      .unique()
    if (!profile) throw new Error('Missing fixture profile')
    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: 'user',
        where: [{ field: '_id', value: profile.authUserId }],
        update: { email: 'draft_012345abcdef@example.invalid' }
      }
    })
  })
  vi.stubEnv('SITE_URL', 'https://example.com')
  try {
    await expect(t.mutation(command, input)).rejects.toThrow('development application origin')
  } finally {
    vi.unstubAllEnvs()
  }
  expect(await t.run((ctx) => ctx.db.query('accountEntitlements').collect())).toEqual([])
  await t.mutation(command, input)
  await t.mutation(command, input)
  expect(await t.run((ctx) => ctx.db.query('accountEntitlements').collect())).toMatchObject([
    { userId: first.userId, tier: 'PLAYER' }
  ])
  const id = crypto.randomUUID()
  await first.caller.mutation(api.content.drafts.save, {
    subjectKind: 'EQUIPMENT',
    subjectId: id,
    systemId: club.systemId,
    label: 'Tier cleanup guard',
    payload: { ...club, id, userId: first.userId }
  })
  await expect(t.mutation(command, { ...input, enabled: false })).rejects.toThrow(
    'empty fixture account'
  )
  await first.caller.mutation(api.content.drafts.discard, {
    subjectKind: 'EQUIPMENT',
    subjectId: id
  })
  await t.mutation(command, { ...input, enabled: false })
  await t.mutation(command, { ...input, enabled: false })
  expect(await t.run((ctx) => ctx.db.query('accountEntitlements').collect())).toEqual([])
  await t.run((ctx) => ctx.db.insert('accountEntitlements', { userId: first.userId, tier: 'GM' }))
  await expect(t.mutation(command, input)).rejects.toThrow('another tier')
  await expect(t.mutation(command, { ...input, enabled: false })).rejects.toThrow('another tier')
  expect(await t.run((ctx) => ctx.db.query('accountEntitlements').collect())).toMatchObject([
    { tier: 'GM' }
  ])
})
