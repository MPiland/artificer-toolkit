import type { DBLike } from '#types'
import { createHash } from 'node:crypto'
import {
  AUTHORING_MODE_KIND,
  DURATION_KIND,
  RANGE_KIND,
  type FacetAuthored,
  type FacetBodyAuthored,
  type FacetConditionAuthored,
  type NodeSubjectCode,
  type PredicateConditionAuthored
} from '@artificer-toolkit/shared'
import { withTransaction } from '../../utils/index.js'
import {
  SUBJECT_SELECTION_COLUMNS,
  isSelectableSubjectCode,
  requireAbilityCode,
  requireAuthoringMode,
  requireChargeLimitKind,
  requireChargeResetKind,
  requireCreatureCategory,
  requireDurationKind,
  requireEquipmentCategory,
  requireEquipmentProperty,
  requireLinkedRecord,
  requireMeasurementUnitCode,
  requireNodeSubject,
  requireProficiencyKind,
  requireRangeKind,
  requireRelationTargetSubject,
  requireScalingAmountKind,
  requireSizeCode,
  requireVehicleCategory,
  type SelectionColumn
} from './facetShared.js'

function createDerivedUuid(baseId: string, purpose: string): string {
  const hex = createHash('sha256').update(`${baseId}:${purpose}`).digest('hex')
  const variant = ((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${variant}${hex.slice(18, 20)}`,
    hex.slice(20, 32)
  ].join('-')
}

function getContextBodyId(facetId: string, contextId: string): string {
  return createDerivedUuid(`${facetId}:${contextId}`, 'facet-body')
}

function getContextBodyGroupId(facetId: string, contextId: string): string {
  return createDerivedUuid(`${facetId}:${contextId}`, 'facet-body-group')
}

function getWhereBodyId(bodyGroupId: string, conditionId: string): string {
  return createDerivedUuid(`${bodyGroupId}:${conditionId}`, 'where-body')
}

function collectAuthoredWhereBodyIds(
  bodyIds: Set<string>,
  bodyGroupId: string,
  condition: FacetConditionAuthored
) {
  if (condition.kind !== 'EXISTS' || !condition.where) {
    return
  }

  bodyIds.add(getWhereBodyId(bodyGroupId, condition.id))

  for (const group of condition.where.groups) {
    for (const childCondition of group.conditions ?? []) {
      collectAuthoredWhereBodyIds(bodyIds, group.id, childCondition)
    }
  }
}

function collectAuthoredFacetBodyIds<N extends NodeSubjectCode>(facet: FacetAuthored<N>): string[] {
  const bodyIds = new Set<string>()

  for (const group of facet.groups) {
    for (const context of group.contexts) {
      const bodyGroupId = getContextBodyGroupId(facet.id, context.id)

      bodyIds.add(getContextBodyId(facet.id, context.id))

      for (const condition of context.conditions ?? []) {
        collectAuthoredWhereBodyIds(bodyIds, bodyGroupId, condition)
      }
    }
  }

  return [...bodyIds]
}

async function replaceSelectionItems(
  db: DBLike,
  table: 'facet_body_selection_items' | 'facet_exists_selection_items',
  ownerColumn: 'facet_body_id' | 'facet_condition_id',
  ownerId: string,
  subject: NodeSubjectCode,
  selection: Record<string, unknown>
): Promise<void> {
  if (!isSelectableSubjectCode(subject)) {
    throw new Error(
      `${table}.${ownerColumn} "${ownerId}" uses unsupported subject selection "${subject}".`
    )
  }

  const config = SUBJECT_SELECTION_COLUMNS[subject]
  const normalizedConfig: SelectionColumn = {
    payloadKey: config.payloadKey,
    column: config.column,
    mode: 'mode' in config ? config.mode : 'many'
  }
  const authoringModeKind = requireAuthoringMode(
    `${table}.${ownerColumn} "${ownerId}"`,
    String(selection.authoringModeKind)
  )

  if (authoringModeKind !== AUTHORING_MODE_KIND.SELECTED) {
    return
  }

  const ids = selection[config.payloadKey]

  if (normalizedConfig.mode === 'single') {
    if (typeof ids !== 'string') {
      throw new Error(
        `${table}.${ownerColumn} "${ownerId}" requires "${normalizedConfig.payloadKey}" for subject "${subject}".`
      )
    }

    await db
      .insertInto(table)
      .values({
        [ownerColumn]: ownerId,
        [normalizedConfig.column]:
          normalizedConfig.payloadKey === 'proficiencyKind'
            ? requireProficiencyKind(`${table}.${ownerColumn} "${ownerId}"`, ids)
            : ids,
        sort_order: 1
      })
      .execute()
    return
  }

  if (!Array.isArray(ids) || ids.some((value) => typeof value !== 'string')) {
    throw new Error(
      `${table}.${ownerColumn} "${ownerId}" requires "${normalizedConfig.payloadKey}" for subject "${subject}".`
    )
  }

  if (ids.length === 0) {
    throw new Error(
      `${table}.${ownerColumn} "${ownerId}" cannot persist an empty selected set for subject "${subject}".`
    )
  }

  await db
    .insertInto(table)
    .values(
      ids.map((id, index) => ({
        [ownerColumn]: ownerId,
        [normalizedConfig.column]: id,
        sort_order: index + 1
      }))
    )
    .execute()
}

async function insertPredicateSelectableHeader(
  db: DBLike,
  condition: Record<string, unknown>
): Promise<void> {
  const authoringModeKind = condition.authoringModeKind

  if (typeof authoringModeKind !== 'string') {
    throw new Error(`Facet condition "${String(condition.id)}" is missing authoringModeKind.`)
  }

  await db
    .insertInto('facet_predicate_selectables')
    .values({
      facet_condition_id: String(condition.id),
      authoring_mode_kind: requireAuthoringMode(
        `facet condition "${String(condition.id)}"`,
        authoringModeKind
      )
    })
    .execute()
}

async function writeAbilityItems(
  db: DBLike,
  conditionId: string,
  abilities: string[]
): Promise<void> {
  if (abilities.length === 0) {
    throw new Error(`Facet condition "${conditionId}" requires at least one ability.`)
  }

  await db
    .insertInto('facet_predicate_ability_items')
    .values(
      abilities.map((ability, index) => ({
        facet_condition_id: conditionId,
        ability_code: requireAbilityCode(`facet condition "${conditionId}"`, ability),
        sort_order: index + 1
      }))
    )
    .execute()
}

async function writeEquipmentPropertyItems(
  db: DBLike,
  conditionId: string,
  properties: string[]
): Promise<void> {
  if (properties.length === 0) {
    throw new Error(`Facet condition "${conditionId}" requires at least one equipment property.`)
  }

  await db
    .insertInto('facet_predicate_equipment_property_items')
    .values(
      properties.map((property, index) => ({
        facet_condition_id: conditionId,
        property_code: requireEquipmentProperty(`facet condition "${conditionId}"`, property),
        sort_order: index + 1
      }))
    )
    .execute()
}

async function writeSizeItems(db: DBLike, conditionId: string, sizes: string[]): Promise<void> {
  if (sizes.length === 0) {
    throw new Error(`Facet condition "${conditionId}" requires at least one size.`)
  }

  await db
    .insertInto('facet_predicate_size_items')
    .values(
      sizes.map((size, index) => ({
        facet_condition_id: conditionId,
        size_code: requireSizeCode(`facet condition "${conditionId}"`, size),
        sort_order: index + 1
      }))
    )
    .execute()
}

async function writeSubclassSpecializationItems(
  db: DBLike,
  conditionId: string,
  specializationIds: string[]
): Promise<void> {
  if (specializationIds.length === 0) {
    throw new Error(`Facet condition "${conditionId}" requires at least one specialization id.`)
  }

  await db
    .insertInto('facet_predicate_subclass_specialization_items')
    .values(
      specializationIds.map((specializationId, index) => ({
        facet_condition_id: conditionId,
        specialization_id: specializationId,
        sort_order: index + 1
      }))
    )
    .execute()
}

async function writeChargeLimitKindItems(
  db: DBLike,
  conditionId: string,
  chargeLimitKinds: string[]
): Promise<void> {
  if (chargeLimitKinds.length === 0) {
    throw new Error(`Facet condition "${conditionId}" requires at least one charge limit kind.`)
  }

  await db
    .insertInto('facet_predicate_charge_limit_kind_items')
    .values(
      chargeLimitKinds.map((chargeLimitKind, index) => ({
        facet_condition_id: conditionId,
        charge_limit_kind: requireChargeLimitKind(
          `facet condition "${conditionId}"`,
          chargeLimitKind
        ),
        sort_order: index + 1
      }))
    )
    .execute()
}

async function writeChargeResetKindItems(
  db: DBLike,
  conditionId: string,
  chargeResetKinds: string[]
): Promise<void> {
  if (chargeResetKinds.length === 0) {
    throw new Error(`Facet condition "${conditionId}" requires at least one charge reset kind.`)
  }

  await db
    .insertInto('facet_predicate_charge_reset_kind_items')
    .values(
      chargeResetKinds.map((chargeResetKind, index) => ({
        facet_condition_id: conditionId,
        charge_reset_kind: requireChargeResetKind(
          `facet condition "${conditionId}"`,
          chargeResetKind
        ),
        sort_order: index + 1
      }))
    )
    .execute()
}

async function writeRangeKindItems(
  db: DBLike,
  conditionId: string,
  rangeKinds: string[]
): Promise<void> {
  if (rangeKinds.length === 0) {
    throw new Error(`Facet condition "${conditionId}" requires at least one range kind.`)
  }

  await db
    .insertInto('facet_predicate_range_kind_items')
    .values(
      rangeKinds.map((rangeKind, index) => ({
        facet_condition_id: conditionId,
        range_kind: requireRangeKind(`facet condition "${conditionId}"`, rangeKind),
        sort_order: index + 1
      }))
    )
    .execute()
}

async function writeDurationKindItems(
  db: DBLike,
  conditionId: string,
  durationKinds: string[]
): Promise<void> {
  if (durationKinds.length === 0) {
    throw new Error(`Facet condition "${conditionId}" requires at least one duration kind.`)
  }

  await db
    .insertInto('facet_predicate_duration_kind_items')
    .values(
      durationKinds.map((durationKind, index) => ({
        facet_condition_id: conditionId,
        duration_kind: requireDurationKind(`facet condition "${conditionId}"`, durationKind),
        sort_order: index + 1
      }))
    )
    .execute()
}

async function writeIdItems(
  db: DBLike,
  table:
    | 'facet_predicate_magic_school_items'
    | 'facet_predicate_skill_items'
    | 'facet_predicate_language_items'
    | 'facet_predicate_damage_type_items'
    | 'facet_predicate_condition_type_items'
    | 'facet_predicate_spell_items'
    | 'facet_predicate_feat_items'
    | 'facet_predicate_class_items'
    | 'facet_predicate_heritage_items'
    | 'facet_predicate_feature_items'
    | 'facet_predicate_option_items'
    | 'facet_predicate_equipment_items',
  column:
    | 'magic_school_id'
    | 'skill_id'
    | 'language_id'
    | 'damage_type_id'
    | 'condition_type_id'
    | 'spell_id'
    | 'feat_id'
    | 'class_id'
    | 'heritage_id'
    | 'feature_id'
    | 'option_id'
    | 'equipment_id',
  conditionId: string,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) {
    throw new Error(`Facet condition "${conditionId}" requires at least one "${column}".`)
  }

  await db
    .insertInto(table)
    .values(
      ids.map((id, index) => ({
        facet_condition_id: conditionId,
        [column]: id,
        sort_order: index + 1
      }))
    )
    .execute()
}

async function writeTextItems(
  db: DBLike,
  table: 'facet_predicate_creature_category_items' | 'facet_predicate_vehicle_category_items',
  column: 'category_code',
  conditionId: string,
  values: string[]
): Promise<void> {
  if (values.length === 0) {
    throw new Error(`Facet condition "${conditionId}" requires at least one "${column}".`)
  }

  await db
    .insertInto(table)
    .values(
      values.map((value: string, index: number) => ({
        facet_condition_id: conditionId,
        [column]: value,
        sort_order: index + 1
      }))
    )
    .execute()
}

async function writePredicatePayload(
  db: DBLike,
  condition: PredicateConditionAuthored
): Promise<void> {
  const conditionId = condition.id

  switch (condition.predicateCode) {
    case 'CLASS_LEVEL':
      await db
        .insertInto('facet_predicate_numeric_ranges')
        .values({
          facet_condition_id: conditionId,
          min_value: condition.min,
          max_value: condition.max ?? null
        })
        .execute()
      await writeIdItems(
        db,
        'facet_predicate_class_items',
        'class_id',
        conditionId,
        condition.classIds
      )
      return

    case 'CHARACTER_LEVEL':
    case 'SPELL_LEVEL':
    case 'SAVING_THROW_DC':
    case 'ARMOR_CLASS':
      await db
        .insertInto('facet_predicate_numeric_ranges')
        .values({
          facet_condition_id: conditionId,
          min_value: condition.min,
          max_value: condition.max ?? null
        })
        .execute()
      return

    case 'FEATURE_OBTAINED':
      await writeIdItems(
        db,
        'facet_predicate_feature_items',
        'feature_id',
        conditionId,
        condition.featureIds
      )
      return

    case 'SUBCLASS_SPECIALIZATION':
      await insertPredicateSelectableHeader(db, condition)
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeSubclassSpecializationItems(db, conditionId, condition.specializationIds)
      }
      return

    case 'OPTION_OBTAINED':
      await writeIdItems(
        db,
        'facet_predicate_option_items',
        'option_id',
        conditionId,
        condition.optionIds
      )
      if (condition.featureIds && condition.featureIds.length > 0) {
        await writeIdItems(
          db,
          'facet_predicate_feature_items',
          'feature_id',
          conditionId,
          condition.featureIds
        )
      }
      return

    case 'SPELL_OBTAINED':
      await writeIdItems(
        db,
        'facet_predicate_spell_items',
        'spell_id',
        conditionId,
        condition.spellIds
      )
      return

    case 'FEAT_OBTAINED':
      await writeIdItems(
        db,
        'facet_predicate_feat_items',
        'feat_id',
        conditionId,
        condition.featIds
      )
      return

    case 'HERITAGE':
      await insertPredicateSelectableHeader(db, condition)
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeIdItems(
          db,
          'facet_predicate_heritage_items',
          'heritage_id',
          conditionId,
          condition.heritageIds
        )
      }
      return

    case 'SPELLCASTING':
    case 'CONCENTRATION':
    case 'RITUAL':
    case 'CAN_CAST_SPELL':
    case 'WHILE_SOURCE_CARRIED':
    case 'WHILE_SOURCE_EQUIPPED':
    case 'WHILE_SOURCE_ATTUNED':
      return

    case 'SIZE':
      await insertPredicateSelectableHeader(db, condition)
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeSizeItems(db, conditionId, condition.sizes)
      }
      return

    case 'RANGE': {
      await insertPredicateSelectableHeader(db, condition)

      const distancePayload = condition as { min?: number; max?: number; unit?: string }
      const isSelected = condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
      const selectedRangeKinds = isSelected
        ? (() => {
            if (
              !Array.isArray(condition.rangeKind) ||
              condition.rangeKind.some((value) => typeof value !== 'string')
            ) {
              throw new Error(
                `Facet condition "${conditionId}" requires "rangeKind" to be a string array.`
              )
            }

            if (condition.rangeKind.length === 0) {
              throw new Error(`Facet condition "${conditionId}" requires at least one range kind.`)
            }

            return condition.rangeKind.map((rangeKind) =>
              requireRangeKind(`facet condition "${conditionId}"`, rangeKind)
            )
          })()
        : []
      const includesDistance = selectedRangeKinds.includes(RANGE_KIND.DISTANCE)

      if (includesDistance && selectedRangeKinds.length !== 1) {
        throw new Error(
          `Facet condition "${conditionId}" cannot mix DISTANCE with other range kinds.`
        )
      }

      if (includesDistance || !isSelected) {
        if (typeof distancePayload.min !== 'number') {
          throw new Error(`Facet condition "${conditionId}" requires min for DISTANCE range.`)
        }

        if (typeof distancePayload.unit !== 'string') {
          throw new Error(`Facet condition "${conditionId}" requires unit for DISTANCE range.`)
        }
      } else if (
        distancePayload.min != null ||
        distancePayload.max != null ||
        distancePayload.unit != null
      ) {
        throw new Error(
          `Facet condition "${conditionId}" can only persist min/max/unit for DISTANCE range.`
        )
      }

      if (isSelected) {
        await writeRangeKindItems(db, conditionId, selectedRangeKinds)
      }

      if (includesDistance || !isSelected) {
        await db
          .insertInto('facet_predicate_ranges')
          .values({
            facet_condition_id: conditionId,
            range_kind: includesDistance ? RANGE_KIND.DISTANCE : null,
            min_distance: distancePayload.min ?? null,
            max_distance: distancePayload.max ?? null,
            unit_code: requireMeasurementUnitCode(
              `facet condition "${conditionId}"`,
              distancePayload.unit ?? ''
            )
          })
          .execute()
      }
      return
    }

    case 'DURATION': {
      await insertPredicateSelectableHeader(db, condition)

      const timedPayload = condition as { min?: number; max?: number }
      const isSelected = condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
      const selectedDurationKinds = isSelected
        ? (() => {
            if (
              !Array.isArray(condition.durationKind) ||
              condition.durationKind.some((value) => typeof value !== 'string')
            ) {
              throw new Error(
                `Facet condition "${conditionId}" requires "durationKind" to be a string array.`
              )
            }

            if (condition.durationKind.length === 0) {
              throw new Error(
                `Facet condition "${conditionId}" requires at least one duration kind.`
              )
            }

            return condition.durationKind.map((durationKind) =>
              requireDurationKind(`facet condition "${conditionId}"`, durationKind)
            )
          })()
        : []
      const includesInstantaneous = selectedDurationKinds.includes(DURATION_KIND.INSTANTANEOUS)

      if (includesInstantaneous && selectedDurationKinds.length !== 1) {
        throw new Error(
          `Facet condition "${conditionId}" cannot mix INSTANTANEOUS with timed duration kinds.`
        )
      }

      if (includesInstantaneous) {
        if (timedPayload.min != null || timedPayload.max != null) {
          throw new Error(
            `Facet condition "${conditionId}" cannot persist min/max for INSTANTANEOUS duration.`
          )
        }
      } else if (typeof timedPayload.min !== 'number') {
        throw new Error(`Facet condition "${conditionId}" requires min for timed duration.`)
      }

      if (isSelected) {
        await writeDurationKindItems(db, conditionId, selectedDurationKinds)
      }

      if (!includesInstantaneous) {
        await db
          .insertInto('facet_predicate_durations')
          .values({
            facet_condition_id: conditionId,
            duration_kind: isSelected ? null : null,
            min_amount: timedPayload.min ?? null,
            max_amount: timedPayload.max ?? null
          })
          .execute()
      }
      return
    }

    case 'MAGIC_SCHOOL':
      await insertPredicateSelectableHeader(db, condition)
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeIdItems(
          db,
          'facet_predicate_magic_school_items',
          'magic_school_id',
          conditionId,
          condition.magicSchoolIds
        )
      }
      return

    case 'SPELLCASTING_ABILITY':
    case 'SAVING_THROW_ABILITY':
      await insertPredicateSelectableHeader(db, condition)
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeAbilityItems(db, conditionId, condition.abilities)
      }
      return

    case 'ABILITY_SCORE':
      await insertPredicateSelectableHeader(db, condition)
      await db
        .insertInto('facet_predicate_numeric_ranges')
        .values({
          facet_condition_id: conditionId,
          min_value: condition.min,
          max_value: condition.max ?? null
        })
        .execute()
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeAbilityItems(db, conditionId, [condition.abilities])
      }
      return

    case 'SAVING_THROW_ABILITY_BONUS':
      await insertPredicateSelectableHeader(db, condition)
      await db
        .insertInto('facet_predicate_numeric_ranges')
        .values({
          facet_condition_id: conditionId,
          min_value: condition.min,
          max_value: condition.max ?? null
        })
        .execute()
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeAbilityItems(db, conditionId, [condition.abilities])
      }
      return

    case 'SAVE_ABILITY_PROFICIENCY':
      await insertPredicateSelectableHeader(db, condition)
      await db
        .insertInto('facet_predicate_proficiency_levels')
        .values({
          facet_condition_id: conditionId,
          proficiency_level: requireScalingAmountKind(
            `facet condition "${conditionId}"`,
            condition.level
          )
        })
        .execute()
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeAbilityItems(db, conditionId, [condition.abilities])
      }
      return

    case 'EQUIPMENT_CATEGORY':
      await db
        .insertInto('facet_predicate_equipment_categories')
        .values({
          facet_condition_id: conditionId,
          category_code: requireEquipmentCategory(
            `facet condition "${conditionId}"`,
            condition.category
          )
        })
        .execute()
      return

    case 'EQUIPMENT_PROPERTY':
      await insertPredicateSelectableHeader(db, condition)
      if (condition.category) {
        await db
          .insertInto('facet_predicate_equipment_categories')
          .values({
            facet_condition_id: conditionId,
            category_code: requireEquipmentCategory(
              `facet condition "${conditionId}"`,
              condition.category
            )
          })
          .execute()
      }
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeEquipmentPropertyItems(db, conditionId, condition.properties)
      }
      return

    case 'EQUIPMENT_PROFICIENCY':
      await insertPredicateSelectableHeader(db, condition)
      await db
        .insertInto('facet_predicate_proficiency_levels')
        .values({
          facet_condition_id: conditionId,
          proficiency_level: requireScalingAmountKind(
            `facet condition "${conditionId}"`,
            condition.level
          )
        })
        .execute()
      if (condition.category) {
        await db
          .insertInto('facet_predicate_equipment_categories')
          .values({
            facet_condition_id: conditionId,
            category_code: requireEquipmentCategory(
              `facet condition "${conditionId}"`,
              condition.category
            )
          })
          .execute()
      }
      if (condition.properties && condition.properties.length > 0) {
        await writeEquipmentPropertyItems(db, conditionId, condition.properties)
      }
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeIdItems(
          db,
          'facet_predicate_equipment_items',
          'equipment_id',
          conditionId,
          condition.equipmentIds
        )
      }
      return

    case 'EQUIPMENT_PROPERTY_PROFICIENCY':
      await insertPredicateSelectableHeader(db, condition)
      if (condition.category) {
        await db
          .insertInto('facet_predicate_equipment_categories')
          .values({
            facet_condition_id: conditionId,
            category_code: requireEquipmentCategory(
              `facet condition "${conditionId}"`,
              condition.category
            )
          })
          .execute()
      }
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeEquipmentPropertyItems(db, conditionId, condition.properties)
      }
      return

    case 'EQUIPMENT_EQUIPPED':
      await insertPredicateSelectableHeader(db, condition)
      if (condition.category) {
        await db
          .insertInto('facet_predicate_equipment_categories')
          .values({
            facet_condition_id: conditionId,
            category_code: requireEquipmentCategory(
              `facet condition "${conditionId}"`,
              condition.category
            )
          })
          .execute()
      }
      if (condition.properties && condition.properties.length > 0) {
        await writeEquipmentPropertyItems(db, conditionId, condition.properties)
      }
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeIdItems(
          db,
          'facet_predicate_equipment_items',
          'equipment_id',
          conditionId,
          condition.equipmentIds
        )
      }
      return

    case 'DAMAGE_TYPE':
      await insertPredicateSelectableHeader(db, condition)
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeIdItems(
          db,
          'facet_predicate_damage_type_items',
          'damage_type_id',
          conditionId,
          condition.damageTypeIds
        )
      }
      return

    case 'CONDITION_TYPE':
      await insertPredicateSelectableHeader(db, condition)
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeIdItems(
          db,
          'facet_predicate_condition_type_items',
          'condition_type_id',
          conditionId,
          condition.conditionTypeIds
        )
      }
      return

    case 'CHARGE_LIMIT_KIND':
      await insertPredicateSelectableHeader(db, condition)
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeChargeLimitKindItems(db, conditionId, condition.chargeLimitKind)
      }
      return

    case 'CHARGE_RESET_KIND':
      await insertPredicateSelectableHeader(db, condition)
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeChargeResetKindItems(db, conditionId, condition.chargeResetKind)
      }
      return

    case 'SKILL_PROFICIENCY':
      await insertPredicateSelectableHeader(db, condition)
      await db
        .insertInto('facet_predicate_proficiency_levels')
        .values({
          facet_condition_id: conditionId,
          proficiency_level: requireScalingAmountKind(
            `facet condition "${conditionId}"`,
            condition.level
          )
        })
        .execute()
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeIdItems(
          db,
          'facet_predicate_skill_items',
          'skill_id',
          conditionId,
          condition.skillIds
        )
      }
      return

    case 'SKILL_SCORE':
      await insertPredicateSelectableHeader(db, condition)
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeIdItems(
          db,
          'facet_predicate_skill_items',
          'skill_id',
          conditionId,
          condition.skillIds
        )
      }
      return

    case 'LANGUAGE_PROFICIENCY':
      await insertPredicateSelectableHeader(db, condition)
      await db
        .insertInto('facet_predicate_proficiency_levels')
        .values({
          facet_condition_id: conditionId,
          proficiency_level: requireScalingAmountKind(
            `facet condition "${conditionId}"`,
            condition.level
          )
        })
        .execute()
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeIdItems(
          db,
          'facet_predicate_language_items',
          'language_id',
          conditionId,
          condition.languageIds
        )
      }
      return

    case 'CREATURE_CATEGORY':
      await insertPredicateSelectableHeader(db, condition)
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeTextItems(
          db,
          'facet_predicate_creature_category_items',
          'category_code',
          conditionId,
          condition.categories.map((value) =>
            requireCreatureCategory(`facet condition "${conditionId}"`, value)
          )
        )
      }
      return

    case 'CREATURE_TYPE':
      await insertPredicateSelectableHeader(db, condition)
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await db
          .insertInto('facet_predicate_creature_type_items')
          .values(
            condition.creatureTypeIds.map((creatureTypeId: string, index: number) => ({
              facet_condition_id: conditionId,
              creature_type_id: creatureTypeId,
              sort_order: index + 1
            }))
          )
          .execute()
      }
      return

    case 'CREATURE_SIZE':
    case 'VEHICLE_SIZE':
      await insertPredicateSelectableHeader(db, condition)
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeSizeItems(db, conditionId, condition.sizes)
      }
      return

    case 'VEHICLE_CATEGORY':
      await insertPredicateSelectableHeader(db, condition)
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeTextItems(
          db,
          'facet_predicate_vehicle_category_items',
          'category_code',
          conditionId,
          condition.categories.map((value) =>
            requireVehicleCategory(`facet condition "${conditionId}"`, value)
          )
        )
      }
      return

    case 'CREATURE_IS_MOUNT':
    case 'CREATURE_IS_COMPANION':
      return

    default:
      throw new Error(
        `Facet condition "${conditionId}" uses an unsupported predicate for typed persistence.`
      )
  }
}

async function writeBody(
  db: DBLike,
  bodyId: string,
  subject: NodeSubjectCode,
  body: FacetBodyAuthored
): Promise<void> {
  await db
    .insertInto('facet_bodies')
    .values({
      id: bodyId,
      node_subject_code: subject
    })
    .execute()

  await db
    .insertInto('facet_body_selections')
    .values({
      facet_body_id: bodyId,
      authoring_mode_kind: requireAuthoringMode(
        `facet body "${bodyId}"`,
        String(body.authoringModeKind)
      )
    })
    .execute()

  await replaceSelectionItems(
    db,
    'facet_body_selection_items',
    'facet_body_id',
    bodyId,
    subject,
    body as Record<string, unknown>
  )

  for (const group of body.groups) {
    await db
      .insertInto('facet_body_groups')
      .values({
        id: group.id,
        facet_body_id: bodyId,
        sort_order: group.order
      })
      .execute()

    for (const condition of group.conditions ?? []) {
      await writeCondition(db, group.id, subject, condition)
    }
  }
}

async function writeCondition(
  db: DBLike,
  bodyGroupId: string,
  subject: NodeSubjectCode,
  condition: FacetConditionAuthored
): Promise<void> {
  if (condition.kind === 'EXISTS') {
    const whereBodyId = condition.where ? getWhereBodyId(bodyGroupId, condition.id) : null

    await db
      .insertInto('facet_conditions')
      .values({
        id: condition.id,
        facet_body_group_id: bodyGroupId,
        kind: condition.kind,
        constraint_code: condition.constraint,
        sort_order: condition.order,
        relation_code: condition.relationCode,
        predicate_code: null,
        where_facet_body_id: whereBodyId
      })
      .execute()

    await db
      .insertInto('facet_exists_selections')
      .values({
        facet_condition_id: condition.id,
        authoring_mode_kind: requireAuthoringMode(
          `facet exists condition "${condition.id}"`,
          condition.authoringModeKind
        )
      })
      .execute()

    const targetSubject = requireRelationTargetSubject(
      `facet exists condition "${condition.id}"`,
      subject,
      condition.relationCode
    )

    await replaceSelectionItems(
      db,
      'facet_exists_selection_items',
      'facet_condition_id',
      condition.id,
      targetSubject,
      condition as Record<string, unknown>
    )

    if (condition.where) {
      await writeBody(
        db,
        requireLinkedRecord(whereBodyId, 'Missing where body id.'),
        targetSubject,
        condition.where
      )
    }

    return
  }

  await db
    .insertInto('facet_conditions')
    .values({
      id: condition.id,
      facet_body_group_id: bodyGroupId,
      kind: condition.kind,
      constraint_code: condition.constraint,
      sort_order: condition.order,
      predicate_code: condition.predicateCode,
      relation_code: null,
      where_facet_body_id: null
    })
    .execute()

  await writePredicatePayload(db, condition)
}

async function collectFacetBodyIds(db: DBLike, facetId: string): Promise<string[]> {
  const bodyIds = new Set<string>()
  const contextBodyRows = await db
    .selectFrom('facet_groups')
    .innerJoin('facet_contexts', 'facet_contexts.facet_group_id', 'facet_groups.id')
    .innerJoin('facet_context_bodies', 'facet_context_bodies.facet_context_id', 'facet_contexts.id')
    .select('facet_context_bodies.facet_body_id as id')
    .where('facet_groups.facet_id', '=', facetId)
    .execute()

  for (const row of contextBodyRows) {
    bodyIds.add(row.id)
  }

  let pendingBodyIds = [...bodyIds]
  while (pendingBodyIds.length > 0) {
    const whereBodyRows = await db
      .selectFrom('facet_body_groups')
      .innerJoin('facet_conditions', 'facet_conditions.facet_body_group_id', 'facet_body_groups.id')
      .select('facet_conditions.where_facet_body_id as id')
      .where('facet_body_groups.facet_body_id', 'in', pendingBodyIds)
      .where('facet_conditions.where_facet_body_id', 'is not', null)
      .execute()

    pendingBodyIds = []
    for (const row of whereBodyRows) {
      if (row.id && !bodyIds.has(row.id)) {
        bodyIds.add(row.id)
        pendingBodyIds.push(row.id)
      }
    }
  }

  return [...bodyIds]
}

async function deleteExistingFacetGraph(db: DBLike, facetId: string): Promise<void> {
  const bodyIds = await collectFacetBodyIds(db, facetId)

  await db.deleteFrom('facets').where('id', '=', facetId).execute()

  if (bodyIds.length > 0) {
    await db.deleteFrom('facet_bodies').where('id', 'in', bodyIds).execute()
  }
}

async function persistFacet<N extends NodeSubjectCode = NodeSubjectCode>(
  db: DBLike,
  facet: FacetAuthored<N>
): Promise<void> {
  await deleteExistingFacetGraph(db, facet.id)

  const authoredBodyIds = collectAuthoredFacetBodyIds(facet)

  if (authoredBodyIds.length > 0) {
    await db.deleteFrom('facet_bodies').where('id', 'in', authoredBodyIds).execute()
  }

  await db
    .insertInto('facets')
    .values({
      id: facet.id
    })
    .execute()

  for (const group of facet.groups) {
    await db
      .insertInto('facet_groups')
      .values({
        id: group.id,
        facet_id: facet.id,
        sort_order: group.order
      })
      .execute()

    for (const context of group.contexts) {
      const subject = requireNodeSubject(`facet context "${context.id}"`, context.subject)
      const bodyId = getContextBodyId(facet.id, context.id)
      const bodyGroupId = getContextBodyGroupId(facet.id, context.id)

      await db
        .insertInto('facet_contexts')
        .values({
          id: context.id,
          facet_group_id: group.id,
          node_subject_code: subject,
          sort_order: context.order
        })
        .execute()

      await db
        .insertInto('facet_bodies')
        .values({
          id: bodyId,
          node_subject_code: subject
        })
        .execute()

      await db
        .insertInto('facet_context_bodies')
        .values({
          facet_context_id: context.id,
          facet_body_id: bodyId
        })
        .execute()

      if (subject !== 'CHARACTER') {
        await db
          .insertInto('facet_body_selections')
          .values({
            facet_body_id: bodyId,
            authoring_mode_kind: requireAuthoringMode(
              `facet context "${context.id}"`,
              String((context as Record<string, unknown>).authoringModeKind)
            )
          })
          .execute()

        await replaceSelectionItems(
          db,
          'facet_body_selection_items',
          'facet_body_id',
          bodyId,
          subject,
          context as Record<string, unknown>
        )
      }

      await db
        .insertInto('facet_body_groups')
        .values({
          id: bodyGroupId,
          facet_body_id: bodyId,
          sort_order: 1
        })
        .execute()

      for (const condition of context.conditions ?? []) {
        await writeCondition(db, bodyGroupId, subject, condition)
      }
    }
  }
}

export async function upsertFacet<N extends NodeSubjectCode = NodeSubjectCode>(
  db: DBLike,
  facet: FacetAuthored<N>
): Promise<void> {
  return withTransaction(db, (trx) => persistFacet(trx, facet))
}
