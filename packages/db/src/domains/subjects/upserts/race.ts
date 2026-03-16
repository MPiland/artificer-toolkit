import type { DBLike } from '@db-types'
import {
  MEASUREMENT_UNIT_CODE,
  RACE_CATEGORY_CODE,
  SIZE_CODE,
  type RaceAuthored
} from '@artificer-toolkit/shared'
import { upsertDetail } from '../../shared/upserts/index.js'
import { upsertFeature } from '../../features/upserts/index.js'

type RaceRow = {
  id: string
  system_id: string
  user_id: string
  label: string
  quote: string | null
  description: string | null
  category: string
  playable: boolean | null
  parent_race_id: string | null
  size_code: string | null
}

type RaceDetailRow = {
  race_id: string
  detail_id: string
  sort_order: number
}

type RaceSpeedRow = {
  race_id: string
  speed_id: string
  amount: number
  unit_code: string
}

type RaceAncestryRow = {
  id: string
  race_id: string
  label: string
  description: string | null
}

type RaceAncestryOptionRow = {
  id: string
  ancestry_id: string
  label: string
  description: string
  sort_order: number
}

type RaceAncestryOptionFeatureRow = {
  ancestry_option_id: string
  feature_id: string
  sort_order: number
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
    throw new Error(`Race "${raceId}" has invalid size "${value}".`)
  }

  return value as Exclude<RaceAuthored, { category: 'SUBRACE' }>['size']
}

function requireMeasurementUnit(
  raceId: string,
  speedId: string,
  value: string
): NonNullable<RaceAuthored['speeds']>[number]['unit'] {
  if (!(value in MEASUREMENT_UNIT_CODE)) {
    throw new Error(`Race "${raceId}" speed "${speedId}" has invalid unit "${value}".`)
  }

  return value as NonNullable<RaceAuthored['speeds']>[number]['unit']
}

function mapRaceRow(json_data: RaceAuthored): RaceRow {
  const category = requireRaceCategory(json_data.id, json_data.category)

  if (json_data.category === RACE_CATEGORY_CODE.BASE) {
    const baseData = json_data

    return {
      id: baseData.id,
      system_id: baseData.systemId,
      user_id: baseData.userId,
      label: baseData.label,
      quote: baseData.quote ?? null,
      description: baseData.description ?? null,
      category,
      playable: baseData.playable,
      parent_race_id: null,
      size_code: requireSizeCode(baseData.id, baseData.size)
    }
  }

  const subraceData = json_data

  return {
    id: subraceData.id,
    system_id: subraceData.systemId,
    user_id: subraceData.userId,
    label: subraceData.label,
    quote: subraceData.quote ?? null,
    description: subraceData.description ?? null,
    category,
    playable: null,
    parent_race_id: subraceData.parentRaceId,
    size_code: subraceData.size ?? null
  }
}

export async function upsertRace(
  db: DBLike,
  json_data: RaceAuthored,
  _systemId: string
) {
  const speedRows: RaceSpeedRow[] = (json_data.speeds ?? []).map((speed) => ({
    race_id: json_data.id,
    speed_id: speed.speedId,
    amount: speed.amount,
    unit_code: requireMeasurementUnit(json_data.id, speed.speedId, speed.unit)
  }))

  const ancestryRow: RaceAncestryRow | null = json_data.category === RACE_CATEGORY_CODE.BASE && json_data.ancestry
    ? {
        id: json_data.ancestry.id,
        race_id: json_data.id,
        label: json_data.ancestry.label,
        description: json_data.ancestry.description ?? null
      }
    : null

  const ancestryOptionRows: RaceAncestryOptionRow[] = json_data.category === RACE_CATEGORY_CODE.BASE && json_data.ancestry
    ? json_data.ancestry.options.map((option) => ({
        id: option.id,
        ancestry_id: json_data.ancestry!.id,
        label: option.label,
        description: option.description,
        sort_order: option.order
      }))
    : []

  const ancestryOptionFeatureRows: RaceAncestryOptionFeatureRow[] = json_data.category === RACE_CATEGORY_CODE.BASE && json_data.ancestry
    ? json_data.ancestry.options.flatMap((option) =>
        (option.features ?? []).map((feature) => ({
          ancestry_option_id: option.id,
          feature_id: feature.id,
          sort_order: feature.order
        }))
      )
    : []

  const trx = await db.startTransaction().execute()

  try {
    if (json_data.details) {
      for (const detail of json_data.details) {
        await upsertDetail(trx, detail)
      }
    }

    if (json_data.features) {
      for (const feature of json_data.features) {
        await upsertFeature(trx, feature, json_data.systemId)
      }
    }

    if (json_data.category === RACE_CATEGORY_CODE.BASE && json_data.ancestry) {
      for (const option of json_data.ancestry.options) {
        for (const feature of option.features ?? []) {
          await upsertFeature(trx, feature, json_data.systemId)
        }
      }
    }

    await trx
      .insertInto('races')
      .values(mapRaceRow(json_data))
      .onConflict((oc) => oc.column('id').doUpdateSet(({ ref }) => ({
        system_id: ref('excluded.system_id'),
        user_id: ref('excluded.user_id'),
        label: ref('excluded.label'),
        quote: ref('excluded.quote'),
        description: ref('excluded.description'),
        category: ref('excluded.category'),
        playable: ref('excluded.playable'),
        parent_race_id: ref('excluded.parent_race_id'),
        size_code: ref('excluded.size_code')
      })))
      .execute()

    await trx
      .deleteFrom('race_features')
      .where('race_id', '=', json_data.id)
      .execute()

    await trx
      .deleteFrom('race_ancestries')
      .where('race_id', '=', json_data.id)
      .execute()

    await trx
      .deleteFrom('race_details')
      .where('race_id', '=', json_data.id)
      .execute()

    await trx
      .deleteFrom('race_speeds')
      .where('race_id', '=', json_data.id)
      .execute()

    const detailRows: RaceDetailRow[] = (json_data.details ?? []).map((detail) => ({
      race_id: json_data.id,
      detail_id: detail.id,
      sort_order: detail.order
    }))

    if (detailRows.length > 0) {
      await trx
        .insertInto('race_details')
        .values(detailRows)
        .execute()
    }

    const featureRows = (json_data.features ?? []).map((feature) => ({
      race_id: json_data.id,
      feature_id: feature.id,
      sort_order: feature.order
    }))

    if (featureRows.length > 0) {
      await trx
        .insertInto('race_features')
        .values(featureRows)
        .execute()
    }

    if (speedRows.length > 0) {
      await trx
        .insertInto('race_speeds')
        .values(speedRows)
        .execute()
    }

    if (ancestryRow) {
      await trx
        .insertInto('race_ancestries')
        .values(ancestryRow)
        .execute()

      if (ancestryOptionRows.length > 0) {
        await trx
          .insertInto('race_ancestry_options')
          .values(ancestryOptionRows)
          .execute()
      }

      if (ancestryOptionFeatureRows.length > 0) {
        await trx
          .insertInto('race_ancestry_option_features')
          .values(ancestryOptionFeatureRows)
          .execute()
      }
    }

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
