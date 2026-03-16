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
import type { DBLike } from '../types/index.js'
import { upsertEquipment } from '../domains/subjects/upserts/equipment.js'
import { hydrateFacetById } from '../domains/shared/facets.js'
import { createEffectRepository } from './effect.js'
import { createFeatureRepository } from './feature.js'
import { hydrateChargeById } from './grant-helpers.js'
import { createModifierGrantRepository } from './modifier-grant.js'
import type { EquipmentRepository, RepositoryFindAllOptions } from './contracts.js'

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

function requireMeasurementUnit(
  equipmentId: string,
  value: string
): EquipmentAuthored['weight']['unit'] {
  if (!(value in MEASUREMENT_UNIT_CODE)) {
    throw new Error(`Equipment "${equipmentId}" has invalid unit_code "${value}".`)
  }

  return value as EquipmentAuthored['weight']['unit']
}

function requireAttribute(
  equipmentId: string,
  value: string
): NonNullable<EquipmentAuthored['attributes']>[number] {
  if (!(value in EQUIPMENT_ATTRIBUTE)) {
    throw new Error(`Equipment "${equipmentId}" has invalid attribute_code "${value}".`)
  }

  return value as NonNullable<EquipmentAuthored['attributes']>[number]
}

function requireProperty(
  equipmentId: string,
  value: string
): EquipmentAuthored['properties'][number] {
  if (!(value in EQUIPMENT_PROPERTY_CODE)) {
    throw new Error(`Equipment "${equipmentId}" has invalid property_code "${value}".`)
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
    throw new Error(`Equipment "${equipmentId}" has invalid ability_code "${value}".`)
  }

  return value as EquipmentAuthored['abilities'][number]['abilities'][number]['ability']
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

async function hydrateEquipmentById(
  db: DBLike,
  id: string
): Promise<EquipmentAuthored | EquipmentVariantAuthored | null> {
  const row = await db
    .selectFrom('equipment')
    .select([
      'id',
      'system_id',
      'user_id',
      'label',
      'description',
      'quote',
      'category',
      'rarity_id',
      'cost_amount',
      'cost_currency_id',
      'weight_amount',
      'weight_unit',
      'capacity_amount',
      'capacity_unit',
      'max_stack',
      'max_bonus',
      'armor_class',
      'charge_id',
      'restriction_id',
      'parent_equipment_id'
    ])
    .where('id', '=', id)
    .executeTakeFirst()

  if (!row) return null
  if (!row.user_id) {
    throw new Error(`Equipment "${id}" is missing user ownership and cannot be hydrated.`)
  }

  const [effectLinks, modifierLinks, featureLinks, attributes, properties, abilities, contains, charge, restrictions] = await Promise.all([
    db.selectFrom('equipment_effects').select(['effect_id', 'sort_order']).where('equipment_id', '=', id).orderBy('sort_order').execute(),
    db.selectFrom('equipment_modifier_grants').select(['modifier_grant_id', 'sort_order']).where('equipment_id', '=', id).orderBy('sort_order').execute(),
    db.selectFrom('equipment_features').select(['feature_id', 'sort_order']).where('equipment_id', '=', id).orderBy('sort_order').execute(),
    db.selectFrom('equipment_attributes').select(['attribute_code', 'sort_order']).where('equipment_id', '=', id).orderBy('sort_order').execute(),
    db.selectFrom('equipment_properties').select(['property_code']).where('equipment_id', '=', id).orderBy('property_code').execute(),
    db.selectFrom('equipment_abilities').select(['operation', 'ability_code', 'sort_order']).where('equipment_id', '=', id).orderBy('sort_order').execute(),
    db.selectFrom('equipment_contains').select(['contained_equipment_id', 'quantity']).where('equipment_id', '=', id).orderBy('contained_equipment_id').execute(),
    row.charge_id ? hydrateChargeById(db, row.charge_id) : Promise.resolve(null),
    row.restriction_id ? hydrateFacetById<'EQUIPMENT'>(db, row.restriction_id) : Promise.resolve(null)
  ])

  const effectRepository = createEffectRepository(db)
  const featureRepository = createFeatureRepository<'EQUIPMENT'>(db, row.system_id)
  const modifierRepository = createModifierGrantRepository(db)
  const groupedAbilities = new Map<string, { op: EquipmentAuthored['abilities'][number]['op'], abilities: { ability: EquipmentAuthored['abilities'][number]['abilities'][number]['ability'] }[] }>()
  const abilityOrder: string[] = []

  for (const ability of abilities) {
    const op = requireOperation(id, ability.operation)
    if (!groupedAbilities.has(op)) {
      groupedAbilities.set(op, { op, abilities: [] })
      abilityOrder.push(op)
    }

    groupedAbilities.get(op)?.abilities.push({
      ability: requireAbility(id, ability.ability_code)
    })
  }

  const effects = await Promise.all(
    effectLinks.map((link) => effectRepository.findById(link.effect_id))
  )
  const features = await Promise.all(
    featureLinks.map((link) => featureRepository.findById(link.feature_id))
  )
  const modifiers = await Promise.all(
    modifierLinks.map((link) => modifierRepository.findById(link.modifier_grant_id))
  )
  const authoredEffects = effects.map((effect, index) => requireLinkedRecord(
    effect,
    `Equipment "${id}" is linked to missing effect "${effectLinks[index]?.effect_id}".`
  ))
  const authoredFeatures = features.map((feature, index) => requireLinkedRecord(
    feature,
    `Equipment "${id}" is linked to missing feature "${featureLinks[index]?.feature_id}".`
  ))
  const authoredModifiers = modifiers.map((modifier, index) => requireLinkedRecord(
    modifier,
    `Equipment "${id}" is linked to missing modifier grant "${modifierLinks[index]?.modifier_grant_id}".`
  ))

  const base = {
    kind: 'EQUIPMENT' as const,
    id: row.id,
    label: row.label,
    description: row.description,
    attributes: attributes.length > 0
      ? attributes.map((attribute) => requireAttribute(id, attribute.attribute_code))
      : undefined,
    quote: row.quote ?? undefined,
    cost: {
      amount: row.cost_amount,
      currencyId: row.cost_currency_id
    },
    weight: {
      amount: row.weight_amount,
      unit: requireMeasurementUnit(id, row.weight_unit)
    },
    effects: authoredEffects.length > 0 ? authoredEffects : undefined,
    charges: row.charge_id
      ? requireLinkedRecord(charge, `Equipment "${id}" is linked to missing charge "${row.charge_id}".`)
      : undefined,
    capacity: row.capacity_amount != null && row.capacity_unit
      ? {
          amount: row.capacity_amount,
          unit: requireMeasurementUnit(id, row.capacity_unit)
        }
      : undefined,
    modifiers: authoredModifiers.length > 0 ? authoredModifiers : undefined,
    maxStack: row.max_stack ?? undefined,
    rarityId: row.rarity_id,
    maxBonus: row.max_bonus ?? undefined,
    armorClass: row.armor_class ?? undefined,
    contains: contains.length > 0
      ? contains.map((entry) => ({
          equipmentId: entry.contained_equipment_id,
          quantity: entry.quantity
        }))
      : undefined,
    features: authoredFeatures.length > 0 ? authoredFeatures : undefined,
    restrictions: row.restriction_id
      ? requireLinkedRecord(restrictions, `Equipment "${id}" is linked to missing restriction facet "${row.restriction_id}".`)
      : undefined,
    userId: row.user_id,
    systemId: row.system_id
  }
  const category = requireCategory(id, row.category)

  if (category === EQUIPMENT_CATEGORY_CODE.VARIANT) {
    return {
      ...base,
      category,
      parentEquipmentId: requireLinkedRecord(
        row.parent_equipment_id,
        `Equipment "${id}" is missing parent_equipment_id for VARIANT payload.`
      )
    }
  }

  return {
    ...base,
    properties: properties.map((property) => requireProperty(id, property.property_code)),
    category,
    abilities: abilityOrder.map((op) => {
      const group = requireLinkedRecord(
        groupedAbilities.get(op),
        `Equipment "${id}" ability group "${op}" is missing.`
      )

      return group
    })
  }
}

export function createEquipmentRepository(db: DBLike): EquipmentRepository {
  return {
    async upsert(entity) {
      await upsertEquipment(db, entity, entity.systemId)
    },

    async findById(id) {
      return hydrateEquipmentById(db, id)
    },

    async findAll(filter?: RepositoryFindAllOptions) {
      let query = db.selectFrom('equipment').select('id').orderBy('label')

      if (filter?.systemId) {
        query = query.where('system_id', '=', filter.systemId)
      }

      if (filter?.userId) {
        query = query.where('user_id', '=', filter.userId)
      }

      const rows = await query.execute()
      const records = await Promise.all(rows.map((row) => hydrateEquipmentById(db, row.id)))
      return records.filter((record): record is EquipmentAuthored => record !== null)
    }
  }
}
