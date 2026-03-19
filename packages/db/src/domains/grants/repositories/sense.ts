import type { SenseGrantAuthored } from '@artificer-toolkit/shared'
import type { DBLike } from '#types'
import { upsertSenseGrant } from '../upserts/sense.js'
import { hydrateFacetById } from '../../shared/facets.js'
import { hydrateChargeById } from './helpers.js'
import type { SenseGrantRepository } from '../../../repositories/contracts.js'

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

async function hydrateSenseGrantById(
  db: DBLike,
  id: string
): Promise<SenseGrantAuthored | null> {
  const root = await db
    .selectFrom('sense_grants')
    .select([
      'id',
      'sort_order',
      'selection_kind',
      'scaling_kind',
      'authoring_mode_kind',
      'selection_count',
      'scaling_source',
      'class_id',
      'charge_id',
      'restriction_id',
      'range_id',
      'range_kind',
      'range_amount',
      'range_unit'
    ])
    .where('id', '=', id)
    .executeTakeFirst()

  if (!root) return null

  const [rootSenses, scalingLevels, scalingLevelSenses, charge, restrictions] = await Promise.all([
    db.selectFrom('sense_grant_senses')
      .select(['sense_grant_id', 'sense_id'])
      .where('sense_grant_id', '=', id)
      .execute(),
    db.selectFrom('sense_grant_scaling_levels')
      .select(['id', 'sense_grant_id', 'level', 'sort_order', 'authoring_mode_kind', 'selection_count'])
      .where('sense_grant_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('sense_grant_scaling_level_senses')
      .select(['scaling_level_id', 'sense_id'])
      .execute(),
    root.charge_id ? hydrateChargeById(db, root.charge_id) : Promise.resolve(null),
    root.restriction_id ? hydrateFacetById(db, root.restriction_id) : Promise.resolve(null)
  ])

  const sensesByLevel = new Map<string, string[]>()
  for (const row of scalingLevelSenses) {
    sensesByLevel.set(row.scaling_level_id, [
      ...(sensesByLevel.get(row.scaling_level_id) ?? []),
      row.sense_id
    ])
  }

  const range = (() => {
    if (!root.range_id || !root.range_kind) return undefined
    if (root.range_kind === 'DISTANCE') {
      if (root.range_amount == null || !root.range_unit) return undefined
      return { id: root.range_id, rangeKind: 'DISTANCE' as const, amount: root.range_amount, unit: root.range_unit }
    }
    return { id: root.range_id, rangeKind: root.range_kind as Exclude<typeof root.range_kind, 'DISTANCE'> }
  })()

  const base = {
    id: root.id,
    grantKind: 'SENSE_GRANT' as const,
    order: root.sort_order,
    charges: charge ?? undefined,
    range
  }
  const scalingKind = requireScalingKind(root.scaling_kind, `Sense grant "${id}" has invalid scaling_kind "${root.scaling_kind}".`)

  if (scalingKind === 'NONE') {
    const selectionKind = requireSelectionKind(root.selection_kind, `Sense grant "${id}" has invalid selection_kind "${root.selection_kind}".`)
    if (selectionKind === 'GRANTED') {
      requireNoGrantedCount(root.selection_count, `Sense grant "${id}" cannot hydrate selection_count for GRANTED payload.`)
    }
    const authoringModeKind = requireAuthoringModeKind(root.authoring_mode_kind, `Sense grant "${id}" has invalid authoring_mode_kind "${root.authoring_mode_kind}".`)
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
      count: root.selection_kind === 'CHOSEN'
        ? requireChosenCount(root.selection_count, `Sense grant "${id}" is missing selection_count for CHOSEN payload.`)
        : undefined,
      senseIds: authoringModeKind === 'SELECTED'
        ? rootSenses.map((row) => row.sense_id)
        : undefined,
      restrictions: root.restriction_id
        ? requireLinkedRecord(restrictions, `Sense grant "${id}" is linked to missing restriction facet "${root.restriction_id}".`)
        : undefined
    } as SenseGrantAuthored
  }

  return {
    ...base,
    selectionKind: (() => {
      const selectionKind = requireSelectionKind(root.selection_kind, `Sense grant "${id}" has invalid selection_kind "${root.selection_kind}".`)
      if (selectionKind === 'GRANTED') {
        for (const level of scalingLevels) {
          requireNoGrantedCount(
            level.selection_count,
            `Sense grant "${id}" level "${level.id}" cannot hydrate selection_count for GRANTED payload.`
          )
        }
      }
      return selectionKind
    })(),
    scalingKind,
      progression: {
        scalingSource: requireScalingSource(root.scaling_source, `Sense grant "${id}" is missing or has invalid scaling_source.`),
      classId: root.scaling_source === 'CLASS_LEVEL'
        ? requireProgressionClassId(root.class_id, `Sense grant "${id}" is missing class_id for CLASS_LEVEL progression.`)
        : undefined,
      levels: scalingLevels.map((level) => {
        const authoringModeKind = requireAuthoringModeKind(level.authoring_mode_kind, `Sense grant "${id}" level "${level.id}" has invalid authoring_mode_kind "${level.authoring_mode_kind}".`)
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
          count: root.selection_kind === 'CHOSEN'
            ? requireChosenCount(level.selection_count, `Sense grant "${id}" level "${level.id}" is missing selection_count for CHOSEN payload.`)
            : undefined,
          senseIds: authoringModeKind === 'SELECTED'
            ? senseIds
            : undefined
        }
      })
    },
    restrictions: root.restriction_id
      ? requireLinkedRecord(restrictions, `Sense grant "${id}" is linked to missing restriction facet "${root.restriction_id}".`)
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

    async findAll() {
      const rows = await db
        .selectFrom('sense_grants')
        .select('id')
        .orderBy('sort_order')
        .execute()

      const records = await Promise.all(rows.map((row) => hydrateSenseGrantById(db, row.id)))
      return records.filter((record): record is SenseGrantAuthored => record !== null)
    }
  }
}
