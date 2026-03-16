import {
  MEASUREMENT_UNIT_CODE,
  RACE_CATEGORY_CODE,
  SIZE_CODE,
  type RaceAuthored
} from '@artificer-toolkit/shared'
import type { DBLike } from '#types'
import { upsertRace } from '../upserts/race.js'
import { createDetailRepository } from '../../shared/repositories/detail.js'
import { createFeatureRepository } from '../../features/repositories/feature.js'
import type { RaceRepository, RepositoryFindAllOptions } from '../../../repositories/contracts.js'

function requireLinkedRecord<T>(
  value: T | null,
  message: string
): T {
  if (value === null) {
    throw new Error(message)
  }

  return value
}

function requireAncestryOptionDescription(
  raceId: string,
  optionId: string,
  value: string | null
): string {
  if (value == null) {
    throw new Error(`Race "${raceId}" ancestry option "${optionId}" is missing description.`)
  }

  return value
}

function requireRaceCategory(
  raceId: string,
  value: string
): RaceAuthored['category'] {
  if (value !== RACE_CATEGORY_CODE.BASE && value !== RACE_CATEGORY_CODE.SUBRACE) {
    throw new Error(`Race "${raceId}" has invalid category "${value}".`)
  }

  return value
}

function requireSizeCode(
  raceId: string,
  value: string
): Exclude<RaceAuthored, { category: 'SUBRACE' }>['size'] {
  if (!(value in SIZE_CODE)) {
    throw new Error(`Race "${raceId}" has invalid size_code "${value}".`)
  }

  return value as Exclude<RaceAuthored, { category: 'SUBRACE' }>['size']
}

function requireMeasurementUnit(
  raceId: string,
  speedId: string,
  value: string
): NonNullable<RaceAuthored['speeds']>[number]['unit'] {
  if (!(value in MEASUREMENT_UNIT_CODE)) {
    throw new Error(`Race "${raceId}" speed "${speedId}" has invalid unit_code "${value}".`)
  }

  return value as NonNullable<RaceAuthored['speeds']>[number]['unit']
}

async function hydrateRaceById(
  db: DBLike,
  id: string
): Promise<RaceAuthored | null> {
  const row = await db
    .selectFrom('races')
    .select([
      'id',
      'system_id',
      'user_id',
      'label',
      'quote',
      'description',
      'category',
      'playable',
      'parent_race_id',
      'size_code'
    ])
    .where('id', '=', id)
    .executeTakeFirst()

  if (!row) return null
  if (!row.user_id) {
    throw new Error(`Race "${id}" is missing user ownership and cannot be hydrated.`)
  }

  const [featureLinks, ancestryRows, detailLinks, speedRows] = await Promise.all([
    db.selectFrom('race_features')
      .select(['feature_id', 'sort_order'])
      .where('race_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('race_ancestries')
      .select(['id', 'label', 'description'])
      .where('race_id', '=', id)
      .execute(),
    db.selectFrom('race_details')
      .select(['detail_id', 'sort_order'])
      .where('race_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('race_speeds')
      .select(['speed_id', 'amount', 'unit_code'])
      .where('race_id', '=', id)
      .orderBy('speed_id')
      .execute()
  ])

  const detailRepository = createDetailRepository(db)
  const featureRepository = createFeatureRepository(db, row.system_id)
  const details = await Promise.all(detailLinks.map((link) => detailRepository.findById(link.detail_id)))
  const features = await Promise.all(featureLinks.map((link) => featureRepository.findById(link.feature_id)))
  const authoredDetails = details.map((detail, index) => requireLinkedRecord(
    detail,
    `Race "${id}" is linked to missing detail "${detailLinks[index]?.detail_id}".`
  ))
  const authoredFeatures = features.map((feature, index) => requireLinkedRecord(
    feature,
    `Race "${id}" is linked to missing feature "${featureLinks[index]?.feature_id}".`
  ))
  const ancestry = ancestryRows[0]
    ? await (async () => {
        const ancestryId = ancestryRows[0].id as string
        const [optionRows, optionFeatureLinks] = await Promise.all([
          db.selectFrom('race_ancestry_options')
            .select(['id', 'label', 'description', 'sort_order'])
            .where('ancestry_id', '=', ancestryId)
            .orderBy('sort_order')
            .execute(),
          db.selectFrom('race_ancestry_option_features')
            .select(['ancestry_option_id', 'feature_id', 'sort_order'])
            .execute()
        ])

        const featuresByOption = new Map<string, { feature_id: string, sort_order: number }[]>()
        for (const link of optionFeatureLinks) {
          featuresByOption.set(link.ancestry_option_id, [
            ...(featuresByOption.get(link.ancestry_option_id) ?? []),
            { feature_id: link.feature_id, sort_order: link.sort_order }
          ])
        }

        const authoredOptions = await Promise.all(optionRows.map(async (option) => {
          const links = (featuresByOption.get(option.id) ?? [])
            .slice()
            .sort((left, right) => left.sort_order - right.sort_order)
          const optionFeatures = await Promise.all(
            links.map((link) => featureRepository.findById(link.feature_id))
          )

          return {
            id: option.id,
            label: option.label,
            description: requireAncestryOptionDescription(id, option.id, option.description),
            order: option.sort_order,
            features: optionFeatures.length > 0
              ? optionFeatures.map((feature, index) => requireLinkedRecord(
                  feature,
                  `Race "${id}" ancestry option "${option.id}" is linked to missing feature "${links[index]?.feature_id}".`
                ))
              : undefined
          }
        }))

        return {
          id: ancestryId,
          label: ancestryRows[0].label as string,
          description: (ancestryRows[0].description as string | null) ?? undefined,
          options: authoredOptions
        }
      })()
    : undefined
  const authoredSpeeds = speedRows.map((speed) => ({
    speedId: speed.speed_id,
    amount: speed.amount,
    unit: requireMeasurementUnit(id, speed.speed_id, speed.unit_code)
  }))

  const category = requireRaceCategory(id, row.category)

  if (category === RACE_CATEGORY_CODE.BASE) {
    if (row.playable == null) {
      throw new Error(`Race "${id}" is missing playable for BASE payload.`)
    }
    if (!row.size_code) {
      throw new Error(`Race "${id}" is missing size_code for BASE payload.`)
    }

    return {
      id: row.id,
      label: row.label,
      quote: row.quote ?? undefined,
      description: row.description ?? undefined,
      details: authoredDetails.length > 0 ? authoredDetails : undefined,
      features: authoredFeatures.length > 0 ? authoredFeatures : undefined,
      userId: row.user_id,
      systemId: row.system_id,
      category,
      playable: row.playable,
      ancestry,
      size: requireSizeCode(id, row.size_code),
      speeds: authoredSpeeds
    }
  }

  return {
    id: row.id,
    label: row.label,
    quote: row.quote ?? undefined,
    description: row.description ?? undefined,
    details: authoredDetails.length > 0 ? authoredDetails : undefined,
    features: authoredFeatures.length > 0 ? authoredFeatures : undefined,
    userId: row.user_id,
    systemId: row.system_id,
    category,
    parentRaceId: requireLinkedRecord(
      row.parent_race_id,
      `Race "${id}" is missing parent_race_id for SUBRACE payload.`
    ),
    size: row.size_code ? requireSizeCode(id, row.size_code) : undefined,
    speeds: authoredSpeeds.length > 0 ? authoredSpeeds : undefined
  }
}

export function createRaceRepository(db: DBLike): RaceRepository {
  return {
    async upsert(entity) {
      await upsertRace(db, entity, entity.systemId)
    },

    async findById(id) {
      return hydrateRaceById(db, id)
    },

    async findAll(filter?: RepositoryFindAllOptions) {
      let query = db
        .selectFrom('races')
        .select('id')
        .orderBy('label')

      if (filter?.systemId) {
        query = query.where('system_id', '=', filter.systemId)
      }

      if (filter?.userId) {
        query = query.where('user_id', '=', filter.userId)
      }

      const rows = await query.execute()
      const records = await Promise.all(rows.map((row) => hydrateRaceById(db, row.id)))
      return records.filter((record): record is RaceAuthored => record !== null)
    }
  }
}
