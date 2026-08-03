import type { DBLike } from '#types'
import {
  type BaseEquipmentAuthored,
  EQUIPMENT_ATTRIBUTE,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  MEASUREMENT_UNIT_CODE,
  type EquipmentAuthored
} from '@artificer-toolkit/shared'
import { deleteEffectById, upsertEffect } from '../../effects/upserts/index.js'
import { upsertFacet } from '../../shared/facets.js'
import { upsertCharge } from '../../shared/upserts/index.js'
import { upsertModifierGrant } from '../../grants/upserts/index.js'
import { upsertFeature } from '../../features/upserts/index.js'
import { withTransaction } from '../../../utils/index.js'
import { normalizeSubjectStatus } from '../status.js'

type EquipmentRow = {
  id: string
  system_id: string
  user_id: string
  label: string
  description: string | null
  quote: string | null
  status: EquipmentAuthored['status']
  category: string
  rarity_id: string
  cost_amount: number | null
  cost_currency_id: string | null
  weight_amount: number | null
  weight_unit: string | null
  capacity_amount: number | null
  capacity_unit: string | null
  max_stack: number | null
  max_bonus: number | null
  armor_class: number | null
  requires_attunement: boolean
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
  sort_order: number
}

type EquipmentContainsRow = {
  equipment_id: string
  contained_equipment_id: string
  quantity: number
  sort_order: number
}

type EquipmentModifierGrantRow = {
  equipment_id: string
  modifier_grant_id: string
  sort_order: number
}

function requireCategory(equipmentId: string, value: string): EquipmentAuthored['category'] {
  if (
    value !== EQUIPMENT_CATEGORY_CODE.WEAPON &&
    value !== EQUIPMENT_CATEGORY_CODE.ARMOR &&
    value !== EQUIPMENT_CATEGORY_CODE.SHIELD &&
    value !== EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR &&
    value !== EQUIPMENT_CATEGORY_CODE.TOOL &&
    value !== EQUIPMENT_CATEGORY_CODE.VARIANT
  ) {
    throw new Error(`Equipment "${equipmentId}" has invalid category "${value}".`)
  }

  return value
}

function isBaseEquipment(equipment: EquipmentAuthored): equipment is BaseEquipmentAuthored {
  return equipment.category !== EQUIPMENT_CATEGORY_CODE.VARIANT
}

function requireMeasurementUnit(
  equipmentId: string,
  value: string
): NonNullable<BaseEquipmentAuthored['weight']>['unit'] {
  if (!(value in MEASUREMENT_UNIT_CODE)) {
    throw new Error(`Equipment "${equipmentId}" has invalid measurement unit "${value}".`)
  }

  return value as NonNullable<BaseEquipmentAuthored['weight']>['unit']
}

function requireAttribute(
  equipmentId: string,
  value: string
): NonNullable<BaseEquipmentAuthored['attributes']>[number] {
  if (!(value in EQUIPMENT_ATTRIBUTE)) {
    throw new Error(`Equipment "${equipmentId}" has invalid attribute "${value}".`)
  }

  return value as NonNullable<BaseEquipmentAuthored['attributes']>[number]
}

function requireProperty(
  equipmentId: string,
  value: string
): BaseEquipmentAuthored['properties'][number] {
  if (!(value in EQUIPMENT_PROPERTY_CODE)) {
    throw new Error(`Equipment "${equipmentId}" has invalid property "${value}".`)
  }

  return value as BaseEquipmentAuthored['properties'][number]
}

function mapEquipmentRow(json_data: EquipmentAuthored): EquipmentRow {
  const weightAmount = isBaseEquipment(json_data) ? (json_data.weight?.amount ?? null) : null
  const weightUnit = isBaseEquipment(json_data) && json_data.weight
    ? requireMeasurementUnit(json_data.id, json_data.weight.unit)
    : null
  const costAmount = isBaseEquipment(json_data) ? (json_data.cost?.amount ?? null) : null
  const costCurrencyId = isBaseEquipment(json_data) ? (json_data.cost?.currencyId ?? null) : null
  const capacityAmount = isBaseEquipment(json_data) ? (json_data.capacity?.amount ?? null) : null
  const capacityUnit =
    isBaseEquipment(json_data) && json_data.capacity?.unit
      ? requireMeasurementUnit(json_data.id, json_data.capacity.unit)
      : null

  return {
    id: json_data.id,
    system_id: json_data.systemId,
    user_id: json_data.userId,
    label: json_data.label,
    description: json_data.description,
    quote: json_data.quote ?? null,
    status: normalizeSubjectStatus(json_data.status),
    category: requireCategory(json_data.id, json_data.category),
    rarity_id: json_data.rarityId,
    cost_amount: costAmount,
    cost_currency_id: costCurrencyId,
    weight_amount: weightAmount,
    weight_unit: weightUnit,
    capacity_amount: capacityAmount,
    capacity_unit: capacityUnit,
    max_stack: isBaseEquipment(json_data) ? (json_data.maxStack ?? null) : null,
    max_bonus: json_data.maxBonus ?? null,
    armor_class: isBaseEquipment(json_data) ? (json_data.armorClass ?? null) : null,
    requires_attunement: json_data.requiresAttunement ?? false,
    charge_id: json_data.charges?.id ?? null,
    restriction_id: json_data.restrictions?.id ?? null,
    parent_equipment_id: isBaseEquipment(json_data) ? null : json_data.parentEquipmentId
  }
}

export async function upsertEquipment(db: DBLike, json_data: EquipmentAuthored, _systemId: string) {
  const attributeRows: EquipmentAttributeRow[] = (
    isBaseEquipment(json_data) ? (json_data.attributes ?? []) : []
  ).map((attribute, index) => ({
    equipment_id: json_data.id,
    attribute_code: requireAttribute(json_data.id, attribute),
    sort_order: index + 1
  }))

  const propertyRows: EquipmentPropertyRow[] = (
    isBaseEquipment(json_data) ? json_data.properties : (json_data.properties ?? [])
  ).map((property, index) => ({
    equipment_id: json_data.id,
    property_code: requireProperty(json_data.id, property),
    sort_order: index + 1
  }))
  const authoredEffects = json_data.effects ?? []
  const effectRows = authoredEffects.map((effect, index) => ({
    equipment_id: json_data.id,
    effect_id: effect.id,
    sort_order: index + 1
  }))
  const nextEffectIds = new Set(authoredEffects.map((effect) => effect.id))

  const containsRows: EquipmentContainsRow[] = (
    isBaseEquipment(json_data) ? (json_data.contains ?? []) : []
  ).map((entry, index) => ({
    equipment_id: json_data.id,
    contained_equipment_id: entry.equipmentId,
    quantity: entry.quantity,
    sort_order: index + 1
  }))

  return withTransaction(db, async (trx) => {
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

    if (
      existingEquipment?.restriction_id &&
      existingEquipment.restriction_id !== json_data.restrictions?.id
    ) {
      await trx.deleteFrom('facets').where('id', '=', existingEquipment.restriction_id).execute()
    }

    if (json_data.charges) {
      await upsertCharge(trx, json_data.charges)
    }

    if (json_data.restrictions) {
      await upsertFacet(trx, json_data.restrictions)
    }

    await trx
      .insertInto('equipment')
      .values(mapEquipmentRow(json_data))
      .onConflict((oc) =>
        oc.column('id').doUpdateSet((eb) => ({
          system_id: eb.ref('excluded.system_id'),
          user_id: eb.ref('excluded.user_id'),
          label: eb.ref('excluded.label'),
          description: eb.ref('excluded.description'),
          quote: eb.ref('excluded.quote'),
          status: eb.ref('excluded.status'),
          category: eb.ref('excluded.category'),
          rarity_id: eb.ref('excluded.rarity_id'),
          cost_amount: eb.ref('excluded.cost_amount'),
          cost_currency_id: eb.ref('excluded.cost_currency_id'),
          weight_amount: eb.ref('excluded.weight_amount'),
          weight_unit: eb.ref('excluded.weight_unit'),
          capacity_amount: eb.ref('excluded.capacity_amount'),
          capacity_unit: eb.ref('excluded.capacity_unit'),
          max_stack: eb.ref('excluded.max_stack'),
          max_bonus: eb.ref('excluded.max_bonus'),
          armor_class: eb.ref('excluded.armor_class'),
          requires_attunement: eb.ref('excluded.requires_attunement'),
          charge_id: eb.ref('excluded.charge_id'),
          restriction_id: eb.ref('excluded.restriction_id'),
          parent_equipment_id: eb.ref('excluded.parent_equipment_id')
        }))
      )
      .execute()

    await trx
      .deleteFrom('equipment_modifier_grants')
      .where('equipment_id', '=', json_data.id)
      .execute()
    await trx.deleteFrom('equipment_features').where('equipment_id', '=', json_data.id).execute()
    await trx.deleteFrom('equipment_attributes').where('equipment_id', '=', json_data.id).execute()
    await trx.deleteFrom('equipment_properties').where('equipment_id', '=', json_data.id).execute()
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

    for (const effect of authoredEffects) {
      await upsertEffect(trx, effect)
    }

    if (effectRows.length > 0) {
      await trx
        .insertInto('equipment_effects')
        .values(effectRows)
        .onConflict((oc) =>
          oc.columns(['equipment_id', 'effect_id']).doUpdateSet((eb) => ({
            sort_order: eb.ref('excluded.sort_order')
          }))
        )
        .execute()
    }

    if (attributeRows.length > 0) {
      await trx.insertInto('equipment_attributes').values(attributeRows).execute()
    }

    if (propertyRows.length > 0) {
      await trx.insertInto('equipment_properties').values(propertyRows).execute()
    }

    if (containsRows.length > 0) {
      await trx.insertInto('equipment_contains').values(containsRows).execute()
    }

    const modifierRows: EquipmentModifierGrantRow[] = (json_data.modifiers ?? []).map((grant) => ({
      equipment_id: json_data.id,
      modifier_grant_id: grant.id,
      sort_order: grant.order
    }))

    if (json_data.modifiers) {
      for (const modifierGrant of json_data.modifiers) {
        await upsertModifierGrant(trx, modifierGrant, json_data.systemId)
      }
    }

    if (modifierRows.length > 0) {
      await trx.insertInto('equipment_modifier_grants').values(modifierRows).execute()
    }

    const featureRows = (json_data.features ?? []).map((feature) => ({
      equipment_id: json_data.id,
      feature_id: feature.id,
      sort_order: feature.order
    }))

    if (json_data.features) {
      for (const feature of json_data.features) {
        await upsertFeature<'EQUIPMENT'>(trx, feature, json_data.systemId)
      }
    }

    if (featureRows.length > 0) {
      await trx.insertInto('equipment_features').values(featureRows).execute()
    }
  })
}
