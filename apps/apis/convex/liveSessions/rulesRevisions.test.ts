import { convexTest } from 'convex-test'
import { expect, it } from 'vitest'
import schema from '../schema'
import { assertLiveSessionRulesRevisions, readLiveSessionRulesRevisions } from './rulesRevisions'

it('requires the entire authorized scope and rejects revisions changed after capture before any write', async () => {
  const t = convexTest(schema)
  const scope = {
    systemId: crypto.randomUUID(),
    campaignId: crypto.randomUUID(),
    characterId: crypto.randomUUID()
  }
  const expected = { ...scope, characterIds: [scope.characterId] }
  const captured = await t.run((ctx) => readLiveSessionRulesRevisions(ctx, scope))
  expect(captured).toHaveLength(4)
  expect(captured.every((entry) => entry.revision === null)).toBe(true)
  await t.run((ctx) => assertLiveSessionRulesRevisions(ctx, captured, expected))

  for (const invalid of [
    captured.slice(0, -1),
    [...captured.slice(0, -1), captured[0]!],
    [...captured.slice(0, -1), { ...captured[3]!, id: crypto.randomUUID() }]
  ])
    await expect(
      t.run((ctx) => assertLiveSessionRulesRevisions(ctx, invalid, expected))
    ).rejects.toThrow('revision scope')

  // Every observed range, including an absent marker, participates in the commit fence.
  for (const observed of captured) {
    const current = await t.run((ctx) => readLiveSessionRulesRevisions(ctx, scope))
    await t.run(async (ctx) => {
      await ctx.db.insert('sceneVisionRevisions', { ...observed, revision: crypto.randomUUID() })
    })
    const sentinelId = crypto.randomUUID()
    await expect(
      t.run(async (ctx) => {
        await assertLiveSessionRulesRevisions(ctx, current, expected)
        await ctx.db.insert('sceneVisionRevisions', {
          scope: 'CHARACTER',
          id: sentinelId,
          revision: crypto.randomUUID()
        })
      })
    ).rejects.toThrow('changed before commit')
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('sceneVisionRevisions')
          .withIndex('by_scope_id', (q) => q.eq('scope', 'CHARACTER').eq('id', sentinelId))
          .unique()
      )
    ).toBeNull()
  }
})
