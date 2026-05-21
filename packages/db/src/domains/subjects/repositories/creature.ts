import {
  MEASUREMENT_UNIT_CODE,
  SIZE_CODE,
  type CreatureAuthored,
  type CreatureCompanionProfile,
  type CreatureLairProfile,
  type CreatureLegendaryProfile,
  type CreatureMountProfile,
  type CreatureNpcProfile,
} from '@artificer-toolkit/shared'
import type { DBLike } from '#types'
import { upsertCreature } from '../upserts/creature.js'
import { createDetailRepository } from '../../shared/repositories/detail.js'
import { createFeatureRepository } from '../../features/repositories/feature.js'
import { createProficiencyGrantRepository } from '../../grants/repositories/proficiency.js'
import type { CreatureRepository, RepositoryFindAllOptions } from '../../../repositories/contracts.js'
import { hydrateByIds, orderedHydratedRecords } from '../../../repositories/batch.js'
import { hydrateSubjectStatus } from '../status.js'

function requireLinkedRecord<T>(value: T | null, message: string): T {
  if (value === null) throw new Error(message)
  return value
}

function requireSizeCode(creatureId: string, value?: string | null): CreatureAuthored['size'] | undefined {
  if (value == null) {
    return undefined
  }
  if (!(value in SIZE_CODE)) {
    throw new Error(`Creature "${creatureId}" has invalid size_code "${value}".`)
  }
  return value as CreatureAuthored['size']
}

function hydrateAbilityScores(value: unknown): CreatureAuthored['abilityScores'] {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const scores = value as Partial<Record<keyof CreatureAuthored['abilityScores'], number>>

    return {
      STRENGTH: Number(scores.STRENGTH ?? 10),
      DEXTERITY: Number(scores.DEXTERITY ?? 10),
      CONSTITUTION: Number(scores.CONSTITUTION ?? 10),
      INTELLIGENCE: Number(scores.INTELLIGENCE ?? 10),
      WISDOM: Number(scores.WISDOM ?? 10),
      CHARISMA: Number(scores.CHARISMA ?? 10),
      SPELLCASTING: Number(scores.SPELLCASTING ?? 0),
    }
  }

  return {
    STRENGTH: 10,
    DEXTERITY: 10,
    CONSTITUTION: 10,
    INTELLIGENCE: 10,
    WISDOM: 10,
    CHARISMA: 10,
    SPELLCASTING: 0,
  }
}

function requireMeasurementUnit(
  creatureId: string,
  speedId: string,
  value: string
): NonNullable<CreatureAuthored['speeds']>[number]['unit'] {
  if (!(value in MEASUREMENT_UNIT_CODE)) {
    throw new Error(`Creature "${creatureId}" speed "${speedId}" has invalid unit_code "${value}".`)
  }
  return value as NonNullable<CreatureAuthored['speeds']>[number]['unit']
}

async function hydrateCreatureById(
  db: DBLike,
  id: string
): Promise<CreatureAuthored | null> {
  const row = await db
    .selectFrom('creatures')
    .select([
      'id',
      'system_id',
      'user_id',
      'label',
      'quote',
      'description',
      'status',
      'record_kind',
      'category',
      'creature_type_id',
      'size_code',
      'alignment_id',
      'tags',
      'ability_scores',
      'armor_class',
      'armor_class_note',
      'hit_points',
      'hit_dice',
      'senses',
      'passive_perception',
      'challenge_rating_id',
      'xp',
      'legendary_profile',
      'lair_profile',
      'mount_profile',
      'companion_profile',
      'npc_profile',
      'cost',
      'carrying_capacity_amount',
      'carrying_capacity_unit',
      'logistics_notes'
    ])
    .where('id', '=', id)
    .executeTakeFirst()

  if (!row) return null
  if (!row.user_id) {
    throw new Error(`Creature "${id}" is missing user ownership and cannot be hydrated.`)
  }

  const [
    featureLinks,
    detailLinks,
    proficiencyLinks,
    speedRows,
    actionRows,
    resistanceRows,
    immunityRows,
    vulnerabilityRows,
    conditionImmunityRows
  ] = await Promise.all([
    db.selectFrom('creature_features')
      .select(['feature_id', 'sort_order'])
      .where('creature_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('creature_details')
      .select(['detail_id', 'sort_order'])
      .where('creature_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('creature_proficiency_grants')
      .select(['proficiency_grant_id', 'sort_order'])
      .where('creature_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('creature_speeds')
      .select(['speed_id', 'amount', 'unit_code'])
      .where('creature_id', '=', id)
      .execute(),
    db.selectFrom('creature_actions')
      .select([
        'id', 'action_type', 'sort_order', 'label', 'description', 'attack_bonus', 'damage', 'recharge'
      ])
      .where('creature_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('creature_damage_resistances')
      .select(['damage_type_id'])
      .where('creature_id', '=', id)
      .execute(),
    db.selectFrom('creature_damage_immunities')
      .select(['damage_type_id'])
      .where('creature_id', '=', id)
      .execute(),
    db.selectFrom('creature_damage_vulnerabilities')
      .select(['damage_type_id'])
      .where('creature_id', '=', id)
      .execute(),
    db.selectFrom('creature_condition_immunities')
      .select(['condition_type_id'])
      .where('creature_id', '=', id)
      .execute()
  ])

  const detailRepository = createDetailRepository(db)
  const featureRepository = createFeatureRepository(db, row.system_id)
  const proficiencyGrantRepository = createProficiencyGrantRepository(db)

  const [detailsById, featuresById, proficienciesById] = await Promise.all([
    detailRepository.findByIds(detailLinks.map((link) => link.detail_id)),
    featureRepository.findByIds(featureLinks.map((link) => link.feature_id)),
    proficiencyGrantRepository.findByIds(proficiencyLinks.map((link) => link.proficiency_grant_id)),
  ])

  const authoredDetails = detailLinks.map((link) => requireLinkedRecord(detailsById.get(link.detail_id) ?? null, `Creature "${id}" is linked to missing detail "${link.detail_id}".`))
  const authoredFeatures = featureLinks.map((link) => requireLinkedRecord(featuresById.get(link.feature_id) ?? null, `Creature "${id}" is linked to missing feature "${link.feature_id}".`))
  const authoredProficiencies = proficiencyLinks.map((link) => requireLinkedRecord(proficienciesById.get(link.proficiency_grant_id) ?? null, `Creature "${id}" is linked to missing proficiency grant "${link.proficiency_grant_id}".`))

  const authoredSpeeds = speedRows.map((speed) => ({
    speedId: speed.speed_id,
    amount: speed.amount,
    unit: requireMeasurementUnit(id, speed.speed_id, speed.unit_code)
  }))

  const mapAction = (action: typeof actionRows[number]) => ({
    id: action.id,
    label: action.label,
    description: action.description,
    attackBonus: action.attack_bonus ?? undefined,
    damage: action.damage ?? undefined,
    recharge: action.recharge ?? undefined
  })

  const base = {
    id: row.id,
    label: row.label,
    quote: row.quote ?? undefined,
    description: row.description ?? undefined,
    status: hydrateSubjectStatus(row.status),
    details: authoredDetails.length > 0 ? authoredDetails : undefined,
    features: authoredFeatures.length > 0 ? authoredFeatures : undefined,
    proficiencies: authoredProficiencies.length > 0 ? authoredProficiencies : undefined,
    userId: row.user_id,
    systemId: row.system_id,
    recordKind: row.record_kind as NonNullable<CreatureAuthored['recordKind']>,
    category: row.category as CreatureAuthored['category'],
    creatureTypeId: row.creature_type_id ?? '',
    size: requireSizeCode(id, row.size_code) ?? SIZE_CODE.MEDIUM,
    alignmentId: row.alignment_id ?? undefined,
    tags: row.tags ?? undefined,
    speeds: authoredSpeeds,
    mountProfile: row.mount_profile ? (row.mount_profile as unknown as CreatureMountProfile) : undefined,
    companionProfile: row.companion_profile ? (row.companion_profile as unknown as CreatureCompanionProfile) : undefined,
    abilityScores: hydrateAbilityScores(row.ability_scores),
    armorClass: Number(row.armor_class ?? 0),
    armorClassNote: row.armor_class_note ?? undefined,
    hitPoints: Number(row.hit_points ?? 0),
    hitDice: row.hit_dice ?? undefined,
    senses: row.senses ?? undefined,
    passivePerception: row.passive_perception ?? undefined,
    damageVulnerabilities: vulnerabilityRows.map((entry) => entry.damage_type_id),
    damageResistances: resistanceRows.map((entry) => entry.damage_type_id),
    damageImmunities: immunityRows.map((entry) => entry.damage_type_id),
    conditionImmunities: conditionImmunityRows.map((entry) => entry.condition_type_id),
    challengeRatingId: row.challenge_rating_id ?? undefined,
    xp: row.xp ?? undefined,
    actions: actionRows.filter((action) => action.action_type === 'ACTION').map(mapAction),
    bonusActions: actionRows.filter((action) => action.action_type === 'BONUS_ACTION').map(mapAction),
    reactions: actionRows.filter((action) => action.action_type === 'REACTION').map(mapAction),
    legendaryProfile: row.legendary_profile ? (row.legendary_profile as unknown as CreatureLegendaryProfile) : undefined,
    lairProfile: row.lair_profile ? (row.lair_profile as unknown as CreatureLairProfile) : undefined,
    npcProfile: row.npc_profile ? (row.npc_profile as unknown as CreatureNpcProfile) : undefined,
    cost: row.cost ? row.cost as unknown as CreatureAuthored['cost'] : undefined,
    carryingCapacity: row.carrying_capacity_amount != null && row.carrying_capacity_unit
      ? {
          amount: Number(row.carrying_capacity_amount),
          unit: requireMeasurementUnit(id, 'carryingCapacity', row.carrying_capacity_unit)
        }
      : undefined,
    logisticsNotes: row.logistics_notes ?? undefined,
  }

  return base satisfies CreatureAuthored
}

export function createCreatureRepository(db: DBLike): CreatureRepository {
  return {
    async upsert(entity) {
      await upsertCreature(db, entity, entity.systemId)
    },

    async findById(id) {
      return hydrateCreatureById(db, id)
    },

    async findByIds(ids) {
      return hydrateByIds(ids, (id) => hydrateCreatureById(db, id))
    },

    async findAll(filter?: RepositoryFindAllOptions) {
      let query = db
        .selectFrom('creatures')
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
        await hydrateByIds(rows.map((row) => row.id), (id) => hydrateCreatureById(db, id))
      )
    }
  }
}
