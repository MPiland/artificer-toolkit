import type { DBLike } from '#types'
import { createHash } from 'node:crypto'
import { withTransaction } from '../../../utils/index.js'
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
import { upsertDetail, upsertStartingEquipment } from '../../shared/upserts/index.js'
import { upsertProficiencyGrant } from '../../grants/upserts/index.js'
import { upsertFeature, upsertFeatureRoot } from '../../features/upserts/index.js'
import { upsertCharge } from '../../shared/upserts/charge.js'
import { normalizeSubjectStatus } from '../status.js'

type ClassRow = {
  id: string
  system_id: string
  user_id: string
  category: string
  parent_class_id: string | null
  subclass_selection_level: number | null
  label: string
  description: string | null
  status: ClassAuthored['status']
  starting_equipment_id: string | null
}

type ClassAttributeRow = {
  class_id: string
  attribute_code: string
  sort_order: number
}

type ClassDetailRow = {
  class_id: string
  detail_id: string
  sort_order: number
}

type ClassProficiencyGrantRow = {
  class_id: string
  proficiency_grant_id: string
  sort_order: number
}

type ClassSpecializationRow = {
  id: string
  class_id: string
  label: string
  sort_order: number
}

type ClassHitpointRow = {
  class_id: string
  ability_code: string
  die_config: string
}

type ClassStartingGoldRow = {
  class_id: string
  multiplier: number
  currency_id: string
  die_config: string
}

type ClassMulticlassRow = {
  id: string
  class_id: string
}

type ClassMulticlassRequirementGroupRow = {
  id: string
  multiclass_id: string
  sort_order: number
}

type ClassMulticlassRequirementRow = {
  id: string
  requirement_group_id: string
  ability_code: string
  min: number
  sort_order: number
}

type ClassMulticlassProficiencyGrantRow = {
  multiclass_id: string
  proficiency_grant_id: string
  sort_order: number
}

type ClassResourceRow = {
  id: string
  class_id: string
  label: string
  description: string | null
  available_at_level: number
  sort_order: number | null
  charge_id: string
}

type ClassSpellcastingRow = {
  id: string
  class_id: string
  magic_name: string | null
  ability_code: string | null
  max_spell_level: number
  available_spell_ids: string[]
  available_at_level: number | null
  sort_order: number | null
  charge_id: string
}

type ClassSpellcastingAttributeRow = {
  spellcasting_id: string
  attribute_code: string
  sort_order: number
}

type ClassSpellcastingDetailRow = {
  spellcasting_id: string
  detail_id: string
  sort_order: number
}

type ClassSpellcastingPrepareLimitRow = {
  spellcasting_id: string
  scaling: string | null
  rounding: string | null
}

type ClassSpellcastingPrepareLimitMethodRow = {
  spellcasting_id: string
  method_code: string
  sort_order: number
}

type ClassSpellcastingPrepareLimitLevelRow = {
  spellcasting_id: string
  class_level: number
  amount: number
}

type ClassSpellLimitRow = {
  id: string
  spellcasting_id: string
  class_level: number
  learned_spells_limit: number | null
  prepared_spells_limit: number | null
  cantrips_limit: number | null
}

type ClassSpellSlotRow = {
  spell_limit_id: string
  spell_level: number
  slot_count: number
}

function createDerivedUuid(seed: string, purpose: string): string {
  const hex = createHash('sha256').update(`${seed}:${purpose}`).digest('hex')
  const variant = ((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${variant}${hex.slice(18, 20)}`,
    hex.slice(20, 32)
  ].join('-')
}

function requireClassCategory(classId: string, value: string): ClassAuthored['category'] {
  if (value !== CLASS_CATEGORY.BASE && value !== CLASS_CATEGORY.SUBCLASS) {
    throw new Error(`Class "${classId}" has invalid category "${value}".`)
  }

  return value
}

function requireClassAttribute(
  classId: string,
  value: string
): NonNullable<Extract<ClassAuthored, { category: 'BASE' }>['attributes']>[number] {
  if (!(value in CLASS_ATTRIBUTE)) {
    throw new Error(`Class "${classId}" has invalid base attribute "${value}".`)
  }

  return value as NonNullable<Extract<ClassAuthored, { category: 'BASE' }>['attributes']>[number]
}

function requireSubclassAttribute(
  classId: string,
  value: string
): NonNullable<Extract<ClassAuthored, { category: 'SUBCLASS' }>['attributes']>[number] {
  if (!(value in SUBCLASS_ATTRIBUTE)) {
    throw new Error(`Class "${classId}" has invalid subclass attribute "${value}".`)
  }

  return value as NonNullable<
    Extract<ClassAuthored, { category: 'SUBCLASS' }>['attributes']
  >[number]
}

function requireAbilityCode(ownerId: string, value: string, field: string): string {
  if (!(value in ABILITY_CODE)) {
    throw new Error(`${field} "${ownerId}" has invalid ability "${value}".`)
  }

  return value
}

function requireSpellcastingAttribute(ownerId: string, value: string): string {
  if (!(value in SPELLCASTING_ATTRIBUTE)) {
    throw new Error(`Class spellcasting "${ownerId}" has invalid attribute "${value}".`)
  }

  return value
}

function requirePrepareLimitMethod(ownerId: string, value: string): string {
  if (!(value in PREPARE_LIMIT_METHOD_KIND)) {
    throw new Error(`Class spellcasting "${ownerId}" has invalid prepare limit method "${value}".`)
  }

  return value
}

function requireScalingAmountKind(ownerId: string, value: string): string {
  if (!(value in SCALING_AMOUNT_KIND)) {
    throw new Error(`Class spellcasting "${ownerId}" has invalid scaling "${value}".`)
  }

  return value
}

function requireRoundingCode(ownerId: string, value: string): string {
  if (!(value in ROUNDING_CODE)) {
    throw new Error(`Class spellcasting "${ownerId}" has invalid rounding "${value}".`)
  }

  return value
}

function mapClassRow(json_data: ClassAuthored): ClassRow {
  if (json_data.category === CLASS_CATEGORY.BASE) {
    return {
      id: json_data.id,
      system_id: json_data.systemId,
      user_id: json_data.userId,
      category: requireClassCategory(json_data.id, json_data.category),
      parent_class_id: null,
      subclass_selection_level: json_data.subclassSelectionLevel ?? null,
      label: json_data.label,
      description: json_data.description ?? null,
      status: normalizeSubjectStatus(json_data.status),
      starting_equipment_id: json_data.startingEquipment.id
    }
  }

  return {
    id: json_data.id,
    system_id: json_data.systemId,
    user_id: json_data.userId,
    category: requireClassCategory(json_data.id, json_data.category),
    parent_class_id: json_data.parentClassId,
    subclass_selection_level: null,
    label: json_data.label,
    description: json_data.description ?? null,
    status: normalizeSubjectStatus(json_data.status),
    starting_equipment_id: null
  }
}

async function upsertClassRow(db: DBLike, json_data: ClassAuthored) {
  await db
    .insertInto('classes')
    .values(mapClassRow(json_data))
    .onConflict((oc) =>
      oc.column('id').doUpdateSet((eb) => ({
        system_id: eb.ref('excluded.system_id'),
        user_id: eb.ref('excluded.user_id'),
        category: eb.ref('excluded.category'),
        parent_class_id: eb.ref('excluded.parent_class_id'),
        subclass_selection_level: eb.ref('excluded.subclass_selection_level'),
        label: eb.ref('excluded.label'),
        description: eb.ref('excluded.description'),
        status: eb.ref('excluded.status'),
        starting_equipment_id: eb.ref('excluded.starting_equipment_id')
      }))
    )
    .execute()
}

export async function upsertClassRoot(db: DBLike, json_data: ClassAuthored, _systemId: string) {
  return withTransaction(db, async (trx) => {
    if (json_data.category === CLASS_CATEGORY.BASE) {
      await upsertStartingEquipment(trx, json_data.startingEquipment)
    }

    await upsertClassRow(trx, json_data)
  })
}

export async function upsertClass(db: DBLike, json_data: ClassAuthored, _systemId: string) {
  const detailRows: ClassDetailRow[] = (json_data.details ?? []).map((detail) => ({
    class_id: json_data.id,
    detail_id: detail.id,
    sort_order: detail.order
  }))

  const proficiencyRows: ClassProficiencyGrantRow[] = (json_data.proficiencies ?? []).map(
    (grant) => ({
      class_id: json_data.id,
      proficiency_grant_id: grant.id,
      sort_order: grant.order
    })
  )

  const resourceRow: ClassResourceRow | null = json_data.resources
    ? {
        id: json_data.resources.id,
        class_id: json_data.id,
        label: json_data.resources.label,
        description: json_data.resources.description ?? null,
        available_at_level: json_data.resources.availableAtLevel,
        sort_order: json_data.resources.order ?? null,
        charge_id: json_data.resources.charges.id
      }
    : null

  const spellcastingId = createDerivedUuid(json_data.id, 'class-spellcasting')
  const spellcastingRow: ClassSpellcastingRow | null = json_data.spellcasting
    ? {
        id: spellcastingId,
        class_id: json_data.id,
        magic_name: json_data.spellcasting.magicName ?? null,
        ability_code: json_data.spellcasting.ability
          ? requireAbilityCode(json_data.id, json_data.spellcasting.ability, 'Class spellcasting')
          : null,
        max_spell_level: json_data.spellcasting.maxSpellLevel,
        available_spell_ids: json_data.spellcasting.availableSpellIds ?? [],
        available_at_level: json_data.spellcasting.availableAtLevel ?? null,
        sort_order: json_data.spellcasting.order ?? null,
        charge_id: json_data.spellcasting.charges.id
      }
    : null

  const spellcastingAttributeRows: ClassSpellcastingAttributeRow[] = json_data.spellcasting
    ? (json_data.spellcasting.attributes ?? []).map((attribute, index) => ({
        spellcasting_id: spellcastingId,
        attribute_code: requireSpellcastingAttribute(spellcastingId, attribute),
        sort_order: index + 1
      }))
    : []

  const spellcastingDetailRows: ClassSpellcastingDetailRow[] = json_data.spellcasting
    ? (json_data.spellcasting.details ?? []).map((detail) => ({
        spellcasting_id: spellcastingId,
        detail_id: detail.id,
        sort_order: detail.order
      }))
    : []

  const prepareLimitRow: ClassSpellcastingPrepareLimitRow | null = json_data.spellcasting
    ?.prepareLimit
    ? {
        spellcasting_id: spellcastingId,
        scaling: json_data.spellcasting.prepareLimit.scaling
          ? requireScalingAmountKind(spellcastingId, json_data.spellcasting.prepareLimit.scaling)
          : null,
        rounding: json_data.spellcasting.prepareLimit.rounding
          ? requireRoundingCode(spellcastingId, json_data.spellcasting.prepareLimit.rounding)
          : null
      }
    : null

  const prepareLimitMethodRows: ClassSpellcastingPrepareLimitMethodRow[] = json_data.spellcasting
    ?.prepareLimit
    ? json_data.spellcasting.prepareLimit.methodKinds.map((method, index) => ({
        spellcasting_id: spellcastingId,
        method_code: requirePrepareLimitMethod(spellcastingId, method),
        sort_order: index + 1
      }))
    : []

  const prepareLimitLevelRows: ClassSpellcastingPrepareLimitLevelRow[] = json_data.spellcasting
    ?.prepareLimit?.perLevel
    ? json_data.spellcasting.prepareLimit.perLevel.map((level) => ({
        spellcasting_id: spellcastingId,
        class_level: level.classLevel,
        amount: level.amount
      }))
    : []

  const spellLimitRows: ClassSpellLimitRow[] = json_data.spellcasting
    ? json_data.spellcasting.spellLimits.map((limit) => ({
        id: createDerivedUuid(spellcastingId, `spell-limit-${limit.classLevel}`),
        spellcasting_id: spellcastingId,
        class_level: limit.classLevel,
        learned_spells_limit: limit.learnedSpellsLimit ?? null,
        prepared_spells_limit: limit.preparedSpellsLimit ?? null,
        cantrips_limit: limit.cantripsLimit ?? null
      }))
    : []

  const spellSlotRows: ClassSpellSlotRow[] = json_data.spellcasting
    ? json_data.spellcasting.spellLimits.flatMap((limit) =>
        limit.slots.map((slot) => ({
          spell_limit_id: createDerivedUuid(spellcastingId, `spell-limit-${limit.classLevel}`),
          spell_level: slot.spellLevel,
          slot_count: slot.slotCount
        }))
      )
    : []

  return withTransaction(db, async (trx) => {
    if (json_data.category === CLASS_CATEGORY.BASE) {
      await upsertStartingEquipment(trx, json_data.startingEquipment)
    }

    await upsertClassRow(trx, json_data)

    await trx.deleteFrom('class_features').where('class_id', '=', json_data.id).execute()
    await trx.deleteFrom('class_details').where('class_id', '=', json_data.id).execute()
    await trx.deleteFrom('class_proficiency_grants').where('class_id', '=', json_data.id).execute()
    await trx.deleteFrom('class_attributes').where('class_id', '=', json_data.id).execute()
    await trx.deleteFrom('class_specializations').where('class_id', '=', json_data.id).execute()
    await trx.deleteFrom('class_resources').where('class_id', '=', json_data.id).execute()
    await trx.deleteFrom('class_spellcasting').where('class_id', '=', json_data.id).execute()

    if (json_data.category === CLASS_CATEGORY.BASE) {
      await trx.deleteFrom('class_multiclass').where('class_id', '=', json_data.id).execute()
    } else {
      await trx.deleteFrom('class_hitpoints').where('class_id', '=', json_data.id).execute()
      await trx.deleteFrom('class_starting_gold').where('class_id', '=', json_data.id).execute()
      await trx.deleteFrom('class_multiclass').where('class_id', '=', json_data.id).execute()
    }

    if (json_data.details) {
      for (const detail of json_data.details) {
        await upsertDetail(trx, detail)
      }
    }

    if (json_data.proficiencies) {
      for (const grant of json_data.proficiencies) {
        await upsertProficiencyGrant(trx, grant)
      }
    }

    if (json_data.resources) {
      await upsertCharge(trx, json_data.resources.charges)
    }

    if (resourceRow) {
      await trx.insertInto('class_resources').values(resourceRow).execute()
    }

    if (json_data.features) {
      for (const feature of json_data.features) {
        await upsertFeatureRoot(trx, feature, json_data.systemId)
      }
    }

    if (json_data.features) {
      for (const feature of json_data.features) {
        await upsertFeature(trx, feature, json_data.systemId)
      }
    }

    if (json_data.spellcasting) {
      await upsertCharge(trx, json_data.spellcasting.charges)

      for (const detail of json_data.spellcasting.details ?? []) {
        await upsertDetail(trx, detail)
      }
    }

    if (detailRows.length > 0) {
      await trx.insertInto('class_details').values(detailRows).execute()
    }

    const featureRows = (json_data.features ?? []).map((feature) => ({
      class_id: json_data.id,
      feature_id: feature.id,
      sort_order: feature.order
    }))

    if (featureRows.length > 0) {
      await trx.insertInto('class_features').values(featureRows).execute()
    }

    if (proficiencyRows.length > 0) {
      await trx.insertInto('class_proficiency_grants').values(proficiencyRows).execute()
    }

    if (spellcastingRow) {
      await trx.insertInto('class_spellcasting').values(spellcastingRow).execute()

      if (spellcastingAttributeRows.length > 0) {
        await trx
          .insertInto('class_spellcasting_attributes')
          .values(spellcastingAttributeRows)
          .execute()
      }

      if (spellcastingDetailRows.length > 0) {
        await trx.insertInto('class_spellcasting_details').values(spellcastingDetailRows).execute()
      }

      if (prepareLimitRow) {
        await trx.insertInto('class_spellcasting_prepare_limit').values(prepareLimitRow).execute()
      }

      if (prepareLimitMethodRows.length > 0) {
        await trx
          .insertInto('class_spellcasting_prepare_limit_methods')
          .values(prepareLimitMethodRows)
          .execute()
      }

      if (prepareLimitLevelRows.length > 0) {
        await trx
          .insertInto('class_spellcasting_prepare_limit_levels')
          .values(prepareLimitLevelRows)
          .execute()
      }

      if (spellLimitRows.length > 0) {
        await trx.insertInto('class_spell_limits').values(spellLimitRows).execute()
      }

      if (spellSlotRows.length > 0) {
        await trx.insertInto('class_spell_slots').values(spellSlotRows).execute()
      }
    }

    if (json_data.category === CLASS_CATEGORY.BASE) {
      const attributeRows: ClassAttributeRow[] = (json_data.attributes ?? []).map(
        (attribute, index) => ({
          class_id: json_data.id,
          attribute_code: requireClassAttribute(json_data.id, attribute),
          sort_order: index + 1
        })
      )

      if (attributeRows.length > 0) {
        await trx.insertInto('class_attributes').values(attributeRows).execute()
      }

      await trx
        .insertInto('class_hitpoints')
        .values({
          class_id: json_data.id,
          ability_code: requireAbilityCode(json_data.id, json_data.hitpoint.ability, 'Class'),
          die_config: json_data.hitpoint.dieConfig
        } satisfies ClassHitpointRow)
        .onConflict((oc) =>
          oc.column('class_id').doUpdateSet((eb) => ({
            ability_code: eb.ref('excluded.ability_code'),
            die_config: eb.ref('excluded.die_config')
          }))
        )
        .execute()

      await trx
        .insertInto('class_starting_gold')
        .values({
          class_id: json_data.id,
          multiplier: json_data.startingGold.multiplier,
          currency_id: json_data.startingGold.currencyId,
          die_config: json_data.startingGold.dieConfig
        } satisfies ClassStartingGoldRow)
        .onConflict((oc) =>
          oc.column('class_id').doUpdateSet((eb) => ({
            multiplier: eb.ref('excluded.multiplier'),
            currency_id: eb.ref('excluded.currency_id'),
            die_config: eb.ref('excluded.die_config')
          }))
        )
        .execute()

      if (json_data.multiclass.proficiencies) {
        for (const grant of json_data.multiclass.proficiencies) {
          await upsertProficiencyGrant(trx, grant)
        }
      }

      await trx
        .insertInto('class_multiclass')
        .values({
          id: json_data.multiclass.id,
          class_id: json_data.id
        } satisfies ClassMulticlassRow)
        .execute()

      const multiclassGroupRows: ClassMulticlassRequirementGroupRow[] =
        json_data.multiclass.requirementGroups.groups.map((group, index) => ({
          id: group.id,
          multiclass_id: json_data.multiclass.id,
          sort_order: index + 1
        }))

      if (multiclassGroupRows.length > 0) {
        await trx
          .insertInto('class_multiclass_requirement_groups')
          .values(multiclassGroupRows)
          .execute()
      }

      const multiclassRequirementRows: ClassMulticlassRequirementRow[] =
        json_data.multiclass.requirementGroups.groups.flatMap((group) =>
          group.requirements.map((requirement, index) => ({
            id: requirement.id,
            requirement_group_id: group.id,
            ability_code: requireAbilityCode(
              requirement.id,
              requirement.ability,
              'Class multiclass requirement'
            ),
            min: requirement.min,
            sort_order: index + 1
          }))
        )

      if (multiclassRequirementRows.length > 0) {
        await trx
          .insertInto('class_multiclass_requirements')
          .values(multiclassRequirementRows)
          .execute()
      }

      const multiclassProficiencyRows: ClassMulticlassProficiencyGrantRow[] = (
        json_data.multiclass.proficiencies ?? []
      ).map((grant) => ({
        multiclass_id: json_data.multiclass.id,
        proficiency_grant_id: grant.id,
        sort_order: grant.order
      }))

      if (multiclassProficiencyRows.length > 0) {
        await trx
          .insertInto('class_multiclass_proficiency_grants')
          .values(multiclassProficiencyRows)
          .execute()
      }
    } else {
      const attributeRows: ClassAttributeRow[] = (json_data.attributes ?? []).map(
        (attribute, index) => ({
          class_id: json_data.id,
          attribute_code: requireSubclassAttribute(json_data.id, attribute),
          sort_order: index + 1
        })
      )

      if (attributeRows.length > 0) {
        await trx.insertInto('class_attributes').values(attributeRows).execute()
      }

      const specializationRows: ClassSpecializationRow[] = (json_data.specializations ?? []).map(
        (specialization) => ({
          id: specialization.id,
          class_id: json_data.id,
          label: specialization.label,
          sort_order: specialization.order
        })
      )

      if (specializationRows.length > 0) {
        await trx.insertInto('class_specializations').values(specializationRows).execute()
      }
    }
  })
}
