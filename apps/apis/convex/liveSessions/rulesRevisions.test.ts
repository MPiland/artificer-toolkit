import { convexTest } from 'convex-test'
import { expect, it } from 'vitest'
import schema from '../schema'
import { readLiveSessionRulesRevisions } from './rulesRevisions'

it('reads every authorized scope and reflects a changed revision', async () => {
  const t = convexTest(schema)
  const scope = {
    systemId: crypto.randomUUID(),
    campaignId: crypto.randomUUID(),
    characterId: crypto.randomUUID()
  }
  const captured = await t.run((ctx) => readLiveSessionRulesRevisions(ctx, scope))
  expect(captured).toHaveLength(4)
  expect(captured.every((entry) => entry.revision === null)).toBe(true)

  for (const observed of captured) {
    const revision = crypto.randomUUID()
    await t.run(async (ctx) => {
      await ctx.db.insert('sceneVisionRevisions', { ...observed, revision })
    })
    const current = await t.run((ctx) => readLiveSessionRulesRevisions(ctx, scope))
    expect(
      current.find((entry) => entry.scope === observed.scope && entry.id === observed.id)?.revision
    ).toBe(revision)
  }
})
