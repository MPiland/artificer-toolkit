import type { DBLike } from '#types'
import { withTransaction } from '../../../utils/index.js'
import { SPELL_GRANT_ATTRIBUTE, type SpellGrantAuthored } from '@artificer-toolkit/shared'
import { upsertFacet } from '../../shared/facets.js'
import { upsertCharge } from '../../shared/upserts/charge.js'
import {
  requireNoSelectionDuplicatePolicy,
  requireSelectionDuplicatePolicy
} from '../repositories/helpers.js'

type SpellGrantRootRow = {
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
  filter_id: string | null
  cast_at_level: number | null
  casting_ability_code: string | null
}

type SpellGrantScalingLevelRow = {
  id: string
  spell_grant_id: string
  level: number
  sort_order: number
  authoring_mode_kind: string
  selection_count: number | null
  selection_duplicate_policy: string | null
}

type SpellGrantScalingLevelSpellRow = {
  scaling_level_id: string
  spell_id: string
  sort_order: number
}

type SpellGrantAttributeRow = {
  spell_grant_id: string
  attribute_code: string
  sort_order: number
}

type SpellGrantPerLevel = Extract<SpellGrantAuthored, { scalingKind: 'PER_LEVEL' }>
type SpellGrantProgression = {
  scalingSource: string
  classId?: string
  levels: {
    id: string
    level: number
    order: number
    authoringModeKind: string
    spellIds?: string[]
    count?: number
    selectionDuplicatePolicy?: string
  }[]
}

function requireSpellGrantAttribute(
  grantId: string,
  value: string
): NonNullable<SpellGrantAuthored['attributes']>[number] {
  if (!(value in SPELL_GRANT_ATTRIBUTE)) {
    throw new Error(`Spell grant "${grantId}" has invalid attribute "${value}".`)
  }

  return value as NonNullable<SpellGrantAuthored['attributes']>[number]
}

function hasSpellGrantAttribute(
  json_data: SpellGrantAuthored,
  attribute: NonNullable<SpellGrantAuthored['attributes']>[number]
) {
  return (json_data.attributes ?? []).includes(attribute)
}

function validateSpellGrantApplicability(json_data: SpellGrantAuthored) {
  const charges = 'charges' in json_data ? json_data.charges : undefined

  if (charges && !hasSpellGrantAttribute(json_data, 'LIMITED_USE')) {
    throw new Error(
      `Spell grant "${json_data.id}" cannot persist charges without LIMITED_USE in attributes.`
    )
  }

  if (json_data.castAtLevel != null && !hasSpellGrantAttribute(json_data, 'CAST_AT_LEVEL')) {
    throw new Error(
      `Spell grant "${json_data.id}" cannot persist castAtLevel without CAST_AT_LEVEL in attributes.`
    )
  }
}

function getSpellGrantProgression(json_data: SpellGrantPerLevel): SpellGrantProgression {
  return json_data.progression as SpellGrantProgression
}

function getClassIdForProgression(
  grantId: string,
  progression: SpellGrantProgression
): string | null {
  if (progression.scalingSource !== 'CLASS_LEVEL') {
    return null
  }

  if (!progression.classId) {
    throw new Error(`Spell grant "${grantId}" is missing classId for CLASS_LEVEL progression.`)
  }

  return progression.classId
}

function requireChosenCount(grantId: string, count: number | undefined, scope: string): number {
  if (count == null) {
    const suffix = scope === 'root' ? 'payload' : `level "${scope}" payload`
    throw new Error(`Spell grant "${grantId}" is missing count for CHOSEN ${suffix}.`)
  }

  return count
}

function rejectGrantedCount(grantId: string, count: number | undefined, scope: string) {
  if (count == null) {
    return
  }

  const suffix = scope === 'root' ? 'root payload' : `level "${scope}" payload`
  throw new Error(`Spell grant "${grantId}" cannot persist count for GRANTED ${suffix}.`)
}

function requireSelectedSpellIds(
  grantId: string,
  spellIds: string[] | undefined,
  scope: string
): string[] {
  if (!spellIds) {
    const suffix = scope === 'root' ? 'payload' : `level "${scope}" payload`
    throw new Error(`Spell grant "${grantId}" is missing spellIds for SELECTED ${suffix}.`)
  }

  return spellIds
}

function rejectAllModeSpellIds(grantId: string, spellIds: string[] | undefined, scope: string) {
  if (!spellIds || spellIds.length === 0) {
    return
  }

  const suffix = scope === 'root' ? 'root payload' : `level "${scope}" payload`
  throw new Error(
    `Spell grant "${grantId}" cannot persist spellIds when authoringModeKind is ALL for ${suffix}.`
  )
}

function mapSpellGrantRootRow(
  json_data: SpellGrantAuthored,
  chargeId: string | null
): SpellGrantRootRow {
  if (json_data.selectionKind !== 'CHOSEN' && 'count' in json_data) {
    rejectGrantedCount(json_data.id, (json_data as { count?: number }).count, 'root')
  }

  if (json_data.selectionKind !== 'CHOSEN' && 'selectionDuplicatePolicy' in json_data) {
    requireNoSelectionDuplicatePolicy(
      `Spell grant "${json_data.id}"`,
      (json_data as { selectionDuplicatePolicy?: string }).selectionDuplicatePolicy
    )
  }

  if (json_data.scalingKind === 'PER_LEVEL' && 'selectionDuplicatePolicy' in json_data) {
    requireNoSelectionDuplicatePolicy(
      `Spell grant "${json_data.id}"`,
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
      selection_count:
        json_data.selectionKind === 'CHOSEN'
          ? requireChosenCount(json_data.id, json_data.count, 'root')
          : null,
      selection_duplicate_policy:
        json_data.selectionKind === 'CHOSEN'
          ? requireSelectionDuplicatePolicy(
              `Spell grant "${json_data.id}"`,
              json_data.selectionDuplicatePolicy
            )
          : null,
      scaling_source: null,
      class_id: null,
      charge_id: chargeId,
      restriction_id: json_data.restrictions?.id ?? null,
      filter_id: json_data.filters?.id ?? null,
      cast_at_level: json_data.castAtLevel ?? null,
      casting_ability_code: json_data.castingAbility ?? null
    }
  }

  const progression = getSpellGrantProgression(json_data)

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
    restriction_id: json_data.restrictions?.id ?? null,
    filter_id: json_data.filters?.id ?? null,
    cast_at_level: json_data.castAtLevel ?? null,
    casting_ability_code: json_data.castingAbility ?? null
  }
}

function mapRootSpellRows(json_data: SpellGrantAuthored) {
  if (json_data.scalingKind !== 'NONE') {
    return []
  }

  if (json_data.authoringModeKind !== 'SELECTED') {
    if ('spellIds' in json_data) {
      rejectAllModeSpellIds(json_data.id, (json_data as { spellIds?: string[] }).spellIds, 'root')
    }
    return []
  }

  return requireSelectedSpellIds(json_data.id, json_data.spellIds, 'root').map(
    (spellId, index) => ({
      spell_grant_id: json_data.id,
      spell_id: spellId,
      sort_order: index
    })
  )
}

function mapScalingLevelRows(json_data: SpellGrantAuthored): SpellGrantScalingLevelRow[] {
  if (json_data.scalingKind !== 'PER_LEVEL') return []

  const progression = getSpellGrantProgression(json_data)

  return progression.levels.map((level) => ({
    id: level.id,
    spell_grant_id: json_data.id,
    level: level.level,
    sort_order: level.order,
    authoring_mode_kind: level.authoringModeKind,
    selection_count:
      json_data.selectionKind === 'CHOSEN'
        ? requireChosenCount(json_data.id, level.count, level.id)
        : 'count' in level
          ? (rejectGrantedCount(json_data.id, (level as { count?: number }).count, level.id), null)
          : null,
    selection_duplicate_policy:
      json_data.selectionKind === 'CHOSEN'
        ? requireSelectionDuplicatePolicy(
            `Spell grant "${json_data.id}" level "${level.id}"`,
            level.selectionDuplicatePolicy
          )
        : 'selectionDuplicatePolicy' in level
          ? (requireNoSelectionDuplicatePolicy(
              `Spell grant "${json_data.id}" level "${level.id}"`,
              (level as { selectionDuplicatePolicy?: string }).selectionDuplicatePolicy
            ),
            null)
          : null
  }))
}

function mapScalingLevelSpellRows(json_data: SpellGrantAuthored): SpellGrantScalingLevelSpellRow[] {
  if (json_data.scalingKind !== 'PER_LEVEL') return []

  const progression = getSpellGrantProgression(json_data)

  return progression.levels.flatMap((level) => {
    if (level.authoringModeKind !== 'SELECTED') {
      if ('spellIds' in level) {
        rejectAllModeSpellIds(json_data.id, (level as { spellIds?: string[] }).spellIds, level.id)
      }
      return []
    }

    return requireSelectedSpellIds(json_data.id, level.spellIds, level.id).map(
      (spellId, index) => ({
        scaling_level_id: level.id,
        spell_id: spellId,
        sort_order: index
      })
    )
  })
}

function mapAttributeRows(json_data: SpellGrantAuthored): SpellGrantAttributeRow[] {
  return (json_data.attributes ?? []).map((attribute, index) => ({
    spell_grant_id: json_data.id,
    attribute_code: requireSpellGrantAttribute(json_data.id, attribute),
    sort_order: index + 1
  }))
}

export async function upsertSpellGrant(db: DBLike, json_data: SpellGrantAuthored) {
  validateSpellGrantApplicability(json_data)

  const charges = 'charges' in json_data ? json_data.charges : undefined

  const root = mapSpellGrantRootRow(json_data, charges?.id ?? null)
  const attributes = mapAttributeRows(json_data)
  const rootSpells = mapRootSpellRows(json_data)
  const scalingLevels = mapScalingLevelRows(json_data)
  const scalingLevelSpells = mapScalingLevelSpellRows(json_data)

  return withTransaction(db, async (trx) => {
    const existingGrant = await trx
      .selectFrom('spell_grants')
      .select(['restriction_id', 'filter_id'])
      .where('id', '=', json_data.id)
      .executeTakeFirst()

    if (
      existingGrant?.restriction_id &&
      existingGrant.restriction_id !== json_data.restrictions?.id
    ) {
      await trx.deleteFrom('facets').where('id', '=', existingGrant.restriction_id).execute()
    }

    if (existingGrant?.filter_id && existingGrant.filter_id !== json_data.filters?.id) {
      await trx.deleteFrom('facets').where('id', '=', existingGrant.filter_id).execute()
    }

    if (charges) {
      await upsertCharge(trx, charges)
    }

    if (json_data.restrictions) {
      await upsertFacet(trx, json_data.restrictions)
    }

    if (json_data.filters) {
      await upsertFacet(trx, json_data.filters)
    }

    await trx
      .insertInto('spell_grants')
      .values(root)
      .onConflict((oc) =>
        oc.column('id').doUpdateSet((eb) => ({
          sort_order: eb.ref('excluded.sort_order'),
          selection_kind: eb.ref('excluded.selection_kind'),
          scaling_kind: eb.ref('excluded.scaling_kind'),
          authoring_mode_kind: eb.ref('excluded.authoring_mode_kind'),
          selection_count: eb.ref('excluded.selection_count'),
          selection_duplicate_policy: eb.ref('excluded.selection_duplicate_policy'),
          scaling_source: eb.ref('excluded.scaling_source'),
          class_id: eb.ref('excluded.class_id'),
          charge_id: eb.ref('excluded.charge_id'),
          restriction_id: eb.ref('excluded.restriction_id'),
          filter_id: eb.ref('excluded.filter_id'),
          cast_at_level: eb.ref('excluded.cast_at_level'),
          casting_ability_code: eb.ref('excluded.casting_ability_code')
        }))
      )
      .execute()

    await trx
      .deleteFrom('spell_grant_attributes')
      .where('spell_grant_id', '=', json_data.id)
      .execute()

    await trx.deleteFrom('spell_grant_spells').where('spell_grant_id', '=', json_data.id).execute()

    await trx
      .deleteFrom('spell_grant_scaling_levels')
      .where('spell_grant_id', '=', json_data.id)
      .execute()

    if (rootSpells.length > 0) {
      await trx.insertInto('spell_grant_spells').values(rootSpells).execute()
    }

    if (attributes.length > 0) {
      await trx.insertInto('spell_grant_attributes').values(attributes).execute()
    }

    if (scalingLevels.length > 0) {
      await trx.insertInto('spell_grant_scaling_levels').values(scalingLevels).execute()

      if (scalingLevelSpells.length > 0) {
        await trx
          .insertInto('spell_grant_scaling_level_spells')
          .values(scalingLevelSpells)
          .execute()
      }
    }
  })
}
