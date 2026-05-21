import type { DBLike } from '#types'
import type { BackgroundAuthored } from '@artificer-toolkit/shared'
import {
  upsertDetail,
  upsertStartingEquipment
} from '../../shared/upserts/index.js'
import { upsertProficiencyGrant } from '../../grants/upserts/index.js'
import { upsertFeature } from '../../features/upserts/index.js'
import { normalizeSubjectStatus } from '../status.js'

type BackgroundRow = {
  id: string
  system_id: string
  user_id: string
  label: string
  description: string | null
  status: BackgroundAuthored['status']
  starting_equipment_id: string | null
}

type BackgroundDetailRow = {
  background_id: string
  detail_id: string
  sort_order: number
}

type BackgroundProficiencyGrantRow = {
  background_id: string
  proficiency_grant_id: string
  sort_order: number
}

type BackgroundFeatureRow = {
  background_id: string
  feature_id: string
  sort_order: number
}

function mapBackgroundRow(json_data: BackgroundAuthored): BackgroundRow {
  return {
    id: json_data.id,
    system_id: json_data.systemId,
    user_id: json_data.userId,
    label: json_data.label,
    description: json_data.description ?? null,
    status: normalizeSubjectStatus(json_data.status),
    starting_equipment_id: json_data.startingEquipment?.id ?? null
  }
}

export async function upsertBackground(
  db: DBLike,
  json_data: BackgroundAuthored,
  _systemId: string
) {
  const trx = await db.startTransaction().execute()

  try {
    if (json_data.startingEquipment) {
      await upsertStartingEquipment(trx, json_data.startingEquipment)
    }

    await trx
      .insertInto('backgrounds')
      .values(mapBackgroundRow(json_data))
      .onConflict((oc) => oc.column('id').doUpdateSet(({ ref }) => ({
        system_id: ref('excluded.system_id'),
        user_id: ref('excluded.user_id'),
        label: ref('excluded.label'),
        description: ref('excluded.description'),
        status: ref('excluded.status'),
        starting_equipment_id: ref('excluded.starting_equipment_id')
      })))
      .execute()

    await trx
      .deleteFrom('background_details')
      .where('background_id', '=', json_data.id)
      .execute()

    await trx
      .deleteFrom('background_features')
      .where('background_id', '=', json_data.id)
      .execute()

    await trx
      .deleteFrom('background_proficiency_grants')
      .where('background_id', '=', json_data.id)
      .execute()

    if (json_data.details) {
      for (const detail of json_data.details) {
        await upsertDetail(trx, detail)
      }
    }

    if (json_data.proficiencies) {
      for (const proficiencyGrant of json_data.proficiencies) {
        await upsertProficiencyGrant(trx, proficiencyGrant)
      }
    }

    if (json_data.features) {
      for (const feature of json_data.features) {
        await upsertFeature(trx, feature, json_data.systemId)
      }
    }

    const detailRows: BackgroundDetailRow[] = (json_data.details ?? []).map((detail) => ({
      background_id: json_data.id,
      detail_id: detail.id,
      sort_order: detail.order
    }))

    if (detailRows.length > 0) {
      await trx
        .insertInto('background_details')
        .values(detailRows)
        .execute()
    }

    const proficiencyRows: BackgroundProficiencyGrantRow[] = (json_data.proficiencies ?? []).map((proficiencyGrant) => ({
      background_id: json_data.id,
      proficiency_grant_id: proficiencyGrant.id,
      sort_order: proficiencyGrant.order
    }))

    if (proficiencyRows.length > 0) {
      await trx
        .insertInto('background_proficiency_grants')
        .values(proficiencyRows)
        .execute()
    }

    const featureRows: BackgroundFeatureRow[] = (json_data.features ?? []).map((feature) => ({
      background_id: json_data.id,
      feature_id: feature.id,
      sort_order: feature.order
    }))

    if (featureRows.length > 0) {
      await trx
        .insertInto('background_features')
        .values(featureRows)
        .execute()
    }

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
