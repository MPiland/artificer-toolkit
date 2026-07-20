import type { DBLike } from '#types'
import { withTransaction } from '../../../utils/index.js'
import type { Json } from '../../../types/supabase.database.js'
import {
  CREATURE_CATEGORY_CODE,
  MEASUREMENT_UNIT_CODE,
  SIZE_CODE,
  type CreatureAuthored,
} from '@artificer-toolkit/shared'
import { upsertDetail } from '../../shared/upserts/index.js'
import { upsertFeature } from '../../features/upserts/index.js'
import { upsertProficiencyGrant } from '../../grants/upserts/index.js'
import { normalizeSubjectStatus } from '../status.js'

type CreatureRow = {
  id: string
  system_id: string
  user_id: string
  label: string
  quote: string | null
  description: string | null
  status: CreatureAuthored['status']
  category: string
  creature_type_id: string | null
  size_code: string | null
  alignment_id: string | null
  tags: string[] | null
  ability_scores: Json | null
  armor_class: number | null
  armor_class_note: string | null
  hit_points: number | null
  hit_dice: string | null
  senses: string[] | null
  passive_perception: number | null
  challenge_rating_id: string | null
  xp: number | null
  mount_profile: Json | null
  companion_profile: Json | null
  npc_profile: Json | null
  cost: Json | null
  carrying_capacity_amount: number | null
  carrying_capacity_unit: string | null
  logistics_notes: string[] | null
  is_master: boolean | null
}

type CreatureDetailRow = {
  creature_id: string
  detail_id: string
  sort_order: number
}

type CreatureProficiencyGrantRow = {
  creature_id: string
  proficiency_grant_id: string
  sort_order: number
}

type CreatureSpeedRow = {
  creature_id: string
  speed_id: string
  amount: number
  unit_code: string
  sort_order: number
}

type CreatureDamageRow = {
  creature_id: string
  damage_type_id: string
  sort_order: number
}

type CreatureConditionRow = {
  creature_id: string
  condition_type_id: string
}

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

function requireSizeCode(creatureId: string, value?: string | null): string | null {
  if (value == null) {
    return null
  }
  if (!(value in SIZE_CODE)) {
    throw new Error(`Creature "${creatureId}" has invalid size "${value}".`)
  }
  return value
}

function requireMeasurementUnit(
  creatureId: string,
  value?: string | null
): string | null {
  if (value == null) {
    return null
  }
  if (!(value in MEASUREMENT_UNIT_CODE)) {
    throw new Error(`Creature "${creatureId}" has invalid measurement unit "${value}".`)
  }
  return value
}

function buildBaseRow(jsonData: CreatureAuthored): CreatureRow {
  return {
    id: jsonData.id,
    system_id: jsonData.systemId,
    user_id: jsonData.userId,
    label: jsonData.label,
    quote: jsonData.quote ?? null,
    description: jsonData.description ?? null,
    status: normalizeSubjectStatus(jsonData.status),
    category: requireCreatureCategory(jsonData.id, jsonData.category),
    creature_type_id: jsonData.creatureTypeId ?? null,
    size_code: requireSizeCode(jsonData.id, jsonData.size ?? null),
    alignment_id: jsonData.alignmentId ?? null,
    tags: jsonData.tags ?? null,
    ability_scores: jsonData.abilityScores as unknown as Json,
    armor_class: jsonData.armorClass,
    armor_class_note: jsonData.armorClassNote ?? null,
    hit_points: jsonData.hitPoints,
    hit_dice: jsonData.hitDice ?? null,
    senses: jsonData.senses ?? null,
    passive_perception: jsonData.passivePerception ?? null,
    challenge_rating_id: jsonData.challengeRatingId ?? null,
    xp: jsonData.xp ?? null,
    mount_profile: jsonData.mountProfile
      ? jsonData.mountProfile as unknown as Json
      : null,
    companion_profile: jsonData.companionProfile
      ? jsonData.companionProfile as unknown as Json
      : null,
    npc_profile: jsonData.npcProfile
      ? jsonData.npcProfile as unknown as Json
      : null,
    cost: jsonData.cost ? jsonData.cost as unknown as Json : null,
    carrying_capacity_amount: jsonData.carryingCapacity?.amount ?? null,
    carrying_capacity_unit: requireMeasurementUnit(jsonData.id, jsonData.carryingCapacity?.unit ?? null),
    logistics_notes: jsonData.logisticsNotes ?? null,
    is_master: null,
  }
}

function buildCreatureRow(jsonData: CreatureAuthored): CreatureRow {
  return buildBaseRow(jsonData)
}

function buildCreatureUpdateRow(row: CreatureRow): Omit<CreatureRow, 'is_master'> {
  return {
    id: row.id,
    system_id: row.system_id,
    user_id: row.user_id,
    label: row.label,
    quote: row.quote,
    description: row.description,
    status: row.status,
    category: row.category,
    creature_type_id: row.creature_type_id,
    size_code: row.size_code,
    alignment_id: row.alignment_id,
    tags: row.tags,
    ability_scores: row.ability_scores,
    armor_class: row.armor_class,
    armor_class_note: row.armor_class_note,
    hit_points: row.hit_points,
    hit_dice: row.hit_dice,
    senses: row.senses,
    passive_perception: row.passive_perception,
    challenge_rating_id: row.challenge_rating_id,
    xp: row.xp,
    mount_profile: row.mount_profile,
    companion_profile: row.companion_profile,
    npc_profile: row.npc_profile,
    cost: row.cost,
    carrying_capacity_amount: row.carrying_capacity_amount,
    carrying_capacity_unit: row.carrying_capacity_unit,
    logistics_notes: row.logistics_notes,
  }
}

export async function upsertCreature(
  db: DBLike,
  jsonData: CreatureAuthored,
  _systemId: string
) {
  const creatureRow = buildCreatureRow(jsonData)

  const detailRows: CreatureDetailRow[] = (jsonData.details ?? []).map((detail) => ({
    creature_id: jsonData.id,
    detail_id: detail.id,
    sort_order: detail.order,
  }))

  const proficiencyRows: CreatureProficiencyGrantRow[] = (jsonData.proficiencies ?? []).map((grant) => ({
    creature_id: jsonData.id,
    proficiency_grant_id: grant.id,
    sort_order: grant.order,
  }))

  const speedRows: CreatureSpeedRow[] = (jsonData.speeds ?? []).map((speed, index) => ({
    creature_id: jsonData.id,
    speed_id: speed.speedId,
    amount: speed.amount,
    unit_code: speed.unit,
    sort_order: index + 1,
  }))

  const resistanceRows: CreatureDamageRow[] = (jsonData.damageResistances ?? []).map((id, index) => ({
    creature_id: jsonData.id,
    damage_type_id: id,
    sort_order: index + 1,
  }))

  const immunityRows: CreatureDamageRow[] = (jsonData.damageImmunities ?? []).map((id, index) => ({
    creature_id: jsonData.id,
    damage_type_id: id,
    sort_order: index + 1,
  }))

  const vulnerabilityRows: CreatureDamageRow[] = (jsonData.damageVulnerabilities ?? []).map((id, index) => ({
    creature_id: jsonData.id,
    damage_type_id: id,
    sort_order: index + 1,
  }))

  const conditionImmunityRows: CreatureConditionRow[] = (jsonData.conditionImmunities ?? []).map((id) => ({
    creature_id: jsonData.id,
    condition_type_id: id,
  }))

  const featureRows = (jsonData.features ?? []).map((feature) => ({
    creature_id: jsonData.id,
    feature_id: feature.id,
    sort_order: feature.order,
  }))

  return withTransaction(db, async (trx) => {
    await trx
      .insertInto('creatures')
      .values(creatureRow)
      .onConflict((oc) => oc.column('id').doUpdateSet(buildCreatureUpdateRow(creatureRow)))
      .execute()

    await trx.deleteFrom('creature_details').where('creature_id', '=', jsonData.id).execute()
    await trx.deleteFrom('creature_proficiency_grants').where('creature_id', '=', jsonData.id).execute()
    await trx.deleteFrom('creature_features').where('creature_id', '=', jsonData.id).execute()
    await trx.deleteFrom('creature_speeds').where('creature_id', '=', jsonData.id).execute()
    await trx.deleteFrom('creature_damage_resistances').where('creature_id', '=', jsonData.id).execute()
    await trx.deleteFrom('creature_damage_immunities').where('creature_id', '=', jsonData.id).execute()
    await trx.deleteFrom('creature_damage_vulnerabilities').where('creature_id', '=', jsonData.id).execute()
    await trx.deleteFrom('creature_condition_immunities').where('creature_id', '=', jsonData.id).execute()

    for (const detail of jsonData.details ?? []) {
      await upsertDetail(trx, detail)
    }
    for (const feature of jsonData.features ?? []) {
      await upsertFeature(trx, feature, jsonData.systemId)
    }
    for (const proficiency of jsonData.proficiencies ?? []) {
      await upsertProficiencyGrant(trx, proficiency)
    }

    if (detailRows.length > 0) {
      await trx.insertInto('creature_details').values(detailRows).execute()
    }
    if (proficiencyRows.length > 0) {
      await trx.insertInto('creature_proficiency_grants').values(proficiencyRows).execute()
    }
    if (featureRows.length > 0) {
      await trx.insertInto('creature_features').values(featureRows).execute()
    }
    if (speedRows.length > 0) {
      await trx.insertInto('creature_speeds').values(speedRows).execute()
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

  })
}
