import type { DBLike } from '#types'
import { createHash } from 'node:crypto'
import {
  ABILITY_CODE,
  AUTHORING_CONSTRAINT,
  AUTHORING_MODE_KIND,
  CHARGE_LIMIT_KIND,
  CHARGE_RESET_KIND,
  CREATURE_CATEGORY_CODE,
  CREATURE_RECORD_KIND_CODE,
  DURATION_KIND,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  MEASUREMENT_UNIT_CODE,
  NODE_SUBJECT,
  PREDICATE_REGISTRY,
  PROFICIENCY_KIND,
  RANGE_KIND,
  RELATIONS,
  SCALING_AMOUNT_KIND,
  SIZE_CODE,
  VEHICLE_CATEGORY_CODE,
  type FacetAuthored,
  type FacetBodyAuthored,
  type FacetConditionAuthored,
  type FacetContextAuthored,
  type ExistsConditionAuthored,
  type NodeSubjectCode,
  type PredicateConditionAuthored
} from '@artificer-toolkit/shared'

type SelectionColumn = {
  payloadKey: string
  column: string
  mode?: 'many' | 'single'
}

const SUBJECT_SELECTION_COLUMNS = {
  CLASS: { payloadKey: 'classIds', column: 'class_id' },
  FEATURE: { payloadKey: 'featureIds', column: 'feature_id' },
  SPELL: { payloadKey: 'spellIds', column: 'spell_id' },
  EQUIPMENT: { payloadKey: 'equipmentIds', column: 'equipment_id' },
  FEAT: { payloadKey: 'featIds', column: 'feat_id' },
  RACE: { payloadKey: 'raceIds', column: 'race_id' },
  BACKGROUND: { payloadKey: 'backgroundIds', column: 'background_id' },
  CREATURE: { payloadKey: 'creatureIds', column: 'creature_id' },
  VEHICLE: { payloadKey: 'vehicleIds', column: 'vehicle_id' },
  OPTION: { payloadKey: 'optionIds', column: 'option_id' },
  SUBRACE: { payloadKey: 'subraceIds', column: 'subrace_id' },
  SUBCLASS: { payloadKey: 'subclassIds', column: 'subclass_id' },
  RESOURCE: { payloadKey: 'resourceIds', column: 'resource_id' },
  RACE_ANCESTRY_OPTION: { payloadKey: 'ancestryOptionIds', column: 'ancestry_option_id' },
  PROFICIENCY_GRANT: { payloadKey: 'proficiencyKind', column: 'proficiency_kind', mode: 'single' }
} as const satisfies Partial<Record<NodeSubjectCode, SelectionColumn>>

type SelectableSubjectCode = keyof typeof SUBJECT_SELECTION_COLUMNS

type PredicateRow = {
  id: string
  kind: string
  constraint_code: string
  predicate_code: string | null
  relation_code: string | null
  where_facet_body_id: string | null
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

function requireNodeSubject(
  ownerId: string,
  value: string
): NodeSubjectCode {
  if (!(value in NODE_SUBJECT)) {
    throw new Error(`${ownerId} has invalid node_subject_code "${value}".`)
  }

  return value as NodeSubjectCode
}

function requireAuthoringMode(
  ownerId: string,
  value: string
): typeof AUTHORING_MODE_KIND.ALL | typeof AUTHORING_MODE_KIND.SELECTED {
  if (value !== AUTHORING_MODE_KIND.ALL && value !== AUTHORING_MODE_KIND.SELECTED) {
    throw new Error(`${ownerId} has invalid authoring_mode_kind "${value}".`)
  }

  return value
}

function requireConstraint(
  ownerId: string,
  value: string
): typeof AUTHORING_CONSTRAINT.INCLUDE | typeof AUTHORING_CONSTRAINT.EXCLUDE {
  if (value !== AUTHORING_CONSTRAINT.INCLUDE && value !== AUTHORING_CONSTRAINT.EXCLUDE) {
    throw new Error(`${ownerId} has invalid constraint_code "${value}".`)
  }

  return value
}

function requirePredicateCode(
  ownerId: string,
  value: string | null
): keyof typeof PREDICATE_REGISTRY {
  if (!value || !(value in PREDICATE_REGISTRY)) {
    throw new Error(`${ownerId} has invalid predicate_code "${value}".`)
  }

  return value as keyof typeof PREDICATE_REGISTRY
}

function requireAbilityCode(
  ownerId: string,
  value: string
): keyof typeof ABILITY_CODE {
  if (!(value in ABILITY_CODE)) {
    throw new Error(`${ownerId} has invalid ability_code "${value}".`)
  }

  return value as keyof typeof ABILITY_CODE
}

function requireEquipmentCategory(
  ownerId: string,
  value: string
): keyof typeof EQUIPMENT_CATEGORY_CODE {
  if (!(value in EQUIPMENT_CATEGORY_CODE)) {
    throw new Error(`${ownerId} has invalid equipment category "${value}".`)
  }

  return value as keyof typeof EQUIPMENT_CATEGORY_CODE
}

function requireEquipmentProperty(
  ownerId: string,
  value: string
): keyof typeof EQUIPMENT_PROPERTY_CODE {
  if (!(value in EQUIPMENT_PROPERTY_CODE)) {
    throw new Error(`${ownerId} has invalid equipment property "${value}".`)
  }

  return value as keyof typeof EQUIPMENT_PROPERTY_CODE
}

function requireScalingAmountKind(
  ownerId: string,
  value: string
): keyof typeof SCALING_AMOUNT_KIND {
  if (!(value in SCALING_AMOUNT_KIND)) {
    throw new Error(`${ownerId} has invalid proficiency level "${value}".`)
  }

  return value as keyof typeof SCALING_AMOUNT_KIND
}

function requireMeasurementUnitCode(
  ownerId: string,
  value: string
): keyof typeof MEASUREMENT_UNIT_CODE {
  if (!(value in MEASUREMENT_UNIT_CODE)) {
    throw new Error(`${ownerId} has invalid measurement unit "${value}".`)
  }

  return value as keyof typeof MEASUREMENT_UNIT_CODE
}

function requireRangeKind(
  ownerId: string,
  value: string
): keyof typeof RANGE_KIND {
  if (!(value in RANGE_KIND)) {
    throw new Error(`${ownerId} has invalid range kind "${value}".`)
  }

  return value as keyof typeof RANGE_KIND
}

function requireDurationKind(
  ownerId: string,
  value: string
): keyof typeof DURATION_KIND {
  if (!(value in DURATION_KIND)) {
    throw new Error(`${ownerId} has invalid duration kind "${value}".`)
  }

  return value as keyof typeof DURATION_KIND
}

function requireSizeCode(
  ownerId: string,
  value: string
): keyof typeof SIZE_CODE {
  if (!(value in SIZE_CODE)) {
    throw new Error(`${ownerId} has invalid size code "${value}".`)
  }

  return value as keyof typeof SIZE_CODE
}

function requireCreatureRecordKind(
  ownerId: string,
  value: string
): keyof typeof CREATURE_RECORD_KIND_CODE {
  if (!(value in CREATURE_RECORD_KIND_CODE)) {
    throw new Error(`${ownerId} has invalid creature record kind "${value}".`)
  }

  return value as keyof typeof CREATURE_RECORD_KIND_CODE
}

function requireCreatureCategory(
  ownerId: string,
  value: string
): keyof typeof CREATURE_CATEGORY_CODE {
  if (!(value in CREATURE_CATEGORY_CODE)) {
    throw new Error(`${ownerId} has invalid creature category "${value}".`)
  }

  return value as keyof typeof CREATURE_CATEGORY_CODE
}

function requireVehicleCategory(
  ownerId: string,
  value: string
): keyof typeof VEHICLE_CATEGORY_CODE {
  if (!(value in VEHICLE_CATEGORY_CODE)) {
    throw new Error(`${ownerId} has invalid vehicle category "${value}".`)
  }

  return value as keyof typeof VEHICLE_CATEGORY_CODE
}

function requireChargeLimitKind(
  ownerId: string,
  value: string
): keyof typeof CHARGE_LIMIT_KIND {
  if (!(value in CHARGE_LIMIT_KIND)) {
    throw new Error(`${ownerId} has invalid charge limit kind "${value}".`)
  }

  return value as keyof typeof CHARGE_LIMIT_KIND
}

function requireChargeResetKind(
  ownerId: string,
  value: string
): keyof typeof CHARGE_RESET_KIND {
  if (!(value in CHARGE_RESET_KIND)) {
    throw new Error(`${ownerId} has invalid charge reset kind "${value}".`)
  }

  return value as keyof typeof CHARGE_RESET_KIND
}

function requireProficiencyKind(
  ownerId: string,
  value: string
): keyof typeof PROFICIENCY_KIND {
  if (!(value in PROFICIENCY_KIND)) {
    throw new Error(`${ownerId} has invalid proficiency kind "${value}".`)
  }

  return value as keyof typeof PROFICIENCY_KIND
}

function requireRelationTargetSubject(
  ownerId: string,
  subject: NodeSubjectCode,
  relationCode: string
): NodeSubjectCode {
  const relationMap = RELATIONS[subject as keyof typeof RELATIONS] as Record<string, { to: NodeSubjectCode }> | undefined
  const relation = relationMap?.[relationCode]

  if (!relation) {
    throw new Error(`${ownerId} has invalid relation "${relationCode}" for subject "${subject}".`)
  }

  return relation.to
}

function isSelectableSubjectCode(subject: NodeSubjectCode): subject is SelectableSubjectCode {
  return subject in SUBJECT_SELECTION_COLUMNS
}

function createDerivedUuid(baseId: string, purpose: string): string {
  const hex = createHash('sha256').update(`${baseId}:${purpose}`)
    .digest('hex')
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
    for (const childCondition of (group.conditions ?? [])) {
      collectAuthoredWhereBodyIds(bodyIds, group.id, childCondition)
    }
  }
}

function collectAuthoredFacetBodyIds<N extends NodeSubjectCode>(
  facet: FacetAuthored<N>
): string[] {
  const bodyIds = new Set<string>()

  for (const group of facet.groups) {
    for (const context of group.contexts) {
      const bodyGroupId = getContextBodyGroupId(facet.id, context.id)

      bodyIds.add(getContextBodyId(facet.id, context.id))

      for (const condition of (context.conditions ?? [])) {
        collectAuthoredWhereBodyIds(bodyIds, bodyGroupId, condition)
      }
    }
  }

  return [...bodyIds]
}

function requireSingleAbility(
  conditionId: string,
  abilityCodes: string[]
): keyof typeof ABILITY_CODE {
  if (abilityCodes.length !== 1) {
    throw new Error(`facet condition "${conditionId}" expected exactly one ability, found ${abilityCodes.length}.`)
  }

  return requireAbilityCode(`facet condition "${conditionId}"`, abilityCodes[0] as string)
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
  const authoringModeKind = requireAuthoringMode(`${table}.${ownerColumn} "${ownerId}"`, String(selection.authoringModeKind))

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
        [normalizedConfig.column]: normalizedConfig.payloadKey === 'proficiencyKind'
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
    .values(ids.map((id, index) => ({
      [ownerColumn]: ownerId,
      [normalizedConfig.column]: id,
      sort_order: index + 1
    })))
    .execute()
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

  const mode = requireAuthoringMode(`${modeTable}.${ownerColumn} "${ownerId}"`, requireLinkedRecord(modeRow, `${modeTable}.${ownerColumn} "${ownerId}" is missing.`).authoring_mode_kind)

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
      [normalizedConfig.payloadKey]: normalizedConfig.payloadKey === 'proficiencyKind'
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
): Promise<{ authoringModeKind: typeof AUTHORING_MODE_KIND.ALL | typeof AUTHORING_MODE_KIND.SELECTED }> {
  const selectable = requireLinkedRecord(await db.selectFrom('facet_predicate_selectables')
    .select(['authoring_mode_kind'])
    .where('facet_condition_id', '=', conditionId)
    .executeTakeFirst(), `facet condition "${conditionId}" is missing selectable payload metadata.`)

  return {
    authoringModeKind: requireAuthoringMode(`facet condition "${conditionId}"`, selectable.authoring_mode_kind)
  }
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
      authoring_mode_kind: requireAuthoringMode(`facet condition "${String(condition.id)}"`, authoringModeKind)
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
    .values(abilities.map((ability, index) => ({
      facet_condition_id: conditionId,
      ability_code: requireAbilityCode(`facet condition "${conditionId}"`, ability),
      sort_order: index + 1
    })))
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
    .values(properties.map((property, index) => ({
      facet_condition_id: conditionId,
      property_code: requireEquipmentProperty(`facet condition "${conditionId}"`, property),
      sort_order: index + 1
    })))
    .execute()
}

async function writeSizeItems(
  db: DBLike,
  conditionId: string,
  sizes: string[]
): Promise<void> {
  if (sizes.length === 0) {
    throw new Error(`Facet condition "${conditionId}" requires at least one size.`)
  }

  await db
    .insertInto('facet_predicate_size_items')
    .values(sizes.map((size, index) => ({
      facet_condition_id: conditionId,
      size_code: requireSizeCode(`facet condition "${conditionId}"`, size),
      sort_order: index + 1
    })))
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
    .values(specializationIds.map((specializationId, index) => ({
      facet_condition_id: conditionId,
      specialization_id: specializationId,
      sort_order: index + 1
    })))
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
    .values(chargeLimitKinds.map((chargeLimitKind, index) => ({
      facet_condition_id: conditionId,
      charge_limit_kind: requireChargeLimitKind(`facet condition "${conditionId}"`, chargeLimitKind),
      sort_order: index + 1
    })))
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
    .values(chargeResetKinds.map((chargeResetKind, index) => ({
      facet_condition_id: conditionId,
      charge_reset_kind: requireChargeResetKind(`facet condition "${conditionId}"`, chargeResetKind),
      sort_order: index + 1
    })))
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
    .values(rangeKinds.map((rangeKind, index) => ({
      facet_condition_id: conditionId,
      range_kind: requireRangeKind(`facet condition "${conditionId}"`, rangeKind),
      sort_order: index + 1
    })))
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
    .values(durationKinds.map((durationKind, index) => ({
      facet_condition_id: conditionId,
      duration_kind: requireDurationKind(`facet condition "${conditionId}"`, durationKind),
      sort_order: index + 1
    })))
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
    .values(ids.map((id, index) => ({
      facet_condition_id: conditionId,
      [column]: id,
      sort_order: index + 1
    })))
    .execute()
}

async function writeTextItems(
  db: DBLike,
  table:
    | 'facet_predicate_creature_record_kind_items'
    | 'facet_predicate_creature_category_items'
    | 'facet_predicate_vehicle_category_items',
  column: 'record_kind' | 'category_code',
  conditionId: string,
  values: string[]
): Promise<void> {
  if (values.length === 0) {
    throw new Error(`Facet condition "${conditionId}" requires at least one "${column}".`)
  }

  await db
    .insertInto(table)
    .values(values.map((value: string, index: number) => ({
      facet_condition_id: conditionId,
      [column]: value,
      sort_order: index + 1
    })))
    .execute()
}

async function writePredicatePayload(
  db: DBLike,
  condition: PredicateConditionAuthored
): Promise<void> {
  const conditionId = condition.id

  switch (condition.predicateCode) {
    case 'CLASS_LEVEL':
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
      await writeIdItems(db, 'facet_predicate_feature_items', 'feature_id', conditionId, condition.featureIds)
      return

    case 'SUBCLASS_SPECIALIZATION':
      await insertPredicateSelectableHeader(db, condition)
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeSubclassSpecializationItems(db, conditionId, condition.specializationIds)
      }
      return

    case 'OPTION_OBTAINED':
      await writeIdItems(db, 'facet_predicate_option_items', 'option_id', conditionId, condition.optionIds)
      if (condition.featureIds && condition.featureIds.length > 0) {
        await writeIdItems(db, 'facet_predicate_feature_items', 'feature_id', conditionId, condition.featureIds)
      }
      return

    case 'SPELL_OBTAINED':
      await writeIdItems(db, 'facet_predicate_spell_items', 'spell_id', conditionId, condition.spellIds)
      return

    case 'FEAT_OBTAINED':
      await writeIdItems(db, 'facet_predicate_feat_items', 'feat_id', conditionId, condition.featIds)
      return

    case 'HERITAGE':
      await insertPredicateSelectableHeader(db, condition)
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeIdItems(db, 'facet_predicate_heritage_items', 'heritage_id', conditionId, condition.heritageIds)
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

      const distancePayload = condition as { min?: number, max?: number, unit?: string }
      const isSelected = condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
      const selectedRangeKinds = isSelected
        ? (() => {
            if (!Array.isArray(condition.rangeKind) || condition.rangeKind.some((value) => typeof value !== 'string')) {
              throw new Error(`Facet condition "${conditionId}" requires "rangeKind" to be a string array.`)
            }

            if (condition.rangeKind.length === 0) {
              throw new Error(`Facet condition "${conditionId}" requires at least one range kind.`)
            }

            return condition.rangeKind.map((rangeKind) => requireRangeKind(`facet condition "${conditionId}"`, rangeKind))
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
      } else if (distancePayload.min != null || distancePayload.max != null || distancePayload.unit != null) {
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
            unit_code: requireMeasurementUnitCode(`facet condition "${conditionId}"`, distancePayload.unit ?? '')
          })
          .execute()
      }
      return
    }

    case 'DURATION': {
      await insertPredicateSelectableHeader(db, condition)

      const timedPayload = condition as { min?: number, max?: number }
      const isSelected = condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
      const selectedDurationKinds = isSelected
        ? (() => {
            if (!Array.isArray(condition.durationKind) || condition.durationKind.some((value) => typeof value !== 'string')) {
              throw new Error(`Facet condition "${conditionId}" requires "durationKind" to be a string array.`)
            }

            if (condition.durationKind.length === 0) {
              throw new Error(`Facet condition "${conditionId}" requires at least one duration kind.`)
            }

            return condition.durationKind.map((durationKind) => requireDurationKind(`facet condition "${conditionId}"`, durationKind))
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
        await writeIdItems(db, 'facet_predicate_magic_school_items', 'magic_school_id', conditionId, condition.magicSchoolIds)
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
          proficiency_level: requireScalingAmountKind(`facet condition "${conditionId}"`, condition.level)
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
          category_code: requireEquipmentCategory(`facet condition "${conditionId}"`, condition.category)
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
            category_code: requireEquipmentCategory(`facet condition "${conditionId}"`, condition.category)
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
          proficiency_level: requireScalingAmountKind(`facet condition "${conditionId}"`, condition.level)
        })
        .execute()
      if (condition.category) {
        await db
          .insertInto('facet_predicate_equipment_categories')
          .values({
            facet_condition_id: conditionId,
            category_code: requireEquipmentCategory(`facet condition "${conditionId}"`, condition.category)
          })
          .execute()
      }
      if (condition.properties && condition.properties.length > 0) {
        await writeEquipmentPropertyItems(db, conditionId, condition.properties)
      }
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeIdItems(db, 'facet_predicate_equipment_items', 'equipment_id', conditionId, condition.equipmentIds)
      }
      return

    case 'EQUIPMENT_PROPERTY_PROFICIENCY':
      await insertPredicateSelectableHeader(db, condition)
      if (condition.category) {
        await db
          .insertInto('facet_predicate_equipment_categories')
          .values({
            facet_condition_id: conditionId,
            category_code: requireEquipmentCategory(`facet condition "${conditionId}"`, condition.category)
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
            category_code: requireEquipmentCategory(`facet condition "${conditionId}"`, condition.category)
          })
          .execute()
      }
      if (condition.properties && condition.properties.length > 0) {
        await writeEquipmentPropertyItems(db, conditionId, condition.properties)
      }
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeIdItems(db, 'facet_predicate_equipment_items', 'equipment_id', conditionId, condition.equipmentIds)
      }
      return

    case 'DAMAGE_TYPE':
      await insertPredicateSelectableHeader(db, condition)
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeIdItems(db, 'facet_predicate_damage_type_items', 'damage_type_id', conditionId, condition.damageTypeIds)
      }
      return

    case 'CONDITION_TYPE':
      await insertPredicateSelectableHeader(db, condition)
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeIdItems(db, 'facet_predicate_condition_type_items', 'condition_type_id', conditionId, condition.conditionTypeIds)
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
          proficiency_level: requireScalingAmountKind(`facet condition "${conditionId}"`, condition.level)
        })
        .execute()
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeIdItems(db, 'facet_predicate_skill_items', 'skill_id', conditionId, condition.skillIds)
      }
      return

    case 'SKILL_SCORE':
      await insertPredicateSelectableHeader(db, condition)
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeIdItems(db, 'facet_predicate_skill_items', 'skill_id', conditionId, condition.skillIds)
      }
      return

    case 'LANGUAGE_PROFICIENCY':
      await insertPredicateSelectableHeader(db, condition)
      await db
        .insertInto('facet_predicate_proficiency_levels')
        .values({
          facet_condition_id: conditionId,
          proficiency_level: requireScalingAmountKind(`facet condition "${conditionId}"`, condition.level)
        })
        .execute()
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeIdItems(db, 'facet_predicate_language_items', 'language_id', conditionId, condition.languageIds)
      }
      return

    case 'CREATURE_RECORD_KIND':
      await insertPredicateSelectableHeader(db, condition)
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeTextItems(db, 'facet_predicate_creature_record_kind_items', 'record_kind', conditionId, condition.recordKinds.map((value) => requireCreatureRecordKind(`facet condition "${conditionId}"`, value)))
      }
      return

    case 'CREATURE_CATEGORY':
      await insertPredicateSelectableHeader(db, condition)
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await writeTextItems(db, 'facet_predicate_creature_category_items', 'category_code', conditionId, condition.categories.map((value) => requireCreatureCategory(`facet condition "${conditionId}"`, value)))
      }
      return

    case 'CREATURE_TYPE':
      await insertPredicateSelectableHeader(db, condition)
      if (condition.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
        await db
          .insertInto('facet_predicate_creature_type_items')
          .values(condition.creatureTypeIds.map((creatureTypeId: string, index: number) => ({
            facet_condition_id: conditionId,
            creature_type_id: creatureTypeId,
            sort_order: index + 1
          })))
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
        await writeTextItems(db, 'facet_predicate_vehicle_category_items', 'category_code', conditionId, condition.categories.map((value) => requireVehicleCategory(`facet condition "${conditionId}"`, value)))
      }
      return

    case 'CREATURE_IS_MOUNT':
    case 'CREATURE_IS_COMPANION':
      return

    default:
      throw new Error(`Facet condition "${conditionId}" uses an unsupported predicate for typed persistence.`)
  }
}

async function writeBody(
  db: DBLike,
  bodyId: string,
  subject: NodeSubjectCode,
  body: FacetBodyAuthored
): Promise<void> {
  await db.insertInto('facet_bodies').values({
    id: bodyId,
    node_subject_code: subject
  })
    .execute()

  await db.insertInto('facet_body_selections').values({
    facet_body_id: bodyId,
    authoring_mode_kind: requireAuthoringMode(`facet body "${bodyId}"`, String(body.authoringModeKind))
  })
    .execute()

  await replaceSelectionItems(db, 'facet_body_selection_items', 'facet_body_id', bodyId, subject, body as Record<string, unknown>)

  for (const group of body.groups) {
    await db.insertInto('facet_body_groups').values({
      id: group.id,
      facet_body_id: bodyId,
      sort_order: group.order
    })
      .execute()

    for (const condition of (group.conditions ?? [])) {
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

    await db.insertInto('facet_conditions').values({
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

    await db.insertInto('facet_exists_selections').values({
      facet_condition_id: condition.id,
      authoring_mode_kind: requireAuthoringMode(`facet exists condition "${condition.id}"`, condition.authoringModeKind)
    })
      .execute()

    const targetSubject = requireRelationTargetSubject(`facet exists condition "${condition.id}"`, subject, condition.relationCode)

    await replaceSelectionItems(db, 'facet_exists_selection_items', 'facet_condition_id', condition.id, targetSubject, condition as Record<string, unknown>)

    if (condition.where) {
      await writeBody(db, requireLinkedRecord(whereBodyId, 'Missing where body id.'), targetSubject, condition.where)
    }

    return
  }

  await db.insertInto('facet_conditions').values({
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

async function collectFacetBodyIds(
  db: DBLike,
  facetId: string
): Promise<string[]> {
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

async function deleteExistingFacetGraph(
  db: DBLike,
  facetId: string
): Promise<void> {
  const bodyIds = await collectFacetBodyIds(db, facetId)

  await db.deleteFrom('facets').where('id', '=', facetId)
    .execute()

  if (bodyIds.length > 0) {
    await db.deleteFrom('facet_bodies').where('id', 'in', bodyIds)
      .execute()
  }
}

export async function upsertFacet<N extends NodeSubjectCode = NodeSubjectCode>(
  db: DBLike,
  facet: FacetAuthored<N>
): Promise<void> {
  await deleteExistingFacetGraph(db, facet.id)

  const authoredBodyIds = collectAuthoredFacetBodyIds(facet)

  if (authoredBodyIds.length > 0) {
    await db.deleteFrom('facet_bodies').where('id', 'in', authoredBodyIds)
      .execute()
  }

  await db.insertInto('facets').values({
    id: facet.id
  })
    .execute()

  for (const group of facet.groups) {
    await db.insertInto('facet_groups').values({
      id: group.id,
      facet_id: facet.id,
      sort_order: group.order
    })
      .execute()

    for (const context of group.contexts) {
      const subject = requireNodeSubject(`facet context "${context.id}"`, context.subject)
      const bodyId = getContextBodyId(facet.id, context.id)
      const bodyGroupId = getContextBodyGroupId(facet.id, context.id)

      await db.insertInto('facet_contexts').values({
        id: context.id,
        facet_group_id: group.id,
        node_subject_code: subject,
        sort_order: context.order
      })
        .execute()

      await db.insertInto('facet_bodies').values({
        id: bodyId,
        node_subject_code: subject
      })
        .execute()

      await db.insertInto('facet_context_bodies').values({
        facet_context_id: context.id,
        facet_body_id: bodyId
      })
        .execute()

      if (subject !== 'CHARACTER') {
        await db.insertInto('facet_body_selections').values({
          facet_body_id: bodyId,
          authoring_mode_kind: requireAuthoringMode(`facet context "${context.id}"`, String((context as Record<string, unknown>).authoringModeKind))
        })
          .execute()

        await replaceSelectionItems(db, 'facet_body_selection_items', 'facet_body_id', bodyId, subject, context as Record<string, unknown>)
      }

      await db.insertInto('facet_body_groups').values({
        id: bodyGroupId,
        facet_body_id: bodyId,
        sort_order: 1
      })
        .execute()

      for (const condition of (context.conditions ?? [])) {
        await writeCondition(db, bodyGroupId, subject, condition)
      }
    }
  }
}

async function hydratePredicateCondition(
  db: DBLike,
  row: PredicateRow
): Promise<PredicateConditionAuthored> {
  const predicateCode = requirePredicateCode(`facet condition "${row.id}"`, row.predicate_code)
  const sortable = requireLinkedRecord(await db.selectFrom('facet_conditions')
    .select(['sort_order'])
    .where('id', '=', row.id)
    .executeTakeFirst(), `facet condition "${row.id}" is missing sort_order.`)
  const base = {
    id: row.id,
    order: sortable.sort_order,
    kind: 'PREDICATE' as const,
    constraint: requireConstraint(`facet condition "${row.id}"`, row.constraint_code),
    predicateCode
  }

  switch (predicateCode) {
    case 'CLASS_LEVEL':
    case 'CHARACTER_LEVEL':
    case 'SPELL_LEVEL':
    case 'SAVING_THROW_DC':
    case 'ARMOR_CLASS': {
      const range = requireLinkedRecord(await db.selectFrom('facet_predicate_numeric_ranges')
        .select(['min_value', 'max_value'])
        .where('facet_condition_id', '=', row.id)
        .executeTakeFirst(), `facet condition "${row.id}" is missing numeric range payload.`)

      return {
        ...base,
        min: Number(range.min_value),
        max: range.max_value == null ? undefined : Number(range.max_value)
      } as PredicateConditionAuthored
    }

    case 'FEATURE_OBTAINED': {
      const items = await db.selectFrom('facet_predicate_feature_items')
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
        db.selectFrom('facet_predicate_option_items')
          .select(['option_id', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute(),
        db.selectFrom('facet_predicate_feature_items')
          .select(['feature_id', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute()
      ])

      return {
        ...base,
        optionIds: optionItems.map((item) => item.option_id),
        featureIds: featureItems.length > 0 ? featureItems.map((item) => item.feature_id) : undefined
      } as PredicateConditionAuthored
    }

    case 'SPELL_OBTAINED': {
      const items = await db.selectFrom('facet_predicate_spell_items')
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
      const items = await db.selectFrom('facet_predicate_feat_items')
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
      const items = await db.selectFrom('facet_predicate_heritage_items')
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
        db.selectFrom('facet_predicate_ranges')
          .select([
            'range_kind', 'min_distance', 'max_distance', 'unit_code'
          ])
          .where('facet_condition_id', '=', row.id)
          .executeTakeFirst(),
        db.selectFrom('facet_predicate_range_kind_items')
          .select(['range_kind', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute()
      ])
      const rangeKinds = rangeKindRows.length > 0
        ? rangeKindRows.map((item) => requireRangeKind(`facet condition "${row.id}"`, item.range_kind))
        : (rangeRow?.range_kind ? [requireRangeKind(`facet condition "${row.id}"`, rangeRow.range_kind)] : [])
      const includesDistance = rangeKinds.includes(RANGE_KIND.DISTANCE)

      if (selection.authoringModeKind === AUTHORING_MODE_KIND.ALL) {
        const range = requireLinkedRecord(rangeRow, `facet condition "${row.id}" is missing range payload.`)

        return {
          ...base,
          ...selection,
          min: Number(requireLinkedRecord(range.min_distance, `facet condition "${row.id}" is missing min_distance.`)),
          max: range.max_distance == null ? undefined : Number(range.max_distance),
          unit: requireMeasurementUnitCode(`facet condition "${row.id}"`, requireLinkedRecord(range.unit_code, `facet condition "${row.id}" is missing unit_code.`))
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
              min: Number(requireLinkedRecord(requireLinkedRecord(rangeRow, `facet condition "${row.id}" is missing range payload.`).min_distance, `facet condition "${row.id}" is missing min_distance.`)),
              max: rangeRow?.max_distance == null ? undefined : Number(rangeRow.max_distance),
              unit: requireMeasurementUnitCode(`facet condition "${row.id}"`, requireLinkedRecord(rangeRow?.unit_code, `facet condition "${row.id}" is missing unit_code.`))
            }
          : {})
      } as PredicateConditionAuthored
    }

    case 'DURATION': {
      const [selection, durationRow, durationKindRows] = await Promise.all([
        hydratePredicateSelectable(db, row.id),
        db.selectFrom('facet_predicate_durations')
          .select(['duration_kind', 'min_amount', 'max_amount'])
          .where('facet_condition_id', '=', row.id)
          .executeTakeFirst(),
        db.selectFrom('facet_predicate_duration_kind_items')
          .select(['duration_kind', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute()
      ])
      const durationKinds = durationKindRows.length > 0
        ? durationKindRows.map((item) => requireDurationKind(`facet condition "${row.id}"`, item.duration_kind))
        : (durationRow?.duration_kind ? [requireDurationKind(`facet condition "${row.id}"`, durationRow.duration_kind)] : [])
      const includesInstantaneous = durationKinds.includes(DURATION_KIND.INSTANTANEOUS)

      if (selection.authoringModeKind === AUTHORING_MODE_KIND.ALL) {
        const duration = requireLinkedRecord(durationRow, `facet condition "${row.id}" is missing duration payload.`)

        return {
          ...base,
          ...selection,
          min: Number(requireLinkedRecord(duration.min_amount, `facet condition "${row.id}" is missing min_amount.`)),
          max: duration.max_amount == null ? undefined : Number(duration.max_amount)
        } as PredicateConditionAuthored
      }

      if (durationKinds.length === 0) {
        throw new Error(`facet condition "${row.id}" is missing duration_kind.`)
      }

      if (includesInstantaneous && durationKinds.length !== 1) {
        throw new Error(`facet condition "${row.id}" cannot mix INSTANTANEOUS with timed duration kinds.`)
      }

      return {
        ...base,
        ...selection,
        durationKind: durationKinds,
        ...(includesInstantaneous
          ? {}
          : {
              min: Number(requireLinkedRecord(requireLinkedRecord(durationRow, `facet condition "${row.id}" is missing duration payload.`).min_amount, `facet condition "${row.id}" is missing min_amount.`)),
              max: durationRow?.max_amount == null ? undefined : Number(durationRow.max_amount)
            }
        )
      } as PredicateConditionAuthored
    }

    case 'MAGIC_SCHOOL': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const items = await db.selectFrom('facet_predicate_magic_school_items')
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
      const items = await db.selectFrom('facet_predicate_ability_items')
        .select(['ability_code', 'sort_order'])
        .where('facet_condition_id', '=', row.id)
        .orderBy('sort_order')
        .execute()

      return {
        ...base,
        ...selection,
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? { abilities: items.map((item) => requireAbilityCode(`facet condition "${row.id}"`, item.ability_code)) }
          : {})
      } as PredicateConditionAuthored
    }

    case 'ABILITY_SCORE': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const [items, range] = await Promise.all([
        db.selectFrom('facet_predicate_ability_items')
          .select(['ability_code', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute(),
        db.selectFrom('facet_predicate_numeric_ranges')
          .select(['min_value', 'max_value'])
          .where('facet_condition_id', '=', row.id)
          .executeTakeFirst()
      ])

      return {
        ...base,
        ...selection,
        min: Number(requireLinkedRecord(range, `facet condition "${row.id}" is missing numeric range payload.`).min_value),
        max: range?.max_value == null ? undefined : Number(range.max_value),
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? { abilities: requireSingleAbility(row.id, items.map((item) => item.ability_code)) }
          : {})
      } as PredicateConditionAuthored
    }

    case 'SAVING_THROW_ABILITY_BONUS': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const [items, range] = await Promise.all([
        db.selectFrom('facet_predicate_ability_items')
          .select(['ability_code', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute(),
        db.selectFrom('facet_predicate_numeric_ranges')
          .select(['min_value', 'max_value'])
          .where('facet_condition_id', '=', row.id)
          .executeTakeFirst()
      ])

      return {
        ...base,
        ...selection,
        min: Number(requireLinkedRecord(range, `facet condition "${row.id}" is missing numeric range payload.`).min_value),
        max: range?.max_value == null ? undefined : Number(range.max_value),
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? { abilities: requireSingleAbility(row.id, items.map((item) => item.ability_code)) }
          : {})
      } as PredicateConditionAuthored
    }

    case 'SAVE_ABILITY_PROFICIENCY': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const [items, levelRow] = await Promise.all([
        db.selectFrom('facet_predicate_ability_items')
          .select(['ability_code', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute(),
        db.selectFrom('facet_predicate_proficiency_levels')
          .select(['proficiency_level'])
          .where('facet_condition_id', '=', row.id)
          .executeTakeFirst()
      ])

      return {
        ...base,
        ...selection,
        level: requireScalingAmountKind(`facet condition "${row.id}"`, requireLinkedRecord(levelRow, `facet condition "${row.id}" is missing proficiency level.`).proficiency_level),
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? { abilities: requireSingleAbility(row.id, items.map((item) => item.ability_code)) }
          : {})
      } as PredicateConditionAuthored
    }

    case 'EQUIPMENT_CATEGORY': {
      const rowData = requireLinkedRecord(await db.selectFrom('facet_predicate_equipment_categories')
        .select(['category_code'])
        .where('facet_condition_id', '=', row.id)
        .executeTakeFirst(), `facet condition "${row.id}" is missing equipment category payload.`)

      return {
        ...base,
        category: requireEquipmentCategory(`facet condition "${row.id}"`, rowData.category_code)
      } as PredicateConditionAuthored
    }

    case 'EQUIPMENT_PROPERTY':
    case 'EQUIPMENT_PROPERTY_PROFICIENCY': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const [categoryRow, propertyItems] = await Promise.all([
        db.selectFrom('facet_predicate_equipment_categories')
          .select(['category_code'])
          .where('facet_condition_id', '=', row.id)
          .executeTakeFirst(),
        db.selectFrom('facet_predicate_equipment_property_items')
          .select(['property_code', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute()
      ])

      return {
        ...base,
        ...selection,
        category: categoryRow ? requireEquipmentCategory(`facet condition "${row.id}"`, categoryRow.category_code) : undefined,
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? { properties: propertyItems.map((item) => requireEquipmentProperty(`facet condition "${row.id}"`, item.property_code)) }
          : {})
      } as PredicateConditionAuthored
    }

    case 'EQUIPMENT_PROFICIENCY': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const [
        categoryRow,
        propertyItems,
        levelRow,
        equipmentItems
      ] = await Promise.all([
        db.selectFrom('facet_predicate_equipment_categories')
          .select(['category_code'])
          .where('facet_condition_id', '=', row.id)
          .executeTakeFirst(),
        db.selectFrom('facet_predicate_equipment_property_items')
          .select(['property_code', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute(),
        db.selectFrom('facet_predicate_proficiency_levels')
          .select(['proficiency_level'])
          .where('facet_condition_id', '=', row.id)
          .executeTakeFirst(),
        db.selectFrom('facet_predicate_equipment_items')
          .select(['equipment_id', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute()
      ])

      return {
        ...base,
        ...selection,
        category: categoryRow ? requireEquipmentCategory(`facet condition "${row.id}"`, categoryRow.category_code) : undefined,
        properties: propertyItems.length > 0
          ? propertyItems.map((item) => requireEquipmentProperty(`facet condition "${row.id}"`, item.property_code))
          : undefined,
        level: requireScalingAmountKind(`facet condition "${row.id}"`, requireLinkedRecord(levelRow, `facet condition "${row.id}" is missing proficiency level.`).proficiency_level),
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? { equipmentIds: equipmentItems.map((item) => item.equipment_id) }
          : {})
      } as PredicateConditionAuthored
    }

    case 'EQUIPMENT_EQUIPPED': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const [categoryRow, propertyItems, equipmentItems] = await Promise.all([
        db.selectFrom('facet_predicate_equipment_categories')
          .select(['category_code'])
          .where('facet_condition_id', '=', row.id)
          .executeTakeFirst(),
        db.selectFrom('facet_predicate_equipment_property_items')
          .select(['property_code', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute(),
        db.selectFrom('facet_predicate_equipment_items')
          .select(['equipment_id', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute()
      ])

      return {
        ...base,
        ...selection,
        category: categoryRow ? requireEquipmentCategory(`facet condition "${row.id}"`, categoryRow.category_code) : undefined,
        properties: propertyItems.length > 0
          ? propertyItems.map((item) => requireEquipmentProperty(`facet condition "${row.id}"`, item.property_code))
          : undefined,
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? { equipmentIds: equipmentItems.map((item) => item.equipment_id) }
          : {})
      } as PredicateConditionAuthored
    }

    case 'DAMAGE_TYPE': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const items = await db.selectFrom('facet_predicate_damage_type_items')
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
      const items = await db.selectFrom('facet_predicate_condition_type_items')
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
      const items = await db.selectFrom('facet_predicate_subclass_specialization_items')
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
      const items = await db.selectFrom('facet_predicate_size_items')
        .select(['size_code', 'sort_order'])
        .where('facet_condition_id', '=', row.id)
        .orderBy('sort_order')
        .execute()

      return {
        ...base,
        ...selection,
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? { sizes: items.map((item) => requireSizeCode(`facet condition "${row.id}"`, item.size_code)) }
          : {})
      } as PredicateConditionAuthored
    }

    case 'CREATURE_RECORD_KIND': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const items = await db.selectFrom('facet_predicate_creature_record_kind_items')
        .select(['record_kind', 'sort_order'])
        .where('facet_condition_id', '=', row.id)
        .orderBy('sort_order')
        .execute()

      return {
        ...base,
        ...selection,
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? { recordKinds: items.map((item) => requireCreatureRecordKind(`facet condition "${row.id}"`, item.record_kind)) }
          : {})
      } as PredicateConditionAuthored
    }

    case 'CREATURE_CATEGORY': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const items = await db.selectFrom('facet_predicate_creature_category_items')
        .select(['category_code', 'sort_order'])
        .where('facet_condition_id', '=', row.id)
        .orderBy('sort_order')
        .execute()

      return {
        ...base,
        ...selection,
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? { categories: items.map((item) => requireCreatureCategory(`facet condition "${row.id}"`, item.category_code)) }
          : {})
      } as PredicateConditionAuthored
    }

    case 'CREATURE_TYPE': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const items = await db.selectFrom('facet_predicate_creature_type_items')
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
      const items = await db.selectFrom('facet_predicate_size_items')
        .select(['size_code', 'sort_order'])
        .where('facet_condition_id', '=', row.id)
        .orderBy('sort_order')
        .execute()

      return {
        ...base,
        ...selection,
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? { sizes: items.map((item) => requireSizeCode(`facet condition "${row.id}"`, item.size_code)) }
          : {})
      } as PredicateConditionAuthored
    }

    case 'CREATURE_IS_MOUNT':
    case 'CREATURE_IS_COMPANION':
      return base as PredicateConditionAuthored

    case 'VEHICLE_CATEGORY': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const items = await db.selectFrom('facet_predicate_vehicle_category_items')
        .select(['category_code', 'sort_order'])
        .where('facet_condition_id', '=', row.id)
        .orderBy('sort_order')
        .execute()

      return {
        ...base,
        ...selection,
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? { categories: items.map((item) => requireVehicleCategory(`facet condition "${row.id}"`, item.category_code)) }
          : {})
      } as PredicateConditionAuthored
    }

    case 'CHARGE_LIMIT_KIND': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const items = await db.selectFrom('facet_predicate_charge_limit_kind_items')
        .select(['charge_limit_kind', 'sort_order'])
        .where('facet_condition_id', '=', row.id)
        .orderBy('sort_order')
        .execute()

      return {
        ...base,
        ...selection,
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? { chargeLimitKind: items.map((item) => requireChargeLimitKind(`facet condition "${row.id}"`, item.charge_limit_kind)) }
          : {})
      } as PredicateConditionAuthored
    }

    case 'CHARGE_RESET_KIND': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const items = await db.selectFrom('facet_predicate_charge_reset_kind_items')
        .select(['charge_reset_kind', 'sort_order'])
        .where('facet_condition_id', '=', row.id)
        .orderBy('sort_order')
        .execute()

      return {
        ...base,
        ...selection,
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? { chargeResetKind: items.map((item) => requireChargeResetKind(`facet condition "${row.id}"`, item.charge_reset_kind)) }
          : {})
      } as PredicateConditionAuthored
    }

    case 'SKILL_PROFICIENCY':
    case 'SKILL_SCORE': {
      const selection = await hydratePredicateSelectable(db, row.id)
      const items = await db.selectFrom('facet_predicate_skill_items')
        .select(['skill_id', 'sort_order'])
        .where('facet_condition_id', '=', row.id)
        .orderBy('sort_order')
        .execute()
      const levelRow = predicateCode === 'SKILL_PROFICIENCY'
        ? await db.selectFrom('facet_predicate_proficiency_levels')
            .select(['proficiency_level'])
            .where('facet_condition_id', '=', row.id)
            .executeTakeFirst()
        : null

      return {
        ...base,
        ...selection,
        ...(predicateCode === 'SKILL_PROFICIENCY'
          ? {
              level: requireScalingAmountKind(`facet condition "${row.id}"`, requireLinkedRecord(levelRow, `facet condition "${row.id}" is missing proficiency level.`).proficiency_level)
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
        db.selectFrom('facet_predicate_language_items')
          .select(['language_id', 'sort_order'])
          .where('facet_condition_id', '=', row.id)
          .orderBy('sort_order')
          .execute(),
        db.selectFrom('facet_predicate_proficiency_levels')
          .select(['proficiency_level'])
          .where('facet_condition_id', '=', row.id)
          .executeTakeFirst()
      ])

      return {
        ...base,
        ...selection,
        level: requireScalingAmountKind(`facet condition "${row.id}"`, requireLinkedRecord(levelRow, `facet condition "${row.id}" is missing proficiency level.`).proficiency_level),
        ...(selection.authoringModeKind === AUTHORING_MODE_KIND.SELECTED
          ? { languageIds: items.map((item) => item.language_id) }
          : {})
      } as PredicateConditionAuthored
    }

    default:
      throw new Error(
        `Facet condition "${row.id}" uses unsupported predicate "${predicateCode}" for typed hydration.`
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
  const targetSubject = requireRelationTargetSubject(`facet condition "${row.id}"`, parentSubject, relationCode)
  const selection = await hydrateSelection(db, 'facet_exists_selections', 'facet_exists_selection_items', 'facet_condition_id', row.id, targetSubject)
  const orderRow = requireLinkedRecord(await db.selectFrom('facet_conditions')
    .select(['sort_order'])
    .where('id', '=', row.id)
    .executeTakeFirst(), `facet condition "${row.id}" is missing sort_order.`)

  return {
    id: row.id,
    order: orderRow.sort_order,
    kind: 'EXISTS',
    constraint: requireConstraint(`facet condition "${row.id}"`, row.constraint_code),
    relationCode,
    ...selection,
    where: row.where_facet_body_id
      ? await hydrateBodyById(db, row.where_facet_body_id)
      : undefined
  } as ExistsConditionAuthored
}

async function hydrateBodyById(
  db: DBLike,
  bodyId: string
): Promise<FacetBodyAuthored> {
  const bodyRow = requireLinkedRecord(await db.selectFrom('facet_bodies')
    .select(['id', 'node_subject_code'])
    .where('id', '=', bodyId)
    .executeTakeFirst(), `facet body "${bodyId}" is missing.`)
  const subject = requireNodeSubject(`facet body "${bodyId}"`, bodyRow.node_subject_code)
  const selection = await hydrateSelection(db, 'facet_body_selections', 'facet_body_selection_items', 'facet_body_id', bodyId, subject)
  const groupRows = await db.selectFrom('facet_body_groups')
    .select(['id', 'sort_order'])
    .where('facet_body_id', '=', bodyId)
    .orderBy('sort_order')
    .execute()

  const groups = await Promise.all(groupRows.map(async (groupRow) => {
    const conditionRows = await db.selectFrom('facet_conditions')
      .select([
        'id',
        'kind',
        'constraint_code',
        'predicate_code',
        'relation_code',
        'where_facet_body_id'
      ])
      .where('facet_body_group_id', '=', groupRow.id)
      .orderBy('sort_order')
      .execute()

    return {
      id: groupRow.id,
      order: groupRow.sort_order,
      conditions: await Promise.all(
        conditionRows.map((conditionRow) => hydrateCondition(db, conditionRow as PredicateRow, subject))
      )
    }
  }))

  return {
    ...selection,
    groups
  } as unknown as FacetBodyAuthored
}

export async function hydrateFacetById<N extends NodeSubjectCode = NodeSubjectCode>(
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

  const groupRows = await db.selectFrom('facet_groups')
    .select(['id', 'sort_order'])
    .where('facet_id', '=', facetId)
    .orderBy('sort_order')
    .execute()

  const groups = await Promise.all(groupRows.map(async (groupRow) => {
    const contextRows = await db.selectFrom('facet_contexts')
      .select(['id', 'node_subject_code', 'sort_order'])
      .where('facet_group_id', '=', groupRow.id)
      .orderBy('sort_order')
      .execute()

    const contexts = await Promise.all(contextRows.map(async (contextRow) => {
      const subject = requireNodeSubject(`facet context "${contextRow.id}"`, contextRow.node_subject_code)
      const bodyRow = requireLinkedRecord(await db.selectFrom('facet_context_bodies')
        .select(['facet_body_id'])
        .where('facet_context_id', '=', contextRow.id)
        .executeTakeFirst(), `facet context "${contextRow.id}" is missing body mapping.`)
      const bodyId = bodyRow.facet_body_id
      const conditionGroupRows = await db.selectFrom('facet_body_groups')
        .select(['id'])
        .where('facet_body_id', '=', bodyId)
        .orderBy('sort_order')
        .execute()

      const conditions = (
        await Promise.all(conditionGroupRows.map(async (bodyGroupRow) => {
          const conditionRows = await db.selectFrom('facet_conditions')
            .select([
              'id',
              'kind',
              'constraint_code',
              'predicate_code',
              'relation_code',
              'where_facet_body_id'
            ])
            .where('facet_body_group_id', '=', bodyGroupRow.id)
            .orderBy('sort_order')
            .execute()

          return Promise.all(
            conditionRows.map((conditionRow) => hydrateCondition(db, conditionRow as PredicateRow, subject))
          )
        }))
      ).flat()

      if (subject === 'CHARACTER') {
        return {
          id: contextRow.id,
          order: contextRow.sort_order,
          subject,
          conditions
        } as unknown as FacetContextAuthored
      }

      const selection = await hydrateSelection(db, 'facet_body_selections', 'facet_body_selection_items', 'facet_body_id', bodyId, subject)

      return {
        id: contextRow.id,
        order: contextRow.sort_order,
        subject,
        ...selection,
        conditions
      } as unknown as FacetContextAuthored
    }))

    return {
      id: groupRow.id,
      order: groupRow.sort_order,
      contexts
    }
  }))

  return {
    id: row.id,
    groups
  } as unknown as FacetAuthored<N>
}
