import type { DBLike } from '@db-types'
import {
  ABILITY_CODE,
  EQUIPMENT_ATTRIBUTE,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  MEASUREMENT_UNIT_CODE,
  OPERATION_CODE,
  type EquipmentAuthored,
  type EquipmentVariantAuthored
} from '@artificer-toolkit/shared'
import { deleteEffectById, upsertEffect } from '../../effects/upserts/index.js'
import { upsertFacet } from '../../shared/facets.js'
import { upsertCharge } from '../../shared/upserts/index.js'
import { upsertModifierGrant } from '../../grants/upserts/index.js'
import { upsertFeature } from '../../features/upserts/index.js'

type EquipmentRow = {
  id: string
  system_id: string
  user_id: string
  label: string
  description: string | null
  quote: string | null
  category: string
  rarity_id: string
  cost_amount: number
  cost_currency_id: string
  weight_amount: number
  weight_unit: string
  capacity_amount: number | null
  capacity_unit: string | null
  max_stack: number | null
  max_bonus: number | null
  armor_class: number | null
  charge_id: string | null
  restriction_id: string | null
  parent_equipment_id: string | null
}

type EquipmentAttributeRow = {
  equipment_id: string
  attribute_code: string
  sort_order: number
}

type EquipmentPropertyRow = {
  equipment_id: string
  property_code: string
}

type EquipmentAbilityRow = {
  equipment_id: string
  operation: string
  ability_code: string
  sort_order: number
}

type EquipmentContainsRow = {
  equipment_id: string
  contained_equipment_id: string
  quantity: number
}

type EquipmentModifierGrantRow = {
  equipment_id: string
  modifier_grant_id: string
  sort_order: number
}

function requireCategory(
  equipmentId: string,
  value: string
): EquipmentAuthored['category'] | EquipmentVariantAuthored['category'] {
  if (
    value !== EQUIPMENT_CATEGORY_CODE.WEAPON
    && value !== EQUIPMENT_CATEGORY_CODE.ARMOR
    && value !== EQUIPMENT_CATEGORY_CODE.SHIELD
    && value !== EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR
    && value !== EQUIPMENT_CATEGORY_CODE.TOOL
    && value !== EQUIPMENT_CATEGORY_CODE.VARIANT
  ) {
    throw new Error(`Equipment "${equipmentId}" has invalid category "${value}".`)
  }

  return value
}

function isBaseEquipment(
  equipment: EquipmentAuthored | EquipmentVariantAuthored
): equipment is EquipmentAuthored {
  return equipment.category !== EQUIPMENT_CATEGORY_CODE.VARIANT
}

function requireMeasurementUnit(
  equipmentId: string,
  value: string
): EquipmentAuthored['weight']['unit'] {
  if (!(value in MEASUREMENT_UNIT_CODE)) {
    throw new Error(`Equipment "${equipmentId}" has invalid measurement unit "${value}".`)
  }

  return value as EquipmentAuthored['weight']['unit']
}

function requireAttribute(
  equipmentId: string,
  value: string
): NonNullable<EquipmentAuthored['attributes']>[number] {
  if (!(value in EQUIPMENT_ATTRIBUTE)) {
    throw new Error(`Equipment "${equipmentId}" has invalid attribute "${value}".`)
  }

  return value as NonNullable<EquipmentAuthored['attributes']>[number]
}

function requireProperty(
  equipmentId: string,
  value: string
): EquipmentAuthored['properties'][number] {
  if (!(value in EQUIPMENT_PROPERTY_CODE)) {
    throw new Error(`Equipment "${equipmentId}" has invalid property "${value}".`)
  }

  return value as EquipmentAuthored['properties'][number]
}

function requireOperation(
  equipmentId: string,
  value: string
): EquipmentAuthored['abilities'][number]['op'] {
  if (!(value in OPERATION_CODE)) {
    throw new Error(`Equipment "${equipmentId}" has invalid operation "${value}".`)
  }

  return value as EquipmentAuthored['abilities'][number]['op']
}

function requireAbility(
  equipmentId: string,
  value: string
): EquipmentAuthored['abilities'][number]['abilities'][number]['ability'] {
  if (!(value in ABILITY_CODE)) {
    throw new Error(`Equipment "${equipmentId}" has invalid ability "${value}".`)
  }

  return value as EquipmentAuthored['abilities'][number]['abilities'][number]['ability']
}

function mapEquipmentRow(json_data: EquipmentAuthored | EquipmentVariantAuthored): EquipmentRow {
  return {
    id: json_data.id,
    system_id: json_data.systemId,
    user_id: json_data.userId,
    label: json_data.label,
    description: json_data.description,
    quote: json_data.quote ?? null,
    category: requireCategory(json_data.id, json_data.category),
    rarity_id: json_data.rarityId,
    cost_amount: json_data.cost.amount,
    cost_currency_id: json_data.cost.currencyId,
    weight_amount: json_data.weight.amount,
    weight_unit: requireMeasurementUnit(json_data.id, json_data.weight.unit),
    capacity_amount: json_data.capacity?.amount ?? null,
    capacity_unit: json_data.capacity?.unit
      ? requireMeasurementUnit(json_data.id, json_data.capacity.unit)
      : null,
    max_stack: json_data.maxStack ?? null,
    max_bonus: json_data.maxBonus ?? null,
    armor_class: json_data.armorClass ?? null,
    charge_id: json_data.charges?.id ?? null,
    restriction_id: json_data.restrictions?.id ?? null,
    parent_equipment_id: isBaseEquipment(json_data)
      ? null
      : json_data.parentEquipmentId
  }
}

export async function upsertEquipment(
  db: DBLike,
  json_data: EquipmentAuthored | EquipmentVariantAuthored,
  _systemId: string
) {
  const attributeRows: EquipmentAttributeRow[] = (json_data.attributes ?? []).map((attribute, index) => ({
    equipment_id: json_data.id,
    attribute_code: requireAttribute(json_data.id, attribute),
    sort_order: index + 1
  }))

  const propertyRows: EquipmentPropertyRow[] = isBaseEquipment(json_data)
    ? json_data.properties.map((property) => ({
        equipment_id: json_data.id,
        property_code: requireProperty(json_data.id, property)
      }))
    : []
  const effectRows = (json_data.effects ?? []).map((effect, index) => ({
    equipment_id: json_data.id,
    effect_id: effect.id,
    sort_order: index + 1
  }))
  const nextEffectIds = new Set((json_data.effects ?? []).map((effect) => effect.id))

  const abilityRows: EquipmentAbilityRow[] = isBaseEquipment(json_data)
    ? json_data.abilities.flatMap((entry, groupIndex) =>
        entry.abilities.map((ability, abilityIndex) => ({
          equipment_id: json_data.id,
          operation: requireOperation(json_data.id, entry.op),
          ability_code: requireAbility(json_data.id, ability.ability),
          sort_order: groupIndex * 100 + abilityIndex + 1
        }))
      )
    : []

  const containsRows: EquipmentContainsRow[] = (json_data.contains ?? []).map((entry) => ({
    equipment_id: json_data.id,
    contained_equipment_id: entry.equipmentId,
    quantity: entry.quantity
  }))

  const trx = await db.startTransaction().execute()

  try {
    const existingEquipment = await trx
      .selectFrom('equipment')
      .select(['restriction_id'])
      .where('id', '=', json_data.id)
      .executeTakeFirst()
    const previousEffectRows = await trx
      .selectFrom('equipment_effects')
      .select(['effect_id'])
      .where('equipment_id', '=', json_data.id)
      .execute()

    if (existingEquipment?.restriction_id && existingEquipment.restriction_id !== json_data.restrictions?.id) {
      await trx.deleteFrom('facets').where('id', '=', existingEquipment.restriction_id).execute()
    }

    if (json_data.charges) {
      await upsertCharge(trx, json_data.charges)
    }

    if (json_data.restrictions) {
      await upsertFacet(trx, json_data.restrictions)
    }

    for (const effect of json_data.effects ?? []) {
      await upsertEffect(trx, effect)
    }

    if (json_data.modifiers) {
      for (const modifierGrant of json_data.modifiers) {
        await upsertModifierGrant(trx, modifierGrant, json_data.systemId)
      }
    }

    if (json_data.features) {
      for (const feature of json_data.features) {
        await upsertFeature<'EQUIPMENT'>(trx, feature, json_data.systemId)
      }
    }

    await trx
      .insertInto('equipment')
      .values(mapEquipmentRow(json_data))
      .onConflict((oc) => oc.column('id').doUpdateSet(({ ref }) => ({
        system_id: ref('excluded.system_id'),
        user_id: ref('excluded.user_id'),
        label: ref('excluded.label'),
        description: ref('excluded.description'),
        quote: ref('excluded.quote'),
        category: ref('excluded.category'),
        rarity_id: ref('excluded.rarity_id'),
        cost_amount: ref('excluded.cost_amount'),
        cost_currency_id: ref('excluded.cost_currency_id'),
        weight_amount: ref('excluded.weight_amount'),
        weight_unit: ref('excluded.weight_unit'),
        capacity_amount: ref('excluded.capacity_amount'),
        capacity_unit: ref('excluded.capacity_unit'),
        max_stack: ref('excluded.max_stack'),
        max_bonus: ref('excluded.max_bonus'),
        armor_class: ref('excluded.armor_class'),
        charge_id: ref('excluded.charge_id'),
        restriction_id: ref('excluded.restriction_id'),
        parent_equipment_id: ref('excluded.parent_equipment_id')
      })))
      .execute()

    await trx.deleteFrom('equipment_modifier_grants').where('equipment_id', '=', json_data.id).execute()
    await trx.deleteFrom('equipment_features').where('equipment_id', '=', json_data.id).execute()
    await trx.deleteFrom('equipment_attributes').where('equipment_id', '=', json_data.id).execute()
    await trx.deleteFrom('equipment_properties').where('equipment_id', '=', json_data.id).execute()
    await trx.deleteFrom('equipment_abilities').where('equipment_id', '=', json_data.id).execute()
    await trx.deleteFrom('equipment_contains').where('equipment_id', '=', json_data.id).execute()

    for (const previousEffect of previousEffectRows) {
      if (!nextEffectIds.has(previousEffect.effect_id)) {
        await trx
          .deleteFrom('equipment_effects')
          .where('equipment_id', '=', json_data.id)
          .where('effect_id', '=', previousEffect.effect_id)
          .execute()
        await deleteEffectById(trx, previousEffect.effect_id)
      }
    }

    if (effectRows.length > 0) {
      await trx
        .insertInto('equipment_effects')
        .values(effectRows)
        .onConflict((oc) => oc.columns(['equipment_id', 'effect_id']).doUpdateSet(({ ref }) => ({
          sort_order: ref('excluded.sort_order')
        })))
        .execute()
    }

    if (attributeRows.length > 0) {
      await trx.insertInto('equipment_attributes').values(attributeRows).execute()
    }

    if (propertyRows.length > 0) {
      await trx.insertInto('equipment_properties').values(propertyRows).execute()
    }

    if (abilityRows.length > 0) {
      await trx.insertInto('equipment_abilities').values(abilityRows).execute()
    }

    if (containsRows.length > 0) {
      await trx.insertInto('equipment_contains').values(containsRows).execute()
    }

    const modifierRows: EquipmentModifierGrantRow[] = (json_data.modifiers ?? []).map((grant) => ({
      equipment_id: json_data.id,
      modifier_grant_id: grant.id,
      sort_order: grant.order
    }))

    if (modifierRows.length > 0) {
      await trx.insertInto('equipment_modifier_grants').values(modifierRows).execute()
    }

    const featureRows = (json_data.features ?? []).map((feature) => ({
      equipment_id: json_data.id,
      feature_id: feature.id,
      sort_order: feature.order
    }))

    if (featureRows.length > 0) {
      await trx.insertInto('equipment_features').values(featureRows).execute()
    }

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
