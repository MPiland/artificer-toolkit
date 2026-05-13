import type { DBLike } from '#types'
import type { FeatAuthored } from '@artificer-toolkit/shared'
import { upsertCharge } from '../../shared/upserts/index.js'
import { upsertFacet } from '../../shared/facets.js'
import {
  upsertModifierGrant,
  upsertProficiencyGrant,
  upsertSenseGrant,
  upsertSpellGrant
} from '../../grants/upserts/index.js'
import { deleteEffectById, upsertEffect } from '../../effects/upserts/index.js'
import { upsertFeature } from '../../features/upserts/index.js'
import { normalizeSubjectStatus } from '../status.js'

type FeatRow = {
  id: string
  system_id: string
  user_id: string
  label: string
  description: string
  detail: string | null
  status: FeatAuthored['status']
  prerequisite_id: string | null
  charge_id: string | null
}

type FeatProficiencyGrantRow = {
  feat_id: string
  proficiency_grant_id: string
  sort_order: number
}

type FeatSenseGrantRow = {
  feat_id: string
  sense_grant_id: string
  sort_order: number
}

type FeatSpellGrantRow = {
  feat_id: string
  spell_grant_id: string
  sort_order: number
}

type FeatModifierGrantRow = {
  feat_id: string
  modifier_grant_id: string
  sort_order: number
}

function mapFeatRow(json_data: FeatAuthored): FeatRow {
  return {
    id: json_data.id,
    system_id: json_data.systemId,
    user_id: json_data.userId,
    label: json_data.label,
    description: json_data.description,
    detail: json_data.detail ?? null,
    status: normalizeSubjectStatus(json_data.status),
    prerequisite_id: json_data.prerequisites?.id ?? null,
    charge_id: json_data.charges?.id ?? null
  }
}

export async function upsertFeat(
  db: DBLike,
  json_data: FeatAuthored,
  _systemId: string
) {
  const authoredEffects = json_data.effects ?? []
  const effectRows = authoredEffects.map((effect, index) => ({
    feat_id: json_data.id,
    effect_id: effect.id,
    sort_order: index + 1
  }))
  const nextEffectIds = new Set(authoredEffects.map((effect) => effect.id))

  const trx = await db.startTransaction().execute()

  try {
    const previousEffectRows = await trx
      .selectFrom('feat_effects')
      .select(['effect_id'])
      .where('feat_id', '=', json_data.id)
      .execute()

    if (json_data.charges) {
      await upsertCharge(trx, json_data.charges)
    }

    if (json_data.prerequisites) {
      await upsertFacet(trx, json_data.prerequisites)
    }

    await trx
      .insertInto('feats')
      .values(mapFeatRow(json_data))
      .onConflict((oc) => oc.column('id').doUpdateSet(({ ref }) => ({
        system_id: ref('excluded.system_id'),
        user_id: ref('excluded.user_id'),
        label: ref('excluded.label'),
        description: ref('excluded.description'),
        detail: ref('excluded.detail'),
        status: ref('excluded.status'),
        prerequisite_id: ref('excluded.prerequisite_id'),
        charge_id: ref('excluded.charge_id')
      })))
      .execute()

    await trx
      .deleteFrom('feat_features')
      .where('feat_id', '=', json_data.id)
      .execute()

    await trx
      .deleteFrom('feat_modifier_grants')
      .where('feat_id', '=', json_data.id)
      .execute()

    await trx
      .deleteFrom('feat_proficiency_grants')
      .where('feat_id', '=', json_data.id)
      .execute()

    await trx
      .deleteFrom('feat_sense_grants')
      .where('feat_id', '=', json_data.id)
      .execute()

    await trx
      .deleteFrom('feat_spell_grants')
      .where('feat_id', '=', json_data.id)
      .execute()

    for (const previousEffect of previousEffectRows) {
      if (!nextEffectIds.has(previousEffect.effect_id)) {
        await trx
          .deleteFrom('feat_effects')
          .where('feat_id', '=', json_data.id)
          .where('effect_id', '=', previousEffect.effect_id)
          .execute()
        await deleteEffectById(trx, previousEffect.effect_id)
      }
    }

    for (const effect of authoredEffects) {
      await upsertEffect(trx, effect)
    }

    if (json_data.features) {
      for (const feature of json_data.features) {
        await upsertFeature(trx, feature, json_data.systemId)
      }
    }

    if (json_data.grants?.modifiers) {
      for (const modifierGrant of json_data.grants.modifiers) {
        await upsertModifierGrant(trx, modifierGrant, json_data.systemId)
      }
    }

    if (json_data.grants?.proficiencies) {
      for (const proficiencyGrant of json_data.grants.proficiencies) {
        await upsertProficiencyGrant(trx, proficiencyGrant)
      }
    }

    if (json_data.grants?.senses) {
      for (const senseGrant of json_data.grants.senses) {
        await upsertSenseGrant(trx, senseGrant)
      }
    }

    if (json_data.grants?.spells) {
      for (const spellGrant of json_data.grants.spells) {
        await upsertSpellGrant(trx, spellGrant)
      }
    }

    if (effectRows.length > 0) {
      await trx
        .insertInto('feat_effects')
        .values(effectRows)
        .onConflict((oc) => oc.columns(['feat_id', 'effect_id']).doUpdateSet(({ ref }) => ({
          sort_order: ref('excluded.sort_order')
        })))
        .execute()
    }

    const proficiencyRows: FeatProficiencyGrantRow[] = (json_data.grants?.proficiencies ?? []).map((grant) => ({
      feat_id: json_data.id,
      proficiency_grant_id: grant.id,
      sort_order: grant.order
    }))

    if (proficiencyRows.length > 0) {
      await trx
        .insertInto('feat_proficiency_grants')
        .values(proficiencyRows)
        .execute()
    }

    const senseRows: FeatSenseGrantRow[] = (json_data.grants?.senses ?? []).map((grant) => ({
      feat_id: json_data.id,
      sense_grant_id: grant.id,
      sort_order: grant.order
    }))

    if (senseRows.length > 0) {
      await trx
        .insertInto('feat_sense_grants')
        .values(senseRows)
        .execute()
    }

    const spellRows: FeatSpellGrantRow[] = (json_data.grants?.spells ?? []).map((grant) => ({
      feat_id: json_data.id,
      spell_grant_id: grant.id,
      sort_order: grant.order
    }))

    if (spellRows.length > 0) {
      await trx
        .insertInto('feat_spell_grants')
        .values(spellRows)
        .execute()
    }

    const modifierRows: FeatModifierGrantRow[] = (json_data.grants?.modifiers ?? []).map((grant) => ({
      feat_id: json_data.id,
      modifier_grant_id: grant.id,
      sort_order: grant.order
    }))

    if (modifierRows.length > 0) {
      await trx
        .insertInto('feat_modifier_grants')
        .values(modifierRows)
        .execute()
    }

    const featureRows = (json_data.features ?? []).map((feature) => ({
      feat_id: json_data.id,
      feature_id: feature.id,
      sort_order: feature.order
    }))

    if (featureRows.length > 0) {
      await trx
        .insertInto('feat_features')
        .values(featureRows)
        .execute()
    }

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}


