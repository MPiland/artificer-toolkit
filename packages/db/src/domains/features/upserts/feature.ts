import type { DBLike } from '@db-types'
import {
  FEATURE_ATTRIBUTE,
  type NodeSubjectCode,
  type FeatureAuthored
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
import { upsertOption } from './option.js'

type FeatureRow = {
  id: string
  label: string
  description: string
  detail: string | null
  charge_id: string | null
  restriction_id: string | null
  sort_order: number
  available_at_level: number | null
}

type FeatureAttributeRow = {
  feature_id: string
  attribute_code: string
  sort_order: number
}

type FeatureFeatGrantRow = {
  feature_id: string
  feat_grant_id: string
  sort_order: number
}

type FeatureModifierGrantRow = {
  feature_id: string
  modifier_grant_id: string
  sort_order: number
}

type FeatureProficiencyGrantRow = {
  feature_id: string
  proficiency_grant_id: string
  sort_order: number
}

type FeatureSenseGrantRow = {
  feature_id: string
  sense_grant_id: string
  sort_order: number
}

type FeatureSpellGrantRow = {
  feature_id: string
  spell_grant_id: string
  sort_order: number
}

type FeatureOptionRow = {
  feature_id: string
  option_id: string
  sort_order: number
}

type FeatureOptionLevelRow = {
  feature_id: string
  level: number
  count: number
  replace_count: number | null
  sort_order: number
}

function requireFeatureAttribute(
  featureId: string,
  value: string
): NonNullable<FeatureAuthored['attributes']>[number] {
  if (!(value in FEATURE_ATTRIBUTE)) {
    throw new Error(`Feature "${featureId}" has invalid attribute "${value}".`)
  }

  return value as NonNullable<FeatureAuthored['attributes']>[number]
}

function mapFeatureRow<N extends NodeSubjectCode>(json_data: FeatureAuthored<N>): FeatureRow {
  return {
    id: json_data.id,
    label: json_data.label,
    description: json_data.description,
    detail: json_data.detail ?? null,
    charge_id: json_data.charges?.id ?? null,
    restriction_id: json_data.restrictions?.id ?? null,
    sort_order: json_data.order,
    available_at_level: json_data.availableAtLevel ?? null
  }
}

export async function upsertFeature<N extends NodeSubjectCode>(
  db: DBLike,
  json_data: FeatureAuthored<N>,
  systemId?: string
): Promise<void> {
  const attributeRows: FeatureAttributeRow[] = (json_data.attributes ?? []).map((attribute, index) => ({
    feature_id: json_data.id,
    attribute_code: requireFeatureAttribute(json_data.id, attribute),
    sort_order: index + 1
  }))
  const effectRows = (json_data.effects ?? []).map((effect, index) => ({
    feature_id: json_data.id,
    effect_id: effect.id,
    sort_order: index + 1
  }))
  const featGrantRows: FeatureFeatGrantRow[] = (json_data.grants?.feats ?? []).map((grant) => ({
    feature_id: json_data.id,
    feat_grant_id: grant.id,
    sort_order: grant.order
  }))
  const modifierGrantRows: FeatureModifierGrantRow[] = (json_data.grants?.modifiers ?? []).map((grant) => ({
    feature_id: json_data.id,
    modifier_grant_id: grant.id,
    sort_order: grant.order
  }))
  const proficiencyGrantRows: FeatureProficiencyGrantRow[] = (json_data.grants?.proficiencies ?? []).map((grant) => ({
    feature_id: json_data.id,
    proficiency_grant_id: grant.id,
    sort_order: grant.order
  }))
  const senseGrantRows: FeatureSenseGrantRow[] = (json_data.grants?.senses ?? []).map((grant) => ({
    feature_id: json_data.id,
    sense_grant_id: grant.id,
    sort_order: grant.order
  }))
  const spellGrantRows: FeatureSpellGrantRow[] = (json_data.grants?.spells ?? []).map((grant) => ({
    feature_id: json_data.id,
    spell_grant_id: grant.id,
    sort_order: grant.order
  }))
  const optionRows: FeatureOptionRow[] = (json_data.options ?? []).map((option) => ({
    feature_id: json_data.id,
    option_id: option.id,
    sort_order: option.order
  }))
  const optionLevelRows: FeatureOptionLevelRow[] = (json_data.optionChoices ?? []).map((choice, index) => ({
    feature_id: json_data.id,
    level: choice.level,
    count: choice.count,
    replace_count: choice.replaceCount ?? null,
    sort_order: index + 1
  }))
  const nextEffectIds = new Set((json_data.effects ?? []).map((effect) => effect.id))

  const trx = await db.startTransaction().execute()

  try {
    const existingFeature = await trx
      .selectFrom('features')
      .select(['restriction_id'])
      .where('id', '=', json_data.id)
      .executeTakeFirst()
    const previousEffectRows = await trx
      .selectFrom('feature_effects')
      .select(['effect_id'])
      .where('feature_id', '=', json_data.id)
      .execute()

    if (existingFeature?.restriction_id && existingFeature.restriction_id !== json_data.restrictions?.id) {
      await trx.deleteFrom('facets').where('id', '=', existingFeature.restriction_id).execute()
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

    for (const option of json_data.options ?? []) {
      await upsertOption(trx, option as unknown as Parameters<typeof upsertOption>[1], systemId)
    }

    await trx
      .insertInto('features')
      .values(mapFeatureRow(json_data))
      .onConflict((oc) => oc.column('id').doUpdateSet(({ ref }) => ({
        label: ref('excluded.label'),
        description: ref('excluded.description'),
        detail: ref('excluded.detail'),
        charge_id: ref('excluded.charge_id'),
        restriction_id: ref('excluded.restriction_id'),
        sort_order: ref('excluded.sort_order'),
        available_at_level: ref('excluded.available_at_level')
      })))
      .execute()

    await trx.deleteFrom('feature_attributes').where('feature_id', '=', json_data.id).execute()
    await trx.deleteFrom('feature_feat_grants').where('feature_id', '=', json_data.id).execute()
    await trx.deleteFrom('feature_modifier_grants').where('feature_id', '=', json_data.id).execute()
    await trx.deleteFrom('feature_proficiency_grants').where('feature_id', '=', json_data.id).execute()
    await trx.deleteFrom('feature_sense_grants').where('feature_id', '=', json_data.id).execute()
    await trx.deleteFrom('feature_spell_grants').where('feature_id', '=', json_data.id).execute()
    await trx.deleteFrom('feature_options').where('feature_id', '=', json_data.id).execute()
    await trx.deleteFrom('feature_option_levels').where('feature_id', '=', json_data.id).execute()

    for (const previousEffect of previousEffectRows) {
      if (!nextEffectIds.has(previousEffect.effect_id)) {
        await trx
          .deleteFrom('feature_effects')
          .where('feature_id', '=', json_data.id)
          .where('effect_id', '=', previousEffect.effect_id)
          .execute()
        await deleteEffectById(trx, previousEffect.effect_id)
      }
    }

    if (effectRows.length > 0) {
      await trx
        .insertInto('feature_effects')
        .values(effectRows)
        .onConflict((oc) => oc.columns(['feature_id', 'effect_id']).doUpdateSet(({ ref }) => ({
          sort_order: ref('excluded.sort_order')
        })))
        .execute()
    }

    if (attributeRows.length > 0) {
      await trx.insertInto('feature_attributes').values(attributeRows).execute()
    }

    if (featGrantRows.length > 0) {
      await trx.insertInto('feature_feat_grants').values(featGrantRows).execute()
    }

    if (modifierGrantRows.length > 0) {
      await trx.insertInto('feature_modifier_grants').values(modifierGrantRows).execute()
    }

    if (proficiencyGrantRows.length > 0) {
      await trx.insertInto('feature_proficiency_grants').values(proficiencyGrantRows).execute()
    }

    if (senseGrantRows.length > 0) {
      await trx.insertInto('feature_sense_grants').values(senseGrantRows).execute()
    }

    if (spellGrantRows.length > 0) {
      await trx.insertInto('feature_spell_grants').values(spellGrantRows).execute()
    }

    if (optionRows.length > 0) {
      await trx.insertInto('feature_options').values(optionRows).execute()
    }

    if (optionLevelRows.length > 0) {
      await trx.insertInto('feature_option_levels').values(optionLevelRows).execute()
    }

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
