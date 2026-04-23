import {
  type BaseEquipmentAuthored,
  EQUIPMENT_ATTRIBUTE,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  MEASUREMENT_UNIT_CODE,
  type EquipmentAuthored,
  resolveEquipmentAuthored,
  type ResolvedEquipment
} from '@artificer-toolkit/shared'
import type { DBLike } from '#types'
import { upsertEquipment } from '../upserts/equipment.js'
import { hydrateFacetById } from '../../shared/facets.js'
import { createEffectRepository } from '../../effects/repositories/effect.js'
import { createFeatureRepository } from '../../features/repositories/feature.js'
import { hydrateChargeById } from '../../grants/repositories/helpers.js'
import { createModifierGrantRepository } from '../../grants/repositories/modifier.js'
import type { EquipmentRepository, RepositoryFindAllOptions } from '../../../repositories/contracts.js'
import { hydrateSubjectStatus } from '../status.js'

type AnyEquipmentAuthored = EquipmentAuthored
type EquipmentCategory = EquipmentAuthored['category']
type EquipmentProperty = BaseEquipmentAuthored['properties'][number]
type EquipmentAttributeCode = NonNullable<BaseEquipmentAuthored['attributes']>[number]

function requireCategory(
  equipmentId: string,
  value: string
): EquipmentCategory {
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
): BaseEquipmentAuthored['weight']['unit'] {
  if (!(value in MEASUREMENT_UNIT_CODE)) {
    throw new Error(`Equipment "${equipmentId}" has invalid unit_code "${value}".`)
  }

  return value as BaseEquipmentAuthored['weight']['unit']
}

function requireAttribute(
  equipmentId: string,
  value: string
): EquipmentAttributeCode {
  if (!(value in EQUIPMENT_ATTRIBUTE)) {
    throw new Error(`Equipment "${equipmentId}" has invalid attribute_code "${value}".`)
  }

  return value as EquipmentAttributeCode
}

function requireProperty(
  equipmentId: string,
  value: string
): EquipmentProperty {
  if (!(value in EQUIPMENT_PROPERTY_CODE)) {
    throw new Error(`Equipment "${equipmentId}" has invalid property_code "${value}".`)
  }

  return value as EquipmentProperty
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
): Promise<AnyEquipmentAuthored | null> {
  const row = await db
    .selectFrom('equipment')
    .select([
      'id',
      'system_id',
      'user_id',
      'label',
      'description',
      'quote',
      'status',
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

  const [
    effectLinks,
    modifierLinks,
    featureLinks,
    attributes,
    properties,
    contains,
    charge,
    restrictions
  ] = await Promise.all([
    db.selectFrom('equipment_effects').select(['effect_id', 'sort_order'])
      .where('equipment_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('equipment_modifier_grants').select(['modifier_grant_id', 'sort_order'])
      .where('equipment_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('equipment_features').select(['feature_id', 'sort_order'])
      .where('equipment_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('equipment_attributes').select(['attribute_code', 'sort_order'])
      .where('equipment_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('equipment_properties').select(['property_code'])
      .where('equipment_id', '=', id)
      .orderBy('property_code')
      .execute(),
    db.selectFrom('equipment_contains').select(['contained_equipment_id', 'quantity'])
      .where('equipment_id', '=', id)
      .orderBy('contained_equipment_id')
      .execute(),
    row.charge_id ? hydrateChargeById(db, row.charge_id) : Promise.resolve(null),
    row.restriction_id ? hydrateFacetById<'EQUIPMENT'>(db, row.restriction_id) : Promise.resolve(null)
  ])

  const effectRepository = createEffectRepository(db)
  const featureRepository = createFeatureRepository<'EQUIPMENT'>(db, row.system_id)
  const modifierRepository = createModifierGrantRepository(db)

  const effects = await Promise.all(
    effectLinks.map((link) => effectRepository.findById(link.effect_id))
  )
  const features = await Promise.all(
    featureLinks.map((link) => featureRepository.findById(link.feature_id))
  )
  const modifiers = await Promise.all(
    modifierLinks.map((link) => modifierRepository.findById(link.modifier_grant_id))
  )
  const authoredEffects = effects.map((effect, index) => requireLinkedRecord(effect, `Equipment "${id}" is linked to missing effect "${effectLinks[index]?.effect_id}".`))
  const authoredFeatures = features.map((feature, index) => requireLinkedRecord(feature, `Equipment "${id}" is linked to missing feature "${featureLinks[index]?.feature_id}".`))
  const authoredModifiers = modifiers.map((modifier, index) => requireLinkedRecord(modifier, `Equipment "${id}" is linked to missing modifier grant "${modifierLinks[index]?.modifier_grant_id}".`))

  const common = {
    kind: 'EQUIPMENT' as const,
    id: row.id,
    label: row.label,
    description: row.description,
    quote: row.quote ?? undefined,
    status: hydrateSubjectStatus(row.status),
    effects: authoredEffects.length > 0 ? authoredEffects : undefined,
    charges: row.charge_id
      ? requireLinkedRecord(charge, `Equipment "${id}" is linked to missing charge "${row.charge_id}".`)
      : undefined,
    modifiers: authoredModifiers.length > 0 ? authoredModifiers : undefined,
    rarityId: row.rarity_id,
    maxBonus: row.max_bonus ?? undefined,
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
      ...common,
      category,
      parentEquipmentId: requireLinkedRecord(row.parent_equipment_id, `Equipment "${id}" is missing parent_equipment_id for VARIANT payload.`),
      properties: properties.length > 0
        ? properties.map((property) => requireProperty(id, property.property_code))
        : undefined
    }
  }

  if (row.weight_amount == null || !row.weight_unit) {
    throw new Error(`Equipment "${id}" is missing weight for BASE payload.`)
  }

  return {
    ...common,
    attributes: attributes.length > 0
      ? attributes.map((attribute) => requireAttribute(id, attribute.attribute_code))
      : undefined,
    cost: row.cost_amount != null && row.cost_currency_id
      ? {
          amount: row.cost_amount,
          currencyId: row.cost_currency_id
        }
      : undefined,
    weight: {
      amount: row.weight_amount,
      unit: requireMeasurementUnit(id, row.weight_unit)
    },
    capacity: row.capacity_amount != null && row.capacity_unit
      ? {
          amount: row.capacity_amount,
          unit: requireMeasurementUnit(id, row.capacity_unit)
        }
      : undefined,
    maxStack: row.max_stack ?? undefined,
    armorClass: row.armor_class ?? undefined,
    contains: contains.length > 0
      ? contains.map((entry) => ({
          equipmentId: entry.contained_equipment_id,
          quantity: entry.quantity
        }))
      : undefined,
    properties: properties.map((property) => requireProperty(id, property.property_code)),
    category
  }
}

export function createEquipmentRepository(db: DBLike): EquipmentRepository {
  async function loadEquipmentLineage(
    id: string,
    cache: Map<string, AnyEquipmentAuthored | null>
  ): Promise<AnyEquipmentAuthored | null> {
    if (cache.has(id)) {
      return cache.get(id) ?? null
    }

    const authored = await hydrateEquipmentById(db, id)
    cache.set(id, authored)

    if (
      authored?.category === EQUIPMENT_CATEGORY_CODE.VARIANT
    ) {
      await loadEquipmentLineage(authored.parentEquipmentId, cache)
    }

    return authored
  }

  async function hydrateResolvedEquipmentById(
    id: string,
    _filter?: RepositoryFindAllOptions
  ): Promise<ResolvedEquipment | null> {
    const cache = new Map<string, AnyEquipmentAuthored | null>()
    const authored = await loadEquipmentLineage(id, cache)

    if (!authored) {
      return null
    }

    return resolveEquipmentAuthored(
      authored,
      (parentId: string) => cache.get(parentId) ?? undefined
    )
  }

  return {
    async upsert(entity) {
      await upsertEquipment(db, entity, entity.systemId)
    },

    async findById(id) {
      return hydrateEquipmentById(db, id)
    },

    async findResolvedById(id, filter) {
      return hydrateResolvedEquipmentById(id, filter)
    },

    async findAll(filter?: RepositoryFindAllOptions) {
      let query = db.selectFrom('equipment').select('id')
        .orderBy('label')

      if (filter?.systemId) {
        query = query.where('system_id', '=', filter.systemId)
      }

      if (filter?.userId) {
        query = query.where('user_id', '=', filter.userId)
      }

      const rows = await query.execute()
      const records = await Promise.all(rows.map((row) => hydrateEquipmentById(db, row.id)))
      return records.filter((record): record is AnyEquipmentAuthored => record !== null)
    },

    async findResolvedAll(filter?: RepositoryFindAllOptions) {
      let query = db.selectFrom('equipment').select('id')
        .orderBy('label')

      if (filter?.systemId) {
        query = query.where('system_id', '=', filter.systemId)
      }

      if (filter?.userId) {
        query = query.where('user_id', '=', filter.userId)
      }

      const rows = await query.execute()
      const cache = new Map<string, AnyEquipmentAuthored | null>()

      await Promise.all(rows.map((row) => loadEquipmentLineage(row.id, cache)))

      return rows.flatMap((row) => {
        const authored = cache.get(row.id)

        if (!authored) {
          return []
        }

        return [
          resolveEquipmentAuthored(
            authored,
            (parentId: string) => cache.get(parentId) ?? undefined
          )
        ]
      })
    }
  }
}



