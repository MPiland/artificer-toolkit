import type { DBLike } from '#types'
import {
  CASTING_TIME_UNIT_CODE,
  SPELL_ATTRIBUTE,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { deleteEffectById, upsertEffect } from '../../effects/upserts/index.js'
import { upsertDuration, upsertRange } from '../../shared/upserts/index.js'

type SpellRow = {
  id: string
  system_id: string
  user_id: string
  label: string
  description: string
  level: number
  magic_school_id: string
  casting_time_unit: string
  casting_time_amount: number
  range_id: string | null
  duration_id: string | null
  at_higher_levels: string | null
  material_description: string | null
}

type SpellAttributeRow = {
  spell_id: string
  attribute_code: string
  sort_order: number
}

type SpellClassRow = {
  spell_id: string
  class_id: string
}

function requireCastingTimeUnit(
  spellId: string,
  value: string
): SpellAuthored['castingTime']['unit'] {
  if (!(value in CASTING_TIME_UNIT_CODE)) {
    throw new Error(`Spell "${spellId}" has invalid casting time unit "${value}".`)
  }

  return value as SpellAuthored['castingTime']['unit']
}

function requireSpellAttribute(
  spellId: string,
  value: string
): NonNullable<SpellAuthored['attributes']>[number] {
  if (!(value in SPELL_ATTRIBUTE)) {
    throw new Error(`Spell "${spellId}" has invalid attribute "${value}".`)
  }

  return value as NonNullable<SpellAuthored['attributes']>[number]
}

function mapSpellRow(json_data: SpellAuthored): SpellRow {
  return {
    id: json_data.id,
    system_id: json_data.systemId,
    user_id: json_data.userId,
    label: json_data.label,
    description: json_data.description,
    level: json_data.level,
    magic_school_id: json_data.magicSchoolId,
    casting_time_unit: requireCastingTimeUnit(json_data.id, json_data.castingTime.unit),
    casting_time_amount: json_data.castingTime.amount,
    range_id: json_data.range?.id ?? null,
    duration_id: json_data.duration?.id ?? null,
    at_higher_levels: json_data.atHigherLevels ?? null,
    material_description: json_data.materialDescription ?? null
  }
}

async function deleteCharacteristicById(db: DBLike, id: string): Promise<void> {
  await db.deleteFrom('characteristic_shape_dimensions').where('characteristic_id', '=', id).execute()
  await db.deleteFrom('characteristic_shapes').where('characteristic_id', '=', id).execute()
  await db.deleteFrom('characteristic_ranges').where('characteristic_id', '=', id).execute()
  await db.deleteFrom('characteristic_durations').where('characteristic_id', '=', id).execute()
  await db.deleteFrom('characteristics').where('id', '=', id).execute()
}

export async function upsertSpell(
  db: DBLike,
  json_data: SpellAuthored,
  _systemId: string
) {
  const attributeRows: SpellAttributeRow[] = (json_data.attributes ?? []).map((attribute, index) => ({
    spell_id: json_data.id,
    attribute_code: requireSpellAttribute(json_data.id, attribute),
    sort_order: index + 1
  }))
  const effectRows = (json_data.effects ?? []).map((effect, index) => ({
    spell_id: json_data.id,
    effect_id: effect.id,
    sort_order: index + 1
  }))
  const nextEffectIds = new Set((json_data.effects ?? []).map((effect) => effect.id))

  const classRows: SpellClassRow[] = json_data.classIds.map((classId) => ({
    spell_id: json_data.id,
    class_id: classId
  }))

  const trx = await db.startTransaction().execute()

  try {
    const [previousSpellRow, previousEffectRows] = await Promise.all([
      trx
        .selectFrom('spells')
        .select(['range_id', 'duration_id'])
        .where('id', '=', json_data.id)
        .executeTakeFirst(),
      trx
        .selectFrom('spell_effects')
        .select(['effect_id'])
        .where('spell_id', '=', json_data.id)
        .execute()
    ])

    if (json_data.range) {
      await upsertRange(trx, json_data.range)
    }

    if (json_data.duration) {
      await upsertDuration(trx, json_data.duration)
    }

    for (const effect of json_data.effects ?? []) {
      await upsertEffect(trx, effect)
    }

    await trx
      .insertInto('spells')
      .values(mapSpellRow(json_data))
      .onConflict((oc) => oc.column('id').doUpdateSet(({ ref }) => ({
        system_id: ref('excluded.system_id'),
        user_id: ref('excluded.user_id'),
        label: ref('excluded.label'),
        description: ref('excluded.description'),
        level: ref('excluded.level'),
        magic_school_id: ref('excluded.magic_school_id'),
        casting_time_unit: ref('excluded.casting_time_unit'),
        casting_time_amount: ref('excluded.casting_time_amount'),
        range_id: ref('excluded.range_id'),
        duration_id: ref('excluded.duration_id'),
        at_higher_levels: ref('excluded.at_higher_levels'),
        material_description: ref('excluded.material_description')
      })))
      .execute()

    if (previousSpellRow?.range_id && previousSpellRow.range_id !== json_data.range?.id) {
      await deleteCharacteristicById(trx, previousSpellRow.range_id)
    }

    if (previousSpellRow?.duration_id && previousSpellRow.duration_id !== json_data.duration?.id) {
      await deleteCharacteristicById(trx, previousSpellRow.duration_id)
    }

    await trx
      .deleteFrom('spell_attributes')
      .where('spell_id', '=', json_data.id)
      .execute()

    await trx
      .deleteFrom('spell_classes')
      .where('spell_id', '=', json_data.id)
      .execute()

    for (const previousEffect of previousEffectRows) {
      if (!nextEffectIds.has(previousEffect.effect_id)) {
        await trx
          .deleteFrom('spell_effects')
          .where('spell_id', '=', json_data.id)
          .where('effect_id', '=', previousEffect.effect_id)
          .execute()
        await deleteEffectById(trx, previousEffect.effect_id)
      }
    }

    if (effectRows.length > 0) {
      await trx
        .insertInto('spell_effects')
        .values(effectRows)
        .onConflict((oc) => oc.columns(['spell_id', 'effect_id']).doUpdateSet(({ ref }) => ({
          sort_order: ref('excluded.sort_order')
        })))
        .execute()
    }

    if (attributeRows.length > 0) {
      await trx
        .insertInto('spell_attributes')
        .values(attributeRows)
        .execute()
    }

    if (classRows.length > 0) {
      await trx
        .insertInto('spell_classes')
        .values(classRows)
        .execute()
    }

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
