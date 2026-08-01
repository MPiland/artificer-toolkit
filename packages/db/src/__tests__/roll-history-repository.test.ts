import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { DBLike } from '../types/index.js'
import { createRollHistoryRepository } from '../repositories/rollHistory.js'

describe('roll history repository', () => {
  it('lists only the newest twenty account rolls', async () => {
    const calls: unknown[][] = []
    const builder = {
      selectAll: () => builder,
      where: (...args: unknown[]) => {
        calls.push(args)
        return builder
      },
      orderBy: (...args: unknown[]) => {
        calls.push(args)
        return builder
      },
      limit: (...args: unknown[]) => {
        calls.push(args)
        return builder
      },
      execute: async () => []
    }
    const db = { selectFrom: () => builder } as unknown as DBLike

    await expect(createRollHistoryRepository(db).listForUser('user-1')).resolves.toEqual([])
    expect(calls).toEqual([
      ['user_id', '=', 'user-1'],
      ['created_at', 'desc'],
      ['id', 'desc'],
      [20]
    ])
  })

  it('normalizes Postgres timestamps returned as dates', async () => {
    const builder = {
      selectAll: () => builder,
      where: () => builder,
      orderBy: () => builder,
      limit: () => builder,
      execute: async () => [
        {
          id: 'roll-1',
          character_id: 'character-1',
          character_label: 'Fighter',
          source: { kind: 'INITIATIVE', label: 'Initiative' },
          system_id: 'system-1',
          ruleset_code: 'dnd5e',
          ruleset_version: '2014',
          normalized_expression: '1d20+2',
          evidence: {
            terms: [{ count: 1, die: 20, rolls: [12], subtotal: 12 }],
            modifier: 2,
            mode: 'NORMAL',
            subtotal: 14,
            transform: { kind: 'NONE' },
            total: 14
          },
          created_at: new Date('2026-07-30T20:00:00.000Z')
        }
      ]
    }
    const db = { selectFrom: () => builder } as unknown as DBLike

    await expect(createRollHistoryRepository(db).listForUser('user-1')).resolves.toEqual([
      expect.objectContaining({ createdAt: '2026-07-30T20:00:00.000Z' })
    ])
  })

  it('finds a roll only for its owning account', async () => {
    const calls: unknown[][] = []
    const builder = {
      selectAll: () => builder,
      where: (...args: unknown[]) => {
        calls.push(args)
        return builder
      },
      executeTakeFirst: async () => undefined
    }
    const db = { selectFrom: () => builder } as unknown as DBLike

    await expect(
      createRollHistoryRepository(db).findAvailableByIdForUser('roll-1', 'user-1')
    ).resolves.toBeNull()
    expect(calls).toEqual([
      ['id', '=', 'roll-1'],
      ['user_id', '=', 'user-1'],
      ['consumed_at', 'is', null]
    ])
  })

  it('consumes an available roll once for its owning account', async () => {
    const calls: unknown[][] = []
    const builder = {
      set: () => builder,
      where: (...args: unknown[]) => {
        calls.push(args)
        return builder
      },
      returning: () => builder,
      executeTakeFirst: async () => ({ id: 'roll-1' })
    }
    const db = { updateTable: () => builder } as unknown as DBLike

    await expect(createRollHistoryRepository(db).consumeForUser('roll-1', 'user-1')).resolves.toBe(
      true
    )
    expect(calls).toEqual([
      ['id', '=', 'roll-1'],
      ['user_id', '=', 'user-1'],
      ['consumed_at', 'is', null]
    ])
  })

  it('discards only an unconsumed roll owned by the current account', async () => {
    const calls: unknown[][] = []
    const builder = {
      where: (...args: unknown[]) => {
        calls.push(args)
        return builder
      },
      executeTakeFirst: async () => undefined
    }
    const db = { deleteFrom: () => builder } as unknown as DBLike

    await createRollHistoryRepository(db).discardForUser('roll-1', 'user-1')

    expect(calls).toEqual([
      ['id', '=', 'roll-1'],
      ['user_id', '=', 'user-1'],
      ['consumed_at', 'is', null]
    ])
  })

  it('clears only the current account history', async () => {
    const calls: unknown[][] = []
    const builder = {
      where: (...args: unknown[]) => {
        calls.push(args)
        return builder
      },
      executeTakeFirst: async () => undefined
    }
    const db = { deleteFrom: () => builder } as unknown as DBLike

    await createRollHistoryRepository(db).clearForUser('user-1')

    expect(calls).toEqual([['user_id', '=', 'user-1']])
  })

  it('defines owner-only reads and serialized insert-plus-trim retention', () => {
    const root = process.cwd()
    const migration = readFileSync(
      join(root, 'supabase/migrations/20260730233420_add_user_roll_history.sql'),
      'utf8'
    )
    const repository = readFileSync(
      join(root, 'packages/db/src/repositories/rollHistory.ts'),
      'utf8'
    )

    expect(migration).toContain('USING (user_id = (SELECT auth.uid()))')
    expect(migration).toContain('ON public.user_roll_history (user_id, created_at DESC, id DESC)')
    expect(repository).toContain('pg_advisory_xact_lock')
    expect(repository).toContain('limit 20')
  })
})
