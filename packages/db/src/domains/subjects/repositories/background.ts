import type { BackgroundAuthored } from '@artificer-toolkit/shared'
import type { DBLike } from '#types'
import { upsertBackground } from '../upserts/background.js'
import type { BackgroundRepository, RepositoryFindAllOptions } from '../../../repositories/contracts.js'
import { hydrateSubjectStatus } from '../status.js'

function requireLinkedRecord<T>(
  value: T | null,
  message: string
): T {
  if (value === null) {
    throw new Error(message)
  }

  return value
}

async function hydrateBackgroundById(
  db: DBLike,
  id: string
): Promise<BackgroundAuthored | null> {
  const row = await db
    .selectFrom('backgrounds')
    .select([
      'id',
      'system_id',
      'user_id',
      'label',
      'description',
      'status',
      'starting_equipment_id'
    ])
    .where('id', '=', id)
    .executeTakeFirst()

  if (!row) return null
  if (!row.user_id) {
    throw new Error(`Background "${id}" is missing user ownership and cannot be hydrated.`)
  }

  const [
    detailRepositoryModule,
    featureRepositoryModule,
    proficiencyRepositoryModule,
    startingEquipmentRepositoryModule
  ] = await Promise.all([
    import('../../shared/repositories/detail.js'),
    import('../../features/repositories/feature.js'),
    import('../../grants/repositories/proficiency.js'),
    import('../../shared/repositories/starting_equipment.js')
  ])

  const detailRepository = detailRepositoryModule.createDetailRepository(db)
  const featureRepository = featureRepositoryModule.createFeatureRepository(db, row.system_id)
  const proficiencyRepository = proficiencyRepositoryModule.createProficiencyGrantRepository(db)
  const startingEquipmentRepository = startingEquipmentRepositoryModule.createStartingEquipmentRepository(db)

  const [detailLinks, featureLinks, proficiencyLinks] = await Promise.all([
    db.selectFrom('background_details')
      .select(['detail_id', 'sort_order'])
      .where('background_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('background_features')
      .select(['feature_id', 'sort_order'])
      .where('background_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('background_proficiency_grants')
      .select(['proficiency_grant_id', 'sort_order'])
      .where('background_id', '=', id)
      .orderBy('sort_order')
      .execute()
  ])

  const [
    details,
    features,
    proficiencies,
    startingEquipment
  ] = await Promise.all([
    Promise.all(detailLinks.map((link) => detailRepository.findById(link.detail_id))),
    Promise.all(featureLinks.map((link) => featureRepository.findById(link.feature_id))),
    Promise.all(proficiencyLinks.map((link) => proficiencyRepository.findById(link.proficiency_grant_id))),
    row.starting_equipment_id
      ? startingEquipmentRepository.findById(row.starting_equipment_id)
      : Promise.resolve(null)
  ])

  const authoredDetails = details.map((detail, index) => requireLinkedRecord(detail, `Background "${id}" is linked to missing detail "${detailLinks[index]?.detail_id}".`))
  const authoredFeatures = features.map((feature, index) => requireLinkedRecord(feature, `Background "${id}" is linked to missing feature "${featureLinks[index]?.feature_id}".`))
  const authoredProficiencies = proficiencies.map((grant, index) => requireLinkedRecord(grant, `Background "${id}" is linked to missing proficiency grant "${proficiencyLinks[index]?.proficiency_grant_id}".`))
  const authoredStartingEquipment = row.starting_equipment_id
    ? requireLinkedRecord(startingEquipment, `Background "${id}" is linked to missing starting equipment "${row.starting_equipment_id}".`)
    : null

  return {
    kind: 'BACKGROUND',
    id: row.id,
    label: row.label,
    description: row.description ?? undefined,
    status: hydrateSubjectStatus(row.status),
    details: authoredDetails.length > 0 ? authoredDetails : undefined,
    features: authoredFeatures.length > 0 ? authoredFeatures : undefined,
    startingEquipment: authoredStartingEquipment ?? undefined,
    proficiencies: authoredProficiencies.length > 0 ? authoredProficiencies : undefined,
    userId: row.user_id,
    systemId: row.system_id
  }
}

export function createBackgroundRepository(db: DBLike): BackgroundRepository {
  return {
    async upsert(entity) {
      await upsertBackground(db, entity, entity.systemId)
    },

    async findById(id) {
      return hydrateBackgroundById(db, id)
    },

    async findAll(filter?: RepositoryFindAllOptions) {
      let query = db
        .selectFrom('backgrounds')
        .select('id')
        .orderBy('label')

      if (filter?.systemId) {
        query = query.where('system_id', '=', filter.systemId)
      }

      if (filter?.userId) {
        query = query.where('user_id', '=', filter.userId)
      }

      const rows = await query.execute()
      const records = await Promise.all(rows.map((row) => hydrateBackgroundById(db, row.id)))
      return records.filter((record): record is BackgroundAuthored => record !== null)
    }
  }
}
