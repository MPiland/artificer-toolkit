import {
  ABILITY_CODE,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  type ProficiencyGrantAuthored
} from '@artificer-toolkit/shared'
import type { DBLike } from '#types'
import { upsertProficiencyGrant } from '../upserts/proficiency.js'
import { hydrateFacetById } from '../../shared/facets.js'
import type { ProficiencyGrantRepository } from '../../../repositories/contracts.js'

function requireLinkedRecord<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
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

function requireProficiencyLevel(
  value: string,
  message: string
): 'FULL' | 'HALF' | 'DOUBLE' {
  if (value !== 'FULL' && value !== 'HALF' && value !== 'DOUBLE') {
    throw new Error(message)
  }

  return value
}

function requireAbilityCode(
  value: string,
  message: string
): keyof typeof ABILITY_CODE {
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

function requireEquipmentPropertyCodes(
  grantId: string,
  values: string[]
): string[] {
  for (const value of values) {
    if (!(value in EQUIPMENT_PROPERTY_CODE)) {
      throw new Error(`Proficiency grant "${grantId}" has invalid property_code "${value}".`)
    }
  }

  return values
}

function requireNoPersistedSelectedValues(
  grantId: string,
  values: unknown[],
  field: string
): void {
  if (values.length > 0) {
    throw new Error(`Proficiency grant "${grantId}" cannot hydrate ${field} when authoring_mode_kind is ALL.`)
  }
}

function requireNoGrantedCount(
  grantId: string,
  count: number | null
) {
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

async function hydrateProficiencyGrantById(
  db: DBLike,
  id: string
): Promise<ProficiencyGrantAuthored | null> {
  const root = await db
    .selectFrom('proficiency_grants')
    .select([
      'id',
      'sort_order',
      'proficiency_kind',
      'selection_kind',
      'authoring_mode_kind',
      'count',
      'level',
      'rounding',
      'restriction_id'
    ])
    .where('id', '=', id)
    .executeTakeFirst()

  if (!root) return null

  const [
    skills,
    saveAbilities,
    languages,
    equipment,
    equipmentFilters,
    equipmentFilterProperties,
    equipmentProperties,
    equipmentPropertyFilters,
    restrictions
  ] = await Promise.all([
    db.selectFrom('proficiency_grant_skills')
      .select(['proficiency_grant_id', 'skill_id'])
      .where('proficiency_grant_id', '=', id)
      .execute(),
    db.selectFrom('proficiency_grant_save_abilities')
      .select(['proficiency_grant_id', 'ability_code'])
      .where('proficiency_grant_id', '=', id)
      .execute(),
    db.selectFrom('proficiency_grant_languages')
      .select(['proficiency_grant_id', 'language_id'])
      .where('proficiency_grant_id', '=', id)
      .execute(),
    db.selectFrom('proficiency_grant_equipment')
      .select(['proficiency_grant_id', 'equipment_id'])
      .where('proficiency_grant_id', '=', id)
      .execute(),
    db.selectFrom('proficiency_grant_equipment_filters')
      .select(['proficiency_grant_id', 'category_code'])
      .where('proficiency_grant_id', '=', id)
      .executeTakeFirst(),
    db.selectFrom('proficiency_grant_equipment_filter_properties')
      .select(['proficiency_grant_id', 'property_code'])
      .where('proficiency_grant_id', '=', id)
      .execute(),
    db.selectFrom('proficiency_grant_equipment_properties')
      .select(['proficiency_grant_id', 'property_code'])
      .where('proficiency_grant_id', '=', id)
      .execute(),
    db.selectFrom('proficiency_grant_equipment_property_filters')
      .select(['proficiency_grant_id', 'category_code'])
      .where('proficiency_grant_id', '=', id)
      .executeTakeFirst(),
    root.restriction_id ? hydrateFacetById(db, root.restriction_id) : Promise.resolve(null)
  ])

  const equipmentFilterPropertyCodes = equipmentFilterProperties.map((row) => row.property_code)
  const equipmentPropertyCodes = equipmentProperties.map((row) => row.property_code)
  const selectionKind = requireSelectionKind(root.selection_kind, `Proficiency grant "${id}" has invalid selection_kind "${root.selection_kind}".`)
  const authoringModeKind = requireAuthoringModeKind(root.authoring_mode_kind, `Proficiency grant "${id}" has invalid authoring_mode_kind "${root.authoring_mode_kind}".`)
  const level = requireProficiencyLevel(root.level, `Proficiency grant "${id}" has invalid level "${root.level}".`)

  if (selectionKind === 'CHOSEN' && root.count == null) {
    throw new Error(`Proficiency grant "${id}" is missing count for CHOSEN payload.`)
  }

  if (selectionKind === 'GRANTED') {
    requireNoGrantedCount(id, root.count)
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
    authoringModeKind,
    level,
    rounding: root.rounding ?? undefined,
    count: selectionKind === 'CHOSEN' ? root.count : undefined
  }

  switch (root.proficiency_kind) {
    case 'SKILL':
      if (base.authoringModeKind === 'ALL') {
        requireNoPersistedSelectedValues(id, skills, 'skillIds')
      }
      return {
        ...base,
        proficiencyKind: 'SKILL',
        skillIds: base.authoringModeKind === 'SELECTED'
          ? skills.map((row) => row.skill_id)
          : undefined,
        restrictions: root.restriction_id
          ? requireLinkedRecord(restrictions, `Proficiency grant "${id}" is linked to missing restriction facet "${root.restriction_id}".`)
          : undefined
      } as ProficiencyGrantAuthored

    case 'SAVE_ABILITY':
      if (base.authoringModeKind === 'ALL') {
        requireNoPersistedSelectedValues(id, saveAbilities, 'abilities')
      }
      return {
        ...base,
        proficiencyKind: 'SAVE_ABILITY',
        abilities: base.authoringModeKind === 'SELECTED'
          ? saveAbilities.map((row) => requireAbilityCode(
              row.ability_code,
              `Proficiency grant "${id}" has invalid ability_code "${row.ability_code}".`
            ))
          : undefined,
        restrictions: root.restriction_id
          ? requireLinkedRecord(restrictions, `Proficiency grant "${id}" is linked to missing restriction facet "${root.restriction_id}".`)
          : undefined
      } as ProficiencyGrantAuthored

    case 'LANGUAGE':
      if (base.authoringModeKind === 'ALL') {
        requireNoPersistedSelectedValues(id, languages, 'languageIds')
      }
      return {
        ...base,
        proficiencyKind: 'LANGUAGE',
        languageIds: base.authoringModeKind === 'SELECTED'
          ? languages.map((row) => row.language_id)
          : undefined,
        restrictions: root.restriction_id
          ? requireLinkedRecord(restrictions, `Proficiency grant "${id}" is linked to missing restriction facet "${root.restriction_id}".`)
          : undefined
      } as ProficiencyGrantAuthored

    case 'EQUIPMENT':
      // ALL mode: equipmentIds must be absent, but category and properties are valid extras per Selectable<TSelected, TExtra>
      if (base.authoringModeKind === 'ALL') {
        requireNoPersistedSelectedValues(id, equipment, 'equipmentIds')
      }
      return {
        ...base,
        proficiencyKind: 'EQUIPMENT',
        equipmentIds: base.authoringModeKind === 'SELECTED'
          ? equipment.map((row) => row.equipment_id)
          : undefined,
        category: equipmentFilters?.category_code
          ? requireEquipmentCategoryCode(
              equipmentFilters.category_code,
              `Proficiency grant "${id}" has invalid category_code "${equipmentFilters.category_code}".`
            )
          : undefined,
        properties: equipmentFilterPropertyCodes.length > 0
          ? requireEquipmentPropertyCodes(id, equipmentFilterPropertyCodes)
          : undefined,
        restrictions: root.restriction_id
          ? requireLinkedRecord(restrictions, `Proficiency grant "${id}" is linked to missing restriction facet "${root.restriction_id}".`)
          : undefined
      } as ProficiencyGrantAuthored

    case 'EQUIPMENT_PROPERTY':
      // ALL mode: properties must be absent, but category is a valid extra per Selectable<TSelected, TExtra>
      if (base.authoringModeKind === 'ALL') {
        requireNoPersistedSelectedValues(id, equipmentProperties, 'properties')
      }
      return {
        ...base,
        proficiencyKind: 'EQUIPMENT_PROPERTY',
        properties: base.authoringModeKind === 'SELECTED'
          ? requireEquipmentPropertyCodes(id, equipmentPropertyCodes)
          : undefined,
        category: equipmentPropertyFilters?.category_code
          ? requireEquipmentCategoryCode(
              equipmentPropertyFilters.category_code,
              `Proficiency grant "${id}" has invalid category_code "${equipmentPropertyFilters.category_code}".`
            )
          : undefined,
        restrictions: root.restriction_id
          ? requireLinkedRecord(restrictions, `Proficiency grant "${id}" is linked to missing restriction facet "${root.restriction_id}".`)
          : undefined
      } as ProficiencyGrantAuthored

    default:
      throw new Error(`Proficiency grant "${id}" has invalid proficiency_kind "${root.proficiency_kind}".`)
  }
}

export function createProficiencyGrantRepository(db: DBLike): ProficiencyGrantRepository {
  return {
    async upsert(entity) {
      await upsertProficiencyGrant(db, entity)
    },

    async findById(id) {
      return hydrateProficiencyGrantById(db, id)
    },

    async findAll() {
      const rows = await db
        .selectFrom('proficiency_grants')
        .select('id')
        .orderBy('sort_order')
        .execute()

      const records = await Promise.all(rows.map((row) => hydrateProficiencyGrantById(db, row.id)))
      return records.filter((record): record is ProficiencyGrantAuthored => record !== null)
    }
  }
}
