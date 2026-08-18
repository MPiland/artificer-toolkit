import { sql } from 'kysely'

import {
  systemVocabularySnapshotSchema,
  type SystemVocabularySnapshot
} from '@artificer-toolkit/schema/projections/systemVocabulary'

import type { DBLike, Json } from '#types'
import { checksumSystemVocabularySnapshot, withTransaction } from '../../../utils/index.js'

interface VocabularySnapshotRow {
  checksum: string
  document: Json
  id: string
  schema_version: number
  system_id: string
  vocabulary_version: number
}

interface SystemRow {
  active_vocabulary_snapshot_id: string | null
  id: string
}

export class SystemVocabularySnapshotMismatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SystemVocabularySnapshotMismatchError'
  }
}

function mapSnapshot(row: VocabularySnapshotRow): SystemVocabularySnapshot {
  const snapshot = systemVocabularySnapshotSchema.parse({
    snapshotId: row.id,
    systemId: row.system_id,
    snapshotVersion: row.vocabulary_version,
    schemaVersion: row.schema_version,
    checksum: row.checksum,
    document: row.document
  })
  if (checksumSystemVocabularySnapshot(snapshot) !== snapshot.checksum) {
    throw new SystemVocabularySnapshotMismatchError(
      `System "${snapshot.systemId}" has a vocabulary snapshot with an invalid checksum.`
    )
  }
  return snapshot
}

async function lockSystem(db: DBLike, systemId: string): Promise<SystemRow | null> {
  const result = await sql<SystemRow>`
    select id, active_vocabulary_snapshot_id
    from public.systems
    where id = ${systemId}
    for update
  `.execute(db)

  return result.rows[0] ?? null
}

async function readSnapshot(
  db: DBLike,
  snapshotId: string,
  lock = false
): Promise<SystemVocabularySnapshot | null> {
  const result = await sql<VocabularySnapshotRow>`
    select
      id,
      system_id,
      vocabulary_version,
      schema_version,
      checksum,
      document
    from public.system_vocabulary_snapshots
    where id = ${snapshotId}
    ${lock ? sql`for update` : sql``}
  `.execute(db)

  const row = result.rows[0]
  return row ? mapSnapshot(row) : null
}

export interface SystemVocabularySnapshotRepository {
  findActive(systemId: string): Promise<SystemVocabularySnapshot | null>
  findActiveForPublication(systemId: string): Promise<SystemVocabularySnapshot | null>
  findById(snapshotId: string): Promise<SystemVocabularySnapshot | null>
  publish(input: PublishSystemVocabularySnapshotInput): Promise<SystemVocabularySnapshot>
}

export interface PublishSystemVocabularySnapshotInput {
  document: SystemVocabularySnapshot['document']
  schemaVersion: number
  snapshotId: string
  systemId: string
}

export function createSystemVocabularySnapshotRepository(
  db: DBLike
): SystemVocabularySnapshotRepository {
  return {
    async findActive(systemId) {
      const result = await sql<SystemRow>`
        select id, active_vocabulary_snapshot_id
        from public.systems
        where id = ${systemId}
      `.execute(db)
      const system = result.rows[0]
      if (!system) return null
      if (!system.active_vocabulary_snapshot_id) {
        throw new SystemVocabularySnapshotMismatchError(
          `System "${systemId}" has no active vocabulary snapshot.`
        )
      }

      const snapshot = await readSnapshot(db, system.active_vocabulary_snapshot_id)
      if (!snapshot || snapshot.systemId !== systemId) {
        throw new SystemVocabularySnapshotMismatchError(
          `System "${systemId}" points to an unavailable vocabulary snapshot.`
        )
      }
      return snapshot
    },

    async findActiveForPublication(systemId) {
      const result = await sql<SystemRow>`
        select id, active_vocabulary_snapshot_id
        from public.systems
        where id = ${systemId}
      `.execute(db)
      const system = result.rows[0]
      if (!system || !system.active_vocabulary_snapshot_id) return null

      const snapshot = await readSnapshot(db, system.active_vocabulary_snapshot_id)
      if (!snapshot || snapshot.systemId !== systemId) {
        throw new SystemVocabularySnapshotMismatchError(
          `System "${systemId}" points to an unavailable vocabulary snapshot.`
        )
      }
      return snapshot
    },

    findById(snapshotId) {
      return readSnapshot(db, snapshotId)
    },

    async publish(input) {
      return withTransaction(db, async (trx) => {
        const system = await lockSystem(trx, input.systemId)
        if (!system) {
          throw new SystemVocabularySnapshotMismatchError(
            `Cannot publish vocabulary for unavailable system "${input.systemId}".`
          )
        }

        const nextVersionResult = await sql<{ next_version: number }>`
          select coalesce(max(vocabulary_version), 0) + 1 as next_version
          from public.system_vocabulary_snapshots
          where system_id = ${input.systemId}
        `.execute(trx)
        const nextVersion = nextVersionResult.rows[0]?.next_version
        if (nextVersion === undefined) {
          throw new SystemVocabularySnapshotMismatchError(
            `Could not allocate a vocabulary version for system "${input.systemId}".`
          )
        }
        const snapshot = systemVocabularySnapshotSchema.parse({
          ...input,
          snapshotVersion: nextVersion,
          checksum: checksumSystemVocabularySnapshot({
            ...input,
            snapshotVersion: nextVersion
          })
        })

        await sql`
          insert into public.system_vocabulary_snapshots (
            id,
            system_id,
            vocabulary_version,
            schema_version,
            checksum,
            document
          ) values (
            ${snapshot.snapshotId},
            ${snapshot.systemId},
            ${snapshot.snapshotVersion},
            ${snapshot.schemaVersion},
            ${snapshot.checksum},
            ${JSON.stringify(snapshot.document)}::jsonb
          )
        `.execute(trx)

        const updated = await sql<{ id: string }>`
          update public.systems
          set active_vocabulary_snapshot_id = ${snapshot.snapshotId}
          where id = ${snapshot.systemId}
          returning id
        `.execute(trx)
        if (!updated.rows[0]) {
          throw new SystemVocabularySnapshotMismatchError(
            `System "${snapshot.systemId}" changed while its vocabulary was publishing.`
          )
        }

        return snapshot
      })
    }
  }
}
