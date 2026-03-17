import type { DBLike } from '#types'
import type { Json } from '../../../types/supabase.database.js'
import {
  CREATURE_CATEGORY_CODE,
  SIZE_CODE,
  type CreatureAuthored,
} from '@artificer-toolkit/shared'
import { upsertDetail } from '../../shared/upserts/index.js'
import { upsertFeature } from '../../features/upserts/index.js'

// ─── Row types ────────────────────────────────────────────────────────────────

type CreatureRow = {
  id: string
  system_id: string
  user_id: string
  label: string
  quote: string | null
  description: string | null
  category: string
  creature_type_id: string | null
  size_code: string
  alignment_id: string | null
  tags: string[] | null
  ability_scores: Json
  armor_class: number
  armor_class_note: string | null
  hit_points: number
  hit_dice: string | null
  senses: string[] | null
  passive_perception: number | null
  saving_throw_proficiencies: string[] | null
  skill_proficiencies: string[] | null
  languages: string[] | null
  challenge_rating_id: string | null
  xp: number | null
  legendary_profile: Json | null
  lair_profile: Json | null
  mount_profile: Json | null
  companion_profile: Json | null
  npc_profile: Json | null
  is_master: boolean | null
}

type CreatureDetailRow = {
  creature_id: string
  detail_id: string
  sort_order: number
}

type CreatureSpeedRow = {
  creature_id: string
  speed_id: string
  amount: number
  unit_code: string
}

type CreatureActionRow = {
  id: string
  creature_id: string
  action_type: string
  sort_order: number
  label: string
  description: string
  attack_bonus: number | null
  damage: string | null
  recharge: string | null
}

type CreatureDamageRow = {
  creature_id: string
  damage_type_id: string
}

type CreatureConditionRow = {
  creature_id: string
  condition_type_id: string
}

// ─── Validators ───────────────────────────────────────────────────────────────

function requireCreatureCategory(
  creatureId: string,
  value: string
): CreatureAuthored['category'] {
  const valid = Object.values(CREATURE_CATEGORY_CODE) as string[]
  if (!valid.includes(value)) {
    throw new Error(`Creature "${creatureId}" has invalid category "${value}".`)
  }
  return value as CreatureAuthored['category']
}

function requireSizeCode(creatureId: string, value: string): string {
  if (!(value in SIZE_CODE)) {
    throw new Error(`Creature "${creatureId}" has invalid size "${value}".`)
  }
  return value
}

// ─── Main upsert ──────────────────────────────────────────────────────────────

export async function upsertCreature(
  db: DBLike,
  json_data: CreatureAuthored,
  _systemId: string
) {
  const category = requireCreatureCategory(json_data.id, json_data.category)
  const size_code = requireSizeCode(json_data.id, json_data.size)

  const creatureRow: CreatureRow = {
    id: json_data.id,
    system_id: json_data.systemId,
    user_id: json_data.userId,
    label: json_data.label,
    quote: json_data.quote ?? null,
    description: json_data.description ?? null,
    category,
    creature_type_id: json_data.creatureTypeId ?? null,
    size_code,
    alignment_id: json_data.alignmentId ?? null,
    tags: json_data.tags ?? null,
    ability_scores: json_data.abilityScores as unknown as Json,
    armor_class: json_data.armorClass,
    armor_class_note: json_data.armorClassNote ?? null,
    hit_points: json_data.hitPoints,
    hit_dice: json_data.hitDice ?? null,
    senses: json_data.senses ?? null,
    passive_perception: json_data.passivePerception ?? null,
    saving_throw_proficiencies: json_data.savingThrowProficiencies ?? null,
    skill_proficiencies: json_data.skillProficiencies ?? null,
    languages: json_data.languages ?? null,
    challenge_rating_id: json_data.challengeRatingId ?? null,
    xp: json_data.xp ?? null,
    legendary_profile: json_data.legendaryProfile
      ? (json_data.legendaryProfile as unknown as Json)
      : null,
    lair_profile: json_data.lairProfile
      ? (json_data.lairProfile as unknown as Json)
      : null,
    mount_profile: json_data.mountProfile
      ? (json_data.mountProfile as unknown as Json)
      : null,
    companion_profile: json_data.companionProfile
      ? (json_data.companionProfile as unknown as Json)
      : null,
    npc_profile: json_data.npcProfile
      ? (json_data.npcProfile as unknown as Json)
      : null,
    is_master: null,
  }

  const detailRows: CreatureDetailRow[] = (json_data.details ?? []).map((detail) => ({
    creature_id: json_data.id,
    detail_id: detail.id,
    sort_order: detail.order,
  }))

  const speedRows: CreatureSpeedRow[] = (json_data.speeds ?? []).map((speed) => ({
    creature_id: json_data.id,
    speed_id: speed.speedId,
    amount: speed.amount,
    unit_code: speed.unit,
  }))

  const buildActionRows = (
    actions: CreatureAuthored['actions'],
    actionType: string
  ): CreatureActionRow[] =>
    (actions ?? []).map((action, i) => ({
      id: action.id,
      creature_id: json_data.id,
      action_type: actionType,
      sort_order: i,
      label: action.label,
      description: action.description,
      attack_bonus: action.attackBonus ?? null,
      damage: action.damage ?? null,
      recharge: action.recharge ?? null,
    }))

  const actionRows: CreatureActionRow[] = [
    ...buildActionRows(json_data.actions, 'ACTION'),
    ...buildActionRows(json_data.bonusActions, 'BONUS_ACTION'),
    ...buildActionRows(json_data.reactions, 'REACTION'),
  ]

  const resistanceRows: CreatureDamageRow[] = (json_data.damageResistances ?? []).map((id) => ({
    creature_id: json_data.id,
    damage_type_id: id,
  }))

  const immunityRows: CreatureDamageRow[] = (json_data.damageImmunities ?? []).map((id) => ({
    creature_id: json_data.id,
    damage_type_id: id,
  }))

  const vulnerabilityRows: CreatureDamageRow[] = (json_data.damageVulnerabilities ?? []).map((id) => ({
    creature_id: json_data.id,
    damage_type_id: id,
  }))

  const conditionImmunityRows: CreatureConditionRow[] = (json_data.conditionImmunities ?? []).map((id) => ({
    creature_id: json_data.id,
    condition_type_id: id,
  }))

  const featureRows = (json_data.features ?? []).map((feature) => ({
    creature_id: json_data.id,
    feature_id: feature.id,
    sort_order: feature.order,
  }))

  const trx = await db.startTransaction().execute()

  try {
    // Upsert owned shared records first (FK dependencies)
    for (const detail of json_data.details ?? []) {
      await upsertDetail(trx, detail)
    }
    for (const feature of json_data.features ?? []) {
      await upsertFeature(trx, feature, json_data.systemId)
    }

    // Upsert root creature row
    await trx
      .insertInto('creatures')
      .values(creatureRow)
      .onConflict((oc) => oc.column('id').doUpdateSet(({ ref }) => ({
        system_id: ref('excluded.system_id'),
        user_id: ref('excluded.user_id'),
        label: ref('excluded.label'),
        quote: ref('excluded.quote'),
        description: ref('excluded.description'),
        category: ref('excluded.category'),
        creature_type_id: ref('excluded.creature_type_id'),
        size_code: ref('excluded.size_code'),
        alignment_id: ref('excluded.alignment_id'),
        tags: ref('excluded.tags'),
        ability_scores: ref('excluded.ability_scores'),
        armor_class: ref('excluded.armor_class'),
        armor_class_note: ref('excluded.armor_class_note'),
        hit_points: ref('excluded.hit_points'),
        hit_dice: ref('excluded.hit_dice'),
        senses: ref('excluded.senses'),
        passive_perception: ref('excluded.passive_perception'),
        saving_throw_proficiencies: ref('excluded.saving_throw_proficiencies'),
        skill_proficiencies: ref('excluded.skill_proficiencies'),
        languages: ref('excluded.languages'),
        challenge_rating_id: ref('excluded.challenge_rating_id'),
        xp: ref('excluded.xp'),
        legendary_profile: ref('excluded.legendary_profile'),
        lair_profile: ref('excluded.lair_profile'),
        mount_profile: ref('excluded.mount_profile'),
        companion_profile: ref('excluded.companion_profile'),
        npc_profile: ref('excluded.npc_profile'),
      })))
      .execute()

    // Delete and re-insert all bridge records
    await trx.deleteFrom('creature_details').where('creature_id', '=', json_data.id).execute()
    await trx.deleteFrom('creature_features').where('creature_id', '=', json_data.id).execute()
    await trx.deleteFrom('creature_speeds').where('creature_id', '=', json_data.id).execute()
    await trx.deleteFrom('creature_actions').where('creature_id', '=', json_data.id).execute()
    await trx.deleteFrom('creature_damage_resistances').where('creature_id', '=', json_data.id).execute()
    await trx.deleteFrom('creature_damage_immunities').where('creature_id', '=', json_data.id).execute()
    await trx.deleteFrom('creature_damage_vulnerabilities').where('creature_id', '=', json_data.id).execute()
    await trx.deleteFrom('creature_condition_immunities').where('creature_id', '=', json_data.id).execute()

    if (detailRows.length > 0) {
      await trx.insertInto('creature_details').values(detailRows).execute()
    }
    if (featureRows.length > 0) {
      await trx.insertInto('creature_features').values(featureRows).execute()
    }
    if (speedRows.length > 0) {
      await trx.insertInto('creature_speeds').values(speedRows).execute()
    }
    if (actionRows.length > 0) {
      await trx.insertInto('creature_actions').values(actionRows).execute()
    }
    if (resistanceRows.length > 0) {
      await trx.insertInto('creature_damage_resistances').values(resistanceRows).execute()
    }
    if (immunityRows.length > 0) {
      await trx.insertInto('creature_damage_immunities').values(immunityRows).execute()
    }
    if (vulnerabilityRows.length > 0) {
      await trx.insertInto('creature_damage_vulnerabilities').values(vulnerabilityRows).execute()
    }
    if (conditionImmunityRows.length > 0) {
      await trx.insertInto('creature_condition_immunities').values(conditionImmunityRows).execute()
    }

    await trx.commit().execute()
  } catch (error) {
    await trx.rollback().execute()
    throw error
  }
}
