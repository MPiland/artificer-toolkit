import type { FeatGrantAuthored } from '@artificer-toolkit/shared'
import type { DBLike } from '#types'
import { upsertFeatGrant } from '../upserts/feat.js'
import { hydrateFacetById } from '../../shared/facets.js'
import {
  hydrateChargeById,
  requireNoSelectionDuplicatePolicy,
  requireSelectionDuplicatePolicy
} from './helpers.js'
import type { FeatGrantRepository } from '../../../repositories/contracts.js'
import { hydrateByIds, orderedHydratedRecords } from '../../../repositories/batch.js'

function requireLinkedRecord<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw new Error(message)
  }

  return value
}

function requireChosenCount(value: number | null, message: string): number {
  if (value == null) {
    throw new Error(message)
  }

  return value
}

function requireNoGrantedCount(
  value: number | null,
  message: string
) {
  if (value != null) {
    throw new Error(message)
  }
}

function requireProgressionClassId(
  value: string | null,
  message: string
): string {
  if (!value) {
    throw new Error(message)
  }

  return value
}

function requireSelectionKind(
  value: string,
  message: string
): 'GRANTED' | 'CHOSEN' {
  if (value !== 'GRANTED' && value !== 'CHOSEN') {
    throw new Error(message)
  }

  return value
}

function requireAuthoringModeKind(
  value: string,
  message: string
): 'ALL' | 'SELECTED' {
  if (value !== 'ALL' && value !== 'SELECTED') {
    throw new Error(message)
  }

  return value
}

function requireNoUnexpectedSelectedIds(
  ids: string[],
  message: string
) {
  if (ids.length > 0) {
    throw new Error(message)
  }
}

function requireScalingSource(
  value: string | null,
  message: string
): 'CHARACTER_LEVEL' | 'CLASS_LEVEL' | 'PARENT_CLASS_LEVEL' | 'SPELL_CAST_LEVEL' {
  if (
    value !== 'CHARACTER_LEVEL'
    && value !== 'CLASS_LEVEL'
    && value !== 'PARENT_CLASS_LEVEL'
    && value !== 'SPELL_CAST_LEVEL'
  ) {
    throw new Error(message)
  }

  return value
}

function requireScalingKind(
  value: string,
  message: string
): 'NONE' | 'PER_LEVEL' {
  if (value !== 'NONE' && value !== 'PER_LEVEL') {
    throw new Error(message)
  }

  return value
}

async function hydrateFeatGrantById(
  db: DBLike,
  id: string
): Promise<FeatGrantAuthored | null> {
  const root = await db
    .selectFrom('feat_grants')
    .select([
      'id',
      'sort_order',
      'selection_kind',
      'scaling_kind',
      'authoring_mode_kind',
      'selection_count',
      'selection_duplicate_policy',
      'scaling_source',
      'class_id',
      'charge_id',
      'restriction_id'
    ])
    .where('id', '=', id)
    .executeTakeFirst()

  if (!root) return null

  const [rootFeats, scalingLevels, charge, restrictions] = await Promise.all([
    db.selectFrom('feat_grant_feats')
      .select(['feat_grant_id', 'feat_id'])
      .where('feat_grant_id', '=', id)
      .execute(),
    db.selectFrom('feat_grant_scaling_levels')
      .select(['id', 'feat_grant_id', 'level', 'sort_order', 'authoring_mode_kind', 'selection_count', 'selection_duplicate_policy'])
      .where('feat_grant_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    root.charge_id ? hydrateChargeById(db, root.charge_id) : Promise.resolve(null),
    root.restriction_id ? hydrateFacetById(db, root.restriction_id) : Promise.resolve(null)
  ])
  const scalingLevelIds = scalingLevels.map((level) => level.id)
  const scalingLevelFeats = scalingLevelIds.length
    ? await db.selectFrom('feat_grant_scaling_level_feats')
        .select(['scaling_level_id', 'feat_id'])
        .where('scaling_level_id', 'in', scalingLevelIds)
        .execute()
    : []

  const featsByLevel = new Map<string, string[]>()
  for (const row of scalingLevelFeats) {
    featsByLevel.set(row.scaling_level_id, [
      ...(featsByLevel.get(row.scaling_level_id) ?? []),
      row.feat_id
    ])
  }

  const base = {
    id: root.id,
    grantKind: 'FEAT_GRANT' as const,
    order: root.sort_order,
    charges: charge ?? undefined
  }
  const scalingKind = requireScalingKind(root.scaling_kind, `Feat grant "${id}" has invalid scaling_kind "${root.scaling_kind}".`)

  if (scalingKind === 'NONE') {
    const selectionKind = requireSelectionKind(root.selection_kind, `Feat grant "${id}" has invalid selection_kind "${root.selection_kind}".`)
    if (selectionKind === 'GRANTED') {
      requireNoGrantedCount(root.selection_count, `Feat grant "${id}" cannot hydrate selection_count for GRANTED payload.`)
      requireNoSelectionDuplicatePolicy(`Feat grant "${id}"`, root.selection_duplicate_policy)
    }
    const authoringModeKind = requireAuthoringModeKind(root.authoring_mode_kind, `Feat grant "${id}" has invalid authoring_mode_kind "${root.authoring_mode_kind}".`)
    if (authoringModeKind === 'ALL') {
      requireNoUnexpectedSelectedIds(
        rootFeats.map((row) => row.feat_id),
        `Feat grant "${id}" cannot hydrate featIds when authoring_mode_kind is ALL.`
      )
    }

    return {
      ...base,
      selectionKind,
      scalingKind: 'NONE',
      authoringModeKind,
      count: root.selection_kind === 'CHOSEN'
        ? requireChosenCount(root.selection_count, `Feat grant "${id}" is missing selection_count for CHOSEN payload.`)
        : undefined,
      selectionDuplicatePolicy: root.selection_kind === 'CHOSEN'
        ? requireSelectionDuplicatePolicy(
          `Feat grant "${id}"`,
          root.selection_duplicate_policy
        )
        : undefined,
      featIds: authoringModeKind === 'SELECTED'
        ? rootFeats.map((row) => row.feat_id)
        : undefined,
      restrictions: root.restriction_id
        ? requireLinkedRecord(restrictions, `Feat grant "${id}" is linked to missing restriction facet "${root.restriction_id}".`)
        : undefined
    } as FeatGrantAuthored
  }

  requireNoSelectionDuplicatePolicy(
    `Feat grant "${id}"`,
    root.selection_duplicate_policy,
    'at the root for PER_LEVEL payload'
  )

  return {
    ...base,
    selectionKind: (() => {
      const selectionKind = requireSelectionKind(root.selection_kind, `Feat grant "${id}" has invalid selection_kind "${root.selection_kind}".`)
      if (selectionKind === 'GRANTED') {
        for (const level of scalingLevels) {
          requireNoGrantedCount(
            level.selection_count,
            `Feat grant "${id}" level "${level.id}" cannot hydrate selection_count for GRANTED payload.`
          )
          requireNoSelectionDuplicatePolicy(
            `Feat grant "${id}" level "${level.id}"`,
            level.selection_duplicate_policy
          )
        }
      }
      return selectionKind
    })(),
    scalingKind,
      progression: {
        scalingSource: requireScalingSource(root.scaling_source, `Feat grant "${id}" is missing or has invalid scaling_source.`),
      classId: root.scaling_source === 'CLASS_LEVEL'
        ? requireProgressionClassId(root.class_id, `Feat grant "${id}" is missing class_id for CLASS_LEVEL progression.`)
        : undefined,
      levels: scalingLevels.map((level) => {
        const authoringModeKind = requireAuthoringModeKind(level.authoring_mode_kind, `Feat grant "${id}" level "${level.id}" has invalid authoring_mode_kind "${level.authoring_mode_kind}".`)
        const featIds = featsByLevel.get(level.id) ?? []
        if (authoringModeKind === 'ALL') {
          requireNoUnexpectedSelectedIds(
            featIds,
            `Feat grant "${id}" level "${level.id}" cannot hydrate featIds when authoring_mode_kind is ALL.`
          )
        }

        return {
          id: level.id,
          level: level.level,
          order: level.sort_order,
          authoringModeKind,
          count: root.selection_kind === 'CHOSEN'
            ? requireChosenCount(level.selection_count, `Feat grant "${id}" level "${level.id}" is missing selection_count for CHOSEN payload.`)
            : undefined,
          selectionDuplicatePolicy: root.selection_kind === 'CHOSEN'
            ? requireSelectionDuplicatePolicy(
              `Feat grant "${id}" level "${level.id}"`,
              level.selection_duplicate_policy
            )
            : undefined,
          featIds: authoringModeKind === 'SELECTED'
            ? featIds
            : undefined
        }
      })
    },
    restrictions: root.restriction_id
      ? requireLinkedRecord(restrictions, `Feat grant "${id}" is linked to missing restriction facet "${root.restriction_id}".`)
      : undefined
  } as FeatGrantAuthored
}

export function createFeatGrantRepository(db: DBLike): FeatGrantRepository {
  return {
    async upsert(entity) {
      await upsertFeatGrant(db, entity)
    },

    async findById(id) {
      return hydrateFeatGrantById(db, id)
    },

    async findByIds(ids) {
      return hydrateByIds(ids, (id) => hydrateFeatGrantById(db, id))
    },

    async findAll() {
      const rows = await db
        .selectFrom('feat_grants')
        .select('id')
        .orderBy('sort_order')
        .execute()

      return orderedHydratedRecords(
        rows.map((row) => row.id),
        await hydrateByIds(rows.map((row) => row.id), (id) => hydrateFeatGrantById(db, id))
      )
    }
  }
}
