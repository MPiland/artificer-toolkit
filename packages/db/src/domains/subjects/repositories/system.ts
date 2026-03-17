import type { DBLike } from '#types'
import type {
  SystemSeedRecord,
  VocabularySeedRecord
} from '../../../source-data/index.js'
import { upsertSystem } from '../upserts/system.js'
import type { SystemRepository } from '../../../repositories/contracts.js'

type VocabularyTableName
  = | 'alignments'
    | 'challenge_ratings'
    | 'condition_types'
    | 'creature_types'
    | 'currencies'
    | 'damage_types'
    | 'languages'
    | 'magic_schools'
    | 'passives'
    | 'rarities'
    | 'senses'
    | 'skills'
    | 'speeds'
    | 'terrains'

async function readVocabularyRows(
  db: DBLike,
  table: VocabularyTableName,
  systemId: string
): Promise<VocabularySeedRecord[]> {
  const rows = await db
    .selectFrom(table)
    .select([
      'id', 'code', 'label', 'description', 'tooltip', 'short'
    ])
    .where('system_id', '=', systemId)
    .orderBy('label')
    .execute()

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    label: row.label,
    description: row.description,
    tooltip: row.tooltip,
    short: row.short
  }))
}

async function hydrateSystemById(
  db: DBLike,
  id: string
): Promise<SystemSeedRecord | null> {
  const row = await db
    .selectFrom('systems')
    .select([
      'id', 'label', 'description', 'user_id'
    ])
    .where('id', '=', id)
    .executeTakeFirst()

  if (!row) return null
  if (!row.user_id) {
    throw new Error(`System "${id}" is missing user_id and cannot be hydrated.`)
  }

  const [
    alignments,
    challengeRatings,
    conditionTypes,
    creatureTypes,
    currencies,
    damageTypes,
    languages,
    magicSchools,
    passives,
    rarities,
    senses,
    skills,
    speeds,
    terrains
  ] = await Promise.all([
    readVocabularyRows(db, 'alignments', row.id),
    readVocabularyRows(db, 'challenge_ratings', row.id),
    readVocabularyRows(db, 'condition_types', row.id),
    readVocabularyRows(db, 'creature_types', row.id),
    readVocabularyRows(db, 'currencies', row.id),
    readVocabularyRows(db, 'damage_types', row.id),
    readVocabularyRows(db, 'languages', row.id),
    readVocabularyRows(db, 'magic_schools', row.id),
    readVocabularyRows(db, 'passives', row.id),
    readVocabularyRows(db, 'rarities', row.id),
    readVocabularyRows(db, 'senses', row.id),
    readVocabularyRows(db, 'skills', row.id),
    readVocabularyRows(db, 'speeds', row.id),
    readVocabularyRows(db, 'terrains', row.id)
  ])

  return {
    id: row.id,
    label: row.label,
    description: row.description,
    userId: row.user_id,
    alignments,
    challengeRatings,
    conditionTypes,
    creatureTypes,
    currencies,
    damageTypes,
    languages,
    magicSchools,
    passives,
    rarities,
    senses,
    skills,
    speeds,
    terrains
  }
}

export function createSystemRepository(db: DBLike): SystemRepository {
  return {
    async upsert(entity) {
      await upsertSystem(db, entity)
    },

    async findById(id) {
      return hydrateSystemById(db, id)
    },

    async findAll(filter) {
      let query = db
        .selectFrom('systems')
        .select('id')
        .orderBy('label')

      if (filter?.userId) {
        query = query.where('user_id', '=', filter.userId)
      }

      const rows = await query.execute()
      const systems = await Promise.all(rows.map((row) => hydrateSystemById(db, row.id)))

      return systems.filter((system): system is SystemSeedRecord => system !== null)
    }
  }
}
