import type { DBLike } from '#types'
import { withTransaction } from '../../../utils/index.js'
import {
  type BaseRaceAuthored,
  MEASUREMENT_UNIT_CODE,
  RACE_CATEGORY_CODE,
  SIZE_CODE,
  type RaceAuthored
} from '@artificer-toolkit/shared'
import { upsertDetail } from '../../shared/upserts/index.js'
import { upsertFeature } from '../../features/upserts/index.js'
import { normalizeSubjectStatus } from '../status.js'

type RaceRow = {
  id: string
  system_id: string
  user_id: string
  label: string
  quote: string | null
  description: string | null
  status: RaceAuthored['status']
  category: string
  selection_mode: string | null
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

type RaceHeritageRow = {
  race_id: string
  heritage_id: string
  sort_order: number
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
): BaseRaceAuthored['size'] {
  if (!(value in SIZE_CODE)) {
    throw new Error(`Race "${raceId}" has invalid size "${value}".`)
  }

  return value as BaseRaceAuthored['size']
}

function requireMeasurementUnit(
  raceId: string,
  speedId: string,
  value: string
): BaseRaceAuthored['speeds'][number]['unit'] {
  if (!(value in MEASUREMENT_UNIT_CODE)) {
    throw new Error(`Race "${raceId}" speed "${speedId}" has invalid unit "${value}".`)
  }

  return value as BaseRaceAuthored['speeds'][number]['unit']
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
      status: normalizeSubjectStatus(baseData.status),
      category,
      selection_mode: baseData.selectionMode,
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
    status: normalizeSubjectStatus(subraceData.status),
    category,
    selection_mode: null,
    parent_race_id: subraceData.parentRaceId,
    size_code: null
  }
}

export async function upsertRace(
  db: DBLike,
  json_data: RaceAuthored,
  _systemId: string
) {
  const baseData: BaseRaceAuthored | null = json_data.category === RACE_CATEGORY_CODE.BASE
    ? json_data
    : null
  const ancestryData = baseData?.ancestry

  const speedRows: RaceSpeedRow[] = (baseData?.speeds ?? []).map((speed) => ({
    race_id: json_data.id,
    speed_id: speed.speedId,
    amount: speed.amount,
    unit_code: requireMeasurementUnit(json_data.id, speed.speedId, speed.unit)
  }))

  const heritageRows: RaceHeritageRow[] = (baseData?.heritageIds ?? []).map((heritageId, index) => ({
    race_id: json_data.id,
    heritage_id: heritageId,
    sort_order: index + 1
  }))

  const ancestryRow: RaceAncestryRow | null = ancestryData
    ? {
        id: ancestryData.id,
        race_id: json_data.id,
        label: ancestryData.label,
        description: ancestryData.description ?? null
      }
    : null

  const ancestryOptionRows: RaceAncestryOptionRow[] = ancestryData
    ? ancestryData.options.map((option) => ({
        id: option.id,
        ancestry_id: ancestryData.id,
        label: option.label,
        description: option.description,
        sort_order: option.order
      }))
    : []

  const ancestryOptionFeatureRows: RaceAncestryOptionFeatureRow[] = ancestryData
    ? ancestryData.options.flatMap((option) => (option.features ?? []).map((feature) => ({
        ancestry_option_id: option.id,
        feature_id: feature.id,
        sort_order: feature.order
      })))
    : []

  return withTransaction(db, async (trx) => {
    await trx
      .insertInto('races')
      .values(mapRaceRow(json_data))
      .onConflict((oc) => oc.column('id').doUpdateSet((eb) => ({
        system_id: eb.ref('excluded.system_id'),
        user_id: eb.ref('excluded.user_id'),
        label: eb.ref('excluded.label'),
        quote: eb.ref('excluded.quote'),
        description: eb.ref('excluded.description'),
        status: eb.ref('excluded.status'),
        category: eb.ref('excluded.category'),
        selection_mode: eb.ref('excluded.selection_mode'),
        parent_race_id: eb.ref('excluded.parent_race_id'),
        size_code: eb.ref('excluded.size_code')
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

    await trx
      .deleteFrom('race_heritages')
      .where('race_id', '=', json_data.id)
      .execute()

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

    if (ancestryData) {
      for (const option of ancestryData.options) {
        for (const feature of option.features ?? []) {
          await upsertFeature(trx, feature, json_data.systemId)
        }
      }
    }

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

    if (heritageRows.length > 0) {
      await trx
        .insertInto('race_heritages')
        .values(heritageRows)
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

  })
}
