import { convexTest } from 'convex-test'
import { expect, it } from 'vitest'

import schema from '../schema'
import {
  deriveOnce,
  memoizeTransactionReads
} from '@artificer-toolkit/encounter-persistence/transactionReads'

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
    expect(memoizeTransactionReads(db)).toBe(db)

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

it('derives a memoized document once, frozen, and any other document on every call', async () => {
  const t = convexTest(schema)
  const id = crypto.randomUUID()
  const documentId = await t.run((ctx) =>
    ctx.db.insert('sceneVisionRevisions', { scope: 'CHARACTER', id, revision: 'first' })
  )
  let derived = 0
  const derive = (document: { revision: string }) => {
    derived += 1
    return { revision: document.revision }
  }
  await t.run(async (ctx) => {
    const memoized = await memoizeTransactionReads(ctx.db).get(documentId)
    if (!memoized) throw new Error('Missing the memoized document.')
    const first = deriveOnce(memoized, derive)
    expect(deriveOnce(memoized, derive)).toBe(first)
    expect(Object.isFrozen(first)).toBe(true)
    expect(derived).toBe(1)
    const plain = await ctx.db.get(documentId)
    if (!plain) throw new Error('Missing the document.')
    expect(deriveOnce(plain, derive)).not.toBe(deriveOnce(plain, derive))
    expect(derived).toBe(3)
  })
})
