import { convexTest } from 'convex-test'
import { expect, it } from 'vitest'

import schema from '../schema'
import { withSceneVisionTracking } from './mutations'
import {
  deriveOnce,
  memoizeMutationReads,
  memoizeTransactionReads,
  beforeWrite
} from './transactionReads'

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

it('never serves a value a write in the same transaction changed', async () => {
  const t = convexTest(schema)
  const id = crypto.randomUUID()
  const other = crypto.randomUUID()
  const [documentId, otherId] = await t.run(async (ctx) => [
    await ctx.db.insert('sceneVisionRevisions', { scope: 'CHARACTER', id, revision: 'first' }),
    await ctx.db.insert('authoredRouteIds', {
      subjectKind: 'CHARACTER',
      subjectId: other,
      routeNumber: 1,
      publicId: 'other'
    })
  ])
  await t.run(async (ctx) => {
    let reads = 0
    const counted = new Proxy(ctx.db, {
      get(target, property) {
        const value: unknown = Reflect.get(target, property)
        if (typeof value !== 'function') return value
        return (...args: unknown[]) => {
          if (property === 'get' || property === 'query') reads++
          return value.apply(target, args)
        }
      }
    })
    const db = memoizeMutationReads(counted)
    expect(memoizeMutationReads(db)).toBe(db)
    const byScope = () =>
      db
        .query('sceneVisionRevisions')
        .withIndex('by_scope_id', (q) => q.eq('scope', 'CHARACTER').eq('id', id))
        .unique()
    const all = () => db.query('sceneVisionRevisions').collect()
    const unrelated = await db.get(otherId)
    expect((await byScope())?.revision).toBe('first')
    // A document a query returned is served to a get by its ID, each time as a private copy the
    // caller may change; the memo keeps what was stored.
    const readsBefore = reads
    const read = await db.get(documentId)
    expect(read).toMatchObject({ revision: 'first' })
    Object.assign(read!, { revision: 'changed' })
    expect(await db.get('sceneVisionRevisions', documentId)).toMatchObject({ revision: 'first' })
    expect(reads).toBe(readsBefore)

    // A patch by bare ID drops the document's gets and its table's queries.
    await db.patch(documentId, { revision: 'second' })
    expect(await db.get(documentId)).toMatchObject({ revision: 'second' })
    expect(await db.get('sceneVisionRevisions', documentId)).toMatchObject({ revision: 'second' })
    expect((await byScope())?.revision).toBe('second')
    // Reads of documents and tables the write cannot change are still served from the memo.
    const readsAfterWrite = reads
    expect(await db.get(otherId)).toEqual(unrelated)
    expect(reads).toBe(readsAfterWrite)

    await db.replace('sceneVisionRevisions', documentId, {
      scope: 'CHARACTER',
      id,
      revision: 'third'
    })
    expect((await byScope())?.revision).toBe('third')
    expect(await all()).toHaveLength(1)
    await db.insert('sceneVisionRevisions', { scope: 'PLAY', id, revision: 'inserted' })
    expect(await all()).toHaveLength(2)
    await db.delete(documentId)
    expect(await db.get(documentId)).toBeNull()
    expect(await byScope()).toBeNull()
    expect(await all()).toHaveLength(1)
  })
})

it('drops reads a trigger write changes when the memo sits beneath the triggers', async () => {
  const t = convexTest(schema)
  const characterId = crypto.randomUUID()
  await t.run(async (ctx) => {
    const db = memoizeMutationReads(ctx.db)
    const tracked = withSceneVisionTracking({ ...ctx, db })
    const revision = () =>
      db
        .query('sceneVisionRevisions')
        .withIndex('by_scope_id', (q) => q.eq('scope', 'CHARACTER').eq('id', characterId))
        .unique()
    expect(await revision()).toBeNull()
    // The trigger refreshes the Character's revision row through the memo, which drops the read.
    await tracked.db.insert('authoredRouteIds', {
      subjectKind: 'CHARACTER',
      subjectId: characterId,
      routeNumber: 1,
      publicId: 'route-1'
    })
    expect((await revision())?.revision).toEqual(expect.any(String))
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

it('derives a mutation memo document once per stored version, handing out private copies', async () => {
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
  const chained = (value: { revision: string }) => ({ upper: value.revision.toUpperCase() })
  await t.run(async (ctx) => {
    const db = memoizeMutationReads(ctx.db)
    const read = async () => {
      const document = await db.get(documentId)
      if (!document) throw new Error('Missing the memoized document.')
      return document
    }
    const first = deriveOnce(await read(), derive)
    const second = deriveOnce(await read(), derive)
    expect(second).toEqual(first)
    expect(second).not.toBe(first)
    expect(Object.isFrozen(first)).toBe(false)
    expect(derived).toBe(1)
    // A caller's change to its copy never reaches the next caller.
    first.revision = 'changed'
    expect(deriveOnce(await read(), derive)).toEqual({ revision: 'first' })
    // A derivation of a derived copy is cached too.
    expect(deriveOnce(second, chained)).toEqual({ upper: 'FIRST' })
    // A written document derives again from its new stored value.
    await db.patch(documentId, { revision: 'second' })
    expect(deriveOnce(await read(), derive)).toEqual({ revision: 'second' })
    expect(derived).toBe(2)
  })
})

it('shares an identity-keyed derivation with a re-read of the same content after a write', async () => {
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
  const identity = (document: { revision: string }) => document.revision
  await t.run(async (ctx) => {
    const db = memoizeMutationReads(ctx.db)
    const read = async () => {
      const document = await db.get(documentId)
      if (!document) throw new Error('Missing the memoized document.')
      return document
    }
    expect(deriveOnce(await read(), derive, identity)).toEqual({ revision: 'first' })
    // Verified before the write, as it will be stored.
    const candidate = beforeWrite(db, { ...(await read()), revision: 'second' })
    expect(deriveOnce(candidate, derive, identity)).toEqual({ revision: 'second' })
    expect(derived).toBe(2)
    await db.patch(documentId, { revision: 'second' })
    const reread = deriveOnce(await read(), derive, identity)
    expect(reread).toEqual({ revision: 'second' })
    expect(derived).toBe(2)
    // Private copies still: a caller's change never reaches the next re-read.
    reread.revision = 'changed'
    expect(deriveOnce(await read(), derive, identity)).toEqual({ revision: 'second' })
    await db.patch(documentId, { revision: 'third' })
    expect(deriveOnce(await read(), derive, identity)).toEqual({ revision: 'third' })
    expect(derived).toBe(3)
    // Outside a memoized transaction, nothing is shared.
    const plain = await ctx.db.get(documentId)
    if (!plain) throw new Error('Missing the document.')
    deriveOnce(plain, derive, identity)
    deriveOnce(plain, derive, identity)
    expect(derived).toBe(5)
  })
})
