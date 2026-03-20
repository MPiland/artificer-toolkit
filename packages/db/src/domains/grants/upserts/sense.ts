import type { DBLike } from '#types'
import type { SenseGrantAuthored } from '@artificer-toolkit/shared'
import { upsertFacet } from '../../shared/facets.js'
import { upsertCharge } from '../../shared/upserts/charge.js'

type SenseGrantRootRow = {
  id: string
  sort_order: number
  selection_kind: string
  scaling_kind: string
  authoring_mode_kind: string
  selection_count: number | null
  scaling_source: string | null
  class_id: string | null
  charge_id: string | null
  restriction_id: string | null
  range_id: string | null
  range_kind: string | null
  range_amount: number | null
  range_unit: string | null
}

type SenseGrantScalingLevelRow = {
  id: string
  sense_grant_id: string
  level: number
  sort_order: number
  authoring_mode_kind: string
  selection_count: number | null
}

type SenseGrantScalingLevelSenseRow = {
  scaling_level_id: string
  sense_id: string
}

type SenseGrantPerLevel = Extract<SenseGrantAuthored, { scalingKind: 'PER_LEVEL' }>
type SenseGrantProgression = {
  scalingSource: string
  classId?: string
  levels: {
    id: string
    level: number
    order: number
    authoringModeKind: string
    senseIds?: string[]
    count?: number
  }[]
}

function getSenseGrantProgression(json_data: SenseGrantPerLevel): SenseGrantProgression {
  return json_data.progression as SenseGrantProgression
}

function getClassIdForProgression(
  grantId: string,
  progression: SenseGrantProgression
): string | null {
  if (progression.scalingSource !== 'CLASS_LEVEL') {
    return null
  }

  if (!progression.classId) {
    throw new Error(`Sense grant "${grantId}" is missing classId for CLASS_LEVEL progression.`)
  }

  return progression.classId
}

function requireChosenCount(
  grantId: string,
  count: number | undefined,
  scope: 'root' | string
): number {
  if (count == null) {
    const suffix = scope === 'root'
      ? 'payload'
      : `level "${scope}" payload`
    throw new Error(`Sense grant "${grantId}" is missing count for CHOSEN ${suffix}.`)
  }

  return count
}

function rejectGrantedCount(
  grantId: string,
  count: number | undefined,
  scope: 'root' | string
) {
  if (count == null) {
    return
  }

  const suffix = scope === 'root'
    ? 'root payload'
    : `level "${scope}" payload`
  throw new Error(`Sense grant "${grantId}" cannot persist count for GRANTED ${suffix}.`)
}

function requireSelectedSenseIds(
  grantId: string,
  senseIds: string[] | undefined,
  scope: 'root' | string
): string[] {
  if (!senseIds) {
    const suffix = scope === 'root'
      ? 'payload'
      : `level "${scope}" payload`
    throw new Error(`Sense grant "${grantId}" is missing senseIds for SELECTED ${suffix}.`)
  }

  return senseIds
}

function rejectAllModeSenseIds(
  grantId: string,
  senseIds: string[] | undefined,
  scope: 'root' | string
) {
  if (!senseIds || senseIds.length === 0) {
    return
  }

  const suffix = scope === 'root'
    ? 'root payload'
    : `level "${scope}" payload`
  throw new Error(`Sense grant "${grantId}" cannot persist senseIds when authoringModeKind is ALL for ${suffix}.`)
}

function mapRangeFields(json_data: SenseGrantAuthored): {
  range_id: string | null
  range_kind: string | null
  range_amount: number | null
  range_unit: string | null
} {
  if (!json_data.range) {
    return { range_id: null, range_kind: null, range_amount: null, range_unit: null }
  }
  const r = json_data.range
  return {
    range_id: r.id,
    range_kind: r.rangeKind,
    range_amount: r.rangeKind === 'DISTANCE' ? r.amount : null,
    range_unit: r.rangeKind === 'DISTANCE' ? r.unit : null
  }
}

function mapSenseGrantRootRow(
  json_data: SenseGrantAuthored,
  chargeId: string | null
): SenseGrantRootRow {
  if (json_data.selectionKind !== 'CHOSEN' && 'count' in json_data) {
    rejectGrantedCount(json_data.id, (json_data as { count?: number }).count, 'root')
  }

  const range = mapRangeFields(json_data)

  if (json_data.scalingKind === 'NONE') {
    return {
      id: json_data.id,
      sort_order: json_data.order,
      selection_kind: json_data.selectionKind,
      scaling_kind: json_data.scalingKind,
      authoring_mode_kind: json_data.authoringModeKind,
      selection_count: json_data.selectionKind === 'CHOSEN'
        ? requireChosenCount(json_data.id, json_data.count, 'root')
        : null,
      scaling_source: null,
      class_id: null,
      charge_id: chargeId,
      restriction_id: json_data.restrictions?.id ?? null,
      ...range
    }
  }

  const progression = getSenseGrantProgression(json_data)

  return {
    id: json_data.id,
    sort_order: json_data.order,
    selection_kind: json_data.selectionKind,
    scaling_kind: json_data.scalingKind,
    authoring_mode_kind: 'ALL',
    selection_count: null,
    scaling_source: progression.scalingSource,
    class_id: getClassIdForProgression(json_data.id, progression),
    charge_id: chargeId,
    restriction_id: json_data.restrictions?.id ?? null,
    ...range
  }
}

function mapRootSenseRows(json_data: SenseGrantAuthored) {
  if (json_data.scalingKind !== 'NONE') {
    return []
  }

  if (json_data.authoringModeKind !== 'SELECTED') {
    if ('senseIds' in json_data) {
      rejectAllModeSenseIds(json_data.id, (json_data as { senseIds?: string[] }).senseIds, 'root')
    }
    return []
  }

  return requireSelectedSenseIds(json_data.id, json_data.senseIds, 'root').map((senseId) => ({
    sense_grant_id: json_data.id,
    sense_id: senseId
  }))
}

function mapScalingLevelRows(json_data: SenseGrantAuthored): SenseGrantScalingLevelRow[] {
  if (json_data.scalingKind !== 'PER_LEVEL') return []

  const progression = getSenseGrantProgression(json_data)

  return progression.levels.map((level) => ({
    id: level.id,
    sense_grant_id: json_data.id,
    level: level.level,
    sort_order: level.order,
    authoring_mode_kind: level.authoringModeKind,
    selection_count: json_data.selectionKind === 'CHOSEN'
      ? requireChosenCount(json_data.id, level.count, level.id)
      : (
          'count' in level
            ? (rejectGrantedCount(json_data.id, (level as { count?: number }).count, level.id), null)
            : null
        )
  }))
}

function mapScalingLevelSenseRows(json_data: SenseGrantAuthored): SenseGrantScalingLevelSenseRow[] {
  if (json_data.scalingKind !== 'PER_LEVEL') return []

  const progression = getSenseGrantProgression(json_data)

  return progression.levels.flatMap((level) => {
    if (level.authoringModeKind !== 'SELECTED') {
      if ('senseIds' in level) {
        rejectAllModeSenseIds(json_data.id, (level as { senseIds?: string[] }).senseIds, level.id)
      }
      return []
    }

    return requireSelectedSenseIds(json_data.id, level.senseIds, level.id).map((senseId) => ({
      scaling_level_id: level.id,
      sense_id: senseId
    }))
  })
}

export async function upsertSenseGrant(
  db: DBLike,
  json_data: SenseGrantAuthored
) {
  const root = mapSenseGrantRootRow(json_data, json_data.charges?.id ?? null)
  const rootSenses = mapRootSenseRows(json_data)
  const scalingLevels = mapScalingLevelRows(json_data)
  const scalingLevelSenses = mapScalingLevelSenseRows(json_data)

  const trx = await db.startTransaction().execute()

  try {
    const existingGrant = await trx
      .selectFrom('sense_grants')
      .select(['restriction_id'])
      .where('id', '=', json_data.id)
      .executeTakeFirst()

    if (existingGrant?.restriction_id && existingGrant.restriction_id !== json_data.restrictions?.id) {
      await trx.deleteFrom('facets').where('id', '=', existingGrant.restriction_id)
        .execute()
    }

    if (json_data.charges) {
      await upsertCharge(trx, json_data.charges)
    }

    if (json_data.restrictions) {
      await upsertFacet(trx, json_data.restrictions)
    }

    await trx
      .insertInto('sense_grants')
      .values(root)
      .onConflict((oc) => oc.column('id').doUpdateSet(({ ref }) => ({
        sort_order: ref('excluded.sort_order'),
        selection_kind: ref('excluded.selection_kind'),
        scaling_kind: ref('excluded.scaling_kind'),
        authoring_mode_kind: ref('excluded.authoring_mode_kind'),
        selection_count: ref('excluded.selection_count'),
        scaling_source: ref('excluded.scaling_source'),
        class_id: ref('excluded.class_id'),
        charge_id: ref('excluded.charge_id'),
        restriction_id: ref('excluded.restriction_id'),
        range_id: ref('excluded.range_id'),
        range_kind: ref('excluded.range_kind'),
        range_amount: ref('excluded.range_amount'),
        range_unit: ref('excluded.range_unit')
      })))
      .execute()

    await trx
      .deleteFrom('sense_grant_senses')
      .where('sense_grant_id', '=', json_data.id)
      .execute()

    await trx
      .deleteFrom('sense_grant_scaling_levels')
      .where('sense_grant_id', '=', json_data.id)
      .execute()

    if (rootSenses.length > 0) {
      await trx
        .insertInto('sense_grant_senses')
        .values(rootSenses)
        .execute()
    }

    if (scalingLevels.length > 0) {
      await trx
        .insertInto('sense_grant_scaling_levels')
        .values(scalingLevels)
        .execute()

      if (scalingLevelSenses.length > 0) {
        await trx
          .insertInto('sense_grant_scaling_level_senses')
          .values(scalingLevelSenses)
          .execute()
      }
    }

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
