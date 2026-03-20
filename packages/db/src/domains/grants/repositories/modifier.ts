import type { ModifierGrantAuthored } from '@artificer-toolkit/shared'
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
import type { ModifierGrantRepository } from '../../../repositories/contracts.js'

type ModifierGrantRow = {
  id: string
  sort_order: number
  selection_kind: string
  count: number | null
  value_domain_code: string
  modifier_kind: string
  scope: string
  restriction_id: string | null
}

type ModifierGrantDomainRow = {
  modifier_grant_id: string
  value_domain_code: string
  attack_domain_code: string | null
  ability_code: string | null
  skill_id: string | null
  speed_id: string | null
  sense_code: string | null
  spell_level: number | null
  condition_type_id: string | null
}

type ModifierGrantPayloadRow = {
  modifier_grant_id: string
  modifier_kind: string
  value_domain_code: string
  numeric_value_kind: string | null
  numeric_amount: number | null
  numeric_multiplier: number | null
  numeric_ability_code: string | null
  numeric_skill_id: string | null
  numeric_class_id: string | null
  set_amount: number | null
  charge_limit_kind: string | null
  charge_scaling_kind: string | null
  charge_amount: number | null
  charge_multiplier: number | null
  charge_min: number | null
  charge_max: number | null
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
  amount: number
  sort_order: number
}

type ModifierGrantOptionalAbilityRow = {
  modifier_grant_id: string
  ability_code: string
}

function requireSelectionKind(
  grantId: string,
  value: string
): 'GRANTED' | 'CHOSEN' {
  if (value !== 'GRANTED' && value !== 'CHOSEN') {
    throw new Error(`Modifier grant "${grantId}" has invalid selection_kind "${value}".`)
  }

  return value
}

function requireChosenCount(
  grantId: string,
  value: number | null
): number {
  if (value == null) {
    throw new Error(`Modifier grant "${grantId}" is missing count for CHOSEN payload.`)
  }

  return value
}

function requireNoGrantedCount(
  grantId: string,
  value: number | null
) {
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

function requireScope(
  grantId: string,
  value: string
): ModifierGrantAuthored['scope'] {
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

function requireRangeKind(
  grantId: string,
  value: string
): keyof typeof RANGE_KIND {
  if (!(value in RANGE_KIND)) {
    throw new Error(`Modifier grant "${grantId}" has invalid range_kind "${value}".`)
  }

  return value as keyof typeof RANGE_KIND
}

function requireDurationKind(
  grantId: string,
  value: string
): keyof typeof DURATION_KIND {
  if (!(value in DURATION_KIND)) {
    throw new Error(`Modifier grant "${grantId}" has invalid duration_kind "${value}".`)
  }

  return value as keyof typeof DURATION_KIND
}

function requireShapeKind(
  grantId: string,
  value: string
): keyof typeof SHAPE_KIND {
  if (!(value in SHAPE_KIND)) {
    throw new Error(`Modifier grant "${grantId}" has invalid shape_kind "${value}".`)
  }

  return value as keyof typeof SHAPE_KIND
}

function requireResetKind(
  grantId: string,
  value: string
): keyof typeof CHARGE_RESET_KIND {
  if (!(value in CHARGE_RESET_KIND)) {
    throw new Error(`Modifier grant "${grantId}" has invalid reset_kind "${value}".`)
  }

  return value as keyof typeof CHARGE_RESET_KIND
}

function requireChargeLimitKind(
  grantId: string,
  value: string
): string {
  if (!(value in CHARGE_LIMIT_KIND)) {
    throw new Error(`Modifier grant "${grantId}" has invalid charge_limit_kind "${value}".`)
  }

  return value
}

function requireChargeScalingKind(
  grantId: string,
  value: string
): string {
  if (!(value in CHARGE_SCALING)) {
    throw new Error(`Modifier grant "${grantId}" has invalid charge_scaling_kind "${value}".`)
  }

  return value
}

function requireNumericValueKind(
  grantId: string,
  value: string | null
): 'FIXED' | 'PROFICIENCY_BONUS' | 'ABILITY_MODIFIER' | 'SKILL_BONUS' | 'CHARACTER_LEVEL' | 'CLASS_LEVEL' | 'SPELL_SLOT_LEVEL' {
  if (
    value !== 'FIXED'
    && value !== 'PROFICIENCY_BONUS'
    && value !== 'ABILITY_MODIFIER'
    && value !== 'SKILL_BONUS'
    && value !== 'CHARACTER_LEVEL'
    && value !== 'CLASS_LEVEL'
    && value !== 'SPELL_SLOT_LEVEL'
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

function requireLinkedRecord<T>(
  value: T | null | undefined,
  message: string
): T {
  if (value == null) {
    throw new Error(message)
  }

  return value
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
    case 'ATTACK_ROLL_BONUS':
    case 'DAMAGE': {
      const persisted = requireDomainRow(row.id, domainRow)
      if (!persisted.attack_domain_code) {
        throw new Error(`Modifier grant "${row.id}" is missing attack_domain_code.`)
      }

      return {
        attackDomain: requireAttackDomainCode(row.id, persisted.attack_domain_code)
      }
    }

    case 'SAVING_THROW_BONUS': {
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

    case 'SKILL_BONUS': {
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
      if (!persisted.sense_code) {
        throw new Error(`Modifier grant "${row.id}" is missing domain sense_code.`)
      }

      return { senseCode: persisted.sense_code }
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
          if (payload.numeric_amount == null) {
            throw new Error(`Modifier grant "${row.id}" FIXED payload is missing numeric_amount.`)
          }

          return {
            valueKind: 'FIXED',
            amount: payload.numeric_amount
          }

        case 'PROFICIENCY_BONUS':
          return {
            valueKind: 'PROFICIENCY_BONUS',
            multiplier: payload.numeric_multiplier ?? undefined
          }

        case 'ABILITY_MODIFIER':
          if (!payload.numeric_ability_code) {
            throw new Error(`Modifier grant "${row.id}" ABILITY_MODIFIER payload is missing numeric_ability_code.`)
          }

          return {
            valueKind: 'ABILITY_MODIFIER',
            ability: requireAbilityCode(row.id, payload.numeric_ability_code, 'numeric_ability_code'),
            multiplier: payload.numeric_multiplier ?? undefined
          }

        case 'SKILL_BONUS':
          if (!payload.numeric_skill_id) {
            throw new Error(`Modifier grant "${row.id}" SKILL_BONUS payload is missing numeric_skill_id.`)
          }

          return {
            valueKind: 'SKILL_BONUS',
            skillId: payload.numeric_skill_id,
            multiplier: payload.numeric_multiplier ?? undefined
          }

        case 'CHARACTER_LEVEL':
          return {
            valueKind: 'CHARACTER_LEVEL',
            multiplier: payload.numeric_multiplier ?? undefined
          }

        case 'CLASS_LEVEL':
          if (!payload.numeric_class_id) {
            throw new Error(`Modifier grant "${row.id}" CLASS_LEVEL payload is missing numeric_class_id.`)
          }

          return {
            valueKind: 'CLASS_LEVEL',
            classId: payload.numeric_class_id,
            multiplier: payload.numeric_multiplier ?? undefined
          }

        case 'SPELL_SLOT_LEVEL':
          return {
            valueKind: 'SPELL_SLOT_LEVEL',
            multiplier: payload.numeric_multiplier ?? undefined
          }
      }
    }

    case 'SET_VALUE': {
      const payload = requirePayloadRow(row.id, payloadRow, row.modifier_kind)
      if (payload.set_amount == null) {
        throw new Error(`Modifier grant "${row.id}" SET_VALUE payload is missing set_amount.`)
      }

      return { amount: payload.set_amount }
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
        throw new Error(`Modifier grant "${row.id}" REPLACE_DAMAGE_TYPE payload is missing damage_type_id.`)
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
            throw new Error(`Modifier grant "${row.id}" option payload is missing condition_type_id.`)
          }

          return { conditionTypeId: payload.condition_type_id }

        case 'ATTRIBUTE':
          if (!payload.attribute_id) {
            throw new Error(`Modifier grant "${row.id}" option payload is missing attribute_id.`)
          }

          return { attributeId: payload.attribute_id }

        case 'MOVEMENT_MODE':
          if (!payload.movement_mode_id) {
            throw new Error(`Modifier grant "${row.id}" option payload is missing movement_mode_id.`)
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
        throw new Error(`Modifier grant "${row.id}" REPLACE_RANGE_KIND payload is missing range_kind.`)
      }

      return { rangeKind: requireRangeKind(row.id, payload.range_kind) }
    }

    case 'REPLACE_DURATION_KIND': {
      const payload = requirePayloadRow(row.id, payloadRow, row.modifier_kind)
      if (!payload.duration_kind) {
        throw new Error(`Modifier grant "${row.id}" REPLACE_DURATION_KIND payload is missing duration_kind.`)
      }

      return { durationKind: requireDurationKind(row.id, payload.duration_kind) }
    }

    case 'REPLACE_SHAPE_KIND': {
      const payload = requirePayloadRow(row.id, payloadRow, row.modifier_kind)
      if (!payload.shape_kind) {
        throw new Error(`Modifier grant "${row.id}" REPLACE_SHAPE_KIND payload is missing shape_kind.`)
      }

      return { shapeKind: requireShapeKind(row.id, payload.shape_kind) }
    }

    case 'REPLACE_CHARGE_RESET_KIND': {
      const payload = requirePayloadRow(row.id, payloadRow, row.modifier_kind)
      if (!payload.reset_kind) {
        throw new Error(`Modifier grant "${row.id}" REPLACE_CHARGE_RESET_KIND payload is missing reset_kind.`)
      }

      return { resetKind: requireResetKind(row.id, payload.reset_kind) }
    }

    case 'OPTIONAL_ABILITY_MODIFIER':
      return {
        abilities: optionalAbilities.map((ability) =>
          requireAbilityCode(row.id, ability.ability_code, 'optional ability_code')
        )
      }

    case 'MODIFY_CHARGE_LIMIT': {
      const payload = requirePayloadRow(row.id, payloadRow, row.modifier_kind)
      if (!payload.charge_limit_kind) {
        throw new Error(`Modifier grant "${row.id}" MODIFY_CHARGE_LIMIT payload is missing charge_limit_kind.`)
      }
      if (!payload.charge_scaling_kind) {
        throw new Error(`Modifier grant "${row.id}" MODIFY_CHARGE_LIMIT payload is missing charge_scaling_kind.`)
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
                amount: level.amount
              }))
            }
          }

          if (payload.charge_amount == null) {
            throw new Error(`Modifier grant "${row.id}" FIXED_AMOUNT charge payload is missing charge_amount.`)
          }

          return {
            limitKind: 'FIXED_AMOUNT',
            scalingKind: 'NONE',
            amount: payload.charge_amount
          }

        case 'CHARACTER_LEVEL':
          return {
            limitKind: 'CHARACTER_LEVEL',
            scalingKind: 'NONE',
            multiplier: payload.charge_multiplier ?? undefined,
            min: payload.charge_min ?? undefined,
            max: payload.charge_max ?? undefined
          }

        case 'CLASS_LEVEL':
          if (!payload.numeric_class_id) {
            throw new Error(`Modifier grant "${row.id}" CLASS_LEVEL charge payload is missing numeric_class_id.`)
          }

          return {
            limitKind: 'CLASS_LEVEL',
            scalingKind: 'NONE',
            classId: payload.numeric_class_id,
            multiplier: payload.charge_multiplier ?? undefined,
            min: payload.charge_min ?? undefined,
            max: payload.charge_max ?? undefined
          }

        case 'PARENT_CLASS_LEVEL':
          return {
            limitKind: 'PARENT_CLASS_LEVEL',
            scalingKind: 'NONE',
            multiplier: payload.charge_multiplier ?? undefined,
            min: payload.charge_min ?? undefined,
            max: payload.charge_max ?? undefined
          }

        case 'SPELL_CAST_LEVEL':
          return {
            limitKind: 'SPELL_CAST_LEVEL',
            scalingKind: 'NONE',
            multiplier: payload.charge_multiplier ?? undefined,
            min: payload.charge_min ?? undefined,
            max: payload.charge_max ?? undefined
          }
      }
    }
  }
}

export async function hydrateModifierGrantById(
  db: DBLike,
  id: string
): Promise<ModifierGrantAuthored | null> {
  const root = await db
    .selectFrom('modifier_grants')
    .select([
      'id',
      'sort_order',
      'selection_kind',
      'count',
      'value_domain_code',
      'modifier_kind',
      'scope',
      'restriction_id'
    ])
    .where('id', '=', id)
    .executeTakeFirst() as ModifierGrantRow | undefined

  if (!root) return null

  const [domainRow, payloadRow, chargeLevels, optionalAbilities, restrictions] = await Promise.all([
    db.selectFrom('modifier_grant_domain_params')
      .select([
        'modifier_grant_id',
        'value_domain_code',
        'attack_domain_code',
        'ability_code',
        'skill_id',
        'speed_id',
        'sense_code',
        'spell_level',
        'condition_type_id'
      ])
      .where('modifier_grant_id', '=', id)
      .executeTakeFirst() as Promise<ModifierGrantDomainRow | undefined>,
    db.selectFrom('modifier_grant_payloads')
      .select([
        'modifier_grant_id',
        'modifier_kind',
        'value_domain_code',
        'numeric_value_kind',
        'numeric_amount',
        'numeric_multiplier',
        'numeric_ability_code',
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
    db.selectFrom('modifier_grant_charge_levels')
      .select(['id', 'modifier_grant_id', 'level', 'amount', 'sort_order'])
      .where('modifier_grant_id', '=', id)
      .orderBy('sort_order')
      .execute() as Promise<ModifierGrantChargeLevelRow[]>,
    db.selectFrom('modifier_grant_optional_abilities')
      .select(['modifier_grant_id', 'ability_code'])
      .where('modifier_grant_id', '=', id)
      .orderBy('ability_code')
      .execute() as Promise<ModifierGrantOptionalAbilityRow[]>,
    root.restriction_id ? hydrateFacetById(db, root.restriction_id) : Promise.resolve(null)
  ])

  const selectionKind = requireSelectionKind(root.id, root.selection_kind)
  if (selectionKind === 'GRANTED') {
    requireNoGrantedCount(root.id, root.count)
  }
  const modifierKind = requireModifierKind(root.id, root.modifier_kind)
  const valueDomainCode = requireValueDomainCode(root.id, root.value_domain_code)
  const authored: ModifierGrantAuthored = {
    id: root.id,
    grantKind: 'MODIFIER_GRANT',
    order: root.sort_order,
    selectionKind,
    count: selectionKind === 'CHOSEN'
      ? requireChosenCount(root.id, root.count)
      : undefined,
    valueDomainCode,
    domain: hydrateDomain(root, domainRow),
    modifierKind,
    scope: requireScope(root.id, root.scope),
    payload: hydratePayload(root, payloadRow, chargeLevels, optionalAbilities),
    restrictions: root.restriction_id
      ? requireLinkedRecord(restrictions, `Modifier grant "${id}" is linked to missing restriction facet "${root.restriction_id}".`)
      : undefined
  } as ModifierGrantAuthored

  return authored
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

    async findAll() {
      const rows = await db
        .selectFrom('modifier_grants')
        .select('id')
        .orderBy('sort_order')
        .execute()

      const records = await Promise.all(rows.map((row) => hydrateModifierGrantById(db, row.id as string)))
      return records.filter((record): record is ModifierGrantAuthored => record !== null)
    }
  }
}
