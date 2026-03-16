import {
  SPELL_GRANT_ATTRIBUTE,
  type SpellGrantAuthored
} from '@artificer-toolkit/shared'
import type { DBLike } from '../types/index.js'
import { upsertSpellGrant } from '../domains/grants/upserts/spell.js'
import { hydrateFacetById } from '../domains/shared/facets.js'
import { hydrateChargeById } from './grant-helpers.js'
import type { SpellGrantRepository } from './contracts.js'

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

function requireLinkedRecord<T>(
  value: T | null | undefined,
  message: string
): T {
  if (value == null) {
    throw new Error(message)
  }

  return value
}

function requireSpellGrantAttribute(
  grantId: string,
  value: string
): NonNullable<SpellGrantAuthored['attributes']>[number] {
  if (!(value in SPELL_GRANT_ATTRIBUTE)) {
    throw new Error(`Spell grant "${grantId}" has invalid attribute_code "${value}".`)
  }

  return value as NonNullable<SpellGrantAuthored['attributes']>[number]
}

function requireSpellGrantApplicability(
  grantId: string,
  attributes: NonNullable<SpellGrantAuthored['attributes']>[number][] | undefined,
  charge: unknown,
  castAtLevel: number | undefined
) {
  const attributeSet = new Set(attributes ?? [])

  if (charge && !attributeSet.has('LIMITED_USE')) {
    throw new Error(`Spell grant "${grantId}" cannot hydrate charges without LIMITED_USE in attributes.`)
  }

  if (castAtLevel != null && !attributeSet.has('CAST_AT_LEVEL')) {
    throw new Error(`Spell grant "${grantId}" cannot hydrate castAtLevel without CAST_AT_LEVEL in attributes.`)
  }
}

async function hydrateSpellGrantById(
  db: DBLike,
  id: string
): Promise<SpellGrantAuthored | null> {
  const root = await db
    .selectFrom('spell_grants')
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
      'filter_id',
      'cast_at_level'
    ])
    .where('id', '=', id)
    .executeTakeFirst()

  if (!root) return null

  const [attributeRows, rootSpells, scalingLevels, scalingLevelSpells, charge, restrictions, filters] = await Promise.all([
    db.selectFrom('spell_grant_attributes')
      .select(['attribute_code', 'sort_order'])
      .where('spell_grant_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('spell_grant_spells')
      .select(['spell_grant_id', 'spell_id'])
      .where('spell_grant_id', '=', id)
      .execute(),
    db.selectFrom('spell_grant_scaling_levels')
      .select(['id', 'spell_grant_id', 'level', 'sort_order', 'authoring_mode_kind', 'selection_count'])
      .where('spell_grant_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('spell_grant_scaling_level_spells')
      .select(['scaling_level_id', 'spell_id'])
      .execute(),
    root.charge_id ? hydrateChargeById(db, root.charge_id) : Promise.resolve(null),
    root.restriction_id ? hydrateFacetById(db, root.restriction_id) : Promise.resolve(null),
    root.filter_id ? hydrateFacetById(db, root.filter_id) : Promise.resolve(null)
  ]) 

  const spellsByLevel = new Map<string, string[]>()
  for (const row of scalingLevelSpells) {
    spellsByLevel.set(row.scaling_level_id, [
      ...(spellsByLevel.get(row.scaling_level_id) ?? []),
      row.spell_id
    ])
  }

  const base = {
    id: root.id,
    grantKind: 'SPELL_GRANT' as const,
    order: root.sort_order,
    castAtLevel: root.cast_at_level ?? undefined,
    charges: charge ?? undefined,
    attributes: attributeRows.length > 0
      ? attributeRows.map((attribute) => requireSpellGrantAttribute(id, attribute.attribute_code))
      : undefined
  }
  requireSpellGrantApplicability(id, base.attributes, base.charges, base.castAtLevel)
  const scalingKind = requireScalingKind(root.scaling_kind, `Spell grant "${id}" has invalid scaling_kind "${root.scaling_kind}".`)

  if (scalingKind === 'NONE') {
    const selectionKind = requireSelectionKind(root.selection_kind, `Spell grant "${id}" has invalid selection_kind "${root.selection_kind}".`)
    if (selectionKind === 'GRANTED') {
      requireNoGrantedCount(root.selection_count, `Spell grant "${id}" cannot hydrate selection_count for GRANTED payload.`)
    }
    const authoringModeKind = requireAuthoringModeKind(root.authoring_mode_kind, `Spell grant "${id}" has invalid authoring_mode_kind "${root.authoring_mode_kind}".`)
    if (authoringModeKind === 'ALL') {
      requireNoUnexpectedSelectedIds(
        rootSpells.map((row) => row.spell_id),
        `Spell grant "${id}" cannot hydrate spellIds when authoring_mode_kind is ALL.`
      )
    }

    return {
      ...base,
      selectionKind,
      scalingKind: 'NONE',
      authoringModeKind,
      count: root.selection_kind === 'CHOSEN'
        ? requireChosenCount(root.selection_count, `Spell grant "${id}" is missing selection_count for CHOSEN payload.`)
        : undefined,
      spellIds: authoringModeKind === 'SELECTED'
        ? rootSpells.map((row) => row.spell_id)
        : undefined,
      restrictions: root.restriction_id
        ? requireLinkedRecord(restrictions, `Spell grant "${id}" is linked to missing restriction facet "${root.restriction_id}".`)
        : undefined,
      filters: root.filter_id
        ? requireLinkedRecord(filters, `Spell grant "${id}" is linked to missing filter facet "${root.filter_id}".`)
        : undefined
    } as SpellGrantAuthored
  }

  return {
    ...base,
    selectionKind: (() => {
      const selectionKind = requireSelectionKind(root.selection_kind, `Spell grant "${id}" has invalid selection_kind "${root.selection_kind}".`)
      if (selectionKind === 'GRANTED') {
        for (const level of scalingLevels) {
          requireNoGrantedCount(
            level.selection_count,
            `Spell grant "${id}" level "${level.id}" cannot hydrate selection_count for GRANTED payload.`
          )
        }
      }
      return selectionKind
    })(),
    scalingKind,
      progression: {
        scalingSource: requireScalingSource(root.scaling_source, `Spell grant "${id}" is missing or has invalid scaling_source.`),
      classId: root.scaling_source === 'CLASS_LEVEL'
        ? requireProgressionClassId(root.class_id, `Spell grant "${id}" is missing class_id for CLASS_LEVEL progression.`)
        : undefined,
      levels: scalingLevels.map((level) => {
        const authoringModeKind = requireAuthoringModeKind(level.authoring_mode_kind, `Spell grant "${id}" level "${level.id}" has invalid authoring_mode_kind "${level.authoring_mode_kind}".`)
        const spellIds = spellsByLevel.get(level.id) ?? []
        if (authoringModeKind === 'ALL') {
          requireNoUnexpectedSelectedIds(
            spellIds,
            `Spell grant "${id}" level "${level.id}" cannot hydrate spellIds when authoring_mode_kind is ALL.`
          )
        }

        return {
          id: level.id,
          level: level.level,
          order: level.sort_order,
          authoringModeKind,
          count: root.selection_kind === 'CHOSEN'
            ? requireChosenCount(level.selection_count, `Spell grant "${id}" level "${level.id}" is missing selection_count for CHOSEN payload.`)
            : undefined,
          spellIds: authoringModeKind === 'SELECTED'
            ? spellIds
            : undefined
        }
      })
    },
    restrictions: root.restriction_id
      ? requireLinkedRecord(restrictions, `Spell grant "${id}" is linked to missing restriction facet "${root.restriction_id}".`)
      : undefined,
    filters: root.filter_id
      ? requireLinkedRecord(filters, `Spell grant "${id}" is linked to missing filter facet "${root.filter_id}".`)
      : undefined
  } as SpellGrantAuthored
}

export function createSpellGrantRepository(db: DBLike): SpellGrantRepository {
  return {
    async upsert(entity) {
      await upsertSpellGrant(db, entity)
    },

    async findById(id) {
      return hydrateSpellGrantById(db, id)
    },

    async findAll() {
      const rows = await db
        .selectFrom('spell_grants')
        .select('id')
        .orderBy('sort_order')
        .execute()

      const records = await Promise.all(rows.map((row) => hydrateSpellGrantById(db, row.id)))
      return records.filter((record): record is SpellGrantAuthored => record !== null)
    }
  }
}
