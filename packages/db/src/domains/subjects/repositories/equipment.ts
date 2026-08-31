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
import type { DBLike, DbTables } from '#types'
import { upsertEquipment } from '../upserts/equipment.js'
import { hydrateFacetById } from '../../shared/facets.js'
import { createEffectRepository } from '../../effects/repositories/effect.js'
import { createFeatureRepository } from '../../features/repositories/feature.js'
import { hydrateChargeById, hydrateChargesByIds } from '../../grants/repositories/helpers.js'
import { createModifierGrantRepository } from '../../grants/repositories/modifier.js'
import type {
  EquipmentRepository,
  RepositoryFindAllOptions
} from '../../../repositories/contracts.js'
import { hydrateByIds, orderedHydratedRecords, uniqueIds } from '../../../repositories/batch.js'
import { hydrateSubjectStatus } from '../status.js'

export interface EquipmentRepositoryReadOptions extends RepositoryFindAllOptions {
  allowedFeatureIds?: ReadonlySet<string>
  includeEffects?: boolean
}

export type EquipmentRepositoryWithReadOptions = Omit<
  EquipmentRepository,
  'findById' | 'findByIds' | 'findResolvedById'
> & {
  findById(
    id: string,
    filter?: EquipmentRepositoryReadOptions
  ): Promise<AnyEquipmentAuthored | null>
  findByIds(
    ids: readonly string[],
    filter?: EquipmentRepositoryReadOptions
  ): Promise<Map<string, AnyEquipmentAuthored>>
  findResolvedById(
    id: string,
    filter?: EquipmentRepositoryReadOptions
  ): Promise<ResolvedEquipment | null>
}

type AnyEquipmentAuthored = EquipmentAuthored
type DbNumeric = number | string
type EquipmentCategory = EquipmentAuthored['category']
type EquipmentProperty = BaseEquipmentAuthored['properties'][number]
type EquipmentAttributeCode = NonNullable<BaseEquipmentAuthored['attributes']>[number]
type EquipmentRow = Pick<
  DbTables['equipment']['Row'],
  | 'id'
  | 'system_id'
  | 'user_id'
  | 'label'
  | 'description'
  | 'quote'
  | 'status'
  | 'category'
  | 'rarity_id'
  | 'cost_amount'
  | 'cost_currency_id'
  | 'weight_amount'
  | 'weight_unit'
  | 'capacity_amount'
  | 'capacity_unit'
  | 'max_stack'
  | 'max_bonus'
  | 'armor_class'
  | 'requires_attunement'
  | 'charge_id'
  | 'restriction_id'
  | 'parent_equipment_id'
>

const EQUIPMENT_COLUMNS = [
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
  'requires_attunement',
  'charge_id',
  'restriction_id',
  'parent_equipment_id'
] as const

type EquipmentRelations = {
  effects: NonNullable<AnyEquipmentAuthored['effects']>
  modifiers: NonNullable<AnyEquipmentAuthored['modifiers']>
  features: NonNullable<AnyEquipmentAuthored['features']>
  attributes: Array<{ attribute_code: string }>
  properties: Array<{ property_code: string }>
  contains: Array<{ contained_equipment_id: string; quantity: number }>
  charge: AnyEquipmentAuthored['charges'] | null
  restrictions: AnyEquipmentAuthored['restrictions'] | null
}

function requireCategory(equipmentId: string, value: string): EquipmentCategory {
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

function requireMeasurementUnit(
  equipmentId: string,
  value: string
): NonNullable<BaseEquipmentAuthored['weight']>['unit'] {
  if (!(value in MEASUREMENT_UNIT_CODE)) {
    throw new Error(`Equipment "${equipmentId}" has invalid unit_code "${value}".`)
  }

  return value as NonNullable<BaseEquipmentAuthored['weight']>['unit']
}

function requireAttribute(equipmentId: string, value: string): EquipmentAttributeCode {
  if (!(value in EQUIPMENT_ATTRIBUTE)) {
    throw new Error(`Equipment "${equipmentId}" has invalid attribute_code "${value}".`)
  }

  return value as EquipmentAttributeCode
}

function requireProperty(equipmentId: string, value: string): EquipmentProperty {
  if (!(value in EQUIPMENT_PROPERTY_CODE)) {
    throw new Error(`Equipment "${equipmentId}" has invalid property_code "${value}".`)
  }

  return value as EquipmentProperty
}

function requireLinkedRecord<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw new Error(message)
  }

  return value
}

function readNumericValue(equipmentId: string, value: DbNumeric, field: string): number {
  const numericValue = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numericValue)) {
    throw new Error(`Equipment "${equipmentId}" has invalid ${field} "${String(value)}".`)
  }

  return numericValue
}

function buildEquipmentAuthored(
  row: EquipmentRow,
  relations: EquipmentRelations
): AnyEquipmentAuthored {
  const id = row.id
  if (!row.user_id) {
    throw new Error(`Equipment "${id}" is missing user ownership and cannot be hydrated.`)
  }

  const common = {
    kind: 'EQUIPMENT' as const,
    id,
    label: row.label,
    description: row.description,
    quote: row.quote ?? undefined,
    status: hydrateSubjectStatus(row.status),
    effects: relations.effects.length > 0 ? relations.effects : undefined,
    charges: row.charge_id
      ? requireLinkedRecord(
          relations.charge,
          `Equipment "${id}" is linked to missing charge "${row.charge_id}".`
        )
      : undefined,
    modifiers: relations.modifiers.length > 0 ? relations.modifiers : undefined,
    rarityId: row.rarity_id,
    maxBonus: row.max_bonus ?? undefined,
    ...(row.requires_attunement ? { requiresAttunement: true } : {}),
    features: relations.features.length > 0 ? relations.features : undefined,
    restrictions: row.restriction_id
      ? requireLinkedRecord(
          relations.restrictions,
          `Equipment "${id}" is linked to missing restriction facet "${row.restriction_id}".`
        )
      : undefined,
    userId: row.user_id,
    systemId: row.system_id
  }
  const category = requireCategory(id, row.category)

  if (category === EQUIPMENT_CATEGORY_CODE.VARIANT) {
    return {
      ...common,
      category,
      parentEquipmentId: requireLinkedRecord(
        row.parent_equipment_id,
        `Equipment "${id}" is missing parent_equipment_id for VARIANT payload.`
      ),
      properties:
        relations.properties.length > 0
          ? relations.properties.map((property) => requireProperty(id, property.property_code))
          : undefined
    }
  }

  return {
    ...common,
    attributes:
      relations.attributes.length > 0
        ? relations.attributes.map((attribute) => requireAttribute(id, attribute.attribute_code))
        : undefined,
    cost:
      row.cost_amount != null && row.cost_currency_id
        ? {
            amount: readNumericValue(id, row.cost_amount, 'cost_amount'),
            currencyId: row.cost_currency_id
          }
        : undefined,
    ...(row.weight_amount != null && row.weight_unit
      ? {
          weight: {
            amount: readNumericValue(id, row.weight_amount, 'weight_amount'),
            unit: requireMeasurementUnit(id, row.weight_unit)
          }
        }
      : {}),
    capacity:
      row.capacity_amount != null && row.capacity_unit
        ? {
            amount: readNumericValue(id, row.capacity_amount, 'capacity_amount'),
            unit: requireMeasurementUnit(id, row.capacity_unit)
          }
        : undefined,
    maxStack: row.max_stack ?? undefined,
    armorClass: row.armor_class ?? undefined,
    contains:
      relations.contains.length > 0
        ? relations.contains.map((entry) => ({
            equipmentId: entry.contained_equipment_id,
            quantity: entry.quantity
          }))
        : undefined,
    properties: relations.properties.map((property) => requireProperty(id, property.property_code)),
    category
  }
}

async function hydrateEquipmentById(
  db: DBLike,
  id: string,
  options: EquipmentRepositoryReadOptions = {}
): Promise<AnyEquipmentAuthored | null> {
  const row = await db
    .selectFrom('equipment')
    .select(EQUIPMENT_COLUMNS)
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
    options.includeEffects === false
      ? Promise.resolve([])
      : db
          .selectFrom('equipment_effects')
          .select(['effect_id', 'sort_order'])
          .where('equipment_id', '=', id)
          .orderBy('sort_order')
          .execute(),
    db
      .selectFrom('equipment_modifier_grants')
      .select(['modifier_grant_id', 'sort_order'])
      .where('equipment_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('equipment_features')
      .select(['feature_id', 'sort_order'])
      .where('equipment_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('equipment_attributes')
      .select(['attribute_code', 'sort_order'])
      .where('equipment_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('equipment_properties')
      .select(['property_code'])
      .where('equipment_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('equipment_contains')
      .select(['contained_equipment_id', 'quantity', 'sort_order'])
      .where('equipment_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    row.charge_id ? hydrateChargeById(db, row.charge_id) : Promise.resolve(null),
    row.restriction_id
      ? hydrateFacetById<'CHARACTER'>(db, row.restriction_id)
      : Promise.resolve(null)
  ])

  const effectRepository = createEffectRepository(db, row.system_id)
  const featureRepository = createFeatureRepository<'EQUIPMENT'>(db, row.system_id)
  const modifierRepository = createModifierGrantRepository(db)
  const selectedFeatureLinks = options.allowedFeatureIds
    ? featureLinks.filter((link) => options.allowedFeatureIds?.has(link.feature_id))
    : featureLinks

  const [effectsById, featuresById, modifiersById] = await Promise.all([
    options.includeEffects === false
      ? Promise.resolve(new Map())
      : effectRepository.findByIds(effectLinks.map((link) => link.effect_id)),
    featureRepository.findByIds(
      selectedFeatureLinks.map((link) => link.feature_id),
      { includeEffects: options.includeEffects }
    ),
    modifierRepository.findByIds(modifierLinks.map((link) => link.modifier_grant_id))
  ])
  const authoredEffects = effectLinks.map((link) =>
    requireLinkedRecord(
      effectsById.get(link.effect_id),
      `Equipment "${id}" is linked to missing effect "${link.effect_id}".`
    )
  )
  const authoredFeatures = selectedFeatureLinks.map((link) =>
    requireLinkedRecord(
      featuresById.get(link.feature_id),
      `Equipment "${id}" is linked to missing feature "${link.feature_id}".`
    )
  )
  const authoredModifiers = modifierLinks.map((link) =>
    requireLinkedRecord(
      modifiersById.get(link.modifier_grant_id),
      `Equipment "${id}" is linked to missing modifier grant "${link.modifier_grant_id}".`
    )
  )

  return buildEquipmentAuthored(row, {
    effects: authoredEffects,
    modifiers: authoredModifiers,
    features: authoredFeatures,
    attributes,
    properties,
    contains,
    charge,
    restrictions
  })
}

function groupEquipmentRows<T extends { equipment_id: string }>(
  rows: readonly T[]
): Map<string, T[]> {
  const grouped = new Map<string, T[]>()

  for (const row of rows) {
    const equipmentRows = grouped.get(row.equipment_id)
    if (equipmentRows) {
      equipmentRows.push(row)
    } else {
      grouped.set(row.equipment_id, [row])
    }
  }

  return grouped
}

async function hydrateEquipmentRows(
  db: DBLike,
  rows: readonly EquipmentRow[],
  options: EquipmentRepositoryReadOptions = {}
): Promise<Map<string, AnyEquipmentAuthored>> {
  const expectedSystemId =
    rows.length > 0 && rows.every((row) => row.system_id === rows[0]?.system_id)
      ? rows[0]?.system_id
      : undefined
  const equipmentIds = rows.map((row) => row.id)
  if (equipmentIds.length === 0) {
    return new Map()
  }

  const chargeIds = uniqueIds(rows.flatMap((row) => (row.charge_id ? [row.charge_id] : [])))
  const restrictionIds = uniqueIds(
    rows.flatMap((row) => (row.restriction_id ? [row.restriction_id] : []))
  )
  const [
    effectLinks,
    modifierLinks,
    featureLinks,
    attributes,
    properties,
    contains,
    chargesById,
    restrictionsById
  ] = await Promise.all([
    options.includeEffects === false
      ? Promise.resolve([])
      : db
          .selectFrom('equipment_effects')
          .select(['equipment_id', 'effect_id', 'sort_order'])
          .where('equipment_id', 'in', equipmentIds)
          .orderBy('sort_order')
          .execute(),
    db
      .selectFrom('equipment_modifier_grants')
      .select(['equipment_id', 'modifier_grant_id', 'sort_order'])
      .where('equipment_id', 'in', equipmentIds)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('equipment_features')
      .select(['equipment_id', 'feature_id', 'sort_order'])
      .where('equipment_id', 'in', equipmentIds)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('equipment_attributes')
      .select(['equipment_id', 'attribute_code', 'sort_order'])
      .where('equipment_id', 'in', equipmentIds)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('equipment_properties')
      .select(['equipment_id', 'property_code', 'sort_order'])
      .where('equipment_id', 'in', equipmentIds)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('equipment_contains')
      .select(['equipment_id', 'contained_equipment_id', 'quantity', 'sort_order'])
      .where('equipment_id', 'in', equipmentIds)
      .orderBy('sort_order')
      .execute(),
    hydrateChargesByIds(db, chargeIds),
    hydrateByIds(restrictionIds, (restrictionId) =>
      hydrateFacetById<'CHARACTER'>(db, restrictionId)
    )
  ])

  const effectRepository = createEffectRepository(db, expectedSystemId)
  const featureRepository = createFeatureRepository<'EQUIPMENT'>(db, expectedSystemId)
  const modifierRepository = createModifierGrantRepository(db)
  const selectedFeatureLinks = options.allowedFeatureIds
    ? featureLinks.filter((link) => options.allowedFeatureIds?.has(link.feature_id))
    : featureLinks
  const [effectsById, featuresById, modifiersById] = await Promise.all([
    options.includeEffects === false
      ? Promise.resolve(new Map())
      : effectRepository.findByIds(effectLinks.map((link) => link.effect_id)),
    featureRepository.findByIds(
      selectedFeatureLinks.map((link) => link.feature_id),
      { includeEffects: options.includeEffects }
    ),
    modifierRepository.findByIds(modifierLinks.map((link) => link.modifier_grant_id))
  ])
  const effectLinksByEquipment = groupEquipmentRows(effectLinks)
  const modifierLinksByEquipment = groupEquipmentRows(modifierLinks)
  const featureLinksByEquipment = groupEquipmentRows(selectedFeatureLinks)
  const attributesByEquipment = groupEquipmentRows(attributes)
  const propertiesByEquipment = groupEquipmentRows(properties)
  const containsByEquipment = groupEquipmentRows(contains)
  const authoredById = new Map<string, AnyEquipmentAuthored>()

  for (const row of rows) {
    const id = row.id
    const authoredEffects = (effectLinksByEquipment.get(id) ?? []).map((link) =>
      requireLinkedRecord(
        effectsById.get(link.effect_id),
        `Equipment "${id}" is linked to missing effect "${link.effect_id}".`
      )
    )
    const authoredFeatures = (featureLinksByEquipment.get(id) ?? []).map((link) =>
      requireLinkedRecord(
        featuresById.get(link.feature_id),
        `Equipment "${id}" is linked to missing feature "${link.feature_id}".`
      )
    )
    const authoredModifiers = (modifierLinksByEquipment.get(id) ?? []).map((link) =>
      requireLinkedRecord(
        modifiersById.get(link.modifier_grant_id),
        `Equipment "${id}" is linked to missing modifier grant "${link.modifier_grant_id}".`
      )
    )

    authoredById.set(
      id,
      buildEquipmentAuthored(row, {
        effects: authoredEffects,
        modifiers: authoredModifiers,
        features: authoredFeatures,
        attributes: attributesByEquipment.get(id) ?? [],
        properties: propertiesByEquipment.get(id) ?? [],
        contains: containsByEquipment.get(id) ?? [],
        charge: row.charge_id ? chargesById.get(row.charge_id) : null,
        restrictions: row.restriction_id ? restrictionsById.get(row.restriction_id) : null
      })
    )
  }

  return authoredById
}

export function createEquipmentRepository(db: DBLike): EquipmentRepositoryWithReadOptions {
  async function loadEquipmentLineage(
    id: string,
    cache: Map<string, AnyEquipmentAuthored | null>,
    options: EquipmentRepositoryReadOptions
  ): Promise<AnyEquipmentAuthored | null> {
    if (cache.has(id)) {
      return cache.get(id) ?? null
    }

    const authored = await hydrateEquipmentById(db, id, options)
    cache.set(id, authored)

    if (authored?.category === EQUIPMENT_CATEGORY_CODE.VARIANT) {
      await loadEquipmentLineage(authored.parentEquipmentId, cache, options)
    }

    return authored
  }

  async function hydrateResolvedEquipmentById(
    id: string,
    options: EquipmentRepositoryReadOptions = {}
  ): Promise<ResolvedEquipment | null> {
    const cache = new Map<string, AnyEquipmentAuthored | null>()
    const authored = await loadEquipmentLineage(id, cache, options)

    if (!authored) {
      return null
    }

    return resolveEquipmentAuthored(
      authored,
      (parentId: string) => cache.get(parentId) ?? undefined
    )
  }

  return {
    async upsert(entity, options) {
      await upsertEquipment(db, entity, entity.systemId, options.contentSourceId)
    },

    async findById(id, filter) {
      return hydrateEquipmentById(db, id, filter)
    },

    async findByIds(ids, filter) {
      return hydrateByIds(ids, (id) => hydrateEquipmentById(db, id, filter))
    },

    async findResolvedById(id, filter) {
      return hydrateResolvedEquipmentById(id, filter)
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
      return orderedHydratedRecords(
        rows.map((row) => row.id),
        await hydrateByIds(
          rows.map((row) => row.id),
          (id) => hydrateEquipmentById(db, id)
        )
      )
    },

    async findResolvedAll(filter?: RepositoryFindAllOptions) {
      let query = db.selectFrom('equipment').select(EQUIPMENT_COLUMNS).orderBy('label')

      if (filter?.systemId) {
        query = query.where('system_id', '=', filter.systemId)
      }

      if (filter?.userId) {
        query = query.where('user_id', '=', filter.userId)
      }

      const rows = await query.execute()
      const rowsById = new Map(rows.map((row) => [row.id, row]))
      let missingParentIds = uniqueIds(
        rows.flatMap((row) =>
          row.parent_equipment_id && !rowsById.has(row.parent_equipment_id)
            ? [row.parent_equipment_id]
            : []
        )
      )

      while (missingParentIds.length > 0) {
        const parentRows = await db
          .selectFrom('equipment')
          .select(EQUIPMENT_COLUMNS)
          .where('id', 'in', missingParentIds)
          .execute()

        for (const parentRow of parentRows) {
          rowsById.set(parentRow.id, parentRow)
        }

        const nextParentIds = parentRows.flatMap((parentRow) =>
          parentRow.parent_equipment_id && !rowsById.has(parentRow.parent_equipment_id)
            ? [parentRow.parent_equipment_id]
            : []
        )

        if (parentRows.length === 0) {
          break
        }

        missingParentIds = uniqueIds(nextParentIds)
      }

      const cache = await hydrateEquipmentRows(db, [...rowsById.values()])

      return rows.flatMap((row) => {
        const authored = cache.get(row.id)

        if (!authored) {
          return []
        }

        return [
          resolveEquipmentAuthored(authored, (parentId: string) => cache.get(parentId) ?? undefined)
        ]
      })
    }
  }
}
