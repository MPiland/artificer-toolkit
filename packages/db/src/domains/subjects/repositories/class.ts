import {
  ABILITY_CODE,
  CLASS_ATTRIBUTE,
  CLASS_CATEGORY,
  PREPARE_LIMIT_METHOD_KIND,
  ROUNDING_CODE,
  SCALING_AMOUNT_KIND,
  SPELLCASTING_ATTRIBUTE,
  SUBCLASS_ATTRIBUTE,
  type ClassAuthored
} from '@artificer-toolkit/shared'
import type { DBLike } from '#types'
import { upsertClass } from '../upserts/class.js'
import { createDetailRepository } from '../../shared/repositories/detail.js'
import { createFeatureRepository } from '../../features/repositories/feature.js'
import { hydrateChargeById } from '../../grants/repositories/helpers.js'
import { createProficiencyGrantRepository } from '../../grants/repositories/proficiency.js'
import { createStartingEquipmentRepository } from '../../shared/repositories/starting_equipment.js'
import type { ClassRepository, RepositoryFindAllOptions } from '../../../repositories/contracts.js'
import { hydrateByIds, orderedHydratedRecords } from '../../../repositories/batch.js'
import { hydrateSubjectStatus } from '../status.js'

function requireLinkedRecord<T>(
  value: T | null | undefined,
  message: string
): T {
  if (value == null) {
    throw new Error(message)
  }

  return value
}

function requireClassCategory(
  classId: string,
  value: string
): ClassAuthored['category'] {
  if (value !== CLASS_CATEGORY.BASE && value !== CLASS_CATEGORY.SUBCLASS) {
    throw new Error(`Class "${classId}" has invalid category "${value}".`)
  }

  return value
}

function requireBaseAttribute(
  classId: string,
  value: string
): NonNullable<Extract<ClassAuthored, { category: 'BASE' }>['attributes']>[number] {
  if (!(value in CLASS_ATTRIBUTE)) {
    throw new Error(`Class "${classId}" has invalid base attribute_code "${value}".`)
  }

  return value as NonNullable<Extract<ClassAuthored, { category: 'BASE' }>['attributes']>[number]
}

function requireSubclassAttribute(
  classId: string,
  value: string
): NonNullable<Extract<ClassAuthored, { category: 'SUBCLASS' }>['attributes']>[number] {
  if (!(value in SUBCLASS_ATTRIBUTE)) {
    throw new Error(`Class "${classId}" has invalid subclass attribute_code "${value}".`)
  }

  return value as NonNullable<Extract<ClassAuthored, { category: 'SUBCLASS' }>['attributes']>[number]
}

function requireAbilityCode(
  ownerId: string,
  value: string,
  field: string
): string {
  if (!(value in ABILITY_CODE)) {
    throw new Error(`${field} "${ownerId}" has invalid ability_code "${value}".`)
  }

  return value
}

function requireSpellcastingAttribute(
  ownerId: string,
  value: string
): NonNullable<NonNullable<ClassAuthored['spellcasting']>['attributes']>[number] {
  if (!(value in SPELLCASTING_ATTRIBUTE)) {
    throw new Error(`Class spellcasting "${ownerId}" has invalid attribute_code "${value}".`)
  }

  return value as NonNullable<NonNullable<ClassAuthored['spellcasting']>['attributes']>[number]
}

function requirePrepareLimitMethod(
  ownerId: string,
  value: string
): NonNullable<NonNullable<ClassAuthored['spellcasting']>['prepareLimit']>['methodKinds'][number] {
  if (!(value in PREPARE_LIMIT_METHOD_KIND)) {
    throw new Error(`Class spellcasting "${ownerId}" has invalid method_code "${value}".`)
  }

  return value as NonNullable<NonNullable<ClassAuthored['spellcasting']>['prepareLimit']>['methodKinds'][number]
}

function requireScalingAmountKind(
  ownerId: string,
  value: string
): NonNullable<NonNullable<ClassAuthored['spellcasting']>['prepareLimit']>['scaling'] {
  if (!(value in SCALING_AMOUNT_KIND)) {
    throw new Error(`Class spellcasting "${ownerId}" has invalid scaling "${value}".`)
  }

  return value as NonNullable<NonNullable<ClassAuthored['spellcasting']>['prepareLimit']>['scaling']
}

function requireRoundingCode(
  ownerId: string,
  value: string
): NonNullable<NonNullable<ClassAuthored['spellcasting']>['prepareLimit']>['rounding'] {
  if (!(value in ROUNDING_CODE)) {
    throw new Error(`Class spellcasting "${ownerId}" has invalid rounding "${value}".`)
  }

  return value as NonNullable<NonNullable<ClassAuthored['spellcasting']>['prepareLimit']>['rounding']
}

async function hydrateClassResourceByClassId(
  db: DBLike,
  classId: string
): Promise<ClassAuthored['resources']> {
  const row = await db
    .selectFrom('class_resources')
    .select(['id', 'label', 'description', 'available_at_level', 'charge_id'])
    .where('class_id', '=', classId)
    .executeTakeFirst()

  if (!row) {
    return undefined
  }

  const charges = await hydrateChargeById(
    db,
    requireLinkedRecord(row.charge_id, `Class "${classId}" resource "${row.id}" is missing charge_id.`)
  )

  return {
    id: row.id,
    label: row.label,
    description: row.description ?? undefined,
    availableAtLevel: row.available_at_level,
    charges: requireLinkedRecord(
      charges,
      `Class "${classId}" resource "${row.id}" is linked to missing charge "${row.charge_id}".`
    )
  }
}

async function hydrateClassSpellcastingByClassId(
  db: DBLike,
  classId: string
): Promise<ClassAuthored['spellcasting']> {
  const row = await db
    .selectFrom('class_spellcasting')
    .select(['id', 'magic_name', 'ability_code', 'max_spell_level', 'charge_id'])
    .where('class_id', '=', classId)
    .executeTakeFirst()

  if (!row) {
    return undefined
  }

  const [charge, attributeRows, prepareLimitRow, prepareLimitMethodRows, prepareLimitLevelRows, spellLimitRows] = await Promise.all([
    hydrateChargeById(db, requireLinkedRecord(row.charge_id, `Class "${classId}" spellcasting "${row.id}" is missing charge_id.`)),
    db.selectFrom('class_spellcasting_attributes')
      .select(['attribute_code', 'sort_order'])
      .where('spellcasting_id', '=', row.id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('class_spellcasting_prepare_limit')
      .select(['scaling', 'rounding'])
      .where('spellcasting_id', '=', row.id)
      .executeTakeFirst(),
    db.selectFrom('class_spellcasting_prepare_limit_methods')
      .select(['method_code', 'sort_order'])
      .where('spellcasting_id', '=', row.id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('class_spellcasting_prepare_limit_levels')
      .select(['class_level', 'amount'])
      .where('spellcasting_id', '=', row.id)
      .orderBy('class_level')
      .execute(),
    db.selectFrom('class_spell_limits')
      .select(['id', 'class_level', 'learned_spells_limit', 'prepared_spells_limit', 'cantrips_limit'])
      .where('spellcasting_id', '=', row.id)
      .orderBy('class_level')
      .execute()
  ])
  const spellLimitIds = spellLimitRows.map((limit) => limit.id)
  const spellSlotRows = spellLimitIds.length
    ? await db.selectFrom('class_spell_slots')
        .select(['spell_limit_id', 'spell_level', 'slot_count'])
        .where('spell_limit_id', 'in', spellLimitIds)
        .execute()
    : []

  const slotsByLimit = new Map<string, { spell_limit_id: string, spell_level: number, slot_count: number }[]>()
  for (const slot of spellSlotRows) {
    slotsByLimit.set(slot.spell_limit_id, [...(slotsByLimit.get(slot.spell_limit_id) ?? []), slot])
  }

  return {
    spellLimits: spellLimitRows.map((limit) => ({
      classLevel: limit.class_level,
      slots: (slotsByLimit.get(limit.id) ?? [])
        .slice()
        .sort((left, right) => left.spell_level - right.spell_level)
        .map((slot) => ({
          spellLevel: slot.spell_level,
          slotCount: slot.slot_count
        })),
      learnedSpellsLimit: limit.learned_spells_limit ?? undefined,
      preparedSpellsLimit: limit.prepared_spells_limit ?? undefined,
      cantripsLimit: limit.cantrips_limit ?? undefined
    })),
    magicName: row.magic_name ?? undefined,
    ability: row.ability_code
      ? requireAbilityCode(classId, row.ability_code, 'Class spellcasting') as NonNullable<ClassAuthored['spellcasting']>['ability']
      : undefined,
    maxSpellLevel: row.max_spell_level,
    attributes: attributeRows.length > 0
      ? attributeRows.map((attribute) => requireSpellcastingAttribute(row.id, attribute.attribute_code))
      : undefined,
    charges: requireLinkedRecord(
      charge,
      `Class "${classId}" spellcasting "${row.id}" is linked to missing charge "${row.charge_id}".`
    ),
    prepareLimit: prepareLimitRow || prepareLimitMethodRows.length > 0 || prepareLimitLevelRows.length > 0
      ? {
          methodKinds: prepareLimitMethodRows.map((method) => requirePrepareLimitMethod(row.id, method.method_code)),
          scaling: prepareLimitRow?.scaling
            ? requireScalingAmountKind(row.id, prepareLimitRow.scaling)
            : undefined,
          rounding: prepareLimitRow?.rounding
            ? requireRoundingCode(row.id, prepareLimitRow.rounding)
            : undefined,
          perLevel: prepareLimitLevelRows.length > 0
            ? prepareLimitLevelRows.map((level) => ({
                classLevel: level.class_level,
                amount: level.amount
              }))
            : undefined
        }
      : undefined
  }
}

async function hydrateClassById(
  db: DBLike,
  id: string
): Promise<ClassAuthored | null> {
  const row = await db
    .selectFrom('classes')
    .select([
      'id',
      'system_id',
      'user_id',
      'category',
      'parent_class_id',
      'label',
      'description',
      'status',
      'starting_equipment_id'
    ])
    .where('id', '=', id)
    .executeTakeFirst()

  if (!row) return null
  if (!row.user_id) {
    throw new Error(`Class "${id}" is missing user ownership and cannot be hydrated.`)
  }

  const [
    featureLinks,
    detailLinks,
    proficiencyLinks,
    attributeRows,
    specializationRows,
    startingGoldRow,
    hitpointRow,
    multiclassRow,
    resources,
    spellcasting
  ] = await Promise.all([
    db.selectFrom('class_features').select(['feature_id', 'sort_order']).where('class_id', '=', id).orderBy('sort_order').execute(),
    db.selectFrom('class_details').select(['detail_id', 'sort_order']).where('class_id', '=', id).orderBy('sort_order').execute(),
    db.selectFrom('class_proficiency_grants').select(['proficiency_grant_id', 'sort_order']).where('class_id', '=', id).orderBy('sort_order').execute(),
    db.selectFrom('class_attributes').select(['attribute_code', 'sort_order']).where('class_id', '=', id).orderBy('sort_order').execute(),
    db.selectFrom('class_specializations').select(['id', 'label', 'sort_order']).where('class_id', '=', id).orderBy('sort_order').execute(),
    db.selectFrom('class_starting_gold').select(['multiplier', 'currency_id', 'die_config']).where('class_id', '=', id).executeTakeFirst(),
    db.selectFrom('class_hitpoints').select(['ability_code', 'die_config']).where('class_id', '=', id).executeTakeFirst(),
    db.selectFrom('class_multiclass').select(['id']).where('class_id', '=', id).executeTakeFirst(),
    hydrateClassResourceByClassId(db, id),
    hydrateClassSpellcastingByClassId(db, id)
  ])

  const detailRepository = createDetailRepository(db)
  const featureRepository = createFeatureRepository(db, row.system_id)
  const proficiencyRepository = createProficiencyGrantRepository(db)
  const startingEquipmentRepository = createStartingEquipmentRepository(db)

  const [detailsById, featuresById, proficienciesById, startingEquipment] = await Promise.all([
    detailRepository.findByIds(detailLinks.map((link) => link.detail_id)),
    featureRepository.findByIds(featureLinks.map((link) => link.feature_id)),
    proficiencyRepository.findByIds(proficiencyLinks.map((link) => link.proficiency_grant_id)),
    row.starting_equipment_id
      ? startingEquipmentRepository.findById(row.starting_equipment_id)
      : Promise.resolve(null)
  ])

  const authoredDetails = detailLinks.map((link) => requireLinkedRecord(
    detailsById.get(link.detail_id) ?? null,
    `Class "${id}" is linked to missing detail "${link.detail_id}".`
  ))
  const authoredFeatures = featureLinks.map((link) => requireLinkedRecord(
    featuresById.get(link.feature_id) ?? null,
    `Class "${id}" is linked to missing feature "${link.feature_id}".`
  ))
  const authoredProficiencies = proficiencyLinks.map((link) => requireLinkedRecord(
    proficienciesById.get(link.proficiency_grant_id) ?? null,
    `Class "${id}" is linked to missing proficiency grant "${link.proficiency_grant_id}".`
  ))
  const category = requireClassCategory(id, row.category)

  if (category === CLASS_CATEGORY.BASE) {
    const [multiclassGroupRows, multiclassProficiencyLinks] = multiclassRow
      ? await Promise.all([
          db.selectFrom('class_multiclass_requirement_groups')
            .select(['id', 'multiclass_id', 'sort_order'])
            .where('multiclass_id', '=', multiclassRow.id)
            .orderBy('sort_order')
            .execute(),
          db.selectFrom('class_multiclass_proficiency_grants')
            .select(['proficiency_grant_id', 'sort_order'])
            .where('multiclass_id', '=', multiclassRow.id)
            .orderBy('sort_order')
            .execute()
        ])
      : [[], []]
    const multiclassGroupIds = multiclassGroupRows.map((group) => group.id)
    const multiclassRequirementRows = multiclassGroupIds.length
      ? await db.selectFrom('class_multiclass_requirements')
          .select(['id', 'requirement_group_id', 'ability_code', 'min', 'sort_order'])
          .where('requirement_group_id', 'in', multiclassGroupIds)
          .orderBy('sort_order')
          .execute()
      : []

    const multiclassProficienciesById = multiclassRow
      ? await proficiencyRepository.findByIds(multiclassProficiencyLinks.map((link) => link.proficiency_grant_id))
      : new Map()

    const requirementsByGroup = new Map<string, { id: string, ability: string, min: number }[]>()
    for (const requirement of multiclassRequirementRows) {
      requirementsByGroup.set(requirement.requirement_group_id, [
        ...(requirementsByGroup.get(requirement.requirement_group_id) ?? []),
        {
          id: requirement.id,
          ability: requireAbilityCode(requirement.id, requirement.ability_code, 'Class multiclass requirement'),
          min: requirement.min
        }
      ])
    }

    return {
      id: row.id,
      label: row.label,
      description: row.description ?? undefined,
      status: hydrateSubjectStatus(row.status),
      details: authoredDetails.length > 0 ? authoredDetails : undefined,
      proficiencies: authoredProficiencies.length > 0 ? authoredProficiencies : undefined,
      spellcasting,
      resources,
      features: authoredFeatures.length > 0 ? authoredFeatures : undefined,
      userId: row.user_id,
      systemId: row.system_id,
      category,
      attributes: attributeRows.length > 0
        ? attributeRows.map((attribute) => requireBaseAttribute(id, attribute.attribute_code))
        : undefined,
      startingGold: {
        multiplier: requireLinkedRecord(startingGoldRow, `Class "${id}" is missing starting gold.`).multiplier,
        currencyId: requireLinkedRecord(startingGoldRow, `Class "${id}" is missing starting gold.`).currency_id,
        dieConfig: requireLinkedRecord(startingGoldRow, `Class "${id}" is missing starting gold.`).die_config
      },
      startingEquipment: requireLinkedRecord(
        startingEquipment,
        `Class "${id}" is linked to missing starting equipment "${row.starting_equipment_id}".`
      ),
      hitpoint: {
        ability: requireAbilityCode(
          id,
          requireLinkedRecord(hitpointRow, `Class "${id}" is missing hitpoint row.`).ability_code,
          'Class hitpoint'
        ) as Extract<ClassAuthored, { category: 'BASE' }>['hitpoint']['ability'],
        dieConfig: requireLinkedRecord(hitpointRow, `Class "${id}" is missing hitpoint row.`).die_config
      },
      multiclass: {
        id: requireLinkedRecord(multiclassRow, `Class "${id}" is missing multiclass row.`).id,
        requirementGroups: {
          groups: multiclassGroupRows.map((group) => ({
            id: group.id,
            requirements: (requirementsByGroup.get(group.id) ?? []).map((requirement) => ({
              id: requirement.id,
              ability: requirement.ability as Extract<ClassAuthored, { category: 'BASE' }>['multiclass']['requirementGroups']['groups'][number]['requirements'][number]['ability'],
              min: requirement.min
            }))
          }))
        },
        proficiencies: multiclassProficiencyLinks.length > 0
          ? multiclassProficiencyLinks.map((link) => requireLinkedRecord(
              multiclassProficienciesById.get(link.proficiency_grant_id) ?? null,
              `Class "${id}" multiclass is linked to missing proficiency grant "${link.proficiency_grant_id}".`
            ))
          : undefined
      }
    }
  }

  return {
    id: row.id,
    label: row.label,
    description: row.description ?? undefined,
    status: hydrateSubjectStatus(row.status),
    details: authoredDetails.length > 0 ? authoredDetails : undefined,
    proficiencies: authoredProficiencies.length > 0 ? authoredProficiencies : undefined,
    spellcasting,
    resources,
    features: authoredFeatures.length > 0 ? authoredFeatures : undefined,
    userId: row.user_id,
    systemId: row.system_id,
    category,
    attributes: attributeRows.length > 0
      ? attributeRows.map((attribute) => requireSubclassAttribute(id, attribute.attribute_code))
      : undefined,
    parentClassId: requireLinkedRecord(
      row.parent_class_id,
      `Class "${id}" is missing parent_class_id for SUBCLASS payload.`
    ),
    specializations: specializationRows.length > 0
      ? specializationRows.map((specialization) => ({
          id: specialization.id,
          label: specialization.label,
          order: specialization.sort_order
        }))
      : undefined
  }
}

export function createClassRepository(db: DBLike): ClassRepository {
  return {
    async upsert(entity) {
      await upsertClass(db, entity, entity.systemId)
    },

    async findById(id) {
      return hydrateClassById(db, id)
    },

    async findByIds(ids) {
      return hydrateByIds(ids, (id) => hydrateClassById(db, id))
    },

    async findAll(filter?: RepositoryFindAllOptions) {
      let query = db
        .selectFrom('classes')
        .select('id')
        .orderBy('label')

      if (filter?.systemId) {
        query = query.where('system_id', '=', filter.systemId)
      }

      if (filter?.userId) {
        query = query.where('user_id', '=', filter.userId)
      }

      const rows = await query.execute()
      return orderedHydratedRecords(
        rows.map((row) => row.id),
        await hydrateByIds(rows.map((row) => row.id), (id) => hydrateClassById(db, id))
      )
    }
  }
}
