import type { ModifierGrantAuthored } from '@artificer-toolkit/shared'
import { sql } from 'kysely'
import {
  ABILITY_CODE,
  ATTACK_DOMAIN_CODE,
  CHARGE_LIMIT_KIND,
  CHARGE_RESET_KIND,
  CHARGE_SCALING,
  DURATION_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  RANGE_KIND,
  SHAPE_KIND,
  VALUE_DOMAIN_CODE
} from '@artificer-toolkit/shared'
import type { DBLike } from '#types'
import { upsertModifierGrant } from '../upserts/modifier.js'
import { hydrateFacetById } from '../../shared/facets.js'
import { requireNoSelectionDuplicatePolicy } from './helpers.js'
import type { ModifierGrantRepository } from '../../../repositories/contracts.js'
import { hydrateByIds, orderedHydratedRecords, uniqueIds } from '../../../repositories/batch.js'

type ModifierGrantRow = {
  id: string
  system_id: string
  sort_order: number
  selection_kind: string
  count: number | null
  selection_duplicate_policy: string | null
  value_domain_code: string
  modifier_kind: string
  scope: string
  restriction_id: string | null
}

type ModifierGrantDomainRow = {
  modifier_grant_id: string
  system_id: string
  value_domain_code: string
  attack_domain_code: string | null
  ability_code: string | null
  skill_id: string | null
  speed_id: string | null
  sense_definition_id: string | null
  spell_level: number | null
  condition_type_id: string | null
}

function parseModifierGrantDomainRow(row: {
  modifier_grant_id: string
  system_id?: unknown
  value_domain_code: string
  attack_domain_code: string | null
  ability_code: string | null
  skill_id: string | null
  speed_id: string | null
  sense_definition_id?: unknown
  spell_level: number | null
  condition_type_id: string | null
}): ModifierGrantDomainRow {
  if (typeof row.system_id !== 'string' || row.system_id.length === 0) {
    throw new Error(`Modifier grant "${row.modifier_grant_id}" is missing domain system_id.`)
  }
  if (row.sense_definition_id !== null && typeof row.sense_definition_id !== 'string') {
    throw new Error(
      `Modifier grant "${row.modifier_grant_id}" has an invalid domain sense_definition_id.`
    )
  }
  return {
    ...row,
    system_id: row.system_id,
    sense_definition_id: row.sense_definition_id
  }
}

type DbNumeric = number | string

type ModifierGrantPayloadRow = {
  modifier_grant_id: string
  modifier_kind: string
  value_domain_code: string
  numeric_value_kind: string | null
  numeric_amount: DbNumeric | null
  numeric_multiplier: DbNumeric | null
  numeric_ability_code: string | null
  numeric_min: DbNumeric | null
  numeric_max: DbNumeric | null
  numeric_skill_id: string | null
  numeric_class_id: string | null
  set_amount: DbNumeric | null
  charge_limit_kind: string | null
  charge_scaling_kind: string | null
  charge_amount: DbNumeric | null
  charge_multiplier: DbNumeric | null
  charge_min: DbNumeric | null
  charge_max: DbNumeric | null
  dice: string | null
  damage_type_id: string | null
  condition_type_id: string | null
  movement_mode_id: string | null
  attribute_id: string | null
  range_kind: string | null
  duration_kind: string | null
  shape_kind: string | null
  reset_kind: string | null
}

type ModifierGrantChargeLevelRow = {
  id: string
  modifier_grant_id: string
  level: number
  amount: DbNumeric
  sort_order: number
}

type ModifierGrantOptionalAbilityRow = {
  modifier_grant_id: string
  ability_code: string
  sort_order: number
}

function groupByModifierGrantId<T extends { modifier_grant_id: string }>(
  rows: readonly T[]
): Map<string, T[]> {
  const grouped = new Map<string, T[]>()

  for (const row of rows) {
    const existing = grouped.get(row.modifier_grant_id)

    if (existing) {
      existing.push(row)
    } else {
      grouped.set(row.modifier_grant_id, [row])
    }
  }

  return grouped
}

function requireSelectionKind(grantId: string, value: string): 'GRANTED' {
  if (value !== 'GRANTED') {
    throw new Error(`Modifier grant "${grantId}" has invalid selection_kind "${value}".`)
  }

  return value
}

function requireNoGrantedCount(grantId: string, value: number | null) {
  if (value != null) {
    throw new Error(`Modifier grant "${grantId}" cannot hydrate count for GRANTED payload.`)
  }
}

function requireValueDomainCode(
  grantId: string,
  value: string
): ModifierGrantAuthored['valueDomainCode'] {
  if (!(value in VALUE_DOMAIN_CODE)) {
    throw new Error(`Modifier grant "${grantId}" has invalid value_domain_code "${value}".`)
  }

  return value as ModifierGrantAuthored['valueDomainCode']
}

function requireModifierKind(
  grantId: string,
  value: string
): ModifierGrantAuthored['modifierKind'] {
  if (!(value in MODIFIER_KIND)) {
    throw new Error(`Modifier grant "${grantId}" has invalid modifier_kind "${value}".`)
  }

  return value as ModifierGrantAuthored['modifierKind']
}

function requireScope(grantId: string, value: string): ModifierGrantAuthored['scope'] {
  if (!(value in MODIFIER_SCOPE_KIND)) {
    throw new Error(`Modifier grant "${grantId}" has invalid scope "${value}".`)
  }

  return value as ModifierGrantAuthored['scope']
}

function requireAbilityCode(
  grantId: string,
  value: string,
  field: string
): keyof typeof ABILITY_CODE {
  if (!(value in ABILITY_CODE)) {
    throw new Error(`Modifier grant "${grantId}" has invalid ${field} "${value}".`)
  }

  return value as keyof typeof ABILITY_CODE
}

function requireAttackDomainCode(
  grantId: string,
  value: string
): 'MELEE' | 'RANGED' | 'SPELL' | 'UNARMED' {
  if (!(value in ATTACK_DOMAIN_CODE)) {
    throw new Error(`Modifier grant "${grantId}" has invalid attack_domain_code "${value}".`)
  }

  return value as 'MELEE' | 'RANGED' | 'SPELL' | 'UNARMED'
}

function requireRangeKind(grantId: string, value: string): keyof typeof RANGE_KIND {
  if (!(value in RANGE_KIND)) {
    throw new Error(`Modifier grant "${grantId}" has invalid range_kind "${value}".`)
  }

  return value as keyof typeof RANGE_KIND
}

function requireDurationKind(grantId: string, value: string): keyof typeof DURATION_KIND {
  if (!(value in DURATION_KIND)) {
    throw new Error(`Modifier grant "${grantId}" has invalid duration_kind "${value}".`)
  }

  return value as keyof typeof DURATION_KIND
}

function requireShapeKind(grantId: string, value: string): keyof typeof SHAPE_KIND {
  if (!(value in SHAPE_KIND)) {
    throw new Error(`Modifier grant "${grantId}" has invalid shape_kind "${value}".`)
  }

  return value as keyof typeof SHAPE_KIND
}

function requireResetKind(grantId: string, value: string): keyof typeof CHARGE_RESET_KIND {
  if (!(value in CHARGE_RESET_KIND)) {
    throw new Error(`Modifier grant "${grantId}" has invalid reset_kind "${value}".`)
  }

  return value as keyof typeof CHARGE_RESET_KIND
}

function requireChargeLimitKind(grantId: string, value: string): string {
  if (!(value in CHARGE_LIMIT_KIND)) {
    throw new Error(`Modifier grant "${grantId}" has invalid charge_limit_kind "${value}".`)
  }

  return value
}

function requireChargeScalingKind(grantId: string, value: string): string {
  if (!(value in CHARGE_SCALING)) {
    throw new Error(`Modifier grant "${grantId}" has invalid charge_scaling_kind "${value}".`)
  }

  return value
}

function requireNumericValueKind(
  grantId: string,
  value: string | null
):
  | 'FIXED'
  | 'PROFICIENCY_BONUS'
  | 'SKILL_BONUS'
  | 'CHARACTER_LEVEL'
  | 'CLASS_LEVEL'
  | 'SPELL_SLOT_LEVEL' {
  if (
    value !== 'FIXED' &&
    value !== 'PROFICIENCY_BONUS' &&
    value !== 'SKILL_BONUS' &&
    value !== 'CHARACTER_LEVEL' &&
    value !== 'CLASS_LEVEL' &&
    value !== 'SPELL_SLOT_LEVEL'
  ) {
    throw new Error(`Modifier grant "${grantId}" has invalid numeric_value_kind "${value}".`)
  }

  return value
}

function requirePayloadRow(
  grantId: string,
  payload: ModifierGrantPayloadRow | undefined,
  modifierKind: string
): ModifierGrantPayloadRow {
  if (!payload) {
    throw new Error(`Modifier grant "${grantId}" is missing persisted payload for ${modifierKind}.`)
  }

  return payload
}

function requireLinkedRecord<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw new Error(message)
  }

  return value
}

function readNumericValue(grantId: string, value: DbNumeric, field: string): number {
  const numericValue = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numericValue)) {
    throw new Error(`Modifier grant "${grantId}" has invalid ${field} "${String(value)}".`)
  }

  return numericValue
}

function requireNumericValue(
  grantId: string,
  value: DbNumeric | null | undefined,
  field: string
): number {
  return readNumericValue(
    grantId,
    requireLinkedRecord(value, `Modifier grant "${grantId}" is missing ${field}.`),
    field
  )
}

function optionalNumericValue(
  grantId: string,
  value: DbNumeric | null | undefined,
  field: string
): number | undefined {
  return value == null ? undefined : readNumericValue(grantId, value, field)
}

function requireDomainRow(
  grantId: string,
  domainRow: ModifierGrantDomainRow | undefined
): ModifierGrantDomainRow {
  if (!domainRow) {
    throw new Error(`Modifier grant "${grantId}" is missing persisted domain params.`)
  }

  return domainRow
}

function hydrateDomain(
  row: ModifierGrantRow,
  domainRow: ModifierGrantDomainRow | undefined
): ModifierGrantAuthored['domain'] {
  switch (row.value_domain_code) {
    case 'ATTACK_ROLL':
    case 'DAMAGE': {
      const persisted = requireDomainRow(row.id, domainRow)
      if (!persisted.attack_domain_code) {
        throw new Error(`Modifier grant "${row.id}" is missing attack_domain_code.`)
      }

      return {
        attackDomain: requireAttackDomainCode(row.id, persisted.attack_domain_code)
      }
    }

    case 'SAVING_THROW_MODIFIER': {
      const persisted = requireDomainRow(row.id, domainRow)
      if (!persisted.ability_code) {
        throw new Error(`Modifier grant "${row.id}" is missing domain ability_code.`)
      }

      return {
        ability: requireAbilityCode(row.id, persisted.ability_code, 'domain ability_code'),
        ...(persisted.condition_type_id ? { conditionTypeId: persisted.condition_type_id } : {})
      }
    }

    case 'ABILITY_SCORE': {
      const persisted = requireDomainRow(row.id, domainRow)
      if (!persisted.ability_code) {
        throw new Error(`Modifier grant "${row.id}" is missing domain ability_code.`)
      }

      return {
        ability: requireAbilityCode(row.id, persisted.ability_code, 'domain ability_code')
      }
    }

    case 'SKILL_MODIFIER': {
      const persisted = requireDomainRow(row.id, domainRow)
      if (!persisted.skill_id) {
        throw new Error(`Modifier grant "${row.id}" is missing domain skill_id.`)
      }

      return { skillId: persisted.skill_id }
    }

    case 'SPEED': {
      const persisted = requireDomainRow(row.id, domainRow)
      if (!persisted.speed_id) {
        throw new Error(`Modifier grant "${row.id}" is missing domain speed_id.`)
      }

      return { speedId: persisted.speed_id }
    }

    case 'SENSE_RANGE': {
      const persisted = requireDomainRow(row.id, domainRow)
      if (!persisted.sense_definition_id) {
        throw new Error(`Modifier grant "${row.id}" is missing domain sense_definition_id.`)
      }

      return { senseDefinitionId: persisted.sense_definition_id }
    }

    case 'SPELL_SLOT_COUNT': {
      const persisted = requireDomainRow(row.id, domainRow)
      if (persisted.spell_level == null) {
        throw new Error(`Modifier grant "${row.id}" is missing domain spell_level.`)
      }

      return { spellLevel: persisted.spell_level }
    }

    default:
      return {}
  }
}

function hydratePayload(
  row: ModifierGrantRow,
  payloadRow: ModifierGrantPayloadRow | undefined,
  chargeLevels: ModifierGrantChargeLevelRow[],
  optionalAbilities: ModifierGrantOptionalAbilityRow[]
): ModifierGrantAuthored['payload'] {
  switch (row.modifier_kind) {
    case 'ADVANTAGE':
    case 'DISADVANTAGE':
      return undefined

    case 'BONUS':
    case 'PENALTY': {
      const payload = requirePayloadRow(row.id, payloadRow, row.modifier_kind)
      const valueKind = requireNumericValueKind(row.id, payload.numeric_value_kind)

      switch (valueKind) {
        case 'FIXED':
          return {
            valueKind: 'FIXED',
            amount: requireNumericValue(row.id, payload.numeric_amount, 'numeric_amount')
          }

        case 'PROFICIENCY_BONUS':
          return {
            valueKind: 'PROFICIENCY_BONUS',
            multiplier: optionalNumericValue(
              row.id,
              payload.numeric_multiplier,
              'numeric_multiplier'
            )
          }

        case 'SKILL_BONUS':
          if (!payload.numeric_skill_id) {
            throw new Error(
              `Modifier grant "${row.id}" SKILL_BONUS payload is missing numeric_skill_id.`
            )
          }

          return {
            valueKind: 'SKILL_BONUS',
            skillId: payload.numeric_skill_id,
            multiplier: optionalNumericValue(
              row.id,
              payload.numeric_multiplier,
              'numeric_multiplier'
            )
          }

        case 'CHARACTER_LEVEL':
          return {
            valueKind: 'CHARACTER_LEVEL',
            multiplier: optionalNumericValue(
              row.id,
              payload.numeric_multiplier,
              'numeric_multiplier'
            )
          }

        case 'CLASS_LEVEL':
          if (!payload.numeric_class_id) {
            throw new Error(
              `Modifier grant "${row.id}" CLASS_LEVEL payload is missing numeric_class_id.`
            )
          }

          return {
            valueKind: 'CLASS_LEVEL',
            classId: payload.numeric_class_id,
            multiplier: optionalNumericValue(
              row.id,
              payload.numeric_multiplier,
              'numeric_multiplier'
            )
          }

        case 'SPELL_SLOT_LEVEL':
          return {
            valueKind: 'SPELL_SLOT_LEVEL',
            multiplier: optionalNumericValue(
              row.id,
              payload.numeric_multiplier,
              'numeric_multiplier'
            )
          }
      }
    }

    case 'ABILITY_MODIFIER_BONUS': {
      const payload = requirePayloadRow(row.id, payloadRow, row.modifier_kind)
      if (!payload.numeric_ability_code) {
        throw new Error(
          `Modifier grant "${row.id}" ABILITY_MODIFIER_BONUS payload is missing numeric_ability_code.`
        )
      }

      return {
        ability: requireAbilityCode(row.id, payload.numeric_ability_code, 'numeric_ability_code'),
        multiplier: optionalNumericValue(row.id, payload.numeric_multiplier, 'numeric_multiplier'),
        min: optionalNumericValue(row.id, payload.numeric_min, 'numeric_min'),
        max: optionalNumericValue(row.id, payload.numeric_max, 'numeric_max')
      }
    }

    case 'SET_VALUE': {
      const payload = requirePayloadRow(row.id, payloadRow, row.modifier_kind)
      return { amount: requireNumericValue(row.id, payload.set_amount, 'set_amount') }
    }

    case 'ADD_BONUS_DIE': {
      const payload = requirePayloadRow(row.id, payloadRow, row.modifier_kind)
      if (!payload.dice) {
        throw new Error(`Modifier grant "${row.id}" ADD_BONUS_DIE payload is missing dice.`)
      }

      return { dice: payload.dice }
    }

    case 'REPLACE_DAMAGE_TYPE': {
      const payload = requirePayloadRow(row.id, payloadRow, row.modifier_kind)
      if (!payload.damage_type_id) {
        throw new Error(
          `Modifier grant "${row.id}" REPLACE_DAMAGE_TYPE payload is missing damage_type_id.`
        )
      }

      return { damageTypeId: payload.damage_type_id }
    }

    case 'ADD_OPTION':
    case 'REMOVE_OPTION': {
      const payload = requirePayloadRow(row.id, payloadRow, row.modifier_kind)

      switch (row.value_domain_code) {
        case 'DAMAGE_RESISTANCE':
        case 'DAMAGE_IMMUNITY':
        case 'DAMAGE_VULNERABILITY':
          if (!payload.damage_type_id) {
            throw new Error(`Modifier grant "${row.id}" option payload is missing damage_type_id.`)
          }

          return { damageTypeId: payload.damage_type_id }

        case 'CONDITION':
        case 'CONDITION_IMMUNITY':
          if (!payload.condition_type_id) {
            throw new Error(
              `Modifier grant "${row.id}" option payload is missing condition_type_id.`
            )
          }

          return { conditionTypeId: payload.condition_type_id }

        case 'ATTRIBUTE':
          if (!payload.attribute_id) {
            throw new Error(`Modifier grant "${row.id}" option payload is missing attribute_id.`)
          }

          return { attributeId: payload.attribute_id }

        case 'MOVEMENT_MODE':
          if (!payload.movement_mode_id) {
            throw new Error(
              `Modifier grant "${row.id}" option payload is missing movement_mode_id.`
            )
          }

          return { movementModeId: payload.movement_mode_id }

        default:
          throw new Error(
            `Modifier grant "${row.id}" cannot hydrate ${row.modifier_kind} for value_domain_code "${row.value_domain_code}".`
          )
      }
    }

    case 'REPLACE_RANGE_KIND': {
      const payload = requirePayloadRow(row.id, payloadRow, row.modifier_kind)
      if (!payload.range_kind) {
        throw new Error(
          `Modifier grant "${row.id}" REPLACE_RANGE_KIND payload is missing range_kind.`
        )
      }

      return { rangeKind: requireRangeKind(row.id, payload.range_kind) }
    }

    case 'REPLACE_DURATION_KIND': {
      const payload = requirePayloadRow(row.id, payloadRow, row.modifier_kind)
      if (!payload.duration_kind) {
        throw new Error(
          `Modifier grant "${row.id}" REPLACE_DURATION_KIND payload is missing duration_kind.`
        )
      }

      return { durationKind: requireDurationKind(row.id, payload.duration_kind) }
    }

    case 'REPLACE_SHAPE_KIND': {
      const payload = requirePayloadRow(row.id, payloadRow, row.modifier_kind)
      if (!payload.shape_kind) {
        throw new Error(
          `Modifier grant "${row.id}" REPLACE_SHAPE_KIND payload is missing shape_kind.`
        )
      }

      return { shapeKind: requireShapeKind(row.id, payload.shape_kind) }
    }

    case 'REPLACE_CHARGE_RESET_KIND': {
      const payload = requirePayloadRow(row.id, payloadRow, row.modifier_kind)
      if (!payload.reset_kind) {
        throw new Error(
          `Modifier grant "${row.id}" REPLACE_CHARGE_RESET_KIND payload is missing reset_kind.`
        )
      }

      return { resetKind: requireResetKind(row.id, payload.reset_kind) }
    }

    case 'OPTIONAL_ABILITY_MODIFIER_BONUS':
      return {
        abilities: optionalAbilities.map((ability) =>
          requireAbilityCode(row.id, ability.ability_code, 'optional ability_code')
        )
      }

    case 'MODIFY_CHARGE_LIMIT': {
      const payload = requirePayloadRow(row.id, payloadRow, row.modifier_kind)
      if (!payload.charge_limit_kind) {
        throw new Error(
          `Modifier grant "${row.id}" MODIFY_CHARGE_LIMIT payload is missing charge_limit_kind.`
        )
      }
      if (!payload.charge_scaling_kind) {
        throw new Error(
          `Modifier grant "${row.id}" MODIFY_CHARGE_LIMIT payload is missing charge_scaling_kind.`
        )
      }

      const limitKind = requireChargeLimitKind(row.id, payload.charge_limit_kind)
      const scalingKind = requireChargeScalingKind(row.id, payload.charge_scaling_kind)

      switch (limitKind) {
        case 'FIXED_AMOUNT':
          if (scalingKind === 'PER_LEVEL') {
            return {
              limitKind: 'FIXED_AMOUNT',
              scalingKind: 'PER_LEVEL',
              levels: chargeLevels.map((level) => ({
                id: level.id,
                level: level.level,
                amount: readNumericValue(row.id, level.amount, 'charge level amount')
              }))
            }
          }

          return {
            limitKind: 'FIXED_AMOUNT',
            scalingKind: 'NONE',
            amount: requireNumericValue(row.id, payload.charge_amount, 'charge_amount')
          }

        case 'CHARACTER_LEVEL':
          return {
            limitKind: 'CHARACTER_LEVEL',
            scalingKind: 'NONE',
            multiplier: optionalNumericValue(
              row.id,
              payload.charge_multiplier,
              'charge_multiplier'
            ),
            min: optionalNumericValue(row.id, payload.charge_min, 'charge_min'),
            max: optionalNumericValue(row.id, payload.charge_max, 'charge_max')
          }

        case 'ABILITY_MODIFIER':
          if (!payload.numeric_ability_code) {
            throw new Error(
              `Modifier grant "${row.id}" ABILITY_MODIFIER charge payload is missing numeric_ability_code.`
            )
          }

          return {
            limitKind: 'ABILITY_MODIFIER',
            scalingKind: 'NONE',
            ability: requireAbilityCode(
              row.id,
              payload.numeric_ability_code,
              'numeric_ability_code'
            ),
            multiplier: optionalNumericValue(
              row.id,
              payload.charge_multiplier,
              'charge_multiplier'
            ),
            min: optionalNumericValue(row.id, payload.charge_min, 'charge_min'),
            max: optionalNumericValue(row.id, payload.charge_max, 'charge_max')
          }

        case 'CLASS_LEVEL':
          if (!payload.numeric_class_id) {
            throw new Error(
              `Modifier grant "${row.id}" CLASS_LEVEL charge payload is missing numeric_class_id.`
            )
          }

          return {
            limitKind: 'CLASS_LEVEL',
            scalingKind: 'NONE',
            classId: payload.numeric_class_id,
            multiplier: optionalNumericValue(
              row.id,
              payload.charge_multiplier,
              'charge_multiplier'
            ),
            min: optionalNumericValue(row.id, payload.charge_min, 'charge_min'),
            max: optionalNumericValue(row.id, payload.charge_max, 'charge_max')
          }

        case 'PARENT_CLASS_LEVEL':
          return {
            limitKind: 'PARENT_CLASS_LEVEL',
            scalingKind: 'NONE',
            multiplier: optionalNumericValue(
              row.id,
              payload.charge_multiplier,
              'charge_multiplier'
            ),
            min: optionalNumericValue(row.id, payload.charge_min, 'charge_min'),
            max: optionalNumericValue(row.id, payload.charge_max, 'charge_max')
          }

        case 'SPELL_CAST_LEVEL':
          return {
            limitKind: 'SPELL_CAST_LEVEL',
            scalingKind: 'NONE',
            multiplier: optionalNumericValue(
              row.id,
              payload.charge_multiplier,
              'charge_multiplier'
            ),
            min: optionalNumericValue(row.id, payload.charge_min, 'charge_min'),
            max: optionalNumericValue(row.id, payload.charge_max, 'charge_max')
          }
      }
    }
  }
}

export async function hydrateModifierGrantById(
  db: DBLike,
  id: string
): Promise<ModifierGrantAuthored | null> {
  const root = (await db
    .selectFrom('modifier_grants')
    .select([
      'id',
      'system_id',
      'sort_order',
      'selection_kind',
      'count',
      'selection_duplicate_policy',
      'value_domain_code',
      'modifier_kind',
      'scope',
      'restriction_id'
    ])
    .where('id', '=', id)
    .executeTakeFirst()) as ModifierGrantRow | undefined

  if (!root) return null

  const [domainRow, payloadRow, chargeLevels, optionalAbilities, restrictions] = await Promise.all([
    db
      .selectFrom('modifier_grant_domain_params')
      .select([
        'modifier_grant_id',
        sql.ref('system_id').as('system_id'),
        'value_domain_code',
        'attack_domain_code',
        'ability_code',
        'skill_id',
        'speed_id',
        sql.ref('sense_definition_id').as('sense_definition_id'),
        'spell_level',
        'condition_type_id'
      ] as const)
      .where('modifier_grant_id', '=', id)
      .executeTakeFirst()
      .then((row) => (row ? parseModifierGrantDomainRow(row) : undefined)),
    db
      .selectFrom('modifier_grant_payloads')
      .select([
        'modifier_grant_id',
        'modifier_kind',
        'value_domain_code',
        'numeric_value_kind',
        'numeric_amount',
        'numeric_multiplier',
        'numeric_ability_code',
        'numeric_min',
        'numeric_max',
        'numeric_skill_id',
        'numeric_class_id',
        'set_amount',
        'charge_limit_kind',
        'charge_scaling_kind',
        'charge_amount',
        'charge_multiplier',
        'charge_min',
        'charge_max',
        'dice',
        'damage_type_id',
        'condition_type_id',
        'movement_mode_id',
        'attribute_id',
        'range_kind',
        'duration_kind',
        'shape_kind',
        'reset_kind'
      ])
      .where('modifier_grant_id', '=', id)
      .executeTakeFirst() as Promise<ModifierGrantPayloadRow | undefined>,
    db
      .selectFrom('modifier_grant_charge_levels')
      .select(['id', 'modifier_grant_id', 'level', 'amount', 'sort_order'])
      .where('modifier_grant_id', '=', id)
      .orderBy('sort_order')
      .execute() as Promise<ModifierGrantChargeLevelRow[]>,
    db
      .selectFrom('modifier_grant_optional_abilities')
      .select(['modifier_grant_id', 'ability_code', 'sort_order'])
      .where('modifier_grant_id', '=', id)
      .orderBy('sort_order')
      .execute() as Promise<ModifierGrantOptionalAbilityRow[]>,
    root.restriction_id ? hydrateFacetById(db, root.restriction_id) : Promise.resolve(null)
  ])

  const selectionKind = requireSelectionKind(root.id, root.selection_kind)
  requireNoGrantedCount(root.id, root.count)
  requireNoSelectionDuplicatePolicy(`Modifier grant "${root.id}"`, root.selection_duplicate_policy)
  const modifierKind = requireModifierKind(root.id, root.modifier_kind)
  const valueDomainCode = requireValueDomainCode(root.id, root.value_domain_code)
  const authored: ModifierGrantAuthored = {
    id: root.id,
    grantKind: 'MODIFIER_GRANT',
    order: root.sort_order,
    selectionKind,
    valueDomainCode,
    domain: hydrateDomain(root, domainRow),
    modifierKind,
    scope: requireScope(root.id, root.scope),
    payload: hydratePayload(root, payloadRow, chargeLevels, optionalAbilities),
    restrictions: root.restriction_id
      ? requireLinkedRecord(
          restrictions,
          `Modifier grant "${id}" is linked to missing restriction facet "${root.restriction_id}".`
        )
      : undefined
  } as ModifierGrantAuthored

  return authored
}

async function hydrateModifierGrantsByIds(
  db: DBLike,
  ids: readonly string[]
): Promise<Map<string, ModifierGrantAuthored>> {
  const distinctIds = uniqueIds(ids)

  if (distinctIds.length === 0) {
    return new Map()
  }

  const [roots, persistedDomainRows, payloadRows, chargeLevels, optionalAbilities] =
    await Promise.all([
      db
        .selectFrom('modifier_grants')
        .select([
          'id',
          'system_id',
          'sort_order',
          'selection_kind',
          'count',
          'selection_duplicate_policy',
          'value_domain_code',
          'modifier_kind',
          'scope',
          'restriction_id'
        ])
        .where('id', 'in', distinctIds)
        .execute() as Promise<ModifierGrantRow[]>,
      db
        .selectFrom('modifier_grant_domain_params')
        .select([
          'modifier_grant_id',
          sql.ref('system_id').as('system_id'),
          'value_domain_code',
          'attack_domain_code',
          'ability_code',
          'skill_id',
          'speed_id',
          sql.ref('sense_definition_id').as('sense_definition_id'),
          'spell_level',
          'condition_type_id'
        ] as const)
        .where('modifier_grant_id', 'in', distinctIds)
        .execute(),
      db
        .selectFrom('modifier_grant_payloads')
        .select([
          'modifier_grant_id',
          'modifier_kind',
          'value_domain_code',
          'numeric_value_kind',
          'numeric_amount',
          'numeric_multiplier',
          'numeric_ability_code',
          'numeric_min',
          'numeric_max',
          'numeric_skill_id',
          'numeric_class_id',
          'set_amount',
          'charge_limit_kind',
          'charge_scaling_kind',
          'charge_amount',
          'charge_multiplier',
          'charge_min',
          'charge_max',
          'dice',
          'damage_type_id',
          'condition_type_id',
          'movement_mode_id',
          'attribute_id',
          'range_kind',
          'duration_kind',
          'shape_kind',
          'reset_kind'
        ])
        .where('modifier_grant_id', 'in', distinctIds)
        .execute() as Promise<ModifierGrantPayloadRow[]>,
      db
        .selectFrom('modifier_grant_charge_levels')
        .select(['id', 'modifier_grant_id', 'level', 'amount', 'sort_order'])
        .where('modifier_grant_id', 'in', distinctIds)
        .orderBy('sort_order')
        .execute() as Promise<ModifierGrantChargeLevelRow[]>,
      db
        .selectFrom('modifier_grant_optional_abilities')
        .select(['modifier_grant_id', 'ability_code', 'sort_order'])
        .where('modifier_grant_id', 'in', distinctIds)
        .orderBy('modifier_grant_id')
        .orderBy('sort_order')
        .execute() as Promise<ModifierGrantOptionalAbilityRow[]>
    ])
  const domainRows = persistedDomainRows.map(parseModifierGrantDomainRow)
  const rootsById = new Map(roots.map((row) => [row.id, row]))
  const domainRowsByGrantId = new Map(domainRows.map((row) => [row.modifier_grant_id, row]))
  const payloadRowsByGrantId = new Map(payloadRows.map((row) => [row.modifier_grant_id, row]))
  const chargeLevelsByGrantId = groupByModifierGrantId(chargeLevels)
  const optionalAbilitiesByGrantId = groupByModifierGrantId(optionalAbilities)
  const restrictionsById = await hydrateByIds(
    roots.flatMap((root) => (root.restriction_id ? [root.restriction_id] : [])),
    (restrictionId) => hydrateFacetById(db, restrictionId)
  )
  const hydrated = new Map<string, ModifierGrantAuthored>()

  for (const id of distinctIds) {
    const root = rootsById.get(id)

    if (!root) continue

    const selectionKind = requireSelectionKind(root.id, root.selection_kind)
    requireNoGrantedCount(root.id, root.count)
    requireNoSelectionDuplicatePolicy(
      `Modifier grant "${root.id}"`,
      root.selection_duplicate_policy
    )

    const modifierKind = requireModifierKind(root.id, root.modifier_kind)
    const valueDomainCode = requireValueDomainCode(root.id, root.value_domain_code)
    hydrated.set(id, {
      id: root.id,
      grantKind: 'MODIFIER_GRANT',
      order: root.sort_order,
      selectionKind,
      valueDomainCode,
      domain: hydrateDomain(root, domainRowsByGrantId.get(id)),
      modifierKind,
      scope: requireScope(root.id, root.scope),
      payload: hydratePayload(
        root,
        payloadRowsByGrantId.get(id),
        chargeLevelsByGrantId.get(id) ?? [],
        optionalAbilitiesByGrantId.get(id) ?? []
      ),
      restrictions: root.restriction_id
        ? requireLinkedRecord(
            restrictionsById.get(root.restriction_id),
            `Modifier grant "${id}" is linked to missing restriction facet "${root.restriction_id}".`
          )
        : undefined
    } as ModifierGrantAuthored)
  }

  return hydrated
}

export function createModifierGrantRepository(
  db: DBLike,
  defaultSystemId?: string
): ModifierGrantRepository {
  return {
    async upsert(entity) {
      await upsertModifierGrant(db, entity, defaultSystemId)
    },

    async findById(id) {
      return hydrateModifierGrantById(db, id)
    },

    async findByIds(ids) {
      return hydrateModifierGrantsByIds(db, ids)
    },

    async findAll() {
      const rows = await db
        .selectFrom('modifier_grants')
        .select('id')
        .orderBy('sort_order')
        .execute()

      return orderedHydratedRecords(
        rows.map((row) => row.id as string),
        await hydrateByIds(
          rows.map((row) => row.id as string),
          (id) => hydrateModifierGrantById(db, id)
        )
      )
    }
  }
}
