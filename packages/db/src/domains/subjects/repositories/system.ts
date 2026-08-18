import { randomUUID } from 'node:crypto'

import type { DBLike } from '#types'
import type { SystemSeedRecord } from '../../../source-data/index.js'
import { upsertSystem } from '../upserts/system.js'
import type { SystemRepository } from '../../../repositories/contracts.js'
import { hydrateByIds, orderedHydratedRecords } from '../../../repositories/batch.js'
import { checksumSystemVocabularySnapshot, withTransaction } from '../../../utils/index.js'
import { createSystemVocabularySnapshotRepository } from './systemVocabularySnapshot.js'

const SYSTEM_VOCABULARY_SNAPSHOT_SCHEMA_VERSION = 1

async function hydrateSystemById(db: DBLike, id: string): Promise<SystemSeedRecord | null> {
  const snapshot = await createSystemVocabularySnapshotRepository(db).findActive(id)
  return snapshot?.document ?? null
}

export function createSystemRepository(db: DBLike): SystemRepository {
  return {
    async upsert(entity) {
      await withTransaction(db, async (trx) => {
        await upsertSystem(trx, entity)
        const snapshots = createSystemVocabularySnapshotRepository(trx)
        const active = await snapshots.findActiveForPublication(entity.id)
        if (active) {
          const checksum = checksumSystemVocabularySnapshot({
            snapshotId: active.snapshotId,
            systemId: entity.id,
            snapshotVersion: active.snapshotVersion,
            schemaVersion: SYSTEM_VOCABULARY_SNAPSHOT_SCHEMA_VERSION,
            document: entity
          })
          if (active.checksum === checksum) return
        }
        await snapshots.publish({
          snapshotId: randomUUID(),
          systemId: entity.id,
          schemaVersion: SYSTEM_VOCABULARY_SNAPSHOT_SCHEMA_VERSION,
          document: entity
        })
      })
    },

    async findById(id) {
      return hydrateSystemById(db, id)
    },

    async findByIds(ids) {
      return hydrateByIds(ids, (id) => hydrateSystemById(db, id))
    },

    async findAll(filter) {
      let query = db.selectFrom('systems').select('id').orderBy('label')

      if (filter?.userId) {
        query = query.where('user_id', '=', filter.userId)
      }

      const rows = await query.execute()
      return orderedHydratedRecords(
        rows.map((row) => row.id),
        await hydrateByIds(
          rows.map((row) => row.id),
          (id) => hydrateSystemById(db, id)
        )
      )
    }
  }
}
