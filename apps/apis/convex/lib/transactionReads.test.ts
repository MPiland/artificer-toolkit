import { convexTest } from 'convex-test'
import { expect, it } from 'vitest'

import schema from '../schema'
import { memoizeTransactionReads } from './transactionReads'

it('serves identical reads once, frozen, and keeps different ranges apart', async () => {
  const t = convexTest(schema)
  const id = crypto.randomUUID()
  const documentId = await t.run((ctx) =>
    ctx.db.insert('sceneVisionRevisions', { scope: 'CHARACTER', id, revision: 'first' })
  )
  await t.run(async (ctx) => {
    const db = memoizeTransactionReads(ctx.db)
    const byScope = () =>
      db
        .query('sceneVisionRevisions')
        .withIndex('by_scope_id', (q) => q.eq('scope', 'CHARACTER').eq('id', id))
        .unique()
    const first = await byScope()
    expect(first?.revision).toBe('first')
    // A repeat is served from the memo: the same frozen document, which no caller can change.
    expect(await byScope()).toBe(first)
    expect(Object.isFrozen(first)).toBe(true)
    expect(() => {
      if (first) Object.assign(first, { revision: 'changed' })
    }).toThrow()
    expect(await db.get(documentId)).toBe(await db.get(documentId))

    // Different bounds, order or terminal are different reads.
    await expect(
      db
        .query('sceneVisionRevisions')
        .withIndex('by_scope_id', (q) => q.eq('scope', 'PLAY').eq('id', id))
        .unique()
    ).resolves.toBeNull()
    const descending = await db
      .query('sceneVisionRevisions')
      .withIndex('by_scope_id', (q) => q.eq('scope', 'CHARACTER'))
      .order('desc')
      .take(4)
    expect(descending).toHaveLength(1)
    expect(descending).not.toBe(
      await db
        .query('sceneVisionRevisions')
        .withIndex('by_scope_id', (q) => q.eq('scope', 'CHARACTER'))
        .take(4)
    )
  })
})
