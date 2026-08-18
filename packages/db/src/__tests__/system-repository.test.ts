import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'

import type { DBLike } from '#types'

const mocks = vi.hoisted(() => ({
  findActive: vi.fn<(systemId: string) => Promise<SystemVocabularySnapshot | null>>(),
  findActiveForPublication: vi.fn<
    (systemId: string) => Promise<SystemVocabularySnapshot | null>
  >(),
  publish: vi.fn<
    (db: DBLike, input: { snapshotId: string; systemId: string }) => Promise<void>
  >(),
  upsertSystem: vi.fn<(db: DBLike, entity: unknown) => Promise<void>>()
}))

vi.mock('../domains/subjects/upserts/system.js', () => ({
  upsertSystem: mocks.upsertSystem
}))

vi.mock('../domains/subjects/repositories/systemVocabularySnapshot.js', () => ({
  createSystemVocabularySnapshotRepository: vi.fn((db: DBLike) => ({
    findActive: mocks.findActive,
    findActiveForPublication: mocks.findActiveForPublication,
    publish: (input: { snapshotId: string; systemId: string }) => mocks.publish(db, input)
  }))
}))

import { createSystemRepository } from '../repositories/index.js'
import { srdBaselineContent } from '../source-data/srd/index.js'
import { checksumSystemVocabularySnapshot } from '../utils/index.js'
import { InMemoryDb } from './helpers/in-memory-db.js'

const system = srdBaselineContent.vocabulary.systems[0]

function snapshot(document = system): SystemVocabularySnapshot {
  return {
    snapshotId: 'snapshot-1',
    systemId: document.id,
    snapshotVersion: 1,
    schemaVersion: 1,
    checksum: 'a'.repeat(64),
    document
  }
}

function createFakeDb(systemRows: Array<{ id: string; user_id: string | null }>): DBLike {
  const db = {
    selectFrom() {
      const state = { rows: systemRows }
      const builder = {
        select() {
          return builder
        },
        where(column: string, _operator: string, value: string) {
          if (column === 'user_id') {
            state.rows = state.rows.filter((row) => row.user_id === value)
          }
          return builder
        },
        orderBy() {
          return builder
        },
        async execute() {
          return state.rows
        }
      }
      return builder
    }
  }
  return db as unknown as DBLike
}

interface InMemoryTableDb {
  insertInto(table: string): {
    values(row: Record<string, unknown>): { execute(): Promise<void> }
  }
  selectFrom(table: string): {
    selectAll(): { execute(): Promise<Record<string, unknown>[]> }
  }
}

function asInMemoryTableDb(db: DBLike | InMemoryDb): InMemoryTableDb {
  return db as unknown as InMemoryTableDb
}

describe('createSystemRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads the active vocabulary snapshot instead of rehydrating relational vocabulary', async () => {
    mocks.findActive.mockResolvedValue(snapshot())
    const repository = createSystemRepository(createFakeDb([]))

    await expect(repository.findById(system.id)).resolves.toEqual(system)
    expect(mocks.findActive).toHaveBeenCalledWith(system.id)
  })

  it('propagates a missing or mismatched active snapshot failure', async () => {
    mocks.findActive.mockRejectedValue(new Error('System has no active vocabulary snapshot.'))
    const repository = createSystemRepository(createFakeDb([]))

    await expect(repository.findById(system.id)).rejects.toThrow('no active vocabulary snapshot')
  })

  it('uses relational roots only to enumerate systems before loading snapshots', async () => {
    mocks.findActive.mockImplementation(async (systemId: string) =>
      systemId === system.id ? snapshot() : null
    )
    const repository = createSystemRepository(
      createFakeDb([
        { id: system.id, user_id: system.userId },
        { id: 'other-system', user_id: 'other-user' }
      ])
    )

    await expect(repository.findAll({ userId: system.userId })).resolves.toEqual([system])
    expect(mocks.findActive).toHaveBeenCalledWith(system.id)
  })

  it('publishes a vocabulary snapshot in the same transaction as a System write', async () => {
    mocks.findActiveForPublication.mockResolvedValue(null)
    const repository = createSystemRepository(new InMemoryDb() as unknown as DBLike)

    await repository.upsert(system)

    expect(mocks.upsertSystem).toHaveBeenCalledWith(expect.anything(), system)
    expect(mocks.publish).toHaveBeenCalledWith(
      mocks.upsertSystem.mock.calls[0]?.[0],
      expect.objectContaining({
        document: system,
        schemaVersion: 1,
        systemId: system.id
      })
    )
    expect(mocks.upsertSystem.mock.calls[0]?.[0]).toMatchObject({ isTransaction: true })
  })

  it('does not publish another vocabulary snapshot when the document is unchanged', async () => {
    const current = snapshot()
    current.checksum = checksumSystemVocabularySnapshot({
      snapshotId: current.snapshotId,
      systemId: current.systemId,
      snapshotVersion: current.snapshotVersion,
      schemaVersion: current.schemaVersion,
      document: system
    })
    mocks.findActiveForPublication.mockResolvedValue(current)
    const repository = createSystemRepository(new InMemoryDb() as unknown as DBLike)

    await repository.upsert(system)

    expect(mocks.publish).not.toHaveBeenCalled()
  })

  it('rolls back the System write when vocabulary snapshot publication fails', async () => {
    const db = new InMemoryDb()
    mocks.findActiveForPublication.mockResolvedValue(null)
    mocks.upsertSystem.mockImplementation(async (trx: DBLike) => {
      await asInMemoryTableDb(trx)
        .insertInto('systems')
        .values({ id: system.id, label: system.label })
        .execute()
    })
    mocks.publish.mockImplementation(async (trx: DBLike, input: { snapshotId: string }) => {
      await asInMemoryTableDb(trx)
        .insertInto('system_vocabulary_snapshots')
        .values({ id: input.snapshotId, system_id: system.id })
        .execute()
      throw new Error('vocabulary snapshot publication failed')
    })
    const repository = createSystemRepository(db as unknown as DBLike)

    await expect(repository.upsert(system)).rejects.toThrow('vocabulary snapshot publication failed')
    await expect(asInMemoryTableDb(db).selectFrom('systems').selectAll().execute()).resolves.toEqual(
      []
    )
    await expect(
      asInMemoryTableDb(db).selectFrom('system_vocabulary_snapshots').selectAll().execute()
    ).resolves.toEqual([])
  })
})
