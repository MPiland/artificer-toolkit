import type { DBLike } from '#types'
import { withTransaction } from '../../../utils/index.js'
import type { FeatGrantAuthored } from '@artificer-toolkit/shared'
import { upsertFacet } from '../../shared/facets.js'
import { upsertCharge } from '../../shared/upserts/charge.js'
import {
  requireNoSelectionDuplicatePolicy,
  requireSelectionDuplicatePolicy
} from '../repositories/helpers.js'

type FeatGrantRootRow = {
  id: string
  sort_order: number
  selection_kind: string
  scaling_kind: string
  authoring_mode_kind: string
  selection_count: number | null
  selection_duplicate_policy: string | null
  scaling_source: string | null
  class_id: string | null
  charge_id: string | null
  restriction_id: string | null
}

type FeatGrantScalingLevelRow = {
  id: string
  feat_grant_id: string
  level: number
  sort_order: number
  authoring_mode_kind: string
  selection_count: number | null
  selection_duplicate_policy: string | null
}

type FeatGrantScalingLevelFeatRow = {
  scaling_level_id: string
  feat_id: string
}

type FeatGrantPerLevel = Extract<FeatGrantAuthored, { scalingKind: 'PER_LEVEL' }>
type FeatGrantProgression = {
  scalingSource: string
  classId?: string
  levels: {
    id: string
    level: number
    order: number
    authoringModeKind: string
    featIds?: string[]
    count?: number
    selectionDuplicatePolicy?: string
  }[]
}

function getFeatGrantProgression(json_data: FeatGrantPerLevel): FeatGrantProgression {
  return json_data.progression as FeatGrantProgression
}

function getClassIdForProgression(
  grantId: string,
  progression: FeatGrantProgression
): string | null {
  if (progression.scalingSource !== 'CLASS_LEVEL') {
    return null
  }

  if (!progression.classId) {
    throw new Error(`Feat grant "${grantId}" is missing classId for CLASS_LEVEL progression.`)
  }

  return progression.classId
}

function requireChosenCount(
  grantId: string,
  count: number | undefined,
  scope: string
): number {
  if (count == null) {
    const suffix = scope === 'root'
      ? 'payload'
      : `level "${scope}" payload`
    throw new Error(`Feat grant "${grantId}" is missing count for CHOSEN ${suffix}.`)
  }

  return count
}

function rejectGrantedCount(
  grantId: string,
  count: number | undefined,
  scope: string
) {
  if (count == null) {
    return
  }

  const suffix = scope === 'root'
    ? 'root payload'
    : `level "${scope}" payload`
  throw new Error(`Feat grant "${grantId}" cannot persist count for GRANTED ${suffix}.`)
}

function requireSelectedFeatIds(
  grantId: string,
  featIds: string[] | undefined,
  scope: string
): string[] {
  if (!featIds) {
    const suffix = scope === 'root'
      ? 'payload'
      : `level "${scope}" payload`
    throw new Error(`Feat grant "${grantId}" is missing featIds for SELECTED ${suffix}.`)
  }

  return featIds
}

function rejectAllModeFeatIds(
  grantId: string,
  featIds: string[] | undefined,
  scope: string
) {
  if (!featIds || featIds.length === 0) {
    return
  }

  const suffix = scope === 'root'
    ? 'root payload'
    : `level "${scope}" payload`
  throw new Error(`Feat grant "${grantId}" cannot persist featIds when authoringModeKind is ALL for ${suffix}.`)
}

function mapFeatGrantRootRow(
  json_data: FeatGrantAuthored,
  chargeId: string | null
): FeatGrantRootRow {
  if (json_data.selectionKind !== 'CHOSEN' && 'count' in json_data) {
    rejectGrantedCount(json_data.id, (json_data as { count?: number }).count, 'root')
  }

  if (json_data.selectionKind !== 'CHOSEN' && 'selectionDuplicatePolicy' in json_data) {
    requireNoSelectionDuplicatePolicy(
      `Feat grant "${json_data.id}"`,
      (json_data as { selectionDuplicatePolicy?: string }).selectionDuplicatePolicy
    )
  }

  if (json_data.scalingKind === 'PER_LEVEL' && 'selectionDuplicatePolicy' in json_data) {
    requireNoSelectionDuplicatePolicy(
      `Feat grant "${json_data.id}"`,
      (json_data as { selectionDuplicatePolicy?: string }).selectionDuplicatePolicy,
      'at the root for PER_LEVEL payload'
    )
  }

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
      selection_duplicate_policy: json_data.selectionKind === 'CHOSEN'
        ? requireSelectionDuplicatePolicy(
          `Feat grant "${json_data.id}"`,
          json_data.selectionDuplicatePolicy
        )
        : null,
      scaling_source: null,
      class_id: null,
      charge_id: chargeId,
      restriction_id: json_data.restrictions?.id ?? null
    }
  }

  const progression = getFeatGrantProgression(json_data)

  return {
    id: json_data.id,
    sort_order: json_data.order,
    selection_kind: json_data.selectionKind,
    scaling_kind: json_data.scalingKind,
    authoring_mode_kind: 'ALL',
    selection_count: null,
    selection_duplicate_policy: null,
    scaling_source: progression.scalingSource,
    class_id: getClassIdForProgression(json_data.id, progression),
    charge_id: chargeId,
    restriction_id: json_data.restrictions?.id ?? null
  }
}

function mapRootFeatRows(json_data: FeatGrantAuthored) {
  if (json_data.scalingKind !== 'NONE') {
    return []
  }

  if (json_data.authoringModeKind !== 'SELECTED') {
    if ('featIds' in json_data) {
      rejectAllModeFeatIds(json_data.id, (json_data as { featIds?: string[] }).featIds, 'root')
    }
    return []
  }

  return requireSelectedFeatIds(json_data.id, json_data.featIds, 'root').map((featId) => ({
    feat_grant_id: json_data.id,
    feat_id: featId
  }))
}

function mapScalingLevelRows(json_data: FeatGrantAuthored): FeatGrantScalingLevelRow[] {
  if (json_data.scalingKind !== 'PER_LEVEL') return []

  const progression = getFeatGrantProgression(json_data)

  return progression.levels.map((level) => ({
    id: level.id,
    feat_grant_id: json_data.id,
    level: level.level,
    sort_order: level.order,
    authoring_mode_kind: level.authoringModeKind,
    selection_count: json_data.selectionKind === 'CHOSEN'
      ? requireChosenCount(json_data.id, level.count, level.id)
      : (
          'count' in level
            ? (rejectGrantedCount(json_data.id, (level as { count?: number }).count, level.id), null)
            : null
        ),
    selection_duplicate_policy: json_data.selectionKind === 'CHOSEN'
      ? requireSelectionDuplicatePolicy(
        `Feat grant "${json_data.id}" level "${level.id}"`,
        level.selectionDuplicatePolicy
      )
      : (
          'selectionDuplicatePolicy' in level
            ? (
                requireNoSelectionDuplicatePolicy(
                  `Feat grant "${json_data.id}" level "${level.id}"`,
                  (level as { selectionDuplicatePolicy?: string }).selectionDuplicatePolicy
                ),
                null
              )
            : null
        )
  }))
}

function mapScalingLevelFeatRows(json_data: FeatGrantAuthored): FeatGrantScalingLevelFeatRow[] {
  if (json_data.scalingKind !== 'PER_LEVEL') return []

  const progression = getFeatGrantProgression(json_data)

  return progression.levels.flatMap((level) => {
    if (level.authoringModeKind !== 'SELECTED') {
      if ('featIds' in level) {
        rejectAllModeFeatIds(json_data.id, (level as { featIds?: string[] }).featIds, level.id)
      }
      return []
    }

    return requireSelectedFeatIds(json_data.id, level.featIds, level.id).map((featId) => ({
      scaling_level_id: level.id,
      feat_id: featId
    }))
  })
}

export async function upsertFeatGrant(
  db: DBLike,
  json_data: FeatGrantAuthored
) {
  const root = mapFeatGrantRootRow(json_data, json_data.charges?.id ?? null)
  const rootFeats = mapRootFeatRows(json_data)
  const scalingLevels = mapScalingLevelRows(json_data)
  const scalingLevelFeats = mapScalingLevelFeatRows(json_data)

  return withTransaction(db, async (trx) => {
    const existingGrant = await trx
      .selectFrom('feat_grants')
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
      .insertInto('feat_grants')
      .values(root)
      .onConflict((oc) => oc.column('id').doUpdateSet((eb) => ({
        sort_order: eb.ref('excluded.sort_order'),
        selection_kind: eb.ref('excluded.selection_kind'),
        scaling_kind: eb.ref('excluded.scaling_kind'),
        authoring_mode_kind: eb.ref('excluded.authoring_mode_kind'),
        selection_count: eb.ref('excluded.selection_count'),
        selection_duplicate_policy: eb.ref('excluded.selection_duplicate_policy'),
        scaling_source: eb.ref('excluded.scaling_source'),
        class_id: eb.ref('excluded.class_id'),
        charge_id: eb.ref('excluded.charge_id'),
        restriction_id: eb.ref('excluded.restriction_id')
      })))
      .execute()

    await trx
      .deleteFrom('feat_grant_feats')
      .where('feat_grant_id', '=', json_data.id)
      .execute()

    await trx
      .deleteFrom('feat_grant_scaling_levels')
      .where('feat_grant_id', '=', json_data.id)
      .execute()

    if (rootFeats.length > 0) {
      await trx
        .insertInto('feat_grant_feats')
        .values(rootFeats)
        .execute()
    }

    if (scalingLevels.length > 0) {
      await trx
        .insertInto('feat_grant_scaling_levels')
        .values(scalingLevels)
        .execute()

      if (scalingLevelFeats.length > 0) {
        await trx
          .insertInto('feat_grant_scaling_level_feats')
          .values(scalingLevelFeats)
          .execute()
      }
    }

  })
}
