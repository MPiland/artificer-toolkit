import type { DBLike } from '#types'
import {
  ABILITY_CODE,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  type ProficiencyGrantAuthored
} from '@artificer-toolkit/shared'
import { upsertFacet } from '../../shared/facets.js'

type ProficiencyGrantRow = {
  id: string
  sort_order: number
  proficiency_kind: string
  selection_kind: string
  authoring_mode_kind: string
  count: number | null
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
}

type ProficiencyGrantLanguageRow = {
  proficiency_grant_id: string
  language_id: string
}

type ProficiencyGrantEquipmentRow = {
  proficiency_grant_id: string
  equipment_id: string
}

type ProficiencyGrantEquipmentFilterRow = {
  proficiency_grant_id: string
  category_code: string | null
}

type ProficiencyGrantEquipmentFilterPropertyRow = {
  proficiency_grant_id: string
  property_code: string
}

type ProficiencyGrantEquipmentPropertyRow = {
  proficiency_grant_id: string
  property_code: string
}

type ProficiencyGrantEquipmentPropertyFilterRow = {
  proficiency_grant_id: string
  category_code: string | null
}

type EquipmentProficiencyGrant = Extract<
  ProficiencyGrantAuthored,
  { proficiencyKind: 'EQUIPMENT' }
>

type EquipmentPropertyProficiencyGrant = Extract<
  ProficiencyGrantAuthored,
  { proficiencyKind: 'EQUIPMENT_PROPERTY' }
>

function requireChosenCount(
  grantId: string,
  count: number | undefined
): number {
  if (count == null) {
    throw new Error(`Proficiency grant "${grantId}" is missing count for CHOSEN payload.`)
  }

  return count
}

function rejectGrantedCount(
  grantId: string,
  count: number | undefined
) {
  if (count == null) {
    return
  }

  throw new Error(`Proficiency grant "${grantId}" cannot persist count for GRANTED payload.`)
}

function requireHalfRounding(
  grantId: string,
  rounding: string | undefined
): string {
  if (!rounding) {
    throw new Error(`Proficiency grant "${grantId}" is missing rounding for HALF level.`)
  }

  return rounding
}

function rejectNonHalfRounding(
  grantId: string,
  rounding: string | undefined,
  level: string
) {
  if (!rounding) {
    return
  }

  throw new Error(`Proficiency grant "${grantId}" cannot persist rounding for ${level} level.`)
}

function requireSelectedValues<T>(
  grantId: string,
  values: T[] | undefined,
  field: string
): T[] {
  if (!values) {
    throw new Error(`Proficiency grant "${grantId}" is missing ${field} for SELECTED payload.`)
  }

  return values
}

function requireAbsentSelectedValues(
  grantId: string,
  values: unknown[] | undefined,
  field: string
): void {
  if (values && values.length > 0) {
    throw new Error(`Proficiency grant "${grantId}" cannot persist ${field} when authoringModeKind is ALL.`)
  }
}

function requireAbilityCode(
  grantId: string,
  value: string
): string {
  if (!(value in ABILITY_CODE)) {
    throw new Error(`Proficiency grant "${grantId}" has invalid ability code "${value}".`)
  }

  return value
}

function requireEquipmentCategoryCode(
  grantId: string,
  value: string
): string {
  if (!(value in EQUIPMENT_CATEGORY_CODE)) {
    throw new Error(`Proficiency grant "${grantId}" has invalid category code "${value}".`)
  }

  return value
}

function requireEquipmentPropertyCode(
  grantId: string,
  value: string
): string {
  if (!(value in EQUIPMENT_PROPERTY_CODE)) {
    throw new Error(`Proficiency grant "${grantId}" has invalid property code "${value}".`)
  }

  return value
}

function mapProficiencyGrantRow(json_data: ProficiencyGrantAuthored): ProficiencyGrantRow {
  if (json_data.selectionKind !== 'CHOSEN' && 'count' in json_data) {
    rejectGrantedCount(json_data.id, (json_data as { count?: number }).count)
  }

  if (json_data.level !== 'HALF' && 'rounding' in json_data) {
    rejectNonHalfRounding(json_data.id, (json_data as { rounding?: string }).rounding, json_data.level)
  }

  return {
    id: json_data.id,
    sort_order: json_data.order,
    proficiency_kind: json_data.proficiencyKind,
    selection_kind: json_data.selectionKind,
    authoring_mode_kind: json_data.authoringModeKind ?? 'ALL',
    count: json_data.selectionKind === 'CHOSEN'
      ? requireChosenCount(json_data.id, json_data.count)
      : null,
    level: json_data.level,
    rounding: json_data.level === 'HALF'
      ? requireHalfRounding(json_data.id, json_data.rounding)
      : null,
    restriction_id: json_data.restrictions?.id ?? null
  }
}

export async function upsertProficiencyGrant(
  db: DBLike,
  json_data: ProficiencyGrantAuthored
) {
  const root = mapProficiencyGrantRow(json_data)
  let skillRows: ProficiencyGrantSkillRow[] = []
  let saveAbilityRows: ProficiencyGrantSaveAbilityRow[] = []
  let languageRows: ProficiencyGrantLanguageRow[] = []
  let equipmentRows: ProficiencyGrantEquipmentRow[] = []
  let equipmentFilterRow: ProficiencyGrantEquipmentFilterRow | null = null
  let equipmentFilterPropertyRows: ProficiencyGrantEquipmentFilterPropertyRow[] = []
  let equipmentPropertyRows: ProficiencyGrantEquipmentPropertyRow[] = []
  let equipmentPropertyFilterRow: ProficiencyGrantEquipmentPropertyFilterRow | null = null

  switch (json_data.proficiencyKind) {
    case 'SKILL': {
      if (json_data.authoringModeKind === 'SELECTED') {
        skillRows = requireSelectedValues(json_data.id, json_data.skillIds, 'skillIds').map((skillId) => ({
          proficiency_grant_id: json_data.id,
          skill_id: skillId
        }))
      } else {
        requireAbsentSelectedValues(json_data.id, ('skillIds' in json_data ? json_data.skillIds : undefined) as string[] | undefined, 'skillIds')
      }
      break
    }

    case 'SAVE_ABILITY': {
      if (json_data.authoringModeKind === 'SELECTED') {
        saveAbilityRows = requireSelectedValues(json_data.id, json_data.abilities, 'abilities').map((ability) => ({
          proficiency_grant_id: json_data.id,
          ability_code: requireAbilityCode(json_data.id, ability)
        }))
      } else {
        requireAbsentSelectedValues(json_data.id, ('abilities' in json_data ? json_data.abilities : undefined) as string[] | undefined, 'abilities')
      }
      break
    }

    case 'LANGUAGE': {
      if (json_data.authoringModeKind === 'SELECTED') {
        languageRows = requireSelectedValues(json_data.id, json_data.languageIds, 'languageIds').map((languageId) => ({
          proficiency_grant_id: json_data.id,
          language_id: languageId
        }))
      } else {
        requireAbsentSelectedValues(json_data.id, ('languageIds' in json_data ? json_data.languageIds : undefined) as string[] | undefined, 'languageIds')
      }
      break
    }

    case 'EQUIPMENT': {
      const equipmentGrant = json_data as EquipmentProficiencyGrant
      const category = 'category' in equipmentGrant
        ? equipmentGrant.category
          ? requireEquipmentCategoryCode(json_data.id, equipmentGrant.category)
          : null
        : null
      const properties = 'properties' in equipmentGrant
        ? (equipmentGrant.properties ?? []).map((property) => requireEquipmentPropertyCode(json_data.id, property))
        : []

      if (equipmentGrant.authoringModeKind === 'SELECTED') {
        equipmentRows = requireSelectedValues(json_data.id, equipmentGrant.equipmentIds, 'equipmentIds').map((equipmentId) => ({
          proficiency_grant_id: json_data.id,
          equipment_id: equipmentId
        }))
      } else {
        // ALL mode: equipmentIds must not be present, but category and properties are valid extras on ALL per Selectable<TSelected, TExtra>
        requireAbsentSelectedValues(json_data.id, ('equipmentIds' in equipmentGrant ? equipmentGrant.equipmentIds : undefined) as string[] | undefined, 'equipmentIds')
      }

      if (category || properties.length > 0) {
        equipmentFilterRow = {
          proficiency_grant_id: json_data.id,
          category_code: category
        }

        equipmentFilterPropertyRows = properties.map((property) => ({
          proficiency_grant_id: json_data.id,
          property_code: property
        }))
      }
      break
    }

    case 'EQUIPMENT_PROPERTY': {
      const equipmentPropertyGrant = json_data as EquipmentPropertyProficiencyGrant
      const category = 'category' in equipmentPropertyGrant
        ? equipmentPropertyGrant.category
          ? requireEquipmentCategoryCode(json_data.id, equipmentPropertyGrant.category)
          : null
        : null

      if (equipmentPropertyGrant.authoringModeKind === 'SELECTED') {
        equipmentPropertyRows = requireSelectedValues(json_data.id, equipmentPropertyGrant.properties, 'properties').map((property) => ({
          proficiency_grant_id: json_data.id,
          property_code: requireEquipmentPropertyCode(json_data.id, property)
        }))
      } else {
        // ALL mode: properties must not be present, but category is a valid extra on ALL per Selectable<TSelected, TExtra>
        requireAbsentSelectedValues(json_data.id, ('properties' in equipmentPropertyGrant ? equipmentPropertyGrant.properties : undefined) as string[] | undefined, 'properties')
      }

      if (category) {
        equipmentPropertyFilterRow = {
          proficiency_grant_id: json_data.id,
          category_code: category
        }
      }
      break
    }

    default: {
      const exhaustive: never = json_data
      return exhaustive
    }
  }

  const trx = await db.startTransaction().execute()

  try {
    const existingGrant = await trx
      .selectFrom('proficiency_grants')
      .select(['restriction_id'])
      .where('id', '=', json_data.id)
      .executeTakeFirst()

    if (existingGrant?.restriction_id && existingGrant.restriction_id !== json_data.restrictions?.id) {
      await trx.deleteFrom('facets').where('id', '=', existingGrant.restriction_id)
        .execute()
    }

    if (json_data.restrictions) {
      await upsertFacet(trx, json_data.restrictions)
    }

    await trx
      .insertInto('proficiency_grants')
      .values(root)
      .onConflict((oc) => oc.column('id').doUpdateSet(({ ref }) => ({
        sort_order: ref('excluded.sort_order'),
        proficiency_kind: ref('excluded.proficiency_kind'),
        selection_kind: ref('excluded.selection_kind'),
        authoring_mode_kind: ref('excluded.authoring_mode_kind'),
        count: ref('excluded.count'),
        level: ref('excluded.level'),
        rounding: ref('excluded.rounding'),
        restriction_id: ref('excluded.restriction_id')
      })))
      .execute()

    await trx
      .deleteFrom('proficiency_grant_skills')
      .where('proficiency_grant_id', '=', json_data.id)
      .execute()

    await trx
      .deleteFrom('proficiency_grant_save_abilities')
      .where('proficiency_grant_id', '=', json_data.id)
      .execute()

    await trx
      .deleteFrom('proficiency_grant_languages')
      .where('proficiency_grant_id', '=', json_data.id)
      .execute()

    await trx
      .deleteFrom('proficiency_grant_equipment')
      .where('proficiency_grant_id', '=', json_data.id)
      .execute()

    await trx
      .deleteFrom('proficiency_grant_equipment_filter_properties')
      .where('proficiency_grant_id', '=', json_data.id)
      .execute()

    await trx
      .deleteFrom('proficiency_grant_equipment_filters')
      .where('proficiency_grant_id', '=', json_data.id)
      .execute()

    await trx
      .deleteFrom('proficiency_grant_equipment_properties')
      .where('proficiency_grant_id', '=', json_data.id)
      .execute()

    await trx
      .deleteFrom('proficiency_grant_equipment_property_filters')
      .where('proficiency_grant_id', '=', json_data.id)
      .execute()

    if (skillRows.length > 0) {
      await trx
        .insertInto('proficiency_grant_skills')
        .values(skillRows)
        .execute()
    }

    if (saveAbilityRows.length > 0) {
      await trx
        .insertInto('proficiency_grant_save_abilities')
        .values(saveAbilityRows)
        .execute()
    }

    if (languageRows.length > 0) {
      await trx
        .insertInto('proficiency_grant_languages')
        .values(languageRows)
        .execute()
    }

    if (equipmentRows.length > 0) {
      await trx
        .insertInto('proficiency_grant_equipment')
        .values(equipmentRows)
        .execute()
    }

    if (equipmentFilterRow) {
      await trx
        .insertInto('proficiency_grant_equipment_filters')
        .values(equipmentFilterRow)
        .execute()
    }

    if (equipmentFilterPropertyRows.length > 0) {
      await trx
        .insertInto('proficiency_grant_equipment_filter_properties')
        .values(equipmentFilterPropertyRows)
        .execute()
    }

    if (equipmentPropertyRows.length > 0) {
      await trx
        .insertInto('proficiency_grant_equipment_properties')
        .values(equipmentPropertyRows)
        .execute()
    }

    if (equipmentPropertyFilterRow) {
      await trx
        .insertInto('proficiency_grant_equipment_property_filters')
        .values(equipmentPropertyFilterRow)
        .execute()
    }

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
