import {
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  type RangeAuthored,
  type ScalableValueAuthored,
  type SenseGrantAuthored
} from '@artificer-toolkit/shared'
import type { DBLike, Json } from '#types'
import { upsertSenseGrant } from '../upserts/sense.js'
import { hydrateFacetById } from '../../shared/facets.js'
import {
  hydrateChargeById,
  requireNoSelectionDuplicatePolicy,
  requireSelectionDuplicatePolicy
} from './helpers.js'
import type { SenseGrantRepository } from '../../../repositories/contracts.js'
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

function requireNoGrantedCount(value: number | null, message: string) {
  if (value != null) {
    throw new Error(message)
  }
}

function requireProgressionClassId(value: string | null, message: string): string {
  if (!value) {
    throw new Error(message)
  }

  return value
}

function requireSelectionKind(value: string, message: string): 'GRANTED' | 'CHOSEN' {
  if (value !== 'GRANTED' && value !== 'CHOSEN') {
    throw new Error(message)
  }

  return value
}

function requireAuthoringModeKind(value: string, message: string): 'ALL' | 'SELECTED' {
  if (value !== 'ALL' && value !== 'SELECTED') {
    throw new Error(message)
  }

  return value
}

function requireNoUnexpectedSelectedIds(ids: string[], message: string) {
  if (ids.length > 0) {
    throw new Error(message)
  }
}

function requireScalingSource(
  value: string | null,
  message: string
): 'CHARACTER_LEVEL' | 'CLASS_LEVEL' | 'PARENT_CLASS_LEVEL' | 'SPELL_CAST_LEVEL' {
  if (
    value !== 'CHARACTER_LEVEL' &&
    value !== 'CLASS_LEVEL' &&
    value !== 'PARENT_CLASS_LEVEL' &&
    value !== 'SPELL_CAST_LEVEL'
  ) {
    throw new Error(message)
  }

  return value
}

function requireScalingKind(value: string, message: string): 'NONE' | 'PER_LEVEL' {
  if (value !== 'NONE' && value !== 'PER_LEVEL') {
    throw new Error(message)
  }

  return value
}

function hydrateSenseGrantRange(row: {
  range_id: string | null
  range_kind: string | null
  range_amount: number | string | null
  range_unit: string | null
  range_scaling: Json | null
}): RangeAuthored | undefined {
  if (!row.range_id) {
    if (
      row.range_kind != null ||
      row.range_amount != null ||
      row.range_unit != null ||
      row.range_scaling != null
    ) {
      throw new Error('Sense grant range payload exists without range_id.')
    }
    return undefined
  }

  if (!row.range_kind || !(row.range_kind in RANGE_KIND)) {
    throw new Error(
      `Sense grant range "${row.range_id}" has invalid range_kind "${String(row.range_kind)}".`
    )
  }
  const rangeKind = row.range_kind as keyof typeof RANGE_KIND

  if (rangeKind !== RANGE_KIND.DISTANCE) {
    if (row.range_amount != null || row.range_unit != null || row.range_scaling != null) {
      throw new Error(
        `Sense grant range "${row.range_id}" has DISTANCE-only payload for ${rangeKind}.`
      )
    }
    return { id: row.range_id, rangeKind }
  }

  const amount =
    typeof row.range_amount === 'number'
      ? row.range_amount
      : row.range_amount == null
        ? Number.NaN
        : Number(row.range_amount)
  if (!Number.isFinite(amount)) {
    throw new Error(`Sense grant range "${row.range_id}" is missing a numeric amount.`)
  }
  if (!row.range_unit || !(row.range_unit in MEASUREMENT_UNIT_CODE)) {
    throw new Error(
      `Sense grant range "${row.range_id}" has invalid range_unit "${String(row.range_unit)}".`
    )
  }

  return {
    id: row.range_id,
    rangeKind,
    amount,
    unit: row.range_unit as keyof typeof MEASUREMENT_UNIT_CODE,
    scaling:
      row.range_scaling == null
        ? undefined
        : (row.range_scaling as ScalableValueAuthored<{
            amount: number
            unit: keyof typeof MEASUREMENT_UNIT_CODE
          }>)
  }
}

async function hydrateSenseGrantById(db: DBLike, id: string): Promise<SenseGrantAuthored | null> {
  const root = await db
    .selectFrom('sense_grants')
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
      'restriction_id',
      'range_id',
      'range_kind',
      'range_amount',
      'range_unit',
      'range_scaling'
    ] as const)
    .where('id', '=', id)
    .executeTakeFirst()

  if (!root) return null

  const [rootSenses, scalingLevels, charge, restrictions] = await Promise.all([
    db
      .selectFrom('sense_grant_senses')
      .select(['sense_grant_id', 'sense_id'])
      .where('sense_grant_id', '=', id)
      .orderBy('sense_id')
      .execute(),
    db
      .selectFrom('sense_grant_scaling_levels')
      .select([
        'id',
        'sense_grant_id',
        'level',
        'sort_order',
        'authoring_mode_kind',
        'selection_count',
        'selection_duplicate_policy'
      ])
      .where('sense_grant_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    root.charge_id ? hydrateChargeById(db, root.charge_id) : Promise.resolve(null),
    root.restriction_id ? hydrateFacetById(db, root.restriction_id) : Promise.resolve(null)
  ])
  const scalingLevelIds = scalingLevels.map((level) => level.id)
  const scalingLevelSenses = scalingLevelIds.length
    ? await db
        .selectFrom('sense_grant_scaling_level_senses')
        .select(['scaling_level_id', 'sense_id'])
        .where('scaling_level_id', 'in', scalingLevelIds)
        .orderBy('sense_id')
        .execute()
    : []

  const sensesByLevel = new Map<string, string[]>()
  for (const row of scalingLevelSenses) {
    sensesByLevel.set(row.scaling_level_id, [
      ...(sensesByLevel.get(row.scaling_level_id) ?? []),
      row.sense_id
    ])
  }

  const range = hydrateSenseGrantRange(root)
  const base = {
    id: root.id,
    grantKind: 'SENSE_GRANT' as const,
    order: root.sort_order,
    charges: charge ?? undefined,
    ...(range ? { range } : {})
  }
  const scalingKind = requireScalingKind(
    root.scaling_kind,
    `Sense grant "${id}" has invalid scaling_kind "${root.scaling_kind}".`
  )

  if (scalingKind === 'NONE') {
    const selectionKind = requireSelectionKind(
      root.selection_kind,
      `Sense grant "${id}" has invalid selection_kind "${root.selection_kind}".`
    )
    if (selectionKind === 'GRANTED') {
      requireNoGrantedCount(
        root.selection_count,
        `Sense grant "${id}" cannot hydrate selection_count for GRANTED payload.`
      )
      requireNoSelectionDuplicatePolicy(`Sense grant "${id}"`, root.selection_duplicate_policy)
    }
    const authoringModeKind = requireAuthoringModeKind(
      root.authoring_mode_kind,
      `Sense grant "${id}" has invalid authoring_mode_kind "${root.authoring_mode_kind}".`
    )
    if (authoringModeKind === 'ALL') {
      requireNoUnexpectedSelectedIds(
        rootSenses.map((row) => row.sense_id),
        `Sense grant "${id}" cannot hydrate senseIds when authoring_mode_kind is ALL.`
      )
    }

    return {
      ...base,
      selectionKind,
      scalingKind: 'NONE',
      authoringModeKind,
      count:
        root.selection_kind === 'CHOSEN'
          ? requireChosenCount(
              root.selection_count,
              `Sense grant "${id}" is missing selection_count for CHOSEN payload.`
            )
          : undefined,
      selectionDuplicatePolicy:
        root.selection_kind === 'CHOSEN'
          ? requireSelectionDuplicatePolicy(`Sense grant "${id}"`, root.selection_duplicate_policy)
          : undefined,
      senseIds:
        authoringModeKind === 'SELECTED' ? rootSenses.map((row) => row.sense_id) : undefined,
      restrictions: root.restriction_id
        ? requireLinkedRecord(
            restrictions,
            `Sense grant "${id}" is linked to missing restriction facet "${root.restriction_id}".`
          )
        : undefined
    } as SenseGrantAuthored
  }

  requireNoSelectionDuplicatePolicy(
    `Sense grant "${id}"`,
    root.selection_duplicate_policy,
    'at the root for PER_LEVEL payload'
  )

  return {
    ...base,
    selectionKind: (() => {
      const selectionKind = requireSelectionKind(
        root.selection_kind,
        `Sense grant "${id}" has invalid selection_kind "${root.selection_kind}".`
      )
      if (selectionKind === 'GRANTED') {
        for (const level of scalingLevels) {
          requireNoGrantedCount(
            level.selection_count,
            `Sense grant "${id}" level "${level.id}" cannot hydrate selection_count for GRANTED payload.`
          )
          requireNoSelectionDuplicatePolicy(
            `Sense grant "${id}" level "${level.id}"`,
            level.selection_duplicate_policy
          )
        }
      }
      return selectionKind
    })(),
    scalingKind,
    progression: {
      scalingSource: requireScalingSource(
        root.scaling_source,
        `Sense grant "${id}" is missing or has invalid scaling_source.`
      ),
      classId:
        root.scaling_source === 'CLASS_LEVEL'
          ? requireProgressionClassId(
              root.class_id,
              `Sense grant "${id}" is missing class_id for CLASS_LEVEL progression.`
            )
          : undefined,
      levels: scalingLevels.map((level) => {
        const authoringModeKind = requireAuthoringModeKind(
          level.authoring_mode_kind,
          `Sense grant "${id}" level "${level.id}" has invalid authoring_mode_kind "${level.authoring_mode_kind}".`
        )
        const senseIds = sensesByLevel.get(level.id) ?? []
        if (authoringModeKind === 'ALL') {
          requireNoUnexpectedSelectedIds(
            senseIds,
            `Sense grant "${id}" level "${level.id}" cannot hydrate senseIds when authoring_mode_kind is ALL.`
          )
        }

        return {
          id: level.id,
          level: level.level,
          order: level.sort_order,
          authoringModeKind,
          count:
            root.selection_kind === 'CHOSEN'
              ? requireChosenCount(
                  level.selection_count,
                  `Sense grant "${id}" level "${level.id}" is missing selection_count for CHOSEN payload.`
                )
              : undefined,
          selectionDuplicatePolicy:
            root.selection_kind === 'CHOSEN'
              ? requireSelectionDuplicatePolicy(
                  `Sense grant "${id}" level "${level.id}"`,
                  level.selection_duplicate_policy
                )
              : undefined,
          senseIds: authoringModeKind === 'SELECTED' ? senseIds : undefined
        }
      })
    },
    restrictions: root.restriction_id
      ? requireLinkedRecord(
          restrictions,
          `Sense grant "${id}" is linked to missing restriction facet "${root.restriction_id}".`
        )
      : undefined
  } as SenseGrantAuthored
}

export function createSenseGrantRepository(db: DBLike): SenseGrantRepository {
  return {
    async upsert(entity) {
      await upsertSenseGrant(db, entity)
    },

    async findById(id) {
      return hydrateSenseGrantById(db, id)
    },

    async findByIds(ids) {
      return hydrateByIds(ids, (id) => hydrateSenseGrantById(db, id))
    },

    async findAll() {
      const rows = await db.selectFrom('sense_grants').select('id').orderBy('sort_order').execute()

      return orderedHydratedRecords(
        rows.map((row) => row.id),
        await hydrateByIds(
          rows.map((row) => row.id),
          (id) => hydrateSenseGrantById(db, id)
        )
      )
    }
  }
}
