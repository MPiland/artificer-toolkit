import type { DBLike } from '#types'
import { withTransaction } from '../../../utils/index.js'
import {
  CASTING_TIME_UNIT_CODE,
  SPELL_ATTRIBUTE,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import { deleteEffectById, upsertEffect } from '../../effects/upserts/index.js'
import { normalizeSubjectStatus } from '../status.js'

const SPELL_COMPONENT_CODES: Record<NonNullable<SpellAuthored['components']>[number], true> = {
  VERBAL: true,
  SOMATIC: true,
  MATERIAL: true
}

type SpellRow = {
  id: string
  system_id: string
  user_id: string
  label: string
  description: string
  status: SpellAuthored['status']
  level: number
  magic_school_id: string
  casting_time_unit: string
  casting_time_amount: number
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

function requireSpellComponent(
  spellId: string,
  value: string
): NonNullable<SpellAuthored['components']>[number] {
  if (!(value in SPELL_COMPONENT_CODES)) {
    throw new Error(`Spell "${spellId}" has invalid component "${value}".`)
  }

  return value as NonNullable<SpellAuthored['components']>[number]
}

function mapSpellRow(json_data: SpellAuthored): SpellRow {
  return {
    id: json_data.id,
    system_id: json_data.systemId,
    user_id: json_data.userId,
    label: json_data.label,
    description: json_data.description,
    status: normalizeSubjectStatus(json_data.status),
    level: json_data.level,
    magic_school_id: json_data.magicSchoolId,
    casting_time_unit: requireCastingTimeUnit(json_data.id, json_data.castingTime.unit),
    casting_time_amount: json_data.castingTime.amount,
    material_description: json_data.materialDescription ?? null
  }
}

export async function upsertSpell(db: DBLike, json_data: SpellAuthored, _systemId: string) {
  const attributeRows: SpellAttributeRow[] = (json_data.attributes ?? []).map(
    (attribute, index) => ({
      spell_id: json_data.id,
      attribute_code: requireSpellAttribute(json_data.id, attribute),
      sort_order: index + 1
    })
  )
  const componentRows: SpellAttributeRow[] = (json_data.components ?? []).map(
    (component, index) => ({
      spell_id: json_data.id,
      attribute_code: requireSpellComponent(json_data.id, component),
      sort_order: (json_data.attributes ?? []).length + index + 1
    })
  )
  const authoredEffects = json_data.effects ?? []
  const effectRows = authoredEffects.map((effect, index) => ({
    spell_id: json_data.id,
    effect_id: effect.id,
    sort_order: index + 1
  }))
  const nextEffectIds = new Set(authoredEffects.map((effect) => effect.id))

  const classRows: SpellClassRow[] = json_data.classIds.map((classId) => ({
    spell_id: json_data.id,
    class_id: classId
  }))

  return withTransaction(db, async (trx) => {
    const previousEffectRows = await trx
      .selectFrom('spell_effects')
      .select(['effect_id'])
      .where('spell_id', '=', json_data.id)
      .execute()

    for (const effect of authoredEffects) {
      await upsertEffect(trx, effect)
    }

    await trx
      .insertInto('spells')
      .values(mapSpellRow(json_data))
      .onConflict((oc) =>
        oc.column('id').doUpdateSet((eb) => ({
          system_id: eb.ref('excluded.system_id'),
          user_id: eb.ref('excluded.user_id'),
          label: eb.ref('excluded.label'),
          description: eb.ref('excluded.description'),
          status: eb.ref('excluded.status'),
          level: eb.ref('excluded.level'),
          magic_school_id: eb.ref('excluded.magic_school_id'),
          casting_time_unit: eb.ref('excluded.casting_time_unit'),
          casting_time_amount: eb.ref('excluded.casting_time_amount'),
          material_description: eb.ref('excluded.material_description')
        }))
      )
      .execute()

    await trx.deleteFrom('spell_attributes').where('spell_id', '=', json_data.id).execute()

    await trx.deleteFrom('spell_classes').where('spell_id', '=', json_data.id).execute()

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
        .onConflict((oc) =>
          oc.columns(['spell_id', 'effect_id']).doUpdateSet((eb) => ({
            sort_order: eb.ref('excluded.sort_order')
          }))
        )
        .execute()
    }

    if (attributeRows.length > 0) {
      await trx.insertInto('spell_attributes').values(attributeRows).execute()
    }

    if (componentRows.length > 0) {
      await trx.insertInto('spell_attributes').values(componentRows).execute()
    }

    if (classRows.length > 0) {
      await trx.insertInto('spell_classes').values(classRows).execute()
    }
  })
}
