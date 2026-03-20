import type { DBLike } from '#types'
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
  type ModifierGrantAuthored
} from '@artificer-toolkit/shared'
import { upsertFacet } from '../../shared/facets.js'

type ModifierGrantRootRow = {
  id: string
  system_id: string
  grant_kind: string
  value_domain_code: string
  modifier_kind: string
  scope: string
  selection_kind: string
  count: number | null
  sort_order: number
  restriction_id: string | null
}

type ModifierGrantDomainParamRow = {
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

function requireSystemId(systemId: string | undefined): string {
  if (!systemId) {
    throw new Error(
      'upsertModifierGrant requires a systemId because modifier_grants persist system ownership.'
    )
  }

  return systemId
}

function requireChosenCount(
  grantId: string,
  count: number | undefined
): number {
  if (count == null) {
    throw new Error(`Modifier grant "${grantId}" is missing count for CHOSEN payload.`)
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

  throw new Error(`Modifier grant "${grantId}" cannot persist count for GRANTED payload.`)
}

function requireAbilityCode(
  grantId: string,
  value: string,
  field: string
): string {
  if (!(value in ABILITY_CODE)) {
    throw new Error(`Modifier grant "${grantId}" has invalid ${field} "${value}".`)
  }

  return value
}

function requireAttackDomainCode(
  grantId: string,
  value: string
): string {
  if (!(value in ATTACK_DOMAIN_CODE)) {
    throw new Error(`Modifier grant "${grantId}" has invalid attackDomain "${value}".`)
  }

  return value
}

function requireModifierScope(
  grantId: string,
  value: string
): string {
  if (!(value in MODIFIER_SCOPE_KIND)) {
    throw new Error(`Modifier grant "${grantId}" has invalid scope "${value}".`)
  }

  return value
}

function requireModifierKind(
  grantId: string,
  value: string
): string {
  if (!(value in MODIFIER_KIND)) {
    throw new Error(`Modifier grant "${grantId}" has invalid modifierKind "${value}".`)
  }

  return value
}

function requireRangeKind(
  grantId: string,
  value: string
): string {
  if (!(value in RANGE_KIND)) {
    throw new Error(`Modifier grant "${grantId}" has invalid rangeKind "${value}".`)
  }

  return value
}

function requireDurationKind(
  grantId: string,
  value: string
): string {
  if (!(value in DURATION_KIND)) {
    throw new Error(`Modifier grant "${grantId}" has invalid durationKind "${value}".`)
  }

  return value
}

function requireShapeKind(
  grantId: string,
  value: string
): string {
  if (!(value in SHAPE_KIND)) {
    throw new Error(`Modifier grant "${grantId}" has invalid shapeKind "${value}".`)
  }

  return value
}

function requireChargeResetKind(
  grantId: string,
  value: string
): string {
  if (!(value in CHARGE_RESET_KIND)) {
    throw new Error(`Modifier grant "${grantId}" has invalid resetKind "${value}".`)
  }

  return value
}

function requireChargeLimitKind(
  grantId: string,
  value: string
): string {
  if (!(value in CHARGE_LIMIT_KIND)) {
    throw new Error(`Modifier grant "${grantId}" has invalid limitKind "${value}".`)
  }

  return value
}

function requireChargeScalingKind(
  grantId: string,
  value: string
): string {
  if (!(value in CHARGE_SCALING)) {
    throw new Error(`Modifier grant "${grantId}" has invalid scalingKind "${value}".`)
  }

  return value
}

function requireNumericValueKind(
  grantId: string,
  value: unknown
): ModifierGrantPayloadRow['numeric_value_kind'] {
  if (
    value !== 'FIXED'
    && value !== 'PROFICIENCY_BONUS'
    && value !== 'ABILITY_MODIFIER'
    && value !== 'SKILL_BONUS'
    && value !== 'CHARACTER_LEVEL'
    && value !== 'CLASS_LEVEL'
    && value !== 'SPELL_SLOT_LEVEL'
  ) {
    throw new Error(`Modifier grant "${grantId}" has invalid valueKind "${String(value)}".`)
  }

  return value
}

function requirePayload<T>(
  grantId: string,
  payload: T | undefined,
  modifierKind: string
): T {
  if (payload == null) {
    throw new Error(`Modifier grant "${grantId}" is missing payload for ${modifierKind}.`)
  }

  return payload
}

function mapModifierGrantRootRow(
  json_data: ModifierGrantAuthored,
  systemId: string
): ModifierGrantRootRow {
  if (json_data.selectionKind !== 'CHOSEN' && 'count' in json_data) {
    rejectGrantedCount(json_data.id, (json_data as { count?: number }).count)
  }

  return {
    id: json_data.id,
    system_id: requireSystemId(systemId),
    grant_kind: json_data.grantKind,
    value_domain_code: json_data.valueDomainCode,
    modifier_kind: requireModifierKind(json_data.id, json_data.modifierKind),
    scope: requireModifierScope(json_data.id, json_data.scope),
    selection_kind: json_data.selectionKind,
    count: json_data.selectionKind === 'CHOSEN'
      ? requireChosenCount(json_data.id, json_data.count)
      : null,
    sort_order: json_data.order,
    restriction_id: json_data.restrictions?.id ?? null
  }
}

function mapModifierGrantDomainRow(
  json_data: ModifierGrantAuthored
): ModifierGrantDomainParamRow | null {
  switch (json_data.valueDomainCode) {
    case 'ATTACK_ROLL_BONUS':
    case 'DAMAGE':
      return {
        modifier_grant_id: json_data.id,
        value_domain_code: json_data.valueDomainCode,
        attack_domain_code: requireAttackDomainCode(json_data.id, (json_data.domain as { attackDomain?: string }).attackDomain ?? ''),
        ability_code: null,
        skill_id: null,
        speed_id: null,
        sense_code: null,
        spell_level: null,
        condition_type_id: null
      }

    case 'SAVING_THROW_BONUS':
      return {
        modifier_grant_id: json_data.id,
        value_domain_code: json_data.valueDomainCode,
        attack_domain_code: null,
        ability_code: requireAbilityCode(json_data.id, (json_data.domain as { ability?: string }).ability ?? '', 'domain ability'),
        skill_id: null,
        speed_id: null,
        sense_code: null,
        spell_level: null,
        condition_type_id: (json_data.domain as { conditionTypeId?: string }).conditionTypeId ?? null
      }

    case 'ABILITY_SCORE':
      return {
        modifier_grant_id: json_data.id,
        value_domain_code: json_data.valueDomainCode,
        attack_domain_code: null,
        ability_code: requireAbilityCode(json_data.id, (json_data.domain as { ability?: string }).ability ?? '', 'domain ability'),
        skill_id: null,
        speed_id: null,
        sense_code: null,
        spell_level: null,
        condition_type_id: null
      }

    case 'SKILL_BONUS': {
      const skillId = (json_data.domain as { skillId?: string }).skillId
      if (!skillId) {
        throw new Error(`Modifier grant "${json_data.id}" is missing domain skillId.`)
      }

      return {
        modifier_grant_id: json_data.id,
        value_domain_code: json_data.valueDomainCode,
        attack_domain_code: null,
        ability_code: null,
        skill_id: skillId,
        speed_id: null,
        sense_code: null,
        spell_level: null,
        condition_type_id: null
      }
    }

    case 'SPEED': {
      const speedId = (json_data.domain as { speedId?: string }).speedId
      if (!speedId) {
        throw new Error(`Modifier grant "${json_data.id}" is missing domain speedId.`)
      }

      return {
        modifier_grant_id: json_data.id,
        value_domain_code: json_data.valueDomainCode,
        attack_domain_code: null,
        ability_code: null,
        skill_id: null,
        speed_id: speedId,
        sense_code: null,
        spell_level: null,
        condition_type_id: null
      }
    }

    case 'SENSE_RANGE': {
      const senseCode = (json_data.domain as { senseCode?: string }).senseCode
      if (!senseCode) {
        throw new Error(`Modifier grant "${json_data.id}" is missing domain senseCode.`)
      }

      return {
        modifier_grant_id: json_data.id,
        value_domain_code: json_data.valueDomainCode,
        attack_domain_code: null,
        ability_code: null,
        skill_id: null,
        speed_id: null,
        sense_code: senseCode,
        spell_level: null,
        condition_type_id: null
      }
    }

    case 'SPELL_SLOT_COUNT': {
      const spellLevel = (json_data.domain as { spellLevel?: number }).spellLevel
      if (spellLevel == null) {
        throw new Error(`Modifier grant "${json_data.id}" is missing domain spellLevel.`)
      }

      return {
        modifier_grant_id: json_data.id,
        value_domain_code: json_data.valueDomainCode,
        attack_domain_code: null,
        ability_code: null,
        skill_id: null,
        speed_id: null,
        sense_code: null,
        spell_level: spellLevel,
        condition_type_id: null
      }
    }

    default:
      return null
  }
}

function createEmptyPayloadRow(
  json_data: ModifierGrantAuthored
): ModifierGrantPayloadRow {
  return {
    modifier_grant_id: json_data.id,
    modifier_kind: requireModifierKind(json_data.id, json_data.modifierKind),
    value_domain_code: json_data.valueDomainCode,
    numeric_value_kind: null,
    numeric_amount: null,
    numeric_multiplier: null,
    numeric_ability_code: null,
    numeric_skill_id: null,
    numeric_class_id: null,
    set_amount: null,
    charge_limit_kind: null,
    charge_scaling_kind: null,
    charge_amount: null,
    charge_multiplier: null,
    charge_min: null,
    charge_max: null,
    dice: null,
    damage_type_id: null,
    condition_type_id: null,
    movement_mode_id: null,
    attribute_id: null,
    range_kind: null,
    duration_kind: null,
    shape_kind: null,
    reset_kind: null
  }
}

function mapModifierGrantPayload(
  json_data: ModifierGrantAuthored
): {
  payload: ModifierGrantPayloadRow | null
  chargeLevels: ModifierGrantChargeLevelRow[]
  optionalAbilities: ModifierGrantOptionalAbilityRow[]
} {
  const optionalAbilities: ModifierGrantOptionalAbilityRow[] = []
  const chargeLevels: ModifierGrantChargeLevelRow[] = []

  switch (json_data.modifierKind) {
    case 'ADVANTAGE':
    case 'DISADVANTAGE':
      return { payload: null, chargeLevels, optionalAbilities }

    case 'BONUS':
    case 'PENALTY': {
      const payload = requirePayload(json_data.id, json_data.payload, json_data.modifierKind)
      const row = createEmptyPayloadRow(json_data)
      const valueKind = requireNumericValueKind(json_data.id, (payload as { valueKind?: string }).valueKind)
      row.numeric_value_kind = valueKind

      switch (valueKind) {
        case 'FIXED':
          row.numeric_amount = (payload as { amount: number }).amount
          break

        case 'PROFICIENCY_BONUS':
        case 'CHARACTER_LEVEL':
        case 'SPELL_SLOT_LEVEL':
          row.numeric_multiplier = (payload as { multiplier?: number }).multiplier ?? null
          break

        case 'ABILITY_MODIFIER':
          row.numeric_ability_code = requireAbilityCode(json_data.id, (payload as { ability?: string }).ability ?? '', 'payload ability')
          row.numeric_multiplier = (payload as { multiplier?: number }).multiplier ?? null
          break

        case 'SKILL_BONUS': {
          const skillId = (payload as { skillId?: string }).skillId
          if (!skillId) {
            throw new Error(`Modifier grant "${json_data.id}" is missing payload skillId.`)
          }

          row.numeric_skill_id = skillId
          row.numeric_multiplier = (payload as { multiplier?: number }).multiplier ?? null
          break
        }

        case 'CLASS_LEVEL': {
          const classId = (payload as { classId?: string }).classId
          if (!classId) {
            throw new Error(`Modifier grant "${json_data.id}" is missing payload classId.`)
          }

          row.numeric_class_id = classId
          row.numeric_multiplier = (payload as { multiplier?: number }).multiplier ?? null
          break
        }
      }

      return { payload: row, chargeLevels, optionalAbilities }
    }

    case 'SET_VALUE': {
      const payload = requirePayload(json_data.id, json_data.payload, json_data.modifierKind)
      return {
        payload: {
          ...createEmptyPayloadRow(json_data),
          set_amount: (payload as { amount: number }).amount
        },
        chargeLevels,
        optionalAbilities
      }
    }

    case 'ADD_BONUS_DIE': {
      const payload = requirePayload(json_data.id, json_data.payload, json_data.modifierKind)
      const dice = (payload as { dice?: string }).dice
      if (!dice) {
        throw new Error(`Modifier grant "${json_data.id}" is missing payload dice.`)
      }

      return {
        payload: {
          ...createEmptyPayloadRow(json_data),
          dice
        },
        chargeLevels,
        optionalAbilities
      }
    }

    case 'REPLACE_DAMAGE_TYPE': {
      const payload = requirePayload(json_data.id, json_data.payload, json_data.modifierKind)
      const damageTypeId = (payload as { damageTypeId?: string }).damageTypeId
      if (!damageTypeId) {
        throw new Error(`Modifier grant "${json_data.id}" is missing payload damageTypeId.`)
      }

      return {
        payload: {
          ...createEmptyPayloadRow(json_data),
          damage_type_id: damageTypeId
        },
        chargeLevels,
        optionalAbilities
      }
    }

    case 'ADD_OPTION':
    case 'REMOVE_OPTION': {
      const payload = requirePayload(json_data.id, json_data.payload, json_data.modifierKind)
      const row = createEmptyPayloadRow(json_data)

      switch (json_data.valueDomainCode) {
        case 'DAMAGE_RESISTANCE':
        case 'DAMAGE_IMMUNITY':
        case 'DAMAGE_VULNERABILITY': {
          const damageTypeId = (payload as { damageTypeId?: string }).damageTypeId
          if (!damageTypeId) {
            throw new Error(`Modifier grant "${json_data.id}" is missing payload damageTypeId.`)
          }

          row.damage_type_id = damageTypeId
          break
        }

        case 'CONDITION':
        case 'CONDITION_IMMUNITY': {
          const conditionTypeId = (payload as { conditionTypeId?: string }).conditionTypeId
          if (!conditionTypeId) {
            throw new Error(`Modifier grant "${json_data.id}" is missing payload conditionTypeId.`)
          }

          row.condition_type_id = conditionTypeId
          break
        }

        case 'ATTRIBUTE': {
          const attributeId = (payload as { attributeId?: string }).attributeId
          if (!attributeId) {
            throw new Error(`Modifier grant "${json_data.id}" is missing payload attributeId.`)
          }

          row.attribute_id = attributeId
          break
        }

        case 'MOVEMENT_MODE': {
          const movementModeId = (payload as { movementModeId?: string }).movementModeId
          if (!movementModeId) {
            throw new Error(`Modifier grant "${json_data.id}" is missing payload movementModeId.`)
          }

          row.movement_mode_id = movementModeId
          break
        }

        default:
          throw new Error(
            `Modifier grant "${json_data.id}" cannot use ${json_data.modifierKind} with valueDomainCode "${json_data.valueDomainCode}".`
          )
      }

      return { payload: row, chargeLevels, optionalAbilities }
    }

    case 'REPLACE_RANGE_KIND': {
      const payload = requirePayload(json_data.id, json_data.payload, json_data.modifierKind)
      return {
        payload: {
          ...createEmptyPayloadRow(json_data),
          range_kind: requireRangeKind(json_data.id, (payload as { rangeKind?: string }).rangeKind ?? '')
        },
        chargeLevels,
        optionalAbilities
      }
    }

    case 'REPLACE_DURATION_KIND': {
      const payload = requirePayload(json_data.id, json_data.payload, json_data.modifierKind)
      return {
        payload: {
          ...createEmptyPayloadRow(json_data),
          duration_kind: requireDurationKind(json_data.id, (payload as { durationKind?: string }).durationKind ?? '')
        },
        chargeLevels,
        optionalAbilities
      }
    }

    case 'REPLACE_SHAPE_KIND': {
      const payload = requirePayload(json_data.id, json_data.payload, json_data.modifierKind)
      return {
        payload: {
          ...createEmptyPayloadRow(json_data),
          shape_kind: requireShapeKind(json_data.id, (payload as { shapeKind?: string }).shapeKind ?? '')
        },
        chargeLevels,
        optionalAbilities
      }
    }

    case 'REPLACE_CHARGE_RESET_KIND': {
      const payload = requirePayload(json_data.id, json_data.payload, json_data.modifierKind)
      return {
        payload: {
          ...createEmptyPayloadRow(json_data),
          reset_kind: requireChargeResetKind(json_data.id, (payload as { resetKind?: string }).resetKind ?? '')
        },
        chargeLevels,
        optionalAbilities
      }
    }

    case 'OPTIONAL_ABILITY_MODIFIER': {
      const payload = requirePayload(json_data.id, json_data.payload, json_data.modifierKind)
      const abilities = (payload as { abilities?: string[] }).abilities
      if (!abilities) {
        throw new Error(`Modifier grant "${json_data.id}" is missing payload abilities.`)
      }

      return {
        payload: createEmptyPayloadRow(json_data),
        chargeLevels,
        optionalAbilities: abilities.map((ability) => ({
          modifier_grant_id: json_data.id,
          ability_code: requireAbilityCode(json_data.id, ability, 'optional ability')
        }))
      }
    }

    case 'MODIFY_CHARGE_LIMIT': {
      const payload = requirePayload(json_data.id, json_data.payload, json_data.modifierKind)
      const row = createEmptyPayloadRow(json_data)
      const limitKind = requireChargeLimitKind(json_data.id, (payload as { limitKind?: string }).limitKind ?? '')
      const scalingKind = requireChargeScalingKind(json_data.id, (payload as { scalingKind?: string }).scalingKind ?? '')

      row.charge_limit_kind = limitKind
      row.charge_scaling_kind = scalingKind

      switch (limitKind) {
        case 'FIXED_AMOUNT':
          if (scalingKind === 'NONE') {
            row.charge_amount = (payload as { amount: number }).amount
          } else {
            const levels = (payload as { levels?: { id: string, level: number, amount: number }[] }).levels
            if (!levels) {
              throw new Error(`Modifier grant "${json_data.id}" is missing payload levels.`)
            }

            chargeLevels.push(...levels.map((level, index) => ({
              id: level.id,
              modifier_grant_id: json_data.id,
              level: level.level,
              amount: level.amount,
              sort_order: index + 1
            })))
          }
          break

        case 'CLASS_LEVEL': {
          const classId = (payload as { classId?: string }).classId
          if (!classId) {
            throw new Error(`Modifier grant "${json_data.id}" is missing payload classId.`)
          }

          row.numeric_class_id = classId
          row.charge_multiplier = (payload as { multiplier?: number }).multiplier ?? null
          row.charge_min = (payload as { min?: number }).min ?? null
          row.charge_max = (payload as { max?: number }).max ?? null
          break
        }

        case 'CHARACTER_LEVEL':
        case 'PARENT_CLASS_LEVEL':
        case 'SPELL_CAST_LEVEL':
          row.charge_multiplier = (payload as { multiplier?: number }).multiplier ?? null
          row.charge_min = (payload as { min?: number }).min ?? null
          row.charge_max = (payload as { max?: number }).max ?? null
          break
      }

      return { payload: row, chargeLevels, optionalAbilities }
    }
  }
}

export async function upsertModifierGrant(
  db: DBLike,
  json_data: ModifierGrantAuthored,
  systemId?: string
) {
  const root = mapModifierGrantRootRow(json_data, requireSystemId(systemId))
  const domainRow = mapModifierGrantDomainRow(json_data)
  const { payload, chargeLevels, optionalAbilities } = mapModifierGrantPayload(json_data)

  const trx = await db.startTransaction().execute()

  try {
    const existingGrant = await trx
      .selectFrom('modifier_grants')
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
      .insertInto('modifier_grants')
      .values(root)
      .onConflict((oc) => oc.column('id').doUpdateSet(({ ref }) => ({
        system_id: ref('excluded.system_id'),
        grant_kind: ref('excluded.grant_kind'),
        value_domain_code: ref('excluded.value_domain_code'),
        modifier_kind: ref('excluded.modifier_kind'),
        scope: ref('excluded.scope'),
        selection_kind: ref('excluded.selection_kind'),
        count: ref('excluded.count'),
        sort_order: ref('excluded.sort_order'),
        restriction_id: ref('excluded.restriction_id')
      })))
      .execute()

    await trx
      .deleteFrom('modifier_grant_charge_levels')
      .where('modifier_grant_id', '=', json_data.id)
      .execute()

    await trx
      .deleteFrom('modifier_grant_optional_abilities')
      .where('modifier_grant_id', '=', json_data.id)
      .execute()

    await trx
      .deleteFrom('modifier_grant_payloads')
      .where('modifier_grant_id', '=', json_data.id)
      .execute()

    await trx
      .deleteFrom('modifier_grant_domain_params')
      .where('modifier_grant_id', '=', json_data.id)
      .execute()

    if (domainRow) {
      await trx
        .insertInto('modifier_grant_domain_params')
        .values(domainRow)
        .execute()
    }

    if (payload) {
      await trx
        .insertInto('modifier_grant_payloads')
        .values(payload)
        .execute()
    }

    if (chargeLevels.length > 0) {
      await trx
        .insertInto('modifier_grant_charge_levels')
        .values(chargeLevels)
        .execute()
    }

    if (optionalAbilities.length > 0) {
      await trx
        .insertInto('modifier_grant_optional_abilities')
        .values(optionalAbilities)
        .execute()
    }

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
