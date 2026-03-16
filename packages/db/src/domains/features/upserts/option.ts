import type { DBLike } from '#types'
import {
  FEATURE_ATTRIBUTE,
  type NodeSubjectCode,
  type OptionAuthored
} from '@artificer-toolkit/shared'
import { upsertFacet } from '../../shared/facets.js'
import { upsertCharge } from '../../shared/upserts/index.js'
import {
  upsertFeatGrant,
  upsertModifierGrant,
  upsertProficiencyGrant,
  upsertSenseGrant,
  upsertSpellGrant
} from '../../grants/upserts/index.js'
import { deleteEffectById, upsertEffect } from '../../effects/upserts/index.js'

type OptionRow = {
  id: string
  label: string
  description: string
  detail: string | null
  sort_order: number
  charge_id: string | null
  restriction_id: string | null
}

type OptionAttributeRow = {
  option_id: string
  attribute_code: string
  sort_order: number
}

type OptionFeatGrantRow = {
  option_id: string
  feat_grant_id: string
  sort_order: number
}

type OptionModifierGrantRow = {
  option_id: string
  modifier_grant_id: string
  sort_order: number
}

type OptionProficiencyGrantRow = {
  option_id: string
  proficiency_grant_id: string
  sort_order: number
}

type OptionSenseGrantRow = {
  option_id: string
  sense_grant_id: string
  sort_order: number
}

type OptionSpellGrantRow = {
  option_id: string
  spell_grant_id: string
  sort_order: number
}

function requireFeatureAttribute(
  optionId: string,
  value: string
): NonNullable<OptionAuthored['attributes']>[number] {
  if (!(value in FEATURE_ATTRIBUTE)) {
    throw new Error(`Option "${optionId}" has invalid attribute "${value}".`)
  }

  return value as NonNullable<OptionAuthored['attributes']>[number]
}

function mapOptionRow<N extends NodeSubjectCode>(json_data: OptionAuthored<N>): OptionRow {
  return {
    id: json_data.id,
    label: json_data.label,
    description: json_data.description,
    detail: json_data.detail ?? null,
    sort_order: json_data.order,
    charge_id: json_data.charges?.id ?? null,
    restriction_id: json_data.restrictions?.id ?? null
  }
}

export async function upsertOption<N extends NodeSubjectCode>(
  db: DBLike,
  json_data: OptionAuthored<N>,
  systemId?: string
): Promise<void> {
  const attributeRows: OptionAttributeRow[] = (json_data.attributes ?? []).map((attribute, index) => ({
    option_id: json_data.id,
    attribute_code: requireFeatureAttribute(json_data.id, attribute),
    sort_order: index + 1
  }))
  const effectRows = (json_data.effects ?? []).map((effect, index) => ({
    option_id: json_data.id,
    effect_id: effect.id,
    sort_order: index + 1
  }))
  const featGrantRows: OptionFeatGrantRow[] = (json_data.grants?.feats ?? []).map((grant) => ({
    option_id: json_data.id,
    feat_grant_id: grant.id,
    sort_order: grant.order
  }))
  const modifierGrantRows: OptionModifierGrantRow[] = (json_data.grants?.modifiers ?? []).map((grant) => ({
    option_id: json_data.id,
    modifier_grant_id: grant.id,
    sort_order: grant.order
  }))
  const proficiencyGrantRows: OptionProficiencyGrantRow[] = (json_data.grants?.proficiencies ?? []).map((grant) => ({
    option_id: json_data.id,
    proficiency_grant_id: grant.id,
    sort_order: grant.order
  }))
  const senseGrantRows: OptionSenseGrantRow[] = (json_data.grants?.senses ?? []).map((grant) => ({
    option_id: json_data.id,
    sense_grant_id: grant.id,
    sort_order: grant.order
  }))
  const spellGrantRows: OptionSpellGrantRow[] = (json_data.grants?.spells ?? []).map((grant) => ({
    option_id: json_data.id,
    spell_grant_id: grant.id,
    sort_order: grant.order
  }))
  const nextEffectIds = new Set((json_data.effects ?? []).map((effect) => effect.id))

  const trx = await db.startTransaction().execute()

  try {
    const existingOption = await trx
      .selectFrom('options')
      .select(['restriction_id'])
      .where('id', '=', json_data.id)
      .executeTakeFirst()
    const previousEffectRows = await trx
      .selectFrom('option_effects')
      .select(['effect_id'])
      .where('option_id', '=', json_data.id)
      .execute()

    if (existingOption?.restriction_id && existingOption.restriction_id !== json_data.restrictions?.id) {
      await trx.deleteFrom('facets').where('id', '=', existingOption.restriction_id)
        .execute()
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

    for (const grant of json_data.grants?.feats ?? []) {
      await upsertFeatGrant(trx, grant as Parameters<typeof upsertFeatGrant>[1])
    }

    for (const grant of json_data.grants?.modifiers ?? []) {
      await upsertModifierGrant(trx, grant as Parameters<typeof upsertModifierGrant>[1], systemId)
    }

    for (const grant of json_data.grants?.proficiencies ?? []) {
      await upsertProficiencyGrant(trx, grant as Parameters<typeof upsertProficiencyGrant>[1])
    }

    for (const grant of json_data.grants?.senses ?? []) {
      await upsertSenseGrant(trx, grant as Parameters<typeof upsertSenseGrant>[1])
    }

    for (const grant of json_data.grants?.spells ?? []) {
      await upsertSpellGrant(trx, grant as Parameters<typeof upsertSpellGrant>[1])
    }

    await trx
      .insertInto('options')
      .values(mapOptionRow(json_data))
      .onConflict((oc) => oc.column('id').doUpdateSet(({ ref }) => ({
        label: ref('excluded.label'),
        description: ref('excluded.description'),
        detail: ref('excluded.detail'),
        sort_order: ref('excluded.sort_order'),
        charge_id: ref('excluded.charge_id'),
        restriction_id: ref('excluded.restriction_id')
      })))
      .execute()

    await trx.deleteFrom('option_attributes').where('option_id', '=', json_data.id)
      .execute()
    await trx.deleteFrom('option_feat_grants').where('option_id', '=', json_data.id)
      .execute()
    await trx.deleteFrom('option_modifier_grants').where('option_id', '=', json_data.id)
      .execute()
    await trx.deleteFrom('option_proficiency_grants').where('option_id', '=', json_data.id)
      .execute()
    await trx.deleteFrom('option_sense_grants').where('option_id', '=', json_data.id)
      .execute()
    await trx.deleteFrom('option_spell_grants').where('option_id', '=', json_data.id)
      .execute()

    for (const previousEffect of previousEffectRows) {
      if (!nextEffectIds.has(previousEffect.effect_id)) {
        await trx
          .deleteFrom('option_effects')
          .where('option_id', '=', json_data.id)
          .where('effect_id', '=', previousEffect.effect_id)
          .execute()
        await deleteEffectById(trx, previousEffect.effect_id)
      }
    }

    if (effectRows.length > 0) {
      await trx
        .insertInto('option_effects')
        .values(effectRows)
        .onConflict((oc) => oc.columns(['option_id', 'effect_id']).doUpdateSet(({ ref }) => ({
          sort_order: ref('excluded.sort_order')
        })))
        .execute()
    }

    if (attributeRows.length > 0) {
      await trx.insertInto('option_attributes').values(attributeRows)
        .execute()
    }

    if (featGrantRows.length > 0) {
      await trx.insertInto('option_feat_grants').values(featGrantRows)
        .execute()
    }

    if (modifierGrantRows.length > 0) {
      await trx.insertInto('option_modifier_grants').values(modifierGrantRows)
        .execute()
    }

    if (proficiencyGrantRows.length > 0) {
      await trx.insertInto('option_proficiency_grants').values(proficiencyGrantRows)
        .execute()
    }

    if (senseGrantRows.length > 0) {
      await trx.insertInto('option_sense_grants').values(senseGrantRows)
        .execute()
    }

    if (spellGrantRows.length > 0) {
      await trx.insertInto('option_spell_grants').values(spellGrantRows)
        .execute()
    }

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
