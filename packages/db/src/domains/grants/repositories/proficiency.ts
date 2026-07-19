import {
  ABILITY_CODE,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  type ProficiencyGrantAuthored
} from '@artificer-toolkit/shared'
import type { DBLike } from '#types'
import { upsertProficiencyGrant } from '../upserts/proficiency.js'
import { hydrateFacetById } from '../../shared/facets.js'
import { requireNoSelectionDuplicatePolicy, requireSelectionDuplicatePolicy } from './helpers.js'
import type { ProficiencyGrantRepository } from '../../../repositories/contracts.js'
import { hydrateByIds, orderedHydratedRecords, uniqueIds } from '../../../repositories/batch.js'

type ProficiencyGrantRow = {
  id: string
  sort_order: number
  proficiency_kind: string
  selection_kind: string
  authoring_mode_kind: string
  count: number | null
  selection_duplicate_policy: string | null
  level: string
  rounding: string | null
  restriction_id: string | null
}

type ProficiencyGrantSkillRow = {
  proficiency_grant_id: string
  skill_id: string
}

type ProficiencyGrantSaveAbilityRow = {
  proficiency_grant_id: string
  ability_code: string
  sort_order: number
}

type ProficiencyGrantLanguageRow = {
  proficiency_grant_id: string
  language_id: string
}

type ProficiencyGrantEquipmentRow = {
  proficiency_grant_id: string
  equipment_id: string
}

type ProficiencyGrantCategoryFilterRow = {
  proficiency_grant_id: string
  category_code: string
}

type ProficiencyGrantPropertyRow = {
  proficiency_grant_id: string
  property_code: string
}

type ProficiencyGrantRows = {
  equipment: readonly ProficiencyGrantEquipmentRow[]
  equipmentFilterProperties: readonly ProficiencyGrantPropertyRow[]
  equipmentFilters: ProficiencyGrantCategoryFilterRow | undefined
  equipmentProperties: readonly ProficiencyGrantPropertyRow[]
  equipmentPropertyFilters: ProficiencyGrantCategoryFilterRow | undefined
  languages: readonly ProficiencyGrantLanguageRow[]
  restriction: ProficiencyGrantAuthored['restrictions'] | null
  saveAbilities: readonly ProficiencyGrantSaveAbilityRow[]
  skills: readonly ProficiencyGrantSkillRow[]
}

function requireLinkedRecord<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
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

function requireProficiencyLevel(value: string, message: string): 'FULL' | 'HALF' | 'DOUBLE' {
  if (value !== 'FULL' && value !== 'HALF' && value !== 'DOUBLE') {
    throw new Error(message)
  }

  return value
}

function requireAbilityCode(value: string, message: string): keyof typeof ABILITY_CODE {
  if (!(value in ABILITY_CODE)) {
    throw new Error(message)
  }

  return value as keyof typeof ABILITY_CODE
}

function requireEquipmentCategoryCode(
  value: string,
  message: string
): keyof typeof EQUIPMENT_CATEGORY_CODE {
  if (!(value in EQUIPMENT_CATEGORY_CODE)) {
    throw new Error(message)
  }

  return value as keyof typeof EQUIPMENT_CATEGORY_CODE
}

function requireEquipmentPropertyCodes(grantId: string, values: string[]): string[] {
  for (const value of values) {
    if (!(value in EQUIPMENT_PROPERTY_CODE)) {
      throw new Error(`Proficiency grant "${grantId}" has invalid property_code "${value}".`)
    }
  }

  return values
}

function requireNoPersistedSelectedValues(
  grantId: string,
  values: readonly unknown[],
  field: string
): void {
  if (values.length > 0) {
    throw new Error(
      `Proficiency grant "${grantId}" cannot hydrate ${field} when authoring_mode_kind is ALL.`
    )
  }
}

function requireNoGrantedCount(grantId: string, count: number | null) {
  if (count != null) {
    throw new Error(`Proficiency grant "${grantId}" cannot hydrate count for GRANTED payload.`)
  }
}

function requireNoUnexpectedRounding(
  grantId: string,
  rounding: string | null | undefined,
  level: 'FULL' | 'HALF' | 'DOUBLE'
) {
  if (level !== 'HALF' && rounding != null) {
    throw new Error(`Proficiency grant "${grantId}" cannot hydrate rounding for ${level} level.`)
  }
}

function groupByGrantId<T extends { proficiency_grant_id: string }>(
  rows: readonly T[]
): Map<string, T[]> {
  const rowsByGrantId = new Map<string, T[]>()

  for (const row of rows) {
    rowsByGrantId.set(row.proficiency_grant_id, [
      ...(rowsByGrantId.get(row.proficiency_grant_id) ?? []),
      row
    ])
  }

  return rowsByGrantId
}

function firstByGrantId<T extends { proficiency_grant_id: string }>(
  rows: readonly T[]
): Map<string, T> {
  const rowsByGrantId = new Map<string, T>()

  for (const row of rows) {
    if (!rowsByGrantId.has(row.proficiency_grant_id)) {
      rowsByGrantId.set(row.proficiency_grant_id, row)
    }
  }

  return rowsByGrantId
}

function orderedGrantRows(
  rows: readonly ProficiencyGrantRow[],
  ids: readonly string[]
): ProficiencyGrantRow[] {
  const rowsById = new Map(rows.map((row) => [row.id, row]))

  return ids.flatMap((id) => {
    const row = rowsById.get(id)
    return row ? [row] : []
  })
}

function buildProficiencyGrant(
  root: ProficiencyGrantRow,
  rows: ProficiencyGrantRows
): ProficiencyGrantAuthored {
  const id = root.id
  const equipmentFilterPropertyCodes = rows.equipmentFilterProperties.map(
    (row) => row.property_code
  )
  const equipmentPropertyCodes = rows.equipmentProperties.map((row) => row.property_code)
  const selectionKind = requireSelectionKind(
    root.selection_kind,
    `Proficiency grant "${id}" has invalid selection_kind "${root.selection_kind}".`
  )
  const authoringModeKind = requireAuthoringModeKind(
    root.authoring_mode_kind,
    `Proficiency grant "${id}" has invalid authoring_mode_kind "${root.authoring_mode_kind}".`
  )
  const level = requireProficiencyLevel(
    root.level,
    `Proficiency grant "${id}" has invalid level "${root.level}".`
  )

  if (selectionKind === 'CHOSEN' && root.count == null) {
    throw new Error(`Proficiency grant "${id}" is missing count for CHOSEN payload.`)
  }

  if (selectionKind === 'GRANTED') {
    requireNoGrantedCount(id, root.count)
    requireNoSelectionDuplicatePolicy(`Proficiency grant "${id}"`, root.selection_duplicate_policy)
  }

  if (level === 'HALF' && !root.rounding) {
    throw new Error(`Proficiency grant "${id}" is missing rounding for HALF level.`)
  }

  requireNoUnexpectedRounding(id, root.rounding, level)

  const base = {
    id: root.id,
    grantKind: 'PROFICIENCY_GRANT' as const,
    proficiencyKind: root.proficiency_kind as ProficiencyGrantAuthored['proficiencyKind'],
    order: root.sort_order,
    selectionKind,
    scalingKind: 'NONE' as const,
    authoringModeKind,
    level,
    rounding: root.rounding ?? undefined,
    count: selectionKind === 'CHOSEN' ? root.count : undefined,
    selectionDuplicatePolicy:
      selectionKind === 'CHOSEN'
        ? requireSelectionDuplicatePolicy(
            `Proficiency grant "${id}"`,
            root.selection_duplicate_policy
          )
        : undefined
  }
  const restrictions = root.restriction_id
    ? requireLinkedRecord(
        rows.restriction,
        `Proficiency grant "${id}" is linked to missing restriction facet "${root.restriction_id}".`
      )
    : undefined

  switch (root.proficiency_kind) {
    case 'SKILL':
      if (base.authoringModeKind === 'ALL') {
        requireNoPersistedSelectedValues(id, rows.skills, 'skillIds')
      }
      return {
        ...base,
        proficiencyKind: 'SKILL',
        skillIds:
          base.authoringModeKind === 'SELECTED'
            ? rows.skills.map((row) => row.skill_id)
            : undefined,
        restrictions
      } as ProficiencyGrantAuthored

    case 'SAVE_ABILITY':
      if (base.authoringModeKind === 'ALL') {
        requireNoPersistedSelectedValues(id, rows.saveAbilities, 'abilities')
      }
      return {
        ...base,
        proficiencyKind: 'SAVE_ABILITY',
        abilities:
          base.authoringModeKind === 'SELECTED'
            ? rows.saveAbilities.map((row) =>
                requireAbilityCode(
                  row.ability_code,
                  `Proficiency grant "${id}" has invalid ability_code "${row.ability_code}".`
                )
              )
            : undefined,
        restrictions
      } as ProficiencyGrantAuthored

    case 'LANGUAGE':
      if (base.authoringModeKind === 'ALL') {
        requireNoPersistedSelectedValues(id, rows.languages, 'languageIds')
      }
      return {
        ...base,
        proficiencyKind: 'LANGUAGE',
        languageIds:
          base.authoringModeKind === 'SELECTED'
            ? rows.languages.map((row) => row.language_id)
            : undefined,
        restrictions
      } as ProficiencyGrantAuthored

    case 'EQUIPMENT':
      // ALL mode: equipmentIds must be absent, but category and properties are valid extras per Selectable<TSelected, TExtra>
      if (base.authoringModeKind === 'ALL') {
        requireNoPersistedSelectedValues(id, rows.equipment, 'equipmentIds')
      }
      return {
        ...base,
        proficiencyKind: 'EQUIPMENT',
        equipmentIds:
          base.authoringModeKind === 'SELECTED'
            ? rows.equipment.map((row) => row.equipment_id)
            : undefined,
        category: rows.equipmentFilters?.category_code
          ? requireEquipmentCategoryCode(
              rows.equipmentFilters.category_code,
              `Proficiency grant "${id}" has invalid category_code "${rows.equipmentFilters.category_code}".`
            )
          : undefined,
        properties:
          equipmentFilterPropertyCodes.length > 0
            ? requireEquipmentPropertyCodes(id, equipmentFilterPropertyCodes)
            : undefined,
        restrictions
      } as ProficiencyGrantAuthored

    case 'EQUIPMENT_PROPERTY':
      // ALL mode: properties must be absent, but category is a valid extra per Selectable<TSelected, TExtra>
      if (base.authoringModeKind === 'ALL') {
        requireNoPersistedSelectedValues(id, rows.equipmentProperties, 'properties')
      }
      return {
        ...base,
        proficiencyKind: 'EQUIPMENT_PROPERTY',
        properties:
          base.authoringModeKind === 'SELECTED'
            ? requireEquipmentPropertyCodes(id, equipmentPropertyCodes)
            : undefined,
        category: rows.equipmentPropertyFilters?.category_code
          ? requireEquipmentCategoryCode(
              rows.equipmentPropertyFilters.category_code,
              `Proficiency grant "${id}" has invalid category_code "${rows.equipmentPropertyFilters.category_code}".`
            )
          : undefined,
        restrictions
      } as ProficiencyGrantAuthored

    default:
      throw new Error(
        `Proficiency grant "${id}" has invalid proficiency_kind "${root.proficiency_kind}".`
      )
  }
}

async function hydrateProficiencyGrantsByIds(
  db: DBLike,
  ids: readonly string[]
): Promise<Map<string, ProficiencyGrantAuthored>> {
  const distinctIds = uniqueIds(ids)
  if (distinctIds.length === 0) {
    return new Map()
  }

  const roots = (await db
    .selectFrom('proficiency_grants')
    .select([
      'id',
      'sort_order',
      'proficiency_kind',
      'selection_kind',
      'authoring_mode_kind',
      'count',
      'selection_duplicate_policy',
      'level',
      'rounding',
      'restriction_id'
    ])
    .where('id', 'in', distinctIds)
    .execute()) as ProficiencyGrantRow[]

  const grantIds = roots.map((row) => row.id)
  if (grantIds.length === 0) {
    return new Map()
  }

  const [
    skills,
    saveAbilities,
    languages,
    equipment,
    equipmentFilters,
    equipmentFilterProperties,
    equipmentProperties,
    equipmentPropertyFilters,
    restrictionsById
  ] = await Promise.all([
    db
      .selectFrom('proficiency_grant_skills')
      .select(['proficiency_grant_id', 'skill_id'])
      .where('proficiency_grant_id', 'in', grantIds)
      .execute() as Promise<ProficiencyGrantSkillRow[]>,
    db
      .selectFrom('proficiency_grant_save_abilities')
      .select(['proficiency_grant_id', 'ability_code', 'sort_order'])
      .where('proficiency_grant_id', 'in', grantIds)
      .orderBy('sort_order')
      .execute() as Promise<ProficiencyGrantSaveAbilityRow[]>,
    db
      .selectFrom('proficiency_grant_languages')
      .select(['proficiency_grant_id', 'language_id'])
      .where('proficiency_grant_id', 'in', grantIds)
      .orderBy('proficiency_grant_id')
      .orderBy('language_id')
      .execute() as Promise<ProficiencyGrantLanguageRow[]>,
    db
      .selectFrom('proficiency_grant_equipment')
      .select(['proficiency_grant_id', 'equipment_id'])
      .where('proficiency_grant_id', 'in', grantIds)
      .execute() as Promise<ProficiencyGrantEquipmentRow[]>,
    db
      .selectFrom('proficiency_grant_equipment_filters')
      .select(['proficiency_grant_id', 'category_code'])
      .where('proficiency_grant_id', 'in', grantIds)
      .execute() as Promise<ProficiencyGrantCategoryFilterRow[]>,
    db
      .selectFrom('proficiency_grant_equipment_filter_properties')
      .select(['proficiency_grant_id', 'property_code'])
      .where('proficiency_grant_id', 'in', grantIds)
      .execute() as Promise<ProficiencyGrantPropertyRow[]>,
    db
      .selectFrom('proficiency_grant_equipment_properties')
      .select(['proficiency_grant_id', 'property_code'])
      .where('proficiency_grant_id', 'in', grantIds)
      .execute() as Promise<ProficiencyGrantPropertyRow[]>,
    db
      .selectFrom('proficiency_grant_equipment_property_filters')
      .select(['proficiency_grant_id', 'category_code'])
      .where('proficiency_grant_id', 'in', grantIds)
      .execute() as Promise<ProficiencyGrantCategoryFilterRow[]>,
    hydrateByIds(
      roots.flatMap((root) => (root.restriction_id ? [root.restriction_id] : [])),
      (restrictionId) => hydrateFacetById(db, restrictionId)
    )
  ])

  const skillsByGrantId = groupByGrantId(skills)
  const saveAbilitiesByGrantId = groupByGrantId(saveAbilities)
  const languagesByGrantId = groupByGrantId(languages)
  const equipmentByGrantId = groupByGrantId(equipment)
  const equipmentFiltersByGrantId = firstByGrantId(equipmentFilters)
  const equipmentFilterPropertiesByGrantId = groupByGrantId(equipmentFilterProperties)
  const equipmentPropertiesByGrantId = groupByGrantId(equipmentProperties)
  const equipmentPropertyFiltersByGrantId = firstByGrantId(equipmentPropertyFilters)
  const grantsById = new Map<string, ProficiencyGrantAuthored>()

  for (const root of orderedGrantRows(roots, distinctIds)) {
    grantsById.set(
      root.id,
      buildProficiencyGrant(root, {
        equipment: equipmentByGrantId.get(root.id) ?? [],
        equipmentFilterProperties: equipmentFilterPropertiesByGrantId.get(root.id) ?? [],
        equipmentFilters: equipmentFiltersByGrantId.get(root.id),
        equipmentProperties: equipmentPropertiesByGrantId.get(root.id) ?? [],
        equipmentPropertyFilters: equipmentPropertyFiltersByGrantId.get(root.id),
        languages: languagesByGrantId.get(root.id) ?? [],
        restriction: root.restriction_id
          ? (restrictionsById.get(root.restriction_id) ?? null)
          : null,
        saveAbilities: saveAbilitiesByGrantId.get(root.id) ?? [],
        skills: skillsByGrantId.get(root.id) ?? []
      })
    )
  }

  return grantsById
}

async function hydrateProficiencyGrantById(
  db: DBLike,
  id: string
): Promise<ProficiencyGrantAuthored | null> {
  const grantsById = await hydrateProficiencyGrantsByIds(db, [id])
  return grantsById.get(id) ?? null
}

export function createProficiencyGrantRepository(db: DBLike): ProficiencyGrantRepository {
  return {
    async upsert(entity) {
      await upsertProficiencyGrant(db, entity)
    },

    async findById(id) {
      return hydrateProficiencyGrantById(db, id)
    },

    async findByIds(ids) {
      return hydrateProficiencyGrantsByIds(db, ids)
    },

    async findAll() {
      const rows = await db
        .selectFrom('proficiency_grants')
        .select('id')
        .orderBy('sort_order')
        .execute()

      return orderedHydratedRecords(
        rows.map((row) => row.id),
        await hydrateProficiencyGrantsByIds(
          db,
          rows.map((row) => row.id)
        )
      )
    }
  }
}
