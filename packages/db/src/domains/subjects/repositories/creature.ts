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
  // The creature schema is evolving ahead of regenerated DB types.
  // Use a narrowed any-based query here until the next typegen pass.
  const row = await (db as any)
    .selectFrom('creatures')
    .select([
      'id',
      'system_id',
      'user_id',
      'label',
      'quote',
      'description',
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
    (db as any).selectFrom('creature_features')
      .select(['feature_id', 'sort_order'])
      .where('creature_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    (db as any).selectFrom('creature_details')
      .select(['detail_id', 'sort_order'])
      .where('creature_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    (db as any).selectFrom('creature_proficiency_grants')
      .select(['proficiency_grant_id', 'sort_order'])
      .where('creature_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    (db as any).selectFrom('creature_speeds')
      .select(['speed_id', 'amount', 'unit_code'])
      .where('creature_id', '=', id)
      .execute(),
    (db as any).selectFrom('creature_actions')
      .select([
        'id', 'action_type', 'sort_order', 'label', 'description', 'attack_bonus', 'damage', 'recharge'
      ])
      .where('creature_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    (db as any).selectFrom('creature_damage_resistances')
      .select(['damage_type_id'])
      .where('creature_id', '=', id)
      .execute(),
    (db as any).selectFrom('creature_damage_immunities')
      .select(['damage_type_id'])
      .where('creature_id', '=', id)
      .execute(),
    (db as any).selectFrom('creature_damage_vulnerabilities')
      .select(['damage_type_id'])
      .where('creature_id', '=', id)
      .execute(),
    (db as any).selectFrom('creature_condition_immunities')
      .select(['condition_type_id'])
      .where('creature_id', '=', id)
      .execute()
  ])

  const detailRepository = createDetailRepository(db)
  const featureRepository = createFeatureRepository(db, row.system_id)
  const proficiencyGrantRepository = createProficiencyGrantRepository(db)

  const [details, features, proficiencies] = await Promise.all([
    Promise.all(detailLinks.map((link: any) => detailRepository.findById(link.detail_id))),
    Promise.all(featureLinks.map((link: any) => featureRepository.findById(link.feature_id))),
    Promise.all(proficiencyLinks.map((link: any) => proficiencyGrantRepository.findById(link.proficiency_grant_id))),
  ])

  const authoredDetails = details.map((detail, index) => requireLinkedRecord(detail, `Creature "${id}" is linked to missing detail "${detailLinks[index]?.detail_id}".`))
  const authoredFeatures = features.map((feature, index) => requireLinkedRecord(feature, `Creature "${id}" is linked to missing feature "${featureLinks[index]?.feature_id}".`))
  const authoredProficiencies = proficiencies.map((proficiency, index) => requireLinkedRecord(proficiency, `Creature "${id}" is linked to missing proficiency grant "${proficiencyLinks[index]?.proficiency_grant_id}".`))

  const authoredSpeeds = speedRows.map((speed: any) => ({
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
    details: authoredDetails.length > 0 ? authoredDetails : undefined,
    features: authoredFeatures.length > 0 ? authoredFeatures : undefined,
    proficiencies: authoredProficiencies.length > 0 ? authoredProficiencies : undefined,
    userId: row.user_id,
    systemId: row.system_id,
    recordKind: row.record_kind as CreatureAuthored['recordKind'],
    category: row.category as CreatureAuthored['category'],
    creatureTypeId: row.creature_type_id ?? undefined,
    size: requireSizeCode(id, row.size_code),
    alignmentId: row.alignment_id ?? undefined,
    tags: row.tags ?? undefined,
    speeds: authoredSpeeds,
    mountProfile: row.mount_profile ? (row.mount_profile as unknown as CreatureMountProfile) : undefined,
    companionProfile: row.companion_profile ? (row.companion_profile as unknown as CreatureCompanionProfile) : undefined,
  }

  if (row.record_kind === 'LOGISTICS') {
    return {
      ...base,
      recordKind: 'LOGISTICS',
      cost: row.cost ? row.cost as never : undefined,
      carryingCapacity: row.carrying_capacity_amount != null && row.carrying_capacity_unit
        ? {
            amount: Number(row.carrying_capacity_amount),
            unit: row.carrying_capacity_unit as never
          }
        : undefined,
      logisticsNotes: row.logistics_notes ?? undefined,
    } as CreatureAuthored
  }

  return {
    ...base,
    recordKind: 'STAT_BLOCK',
    creatureTypeId: row.creature_type_id ?? '',
    size: requireLinkedRecord(requireSizeCode(id, row.size_code), `Creature "${id}" is missing size_code.`),
    abilityScores: row.ability_scores as never,
    armorClass: Number(row.armor_class ?? 0),
    armorClassNote: row.armor_class_note ?? undefined,
    hitPoints: Number(row.hit_points ?? 0),
    hitDice: row.hit_dice ?? undefined,
    senses: row.senses ?? undefined,
    passivePerception: row.passive_perception ?? undefined,
    damageVulnerabilities: vulnerabilityRows.map((entry: any) => entry.damage_type_id),
    damageResistances: resistanceRows.map((entry: any) => entry.damage_type_id),
    damageImmunities: immunityRows.map((entry: any) => entry.damage_type_id),
    conditionImmunities: conditionImmunityRows.map((entry: any) => entry.condition_type_id),
    challengeRatingId: row.challenge_rating_id ?? undefined,
    xp: row.xp ?? undefined,
    actions: actionRows.filter((action: any) => action.action_type === 'ACTION').map(mapAction),
    bonusActions: actionRows.filter((action: any) => action.action_type === 'BONUS_ACTION').map(mapAction),
    reactions: actionRows.filter((action: any) => action.action_type === 'REACTION').map(mapAction),
    legendaryProfile: row.legendary_profile ? (row.legendary_profile as unknown as CreatureLegendaryProfile) : undefined,
    lairProfile: row.lair_profile ? (row.lair_profile as unknown as CreatureLairProfile) : undefined,
    npcProfile: row.npc_profile ? (row.npc_profile as unknown as CreatureNpcProfile) : undefined
  } as CreatureAuthored
}

export function createCreatureRepository(db: DBLike): CreatureRepository {
  return {
    async upsert(entity) {
      await upsertCreature(db, entity, entity.systemId)
    },

    async findById(id) {
      return hydrateCreatureById(db, id)
    },

    async findAll(filter?: RepositoryFindAllOptions) {
      let query = (db as any)
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
      const records = await Promise.all(rows.map((row: any) => hydrateCreatureById(db, row.id)))
      return records.filter((record): record is CreatureAuthored => record !== null)
    }
  }
}
