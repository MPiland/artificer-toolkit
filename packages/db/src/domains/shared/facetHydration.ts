import type { DBLike } from '#types'
import {
  AUTHORING_MODE_KIND,
  DURATION_KIND,
  RANGE_KIND,
  type FacetAuthored,
  type FacetBodyAuthored,
  type FacetConditionAuthored,
  type FacetContextAuthored,
  type ExistsConditionAuthored,
  type NodeSubjectCode,
  type PredicateConditionAuthored
} from '@artificer-toolkit/shared'
import {
  SUBJECT_SELECTION_COLUMNS,
  isSelectableSubjectCode,
  requireAbilityCode,
  requireAuthoringMode,
  requireChargeLimitKind,
  requireChargeResetKind,
  requireConstraint,
  requireCreatureCategory,
  requireDurationKind,
  requireEquipmentCategory,
  requireEquipmentProperty,
  requireLinkedRecord,
  requireMeasurementUnitCode,
  requireNodeSubject,
  requirePredicateCode,
  requireProficiencyKind,
  requireRangeKind,
  requireRelationTargetSubject,
  requireScalingAmountKind,
  requireSizeCode,
  requireSingleAbility,
  requireVehicleCategory,
  type SelectionColumn
} from './facetShared.js'

type PredicateRow = {
  id: string
  kind: string
  constraint_code: string
  sort_order: number
  predicate_code: string | null
  relation_code: string | null
  where_facet_body_id: string | null
}

async function readSelectionRows(
  db: DBLike,
  table: 'facet_body_selection_items' | 'facet_exists_selection_items',
  ownerColumn: 'facet_body_id' | 'facet_condition_id',
  ownerId: string
) {
  return db
    .selectFrom(table)
    .selectAll()
    .where(ownerColumn, '=', ownerId)
    .orderBy('sort_order')
    .execute()
}

async function hydrateSelection(
  db: DBLike,
  modeTable: 'facet_body_selections' | 'facet_exists_selections',
  itemTable: 'facet_body_selection_items' | 'facet_exists_selection_items',
  ownerColumn: 'facet_body_id' | 'facet_condition_id',
  ownerId: string,
  subject: NodeSubjectCode
): Promise<Record<string, unknown>> {
  const modeRow = await db
    .selectFrom(modeTable)
    .select(['authoring_mode_kind'])
    .where(ownerColumn, '=', ownerId)
    .executeTakeFirst()

  const mode = requireAuthoringMode(
    `${modeTable}.${ownerColumn} "${ownerId}"`,
    requireLinkedRecord(modeRow, `${modeTable}.${ownerColumn} "${ownerId}" is missing.`)
      .authoring_mode_kind
  )

  if (mode === AUTHORING_MODE_KIND.ALL) {
    return { authoringModeKind: mode }
  }

  if (!isSelectableSubjectCode(subject)) {
    throw new Error(
      `${modeTable}.${ownerColumn} "${ownerId}" uses unsupported selected subject "${subject}".`
    )
  }

  const config = SUBJECT_SELECTION_COLUMNS[subject]
  const normalizedConfig: SelectionColumn = {
    payloadKey: config.payloadKey,
    column: config.column,
    mode: 'mode' in config ? config.mode : 'many'
  }
  const rows = await readSelectionRows(db, itemTable, ownerColumn, ownerId)

  if (normalizedConfig.mode === 'single') {
    const value = (rows[0] as Record<string, unknown> | undefined)?.[normalizedConfig.column]

    if (typeof value !== 'string') {
      throw new Error(
        `${itemTable}.${ownerColumn} "${ownerId}" is missing selected value for subject "${subject}".`
      )
    }

    return {
      authoringModeKind: mode,
      [normalizedConfig.payloadKey]:
        normalizedConfig.payloadKey === 'proficiencyKind'
          ? requireProficiencyKind(`${itemTable}.${ownerColumn} "${ownerId}"`, value)
          : value
    }
  }

  const ids = rows
    .map((row) => (row as Record<string, unknown>)[normalizedConfig.column])
    .filter((value): value is string => typeof value === 'string')

  if (ids.length === 0) {
    throw new Error(
      `${itemTable}.${ownerColumn} "${ownerId}" is missing selected ids for subject "${subject}".`
    )
  }

  return {
    authoringModeKind: mode,
    [normalizedConfig.payloadKey]: ids
  }
}

async function hydratePredicateSelectable(
  db: DBLike,
  conditionId: string
): Promise<{
  authoringModeKind: typeof AUTHORING_MODE_KIND.ALL | typeof AUTHORING_MODE_KIND.SELECTED
}> {
  const selectable = requireLinkedRecord(
    await db
      .selectFrom('facet_predicate_selectables')
      .select(['authoring_mode_kind'])
      .where('facet_condition_id', '=', conditionId)
      .executeTakeFirst(),
    `facet condition "${conditionId}" is missing selectable payload metadata.`
  )

  return {
    authoringModeKind: requireAuthoringMode(
      `facet condition "${conditionId}"`,
      selectable.authoring_mode_kind
    )
  }
}

async function hydratePredicateCondition(
  db: DBLike,
  row: PredicateRow
): Promise<PredicateConditionAuthored> {
  const predicateCode = requirePredicateCode(`facet condition "${row.id}"`, row.predicate_code)
  const base = {
    id: row.id,
    order: row.sort_order,
    kind: 'PREDICATE' as const,
    constraint: requireConstraint(`facet condition "${row.id}"`, row.constraint_code),
    predicateCode
  }

  switch (predicateCode) {
    case 'CLASS_LEVEL': {
      const [range, classItems] = await Promise.all([
        db
          .selectFrom('facet_predicate_numeric_ranges')
          .select(['min_value', 'max_value'])
          .where('facet_condition_id', '=', row.id)
          .executeTakeFirst(),
        db
          .selectFrom('facet_predicate_class_items')
          .select(['class_id', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute()
      ])
      const requiredRange = requireLinkedRecord(
        range,
        `facet condition "${row.id}" is missing numeric range payload.`
      )

      return {
        ...base,
        classIds: classItems.map((item) => item.class_id),
        min: Number(requiredRange.min_value),
        ...(requiredRange.max_value == null ? {} : { max: Number(requiredRange.max_value) })
      } as PredicateConditionAuthored
    }

    case 'CHARACTER_LEVEL':
    case 'SPELL_LEVEL':
    case 'SAVING_THROW_DC':
    case 'ARMOR_CLASS': {
      const range = requireLinkedRecord(
        await db
          .selectFrom('facet_predicate_numeric_ranges')
          .select(['min_value', 'max_value'])
          .where('facet_condition_id', '=', row.id)
          .executeTakeFirst(),
        `facet condition "${row.id}" is missing numeric range payload.`
      )

      return {
        ...base,
        min: Number(range.min_value),
        ...(range.max_value == null ? {} : { max: Number(range.max_value) })
      } as PredicateConditionAuthored
    }

    case 'FEATURE_OBTAINED': {
      const items = await db
        .selectFrom('facet_predicate_feature_items')
        .select(['feature_id', 'sort_order'])
        .where('facet_condition_id', '=', row.id)
        .orderBy('sort_order')
        .execute()

      return {
        ...base,
        featureIds: items.map((item) => item.feature_id)
      } as PredicateConditionAuthored
    }

    case 'OPTION_OBTAINED': {
      const [optionItems, featureItems] = await Promise.all([
        db
          .selectFrom('facet_predicate_option_items')
          .select(['option_id', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute(),
        db
          .selectFrom('facet_predicate_feature_items')
          .select(['feature_id', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute()
      ])

      return {
        ...base,
        optionIds: optionItems.map((item) => item.option_id),
        featureIds:
          featureItems.length > 0 ? featureItems.map((item) => item.feature_id) : undefined
      } as PredicateConditionAuthored
    }

    case 'SPELL_OBTAINED': {
      const items = await db
        .selectFrom('facet_predicate_spell_items')
        .select(['spell_id', 'sort_order'])
        .where('facet_condition_id', '=', row.id)
        .orderBy('sort_order')
        .execute()

      return {
        ...base,
        spellIds: items.map((item) => item.spell_id)
      } as PredicateConditionAuthored
    }

    case 'FEAT_OBTAINED': {
      const items = await db
        .selectFrom('facet_predicate_feat_items')
        .select(['feat_id', 'sort_order'])
        .where('facet_condition_id', '=', row.id)
        .orderBy('sort_order')
        .execute()

      return {
        ...base,
        featIds: items.map((item) => item.feat_id)
      } as PredicateConditionAuthored
    }

    case 'HERITAGE': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const items = await db
        .selectFrom('facet_predicate_heritage_items')
        .select(['heritage_id', 'sort_order'])
        .where('facet_condition_id', '=', row.id)
        .orderBy('sort_order')
        .execute()

      return {
        ...base,
        ...selection,
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? { heritageIds: items.map((item) => item.heritage_id) }
          : {})
      } as PredicateConditionAuthored
    }

    case 'SPELLCASTING':
    case 'CONCENTRATION':
    case 'RITUAL':
    case 'CAN_CAST_SPELL':
    case 'WHILE_SOURCE_CARRIED':
    case 'WHILE_SOURCE_EQUIPPED':
    case 'WHILE_SOURCE_ATTUNED':
      return base as PredicateConditionAuthored

    case 'RANGE': {
      const [selection, rangeRow, rangeKindRows] = await Promise.all([
        hydratePredicateSelectable(db, row.id),
        db
          .selectFrom('facet_predicate_ranges')
          .select(['range_kind', 'min_distance', 'max_distance', 'unit_code'])
          .where('facet_condition_id', '=', row.id)
          .executeTakeFirst(),
        db
          .selectFrom('facet_predicate_range_kind_items')
          .select(['range_kind', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute()
      ])
      const rangeKinds =
        rangeKindRows.length > 0
          ? rangeKindRows.map((item) =>
              requireRangeKind(`facet condition "${row.id}"`, item.range_kind)
            )
          : rangeRow?.range_kind
            ? [requireRangeKind(`facet condition "${row.id}"`, rangeRow.range_kind)]
            : []
      const includesDistance = rangeKinds.includes(RANGE_KIND.DISTANCE)

      if (selection.authoringModeKind === AUTHORING_MODE_KIND.ALL) {
        const range = requireLinkedRecord(
          rangeRow,
          `facet condition "${row.id}" is missing range payload.`
        )

        return {
          ...base,
          ...selection,
          min: Number(
            requireLinkedRecord(
              range.min_distance,
              `facet condition "${row.id}" is missing min_distance.`
            )
          ),
          max: range.max_distance == null ? undefined : Number(range.max_distance),
          unit: requireMeasurementUnitCode(
            `facet condition "${row.id}"`,
            requireLinkedRecord(
              range.unit_code,
              `facet condition "${row.id}" is missing unit_code.`
            )
          )
        } as PredicateConditionAuthored
      }

      if (rangeKinds.length === 0) {
        throw new Error(`facet condition "${row.id}" is missing range_kind.`)
      }

      if (includesDistance && rangeKinds.length !== 1) {
        throw new Error(`facet condition "${row.id}" cannot mix DISTANCE with other range kinds.`)
      }

      return {
        ...base,
        ...selection,
        rangeKind: rangeKinds,
        ...(includesDistance
          ? {
              min: Number(
                requireLinkedRecord(
                  requireLinkedRecord(
                    rangeRow,
                    `facet condition "${row.id}" is missing range payload.`
                  ).min_distance,
                  `facet condition "${row.id}" is missing min_distance.`
                )
              ),
              max: rangeRow?.max_distance == null ? undefined : Number(rangeRow.max_distance),
              unit: requireMeasurementUnitCode(
                `facet condition "${row.id}"`,
                requireLinkedRecord(
                  rangeRow?.unit_code,
                  `facet condition "${row.id}" is missing unit_code.`
                )
              )
            }
          : {})
      } as PredicateConditionAuthored
    }

    case 'DURATION': {
      const [selection, durationRow, durationKindRows] = await Promise.all([
        hydratePredicateSelectable(db, row.id),
        db
          .selectFrom('facet_predicate_durations')
          .select(['duration_kind', 'min_amount', 'max_amount'])
          .where('facet_condition_id', '=', row.id)
          .executeTakeFirst(),
        db
          .selectFrom('facet_predicate_duration_kind_items')
          .select(['duration_kind', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute()
      ])
      const durationKinds =
        durationKindRows.length > 0
          ? durationKindRows.map((item) =>
              requireDurationKind(`facet condition "${row.id}"`, item.duration_kind)
            )
          : durationRow?.duration_kind
            ? [requireDurationKind(`facet condition "${row.id}"`, durationRow.duration_kind)]
            : []
      const includesInstantaneous = durationKinds.includes(DURATION_KIND.INSTANTANEOUS)

      if (selection.authoringModeKind === AUTHORING_MODE_KIND.ALL) {
        const duration = requireLinkedRecord(
          durationRow,
          `facet condition "${row.id}" is missing duration payload.`
        )

        return {
          ...base,
          ...selection,
          min: Number(
            requireLinkedRecord(
              duration.min_amount,
              `facet condition "${row.id}" is missing min_amount.`
            )
          ),
          max: duration.max_amount == null ? undefined : Number(duration.max_amount)
        } as PredicateConditionAuthored
      }

      if (durationKinds.length === 0) {
        throw new Error(`facet condition "${row.id}" is missing duration_kind.`)
      }

      if (includesInstantaneous && durationKinds.length !== 1) {
        throw new Error(
          `facet condition "${row.id}" cannot mix INSTANTANEOUS with timed duration kinds.`
        )
      }

      return {
        ...base,
        ...selection,
        durationKind: durationKinds,
        ...(includesInstantaneous
          ? {}
          : {
              min: Number(
                requireLinkedRecord(
                  requireLinkedRecord(
                    durationRow,
                    `facet condition "${row.id}" is missing duration payload.`
                  ).min_amount,
                  `facet condition "${row.id}" is missing min_amount.`
                )
              ),
              max: durationRow?.max_amount == null ? undefined : Number(durationRow.max_amount)
            })
      } as PredicateConditionAuthored
    }

    case 'MAGIC_SCHOOL': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const items = await db
        .selectFrom('facet_predicate_magic_school_items')
        .select(['magic_school_id', 'sort_order'])
        .where('facet_condition_id', '=', row.id)
        .orderBy('sort_order')
        .execute()

      return {
        ...base,
        ...selection,
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? { magicSchoolIds: items.map((item) => item.magic_school_id) }
          : {})
      } as PredicateConditionAuthored
    }

    case 'SPELLCASTING_ABILITY':
    case 'SAVING_THROW_ABILITY': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const items = await db
        .selectFrom('facet_predicate_ability_items')
        .select(['ability_code', 'sort_order'])
        .where('facet_condition_id', '=', row.id)
        .orderBy('sort_order')
        .execute()

      return {
        ...base,
        ...selection,
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? {
              abilities: items.map((item) =>
                requireAbilityCode(`facet condition "${row.id}"`, item.ability_code)
              )
            }
          : {})
      } as PredicateConditionAuthored
    }

    case 'ABILITY_SCORE': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const [items, range] = await Promise.all([
        db
          .selectFrom('facet_predicate_ability_items')
          .select(['ability_code', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute(),
        db
          .selectFrom('facet_predicate_numeric_ranges')
          .select(['min_value', 'max_value'])
          .where('facet_condition_id', '=', row.id)
          .executeTakeFirst()
      ])

      return {
        ...base,
        ...selection,
        min: Number(
          requireLinkedRecord(
            range,
            `facet condition "${row.id}" is missing numeric range payload.`
          ).min_value
        ),
        max: range?.max_value == null ? undefined : Number(range.max_value),
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? {
              abilities: requireSingleAbility(
                row.id,
                items.map((item) => item.ability_code)
              )
            }
          : {})
      } as PredicateConditionAuthored
    }

    case 'SAVING_THROW_ABILITY_BONUS': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const [items, range] = await Promise.all([
        db
          .selectFrom('facet_predicate_ability_items')
          .select(['ability_code', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute(),
        db
          .selectFrom('facet_predicate_numeric_ranges')
          .select(['min_value', 'max_value'])
          .where('facet_condition_id', '=', row.id)
          .executeTakeFirst()
      ])

      return {
        ...base,
        ...selection,
        min: Number(
          requireLinkedRecord(
            range,
            `facet condition "${row.id}" is missing numeric range payload.`
          ).min_value
        ),
        max: range?.max_value == null ? undefined : Number(range.max_value),
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? {
              abilities: requireSingleAbility(
                row.id,
                items.map((item) => item.ability_code)
              )
            }
          : {})
      } as PredicateConditionAuthored
    }

    case 'SAVE_ABILITY_PROFICIENCY': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const [items, levelRow] = await Promise.all([
        db
          .selectFrom('facet_predicate_ability_items')
          .select(['ability_code', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute(),
        db
          .selectFrom('facet_predicate_proficiency_levels')
          .select(['proficiency_level'])
          .where('facet_condition_id', '=', row.id)
          .executeTakeFirst()
      ])

      return {
        ...base,
        ...selection,
        level: requireScalingAmountKind(
          `facet condition "${row.id}"`,
          requireLinkedRecord(levelRow, `facet condition "${row.id}" is missing proficiency level.`)
            .proficiency_level
        ),
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? {
              abilities: requireSingleAbility(
                row.id,
                items.map((item) => item.ability_code)
              )
            }
          : {})
      } as PredicateConditionAuthored
    }

    case 'EQUIPMENT_CATEGORY': {
      const rowData = requireLinkedRecord(
        await db
          .selectFrom('facet_predicate_equipment_categories')
          .select(['category_code'])
          .where('facet_condition_id', '=', row.id)
          .executeTakeFirst(),
        `facet condition "${row.id}" is missing equipment category payload.`
      )

      return {
        ...base,
        category: requireEquipmentCategory(`facet condition "${row.id}"`, rowData.category_code)
      } as PredicateConditionAuthored
    }

    case 'EQUIPMENT_PROPERTY':
    case 'EQUIPMENT_PROPERTY_PROFICIENCY': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const [categoryRow, propertyItems] = await Promise.all([
        db
          .selectFrom('facet_predicate_equipment_categories')
          .select(['category_code'])
          .where('facet_condition_id', '=', row.id)
          .executeTakeFirst(),
        db
          .selectFrom('facet_predicate_equipment_property_items')
          .select(['property_code', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute()
      ])

      return {
        ...base,
        ...selection,
        category: categoryRow
          ? requireEquipmentCategory(`facet condition "${row.id}"`, categoryRow.category_code)
          : undefined,
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? {
              properties: propertyItems.map((item) =>
                requireEquipmentProperty(`facet condition "${row.id}"`, item.property_code)
              )
            }
          : {})
      } as PredicateConditionAuthored
    }

    case 'EQUIPMENT_PROFICIENCY': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const [categoryRow, propertyItems, levelRow, equipmentItems] = await Promise.all([
        db
          .selectFrom('facet_predicate_equipment_categories')
          .select(['category_code'])
          .where('facet_condition_id', '=', row.id)
          .executeTakeFirst(),
        db
          .selectFrom('facet_predicate_equipment_property_items')
          .select(['property_code', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute(),
        db
          .selectFrom('facet_predicate_proficiency_levels')
          .select(['proficiency_level'])
          .where('facet_condition_id', '=', row.id)
          .executeTakeFirst(),
        db
          .selectFrom('facet_predicate_equipment_items')
          .select(['equipment_id', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute()
      ])

      return {
        ...base,
        ...selection,
        category: categoryRow
          ? requireEquipmentCategory(`facet condition "${row.id}"`, categoryRow.category_code)
          : undefined,
        properties:
          propertyItems.length > 0
            ? propertyItems.map((item) =>
                requireEquipmentProperty(`facet condition "${row.id}"`, item.property_code)
              )
            : undefined,
        level: requireScalingAmountKind(
          `facet condition "${row.id}"`,
          requireLinkedRecord(levelRow, `facet condition "${row.id}" is missing proficiency level.`)
            .proficiency_level
        ),
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? { equipmentIds: equipmentItems.map((item) => item.equipment_id) }
          : {})
      } as PredicateConditionAuthored
    }

    case 'EQUIPMENT_EQUIPPED': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const [categoryRow, propertyItems, equipmentItems] = await Promise.all([
        db
          .selectFrom('facet_predicate_equipment_categories')
          .select(['category_code'])
          .where('facet_condition_id', '=', row.id)
          .executeTakeFirst(),
        db
          .selectFrom('facet_predicate_equipment_property_items')
          .select(['property_code', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute(),
        db
          .selectFrom('facet_predicate_equipment_items')
          .select(['equipment_id', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute()
      ])

      return {
        ...base,
        ...selection,
        category: categoryRow
          ? requireEquipmentCategory(`facet condition "${row.id}"`, categoryRow.category_code)
          : undefined,
        properties:
          propertyItems.length > 0
            ? propertyItems.map((item) =>
                requireEquipmentProperty(`facet condition "${row.id}"`, item.property_code)
              )
            : undefined,
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? { equipmentIds: equipmentItems.map((item) => item.equipment_id) }
          : {})
      } as PredicateConditionAuthored
    }

    case 'DAMAGE_TYPE': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const items = await db
        .selectFrom('facet_predicate_damage_type_items')
        .select(['damage_type_id', 'sort_order'])
        .where('facet_condition_id', '=', row.id)
        .orderBy('sort_order')
        .execute()

      return {
        ...base,
        ...selection,
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? { damageTypeIds: items.map((item) => item.damage_type_id) }
          : {})
      } as PredicateConditionAuthored
    }

    case 'CONDITION_TYPE': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const items = await db
        .selectFrom('facet_predicate_condition_type_items')
        .select(['condition_type_id', 'sort_order'])
        .where('facet_condition_id', '=', row.id)
        .orderBy('sort_order')
        .execute()

      return {
        ...base,
        ...selection,
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? { conditionTypeIds: items.map((item) => item.condition_type_id) }
          : {})
      } as PredicateConditionAuthored
    }

    case 'SUBCLASS_SPECIALIZATION': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const items = await db
        .selectFrom('facet_predicate_subclass_specialization_items')
        .select(['specialization_id', 'sort_order'])
        .where('facet_condition_id', '=', row.id)
        .orderBy('sort_order')
        .execute()

      return {
        ...base,
        ...selection,
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? { specializationIds: items.map((item) => item.specialization_id) }
          : {})
      } as PredicateConditionAuthored
    }

    case 'SIZE': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const items = await db
        .selectFrom('facet_predicate_size_items')
        .select(['size_code', 'sort_order'])
        .where('facet_condition_id', '=', row.id)
        .orderBy('sort_order')
        .execute()

      return {
        ...base,
        ...selection,
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? {
              sizes: items.map((item) =>
                requireSizeCode(`facet condition "${row.id}"`, item.size_code)
              )
            }
          : {})
      } as PredicateConditionAuthored
    }

    case 'CREATURE_CATEGORY': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const items = await db
        .selectFrom('facet_predicate_creature_category_items')
        .select(['category_code', 'sort_order'])
        .where('facet_condition_id', '=', row.id)
        .orderBy('sort_order')
        .execute()

      return {
        ...base,
        ...selection,
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? {
              categories: items.map((item) =>
                requireCreatureCategory(`facet condition "${row.id}"`, item.category_code)
              )
            }
          : {})
      } as PredicateConditionAuthored
    }

    case 'CREATURE_TYPE': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const items = await db
        .selectFrom('facet_predicate_creature_type_items')
        .select(['creature_type_id', 'sort_order'])
        .where('facet_condition_id', '=', row.id)
        .orderBy('sort_order')
        .execute()

      return {
        ...base,
        ...selection,
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? { creatureTypeIds: items.map((item) => item.creature_type_id) }
          : {})
      } as PredicateConditionAuthored
    }

    case 'CREATURE_SIZE':
    case 'VEHICLE_SIZE': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const items = await db
        .selectFrom('facet_predicate_size_items')
        .select(['size_code', 'sort_order'])
        .where('facet_condition_id', '=', row.id)
        .orderBy('sort_order')
        .execute()

      return {
        ...base,
        ...selection,
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? {
              sizes: items.map((item) =>
                requireSizeCode(`facet condition "${row.id}"`, item.size_code)
              )
            }
          : {})
      } as PredicateConditionAuthored
    }

    case 'CREATURE_IS_MOUNT':
    case 'CREATURE_IS_COMPANION':
      return base as PredicateConditionAuthored

    case 'VEHICLE_CATEGORY': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const items = await db
        .selectFrom('facet_predicate_vehicle_category_items')
        .select(['category_code', 'sort_order'])
        .where('facet_condition_id', '=', row.id)
        .orderBy('sort_order')
        .execute()

      return {
        ...base,
        ...selection,
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? {
              categories: items.map((item) =>
                requireVehicleCategory(`facet condition "${row.id}"`, item.category_code)
              )
            }
          : {})
      } as PredicateConditionAuthored
    }

    case 'CHARGE_LIMIT_KIND': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const items = await db
        .selectFrom('facet_predicate_charge_limit_kind_items')
        .select(['charge_limit_kind', 'sort_order'])
        .where('facet_condition_id', '=', row.id)
        .orderBy('sort_order')
        .execute()

      return {
        ...base,
        ...selection,
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? {
              chargeLimitKind: items.map((item) =>
                requireChargeLimitKind(`facet condition "${row.id}"`, item.charge_limit_kind)
              )
            }
          : {})
      } as PredicateConditionAuthored
    }

    case 'CHARGE_RESET_KIND': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const items = await db
        .selectFrom('facet_predicate_charge_reset_kind_items')
        .select(['charge_reset_kind', 'sort_order'])
        .where('facet_condition_id', '=', row.id)
        .orderBy('sort_order')
        .execute()

      return {
        ...base,
        ...selection,
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? {
              chargeResetKind: items.map((item) =>
                requireChargeResetKind(`facet condition "${row.id}"`, item.charge_reset_kind)
              )
            }
          : {})
      } as PredicateConditionAuthored
    }

    case 'SKILL_PROFICIENCY':
    case 'SKILL_SCORE': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const items = await db
        .selectFrom('facet_predicate_skill_items')
        .select(['skill_id', 'sort_order'])
        .where('facet_condition_id', '=', row.id)
        .orderBy('sort_order')
        .execute()
      const levelRow =
        predicateCode === 'SKILL_PROFICIENCY'
          ? await db
              .selectFrom('facet_predicate_proficiency_levels')
              .select(['proficiency_level'])
              .where('facet_condition_id', '=', row.id)
              .executeTakeFirst()
          : null

      return {
        ...base,
        ...selection,
        ...(predicateCode === 'SKILL_PROFICIENCY'
          ? {
              level: requireScalingAmountKind(
                `facet condition "${row.id}"`,
                requireLinkedRecord(
                  levelRow,
                  `facet condition "${row.id}" is missing proficiency level.`
                ).proficiency_level
              )
            }
          : {}),
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? { skillIds: items.map((item) => item.skill_id) }
          : {})
      } as PredicateConditionAuthored
    }

    case 'LANGUAGE_PROFICIENCY': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const [items, levelRow] = await Promise.all([
        db
          .selectFrom('facet_predicate_language_items')
          .select(['language_id', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute(),
        db
          .selectFrom('facet_predicate_proficiency_levels')
          .select(['proficiency_level'])
          .where('facet_condition_id', '=', row.id)
          .executeTakeFirst()
      ])

      return {
        ...base,
        ...selection,
        level: requireScalingAmountKind(
          `facet condition "${row.id}"`,
          requireLinkedRecord(levelRow, `facet condition "${row.id}" is missing proficiency level.`)
            .proficiency_level
        ),
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? { languageIds: items.map((item) => item.language_id) }
          : {})
      } as PredicateConditionAuthored
    }

    default:
      throw new Error(
        `Facet condition "${row.id}" uses unsupported predicate "${String(predicateCode)}" for typed hydration.`
      )
  }
}

async function hydrateCondition(
  db: DBLike,
  row: PredicateRow,
  parentSubject: NodeSubjectCode
): Promise<FacetConditionAuthored> {
  if (row.kind === 'PREDICATE') {
    return hydratePredicateCondition(db, row)
  }

  if (row.kind !== 'EXISTS') {
    throw new Error(`facet condition "${row.id}" has invalid kind "${row.kind}".`)
  }

  const relationCode = String(row.relation_code)
  const targetSubject = requireRelationTargetSubject(
    `facet condition "${row.id}"`,
    parentSubject,
    relationCode
  )
  const selection = await hydrateSelection(
    db,
    'facet_exists_selections',
    'facet_exists_selection_items',
    'facet_condition_id',
    row.id,
    targetSubject
  )
  return {
    id: row.id,
    order: row.sort_order,
    kind: 'EXISTS',
    constraint: requireConstraint(`facet condition "${row.id}"`, row.constraint_code),
    relationCode,
    ...selection,
    where: row.where_facet_body_id ? await hydrateBodyById(db, row.where_facet_body_id) : undefined
  } as ExistsConditionAuthored
}

async function hydrateBodyById(db: DBLike, bodyId: string): Promise<FacetBodyAuthored> {
  const bodyRow = requireLinkedRecord(
    await db
      .selectFrom('facet_bodies')
      .select(['id', 'node_subject_code'])
      .where('id', '=', bodyId)
      .executeTakeFirst(),
    `facet body "${bodyId}" is missing.`
  )
  const subject = requireNodeSubject(`facet body "${bodyId}"`, bodyRow.node_subject_code)
  const selection = await hydrateSelection(
    db,
    'facet_body_selections',
    'facet_body_selection_items',
    'facet_body_id',
    bodyId,
    subject
  )
  const groupRows = await db
    .selectFrom('facet_body_groups')
    .select(['id', 'sort_order'])
    .where('facet_body_id', '=', bodyId)
    .orderBy('sort_order')
    .execute()

  const groups = await Promise.all(
    groupRows.map(async (groupRow) => {
      const conditionRows = await db
        .selectFrom('facet_conditions')
        .select([
          'id',
          'kind',
          'constraint_code',
          'sort_order',
          'predicate_code',
          'relation_code',
          'where_facet_body_id'
        ])
        .where('facet_body_group_id', '=', groupRow.id)
        .orderBy('sort_order')
        .execute()

      const conditions = await Promise.all(
        conditionRows.map((conditionRow) =>
          hydrateCondition(db, conditionRow as PredicateRow, subject)
        )
      )

      return {
        id: groupRow.id,
        order: groupRow.sort_order,
        ...(conditions.length > 0 ? { conditions } : {})
      }
    })
  )

  return {
    ...selection,
    groups
  } as unknown as FacetBodyAuthored
}

async function hydrateFacetByIdCore<N extends NodeSubjectCode = NodeSubjectCode>(
  db: DBLike,
  facetId: string
): Promise<FacetAuthored<N> | null> {
  const row = await db
    .selectFrom('facets')
    .select(['id'])
    .where('id', '=', facetId)
    .executeTakeFirst()

  if (!row) {
    return null
  }

  const groupRows = await db
    .selectFrom('facet_groups')
    .select(['id', 'sort_order'])
    .where('facet_id', '=', facetId)
    .orderBy('sort_order')
    .execute()

  const groups = await Promise.all(
    groupRows.map(async (groupRow) => {
      const contextRows = await db
        .selectFrom('facet_contexts')
        .select(['id', 'node_subject_code', 'sort_order'])
        .where('facet_group_id', '=', groupRow.id)
        .orderBy('sort_order')
        .execute()

      const contexts = await Promise.all(
        contextRows.map(async (contextRow) => {
          const subject = requireNodeSubject(
            `facet context "${contextRow.id}"`,
            contextRow.node_subject_code
          )
          const bodyRow = requireLinkedRecord(
            await db
              .selectFrom('facet_context_bodies')
              .select(['facet_body_id'])
              .where('facet_context_id', '=', contextRow.id)
              .executeTakeFirst(),
            `facet context "${contextRow.id}" is missing body mapping.`
          )
          const bodyId = bodyRow.facet_body_id
          const conditionGroupRows = await db
            .selectFrom('facet_body_groups')
            .select(['id'])
            .where('facet_body_id', '=', bodyId)
            .orderBy('sort_order')
            .execute()

          const conditions = (
            await Promise.all(
              conditionGroupRows.map(async (bodyGroupRow) => {
                const conditionRows = await db
                  .selectFrom('facet_conditions')
                  .select([
                    'id',
                    'kind',
                    'constraint_code',
                    'sort_order',
                    'predicate_code',
                    'relation_code',
                    'where_facet_body_id'
                  ])
                  .where('facet_body_group_id', '=', bodyGroupRow.id)
                  .orderBy('sort_order')
                  .execute()

                return Promise.all(
                  conditionRows.map((conditionRow) =>
                    hydrateCondition(db, conditionRow as PredicateRow, subject)
                  )
                )
              })
            )
          ).flat()

          if (subject === 'CHARACTER') {
            return {
              id: contextRow.id,
              order: contextRow.sort_order,
              subject,
              ...(conditions.length > 0 ? { conditions } : {})
            } as unknown as FacetContextAuthored
          }

          const selection = await hydrateSelection(
            db,
            'facet_body_selections',
            'facet_body_selection_items',
            'facet_body_id',
            bodyId,
            subject
          )

          return {
            id: contextRow.id,
            order: contextRow.sort_order,
            subject,
            ...selection,
            ...(conditions.length > 0 ? { conditions } : {})
          } as unknown as FacetContextAuthored
        })
      )

      return {
        id: groupRow.id,
        order: groupRow.sort_order,
        contexts
      }
    })
  )

  return {
    id: row.id,
    groups
  } as unknown as FacetAuthored<N>
}

export async function hydrateFacetById<N extends NodeSubjectCode = NodeSubjectCode>(
  db: DBLike,
  facetId: string
): Promise<FacetAuthored<N> | null> {
  return hydrateFacetByIdCore<N>(db, facetId)
}
