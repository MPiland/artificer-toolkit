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
import { hydrateChargesByIds } from '../../grants/repositories/helpers.js'
import { createProficiencyGrantRepository } from '../../grants/repositories/proficiency.js'
import { createStartingEquipmentRepository } from '../../shared/repositories/starting_equipment.js'
import type { ClassRepository, RepositoryFindAllOptions } from '../../../repositories/contracts.js'
import { orderedHydratedRecords, uniqueIds } from '../../../repositories/batch.js'
import { hydrateSubjectStatus } from '../status.js'

export interface ClassRepositoryReadOptions extends RepositoryFindAllOptions {
  allowedFeatureIds?: ReadonlySet<string>
  includeFeatureEffects?: boolean
}

export type ClassRepositoryWithReadOptions = Omit<ClassRepository, 'findById' | 'findByIds'> & {
  findById(id: string, filter?: ClassRepositoryReadOptions): Promise<ClassAuthored | null>
  findByIds(
    ids: readonly string[],
    filter?: ClassRepositoryReadOptions
  ): Promise<Map<string, ClassAuthored>>
}

const CLASS_COLUMNS = [
  'id',
  'system_id',
  'user_id',
  'category',
  'parent_class_id',
  'subclass_selection_level',
  'label',
  'description',
  'status',
  'starting_equipment_id'
] as const

type ClassRow = {
  id: string
  system_id: string
  user_id: string | null
  category: string
  parent_class_id: string | null
  subclass_selection_level: number | null
  label: string
  description: string | null
  status: string
  starting_equipment_id: string | null
}

function groupRows<T>(rows: readonly T[], getOwnerId: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>()

  for (const row of rows) {
    const ownerId = getOwnerId(row)
    const bucket = grouped.get(ownerId)
    if (bucket) {
      bucket.push(row)
    } else {
      grouped.set(ownerId, [row])
    }
  }

  return grouped
}

function requireLinkedRecord<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw new Error(message)
  }

  return value
}

function requireClassCategory(classId: string, value: string): ClassAuthored['category'] {
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

  return value as NonNullable<
    Extract<ClassAuthored, { category: 'SUBCLASS' }>['attributes']
  >[number]
}

function requireAbilityCode(ownerId: string, value: string, field: string): string {
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

  return value as NonNullable<
    NonNullable<ClassAuthored['spellcasting']>['prepareLimit']
  >['methodKinds'][number]
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

  return value as NonNullable<
    NonNullable<ClassAuthored['spellcasting']>['prepareLimit']
  >['rounding']
}

async function hydrateClassById(
  db: DBLike,
  id: string,
  options: ClassRepositoryReadOptions = {}
): Promise<ClassAuthored | null> {
  const classesById = await hydrateClassesByIds(db, [id], options)
  return classesById.get(id) ?? null
}

async function hydrateClassRows(
  db: DBLike,
  rows: readonly ClassRow[],
  options: ClassRepositoryReadOptions = {}
): Promise<Map<string, ClassAuthored>> {
  const classIds = rows.map((row) => row.id)
  if (classIds.length === 0) {
    return new Map()
  }

  const [
    featureLinks,
    detailLinks,
    proficiencyLinks,
    attributeRows,
    specializationRows,
    startingGoldRows,
    hitpointRows,
    multiclassRows,
    resourceRows,
    spellcastingRows
  ] = await Promise.all([
    db
      .selectFrom('class_features')
      .select(['class_id', 'feature_id', 'sort_order'])
      .where('class_id', 'in', classIds)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('class_details')
      .select(['class_id', 'detail_id', 'sort_order'])
      .where('class_id', 'in', classIds)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('class_proficiency_grants')
      .select(['class_id', 'proficiency_grant_id', 'sort_order'])
      .where('class_id', 'in', classIds)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('class_attributes')
      .select(['class_id', 'attribute_code', 'sort_order'])
      .where('class_id', 'in', classIds)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('class_specializations')
      .select(['id', 'class_id', 'label', 'sort_order'])
      .where('class_id', 'in', classIds)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('class_starting_gold')
      .select(['class_id', 'multiplier', 'currency_id', 'die_config'])
      .where('class_id', 'in', classIds)
      .execute(),
    db
      .selectFrom('class_hitpoints')
      .select(['class_id', 'ability_code', 'die_config'])
      .where('class_id', 'in', classIds)
      .execute(),
    db
      .selectFrom('class_multiclass')
      .select(['id', 'class_id'])
      .where('class_id', 'in', classIds)
      .execute(),
    db
      .selectFrom('class_resources')
      .select([
        'id',
        'class_id',
        'label',
        'description',
        'available_at_level',
        'sort_order',
        'charge_id'
      ])
      .where('class_id', 'in', classIds)
      .execute(),
    db
      .selectFrom('class_spellcasting')
      .select([
        'id',
        'class_id',
        'magic_name',
        'ability_code',
        'max_spell_level',
        'available_spell_ids',
        'available_at_level',
        'sort_order',
        'charge_id'
      ])
      .where('class_id', 'in', classIds)
      .execute()
  ])
  const spellcastingIds = spellcastingRows.map((row) => row.id)
  const multiclassIds = multiclassRows.map((row) => row.id)
  const [
    spellcastingAttributeRows,
    spellcastingDetailRows,
    prepareLimitRows,
    prepareLimitMethodRows,
    prepareLimitLevelRows,
    spellLimitRows,
    multiclassGroupRows,
    multiclassProficiencyLinks
  ] = await Promise.all([
    spellcastingIds.length > 0
      ? db
          .selectFrom('class_spellcasting_attributes')
          .select(['spellcasting_id', 'attribute_code', 'sort_order'])
          .where('spellcasting_id', 'in', spellcastingIds)
          .orderBy('sort_order')
          .execute()
      : Promise.resolve([]),
    spellcastingIds.length > 0
      ? db
          .selectFrom('class_spellcasting_details')
          .select(['spellcasting_id', 'detail_id', 'sort_order'])
          .where('spellcasting_id', 'in', spellcastingIds)
          .orderBy('sort_order')
          .execute()
      : Promise.resolve([]),
    spellcastingIds.length > 0
      ? db
          .selectFrom('class_spellcasting_prepare_limit')
          .select(['spellcasting_id', 'scaling', 'rounding'])
          .where('spellcasting_id', 'in', spellcastingIds)
          .execute()
      : Promise.resolve([]),
    spellcastingIds.length > 0
      ? db
          .selectFrom('class_spellcasting_prepare_limit_methods')
          .select(['spellcasting_id', 'method_code', 'sort_order'])
          .where('spellcasting_id', 'in', spellcastingIds)
          .orderBy('sort_order')
          .execute()
      : Promise.resolve([]),
    spellcastingIds.length > 0
      ? db
          .selectFrom('class_spellcasting_prepare_limit_levels')
          .select(['spellcasting_id', 'class_level', 'amount'])
          .where('spellcasting_id', 'in', spellcastingIds)
          .orderBy('class_level')
          .execute()
      : Promise.resolve([]),
    spellcastingIds.length > 0
      ? db
          .selectFrom('class_spell_limits')
          .select([
            'id',
            'spellcasting_id',
            'class_level',
            'learned_spells_limit',
            'prepared_spells_limit',
            'cantrips_limit'
          ])
          .where('spellcasting_id', 'in', spellcastingIds)
          .orderBy('class_level')
          .execute()
      : Promise.resolve([]),
    multiclassIds.length > 0
      ? db
          .selectFrom('class_multiclass_requirement_groups')
          .select(['id', 'multiclass_id', 'sort_order'])
          .where('multiclass_id', 'in', multiclassIds)
          .orderBy('sort_order')
          .execute()
      : Promise.resolve([]),
    multiclassIds.length > 0
      ? db
          .selectFrom('class_multiclass_proficiency_grants')
          .select(['multiclass_id', 'proficiency_grant_id', 'sort_order'])
          .where('multiclass_id', 'in', multiclassIds)
          .orderBy('sort_order')
          .execute()
      : Promise.resolve([])
  ])
  const spellLimitIds = spellLimitRows.map((row) => row.id)
  const multiclassGroupIds = multiclassGroupRows.map((row) => row.id)
  const [spellSlotRows, multiclassRequirementRows, chargesById] = await Promise.all([
    spellLimitIds.length > 0
      ? db
          .selectFrom('class_spell_slots')
          .select(['spell_limit_id', 'spell_level', 'slot_count'])
          .where('spell_limit_id', 'in', spellLimitIds)
          .execute()
      : Promise.resolve([]),
    multiclassGroupIds.length > 0
      ? db
          .selectFrom('class_multiclass_requirements')
          .select(['id', 'requirement_group_id', 'ability_code', 'min', 'sort_order'])
          .where('requirement_group_id', 'in', multiclassGroupIds)
          .orderBy('sort_order')
          .execute()
      : Promise.resolve([]),
    hydrateChargesByIds(db, [
      ...resourceRows.flatMap((row) => (row.charge_id ? [row.charge_id] : [])),
      ...spellcastingRows.flatMap((row) => (row.charge_id ? [row.charge_id] : []))
    ])
  ])
  const selectedFeatureLinks = options.allowedFeatureIds
    ? featureLinks.filter((link) => options.allowedFeatureIds?.has(link.feature_id))
    : featureLinks
  const featureLinksByClass = groupRows(selectedFeatureLinks, (link) => link.class_id)

  const detailRepository = createDetailRepository(db)
  const proficiencyRepository = createProficiencyGrantRepository(db)
  const startingEquipmentRepository = createStartingEquipmentRepository(db)
  const [detailsById, featuresById, proficienciesById, startingEquipmentById] = await Promise.all([
    detailRepository.findByIds([
      ...detailLinks.map((link) => link.detail_id),
      ...spellcastingDetailRows.map((link) => link.detail_id)
    ]),
    createFeatureRepository(db).findByIds(
      selectedFeatureLinks.map((link) => link.feature_id),
      { includeEffects: options.includeFeatureEffects }
    ),
    proficiencyRepository.findByIds([
      ...proficiencyLinks.map((link) => link.proficiency_grant_id),
      ...multiclassProficiencyLinks.map((link) => link.proficiency_grant_id)
    ]),
    startingEquipmentRepository.findByIds(
      rows.flatMap((row) => (row.starting_equipment_id ? [row.starting_equipment_id] : []))
    )
  ])
  const detailLinksByClass = groupRows(detailLinks, (link) => link.class_id)
  const proficiencyLinksByClass = groupRows(proficiencyLinks, (link) => link.class_id)
  const attributesByClass = groupRows(attributeRows, (row) => row.class_id)
  const specializationsByClass = groupRows(specializationRows, (row) => row.class_id)
  const startingGoldByClass = groupRows(startingGoldRows, (row) => row.class_id)
  const hitpointsByClass = groupRows(hitpointRows, (row) => row.class_id)
  const multiclassByClass = groupRows(multiclassRows, (row) => row.class_id)
  const resourcesByClass = groupRows(resourceRows, (row) => row.class_id)
  const spellcastingByClass = groupRows(spellcastingRows, (row) => row.class_id)
  const spellcastingAttributesById = groupRows(
    spellcastingAttributeRows,
    (row) => row.spellcasting_id
  )
  const spellcastingDetailsById = groupRows(spellcastingDetailRows, (row) => row.spellcasting_id)
  const prepareLimitsBySpellcasting = groupRows(prepareLimitRows, (row) => row.spellcasting_id)
  const prepareMethodsBySpellcasting = groupRows(
    prepareLimitMethodRows,
    (row) => row.spellcasting_id
  )
  const prepareLevelsBySpellcasting = groupRows(prepareLimitLevelRows, (row) => row.spellcasting_id)
  const spellLimitsBySpellcasting = groupRows(spellLimitRows, (row) => row.spellcasting_id)
  const slotsByLimit = groupRows(spellSlotRows, (row) => row.spell_limit_id)
  const multiclassGroupsById = groupRows(multiclassGroupRows, (row) => row.multiclass_id)
  const multiclassProficienciesById = groupRows(
    multiclassProficiencyLinks,
    (row) => row.multiclass_id
  )
  const requirementsByGroup = groupRows(
    multiclassRequirementRows,
    (row) => row.requirement_group_id
  )
  const authoredById = new Map<string, ClassAuthored>()

  for (const row of rows) {
    if (!row.user_id) {
      throw new Error(`Class "${row.id}" is missing user ownership and cannot be hydrated.`)
    }

    const id = row.id
    const authoredDetails = (detailLinksByClass.get(id) ?? []).map((link) =>
      requireLinkedRecord(
        detailsById.get(link.detail_id) ?? null,
        `Class "${id}" is linked to missing detail "${link.detail_id}".`
      )
    )
    const authoredFeatures = (featureLinksByClass.get(id) ?? []).map((link) =>
      requireLinkedRecord(
        featuresById.get(link.feature_id) ?? null,
        `Class "${id}" is linked to missing feature "${link.feature_id}".`
      )
    )
    const authoredProficiencies = (proficiencyLinksByClass.get(id) ?? []).map((link) =>
      requireLinkedRecord(
        proficienciesById.get(link.proficiency_grant_id) ?? null,
        `Class "${id}" is linked to missing proficiency grant "${link.proficiency_grant_id}".`
      )
    )
    const resourceRow = resourcesByClass.get(id)?.[0]
    const resources: ClassAuthored['resources'] = resourceRow
      ? {
          id: resourceRow.id,
          label: resourceRow.label,
          description: resourceRow.description ?? undefined,
          availableAtLevel: resourceRow.available_at_level,
          order: resourceRow.sort_order ?? undefined,
          charges: requireLinkedRecord(
            chargesById.get(
              requireLinkedRecord(
                resourceRow.charge_id,
                `Class "${id}" resource "${resourceRow.id}" is missing charge_id.`
              )
            ),
            `Class "${id}" resource "${resourceRow.id}" is linked to missing charge "${resourceRow.charge_id}".`
          )
        }
      : undefined
    const spellcastingRow = spellcastingByClass.get(id)?.[0]
    const spellcasting: ClassAuthored['spellcasting'] = spellcastingRow
      ? (() => {
          const spellcastingId = spellcastingRow.id
          const attributeRows = spellcastingAttributesById.get(spellcastingId) ?? []
          const detailRows = spellcastingDetailsById.get(spellcastingId) ?? []
          const prepareLimitRow = prepareLimitsBySpellcasting.get(spellcastingId)?.[0]
          const prepareLimitMethodRows = prepareMethodsBySpellcasting.get(spellcastingId) ?? []
          const prepareLimitLevelRows = prepareLevelsBySpellcasting.get(spellcastingId) ?? []
          const authoredSpellcastingDetails = detailRows.map((detail) =>
            requireLinkedRecord(
              detailsById.get(detail.detail_id) ?? null,
              `Class "${id}" spellcasting "${spellcastingId}" is linked to missing detail "${detail.detail_id}".`
            )
          )

          return {
            spellLimits: (spellLimitsBySpellcasting.get(spellcastingId) ?? []).map((limit) => ({
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
            magicName: spellcastingRow.magic_name ?? undefined,
            details:
              authoredSpellcastingDetails.length > 0 ? authoredSpellcastingDetails : undefined,
            ability: spellcastingRow.ability_code
              ? (requireAbilityCode(
                  id,
                  spellcastingRow.ability_code,
                  'Class spellcasting'
                ) as NonNullable<ClassAuthored['spellcasting']>['ability'])
              : undefined,
            maxSpellLevel: spellcastingRow.max_spell_level,
            availableSpellIds:
              spellcastingRow.available_spell_ids.length > 0
                ? spellcastingRow.available_spell_ids
                : undefined,
            availableAtLevel: spellcastingRow.available_at_level ?? undefined,
            order: spellcastingRow.sort_order ?? undefined,
            attributes:
              attributeRows.length > 0
                ? attributeRows.map((attribute) =>
                    requireSpellcastingAttribute(spellcastingId, attribute.attribute_code)
                  )
                : undefined,
            charges: requireLinkedRecord(
              chargesById.get(
                requireLinkedRecord(
                  spellcastingRow.charge_id,
                  `Class "${id}" spellcasting "${spellcastingId}" is missing charge_id.`
                )
              ),
              `Class "${id}" spellcasting "${spellcastingId}" is linked to missing charge "${spellcastingRow.charge_id}".`
            ),
            prepareLimit:
              prepareLimitRow ||
              prepareLimitMethodRows.length > 0 ||
              prepareLimitLevelRows.length > 0
                ? {
                    methodKinds: prepareLimitMethodRows.map((method) =>
                      requirePrepareLimitMethod(spellcastingId, method.method_code)
                    ),
                    scaling: prepareLimitRow?.scaling
                      ? requireScalingAmountKind(spellcastingId, prepareLimitRow.scaling)
                      : undefined,
                    rounding: prepareLimitRow?.rounding
                      ? requireRoundingCode(spellcastingId, prepareLimitRow.rounding)
                      : undefined,
                    perLevel:
                      prepareLimitLevelRows.length > 0
                        ? prepareLimitLevelRows.map((level) => ({
                            classLevel: level.class_level,
                            amount: level.amount
                          }))
                        : undefined
                  }
                : undefined
          }
        })()
      : undefined
    const category = requireClassCategory(id, row.category)
    const common = {
      id,
      label: row.label,
      description: row.description ?? undefined,
      status: hydrateSubjectStatus(row.status),
      details: authoredDetails.length > 0 ? authoredDetails : undefined,
      proficiencies: authoredProficiencies.length > 0 ? authoredProficiencies : undefined,
      spellcasting,
      resources,
      features: authoredFeatures.length > 0 ? authoredFeatures : undefined,
      userId: row.user_id,
      systemId: row.system_id
    }

    if (category === CLASS_CATEGORY.BASE) {
      const startingGoldRow = startingGoldByClass.get(id)?.[0]
      const hitpointRow = hitpointsByClass.get(id)?.[0]
      const multiclassRow = multiclassByClass.get(id)?.[0]
      const multiclassGroupRows = multiclassRow
        ? (multiclassGroupsById.get(multiclassRow.id) ?? [])
        : []
      const multiclassProficiencyLinks = multiclassRow
        ? (multiclassProficienciesById.get(multiclassRow.id) ?? [])
        : []

      authoredById.set(id, {
        ...common,
        category,
        subclassSelectionLevel: row.subclass_selection_level ?? undefined,
        attributes:
          (attributesByClass.get(id) ?? []).length > 0
            ? (attributesByClass.get(id) ?? []).map((attribute) =>
                requireBaseAttribute(id, attribute.attribute_code)
              )
            : undefined,
        startingGold: {
          multiplier: requireLinkedRecord(
            startingGoldRow,
            `Class "${id}" is missing starting gold.`
          ).multiplier,
          currencyId: requireLinkedRecord(
            startingGoldRow,
            `Class "${id}" is missing starting gold.`
          ).currency_id,
          dieConfig: requireLinkedRecord(startingGoldRow, `Class "${id}" is missing starting gold.`)
            .die_config
        },
        startingEquipment: requireLinkedRecord(
          row.starting_equipment_id ? startingEquipmentById.get(row.starting_equipment_id) : null,
          `Class "${id}" is linked to missing starting equipment "${row.starting_equipment_id}".`
        ),
        hitpoint: {
          ability: requireAbilityCode(
            id,
            requireLinkedRecord(hitpointRow, `Class "${id}" is missing hitpoint row.`).ability_code,
            'Class hitpoint'
          ) as Extract<ClassAuthored, { category: 'BASE' }>['hitpoint']['ability'],
          dieConfig: requireLinkedRecord(hitpointRow, `Class "${id}" is missing hitpoint row.`)
            .die_config
        },
        multiclass: {
          id: requireLinkedRecord(multiclassRow, `Class "${id}" is missing multiclass row.`).id,
          requirementGroups: {
            groups: multiclassGroupRows.map((group) => ({
              id: group.id,
              requirements: (requirementsByGroup.get(group.id) ?? []).map((requirement) => ({
                id: requirement.id,
                ability: requireAbilityCode(
                  requirement.id,
                  requirement.ability_code,
                  'Class multiclass requirement'
                ) as Extract<
                  ClassAuthored,
                  { category: 'BASE' }
                >['multiclass']['requirementGroups']['groups'][number]['requirements'][number]['ability'],
                min: requirement.min
              }))
            }))
          },
          proficiencies:
            multiclassProficiencyLinks.length > 0
              ? multiclassProficiencyLinks.map((link) =>
                  requireLinkedRecord(
                    proficienciesById.get(link.proficiency_grant_id) ?? null,
                    `Class "${id}" multiclass is linked to missing proficiency grant "${link.proficiency_grant_id}".`
                  )
                )
              : undefined
        }
      })
      continue
    }

    const subclassAttributes = attributesByClass.get(id) ?? []
    authoredById.set(id, {
      ...common,
      category,
      attributes:
        subclassAttributes.length > 0
          ? subclassAttributes.map((attribute) =>
              requireSubclassAttribute(id, attribute.attribute_code)
            )
          : undefined,
      parentClassId: requireLinkedRecord(
        row.parent_class_id,
        `Class "${id}" is missing parent_class_id for SUBCLASS payload.`
      ),
      specializations:
        (specializationsByClass.get(id) ?? []).length > 0
          ? (specializationsByClass.get(id) ?? []).map((specialization) => ({
              id: specialization.id,
              label: specialization.label,
              order: specialization.sort_order
            }))
          : undefined
    })
  }

  return authoredById
}

async function hydrateClassesByIds(
  db: DBLike,
  ids: readonly string[],
  options: ClassRepositoryReadOptions = {}
): Promise<Map<string, ClassAuthored>> {
  const distinctIds = uniqueIds(ids)
  if (distinctIds.length === 0) {
    return new Map()
  }

  const rows = (await db
    .selectFrom('classes')
    .select(CLASS_COLUMNS)
    .where('id', 'in', distinctIds)
    .execute()) as ClassRow[]
  const rowsById = new Map(rows.map((row) => [row.id, row]))

  return hydrateClassRows(
    db,
    distinctIds.flatMap((id) => {
      const row = rowsById.get(id)
      return row ? [row] : []
    }),
    options
  )
}

export function createClassRepository(db: DBLike): ClassRepositoryWithReadOptions {
  return {
    async upsert(entity) {
      await upsertClass(db, entity, entity.systemId)
    },

    async findById(id, filter) {
      return hydrateClassById(db, id, filter)
    },

    async findByIds(ids, filter) {
      return hydrateClassesByIds(db, ids, filter)
    },

    async findAll(filter?: RepositoryFindAllOptions) {
      let query = db.selectFrom('classes').select(CLASS_COLUMNS).orderBy('label')

      if (filter?.systemId) {
        query = query.where('system_id', '=', filter.systemId)
      }

      if (filter?.userId) {
        query = query.where('user_id', '=', filter.userId)
      }

      const rows = await query.execute()
      return orderedHydratedRecords(
        rows.map((row) => row.id),
        await hydrateClassRows(db, rows as ClassRow[])
      )
    }
  }
}
