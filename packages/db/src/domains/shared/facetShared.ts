import {
  ABILITY_CODE,
  AUTHORING_CONSTRAINT,
  AUTHORING_MODE_KIND,
  CHARGE_LIMIT_KIND,
  CHARGE_RESET_KIND,
  CREATURE_CATEGORY_CODE,
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
  type NodeSubjectCode
} from '@artificer-toolkit/shared'

export type SelectionColumn = {
  payloadKey: string
  column: string
  mode?: 'many' | 'single'
}

export const SUBJECT_SELECTION_COLUMNS = {
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

export type SelectableSubjectCode = keyof typeof SUBJECT_SELECTION_COLUMNS

export function requireLinkedRecord<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw new Error(message)
  }

  return value
}

export function requireNodeSubject(ownerId: string, value: string): NodeSubjectCode {
  if (!(value in NODE_SUBJECT)) {
    throw new Error(`${ownerId} has invalid node_subject_code "${value}".`)
  }

  return value as NodeSubjectCode
}

export function requireAuthoringMode(
  ownerId: string,
  value: string
): typeof AUTHORING_MODE_KIND.ALL | typeof AUTHORING_MODE_KIND.SELECTED {
  if (value !== AUTHORING_MODE_KIND.ALL && value !== AUTHORING_MODE_KIND.SELECTED) {
    throw new Error(`${ownerId} has invalid authoring_mode_kind "${value}".`)
  }

  return value
}

export function requireConstraint(
  ownerId: string,
  value: string
): typeof AUTHORING_CONSTRAINT.INCLUDE | typeof AUTHORING_CONSTRAINT.EXCLUDE {
  if (value !== AUTHORING_CONSTRAINT.INCLUDE && value !== AUTHORING_CONSTRAINT.EXCLUDE) {
    throw new Error(`${ownerId} has invalid constraint_code "${value}".`)
  }

  return value
}

export function requirePredicateCode(
  ownerId: string,
  value: string | null
): keyof typeof PREDICATE_REGISTRY {
  if (!value || !(value in PREDICATE_REGISTRY)) {
    throw new Error(`${ownerId} has invalid predicate_code "${value}".`)
  }

  return value as keyof typeof PREDICATE_REGISTRY
}

export function requireAbilityCode(ownerId: string, value: string): keyof typeof ABILITY_CODE {
  if (!(value in ABILITY_CODE)) {
    throw new Error(`${ownerId} has invalid ability_code "${value}".`)
  }

  return value as keyof typeof ABILITY_CODE
}

export function requireEquipmentCategory(
  ownerId: string,
  value: string
): keyof typeof EQUIPMENT_CATEGORY_CODE {
  if (!(value in EQUIPMENT_CATEGORY_CODE)) {
    throw new Error(`${ownerId} has invalid equipment category "${value}".`)
  }

  return value as keyof typeof EQUIPMENT_CATEGORY_CODE
}

export function requireEquipmentProperty(
  ownerId: string,
  value: string
): keyof typeof EQUIPMENT_PROPERTY_CODE {
  if (!(value in EQUIPMENT_PROPERTY_CODE)) {
    throw new Error(`${ownerId} has invalid equipment property "${value}".`)
  }

  return value as keyof typeof EQUIPMENT_PROPERTY_CODE
}

export function requireScalingAmountKind(
  ownerId: string,
  value: string
): keyof typeof SCALING_AMOUNT_KIND {
  if (!(value in SCALING_AMOUNT_KIND)) {
    throw new Error(`${ownerId} has invalid proficiency level "${value}".`)
  }

  return value as keyof typeof SCALING_AMOUNT_KIND
}

export function requireMeasurementUnitCode(
  ownerId: string,
  value: string
): keyof typeof MEASUREMENT_UNIT_CODE {
  if (!(value in MEASUREMENT_UNIT_CODE)) {
    throw new Error(`${ownerId} has invalid measurement unit "${value}".`)
  }

  return value as keyof typeof MEASUREMENT_UNIT_CODE
}

export function requireRangeKind(ownerId: string, value: string): keyof typeof RANGE_KIND {
  if (!(value in RANGE_KIND)) {
    throw new Error(`${ownerId} has invalid range kind "${value}".`)
  }

  return value as keyof typeof RANGE_KIND
}

export function requireDurationKind(ownerId: string, value: string): keyof typeof DURATION_KIND {
  if (!(value in DURATION_KIND)) {
    throw new Error(`${ownerId} has invalid duration kind "${value}".`)
  }

  return value as keyof typeof DURATION_KIND
}

export function requireSizeCode(ownerId: string, value: string): keyof typeof SIZE_CODE {
  if (!(value in SIZE_CODE)) {
    throw new Error(`${ownerId} has invalid size code "${value}".`)
  }

  return value as keyof typeof SIZE_CODE
}

export function requireCreatureCategory(
  ownerId: string,
  value: string
): keyof typeof CREATURE_CATEGORY_CODE {
  if (!(value in CREATURE_CATEGORY_CODE)) {
    throw new Error(`${ownerId} has invalid creature category "${value}".`)
  }

  return value as keyof typeof CREATURE_CATEGORY_CODE
}

export function requireVehicleCategory(
  ownerId: string,
  value: string
): keyof typeof VEHICLE_CATEGORY_CODE {
  if (!(value in VEHICLE_CATEGORY_CODE)) {
    throw new Error(`${ownerId} has invalid vehicle category "${value}".`)
  }

  return value as keyof typeof VEHICLE_CATEGORY_CODE
}

export function requireChargeLimitKind(
  ownerId: string,
  value: string
): keyof typeof CHARGE_LIMIT_KIND {
  if (!(value in CHARGE_LIMIT_KIND)) {
    throw new Error(`${ownerId} has invalid charge limit kind "${value}".`)
  }

  return value as keyof typeof CHARGE_LIMIT_KIND
}

export function requireChargeResetKind(
  ownerId: string,
  value: string
): keyof typeof CHARGE_RESET_KIND {
  if (!(value in CHARGE_RESET_KIND)) {
    throw new Error(`${ownerId} has invalid charge reset kind "${value}".`)
  }

  return value as keyof typeof CHARGE_RESET_KIND
}

export function requireProficiencyKind(
  ownerId: string,
  value: string
): keyof typeof PROFICIENCY_KIND {
  if (!(value in PROFICIENCY_KIND)) {
    throw new Error(`${ownerId} has invalid proficiency kind "${value}".`)
  }

  return value as keyof typeof PROFICIENCY_KIND
}

export function requireRelationTargetSubject(
  ownerId: string,
  subject: NodeSubjectCode,
  relationCode: string
): NodeSubjectCode {
  const relationMap = RELATIONS[subject as keyof typeof RELATIONS] as
    | Record<string, { to: NodeSubjectCode }>
    | undefined
  const relation = relationMap?.[relationCode]

  if (!relation) {
    throw new Error(`${ownerId} has invalid relation "${relationCode}" for subject "${subject}".`)
  }

  return relation.to
}

export function isSelectableSubjectCode(
  subject: NodeSubjectCode
): subject is SelectableSubjectCode {
  return subject in SUBJECT_SELECTION_COLUMNS
}

export function requireSingleAbility(
  conditionId: string,
  abilityCodes: string[]
): keyof typeof ABILITY_CODE {
  if (abilityCodes.length !== 1) {
    throw new Error(
      `facet condition "${conditionId}" expected exactly one ability, found ${abilityCodes.length}.`
    )
  }

  return requireAbilityCode(`facet condition "${conditionId}"`, abilityCodes[0] as string)
}
