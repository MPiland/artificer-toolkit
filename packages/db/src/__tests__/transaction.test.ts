import { describe, expect, it, vi } from 'vitest'
import type { Transaction } from 'kysely'
import type { Database, DBLike } from '#types'
import { withTransaction } from '../utils/transaction.js'

describe('withTransaction', () => {
  it('reuses an existing transaction', async () => {
    const transaction = {
      isTransaction: true
    } as unknown as Transaction<Database>
    const fn = vi.fn(async (trx: Transaction<Database>) => {
      expect(trx).toBe(transaction)
      return 'reused'
    })

    await expect(withTransaction(transaction, fn)).resolves.toBe('reused')
    expect(fn).toHaveBeenCalledOnce()
  })

  it('creates a transaction for a root database', async () => {
    const transaction = {
      isTransaction: true
    } as unknown as Transaction<Database>
    const execute = vi.fn(async <T>(fn: (trx: Transaction<Database>) => Promise<T>) =>
      fn(transaction)
    )
    const start = vi.fn(() => ({ execute }))
    const db = {
      isTransaction: false,
      transaction: start
    } as unknown as DBLike

    await expect(
      withTransaction(db, async (trx) => {
        expect(trx).toBe(transaction)
        return 'created'
      })
    ).resolves.toBe('created')
    expect(start).toHaveBeenCalledOnce()
    expect(execute).toHaveBeenCalledOnce()
  })
})
