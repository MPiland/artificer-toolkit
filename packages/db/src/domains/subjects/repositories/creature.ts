import {
  CREATURE_CATEGORY_CODE,
  MEASUREMENT_UNIT_CODE,
  SIZE_CODE,
  type CreatureAuthored,
  type CreatureCompanionProfile,
  type CreatureLairProfile,
  type CreatureLegendaryProfile,
  type CreatureMountProfile,
  type CreatureNpcProfile
} from '@artificer-toolkit/shared'
import type { DBLike } from '#types'
import { upsertCreature } from '../upserts/creature.js'
import { createDetailRepository } from '../../shared/repositories/detail.js'
import { createFeatureRepository } from '../../features/repositories/feature.js'
import type { CreatureRepository, RepositoryFindAllOptions } from '../../../repositories/contracts.js'

function requireLinkedRecord<T>(value: T | null, message: string): T {
  if (value === null) throw new Error(message)
  return value
}

function requireSizeCode(creatureId: string, value: string): CreatureAuthored['size'] {
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
  const row = await db
    .selectFrom('creatures')
    .select([
      'id',
      'system_id',
      'user_id',
      'label',
      'quote',
      'description',
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
      'saving_throw_proficiencies',
      'skill_proficiencies',
      'languages',
      'challenge_rating_id',
      'xp',
      'legendary_profile',
      'lair_profile',
      'mount_profile',
      'companion_profile',
      'npc_profile'
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
    speedRows,
    actionRows
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
      .execute()
  ])

  const detailRepository = createDetailRepository(db)
  const featureRepository = createFeatureRepository(db, row.system_id)

  const details = await Promise.all(detailLinks.map((link) => detailRepository.findById(link.detail_id)))
  const features = await Promise.all(featureLinks.map((link) => featureRepository.findById(link.feature_id)))

  const authoredDetails = details.map((detail, i) => requireLinkedRecord(detail, `Creature "${id}" is linked to missing detail "${detailLinks[i]?.detail_id}".`))
  const authoredFeatures = features.map((feature, i) => requireLinkedRecord(feature, `Creature "${id}" is linked to missing feature "${featureLinks[i]?.feature_id}".`))

  const authoredSpeeds = speedRows.map((speed) => ({
    speedId: speed.speed_id,
    amount: speed.amount,
    unit: requireMeasurementUnit(id, speed.speed_id, speed.unit_code)
  }))

  const mapAction = (r: typeof actionRows[number]) => ({
    id: r.id,
    label: r.label,
    description: r.description,
    attackBonus: r.attack_bonus ?? undefined,
    damage: r.damage ?? undefined,
    recharge: r.recharge ?? undefined
  })

  const actions = actionRows.filter((r) => r.action_type === 'ACTION').map(mapAction)
  const bonusActions = actionRows.filter((r) => r.action_type === 'BONUS_ACTION').map(mapAction)
  const reactions = actionRows.filter((r) => r.action_type === 'REACTION').map(mapAction)

  if (!row.size_code) {
    throw new Error(`Creature "${id}" is missing size_code.`)
  }

  return {
    id: row.id,
    label: row.label,
    quote: row.quote ?? undefined,
    description: row.description ?? undefined,
    details: authoredDetails.length > 0 ? authoredDetails : undefined,
    features: authoredFeatures.length > 0 ? authoredFeatures : undefined,
    userId: row.user_id,
    systemId: row.system_id,
    category: row.category as CreatureAuthored['category'],
    creatureTypeId: row.creature_type_id ?? '',
    size: requireSizeCode(id, row.size_code),
    alignmentId: row.alignment_id ?? undefined,
    tags: (row.tags as string[] | null) ?? undefined,
    abilityScores: (row.ability_scores as unknown) as CreatureAuthored['abilityScores'],
    armorClass: row.armor_class,
    armorClassNote: row.armor_class_note ?? undefined,
    hitPoints: row.hit_points,
    hitDice: row.hit_dice ?? undefined,
    speeds: authoredSpeeds,
    senses: (row.senses as string[] | null) ?? undefined,
    passivePerception: row.passive_perception ?? undefined,
    savingThrowProficiencies: (row.saving_throw_proficiencies as unknown as CreatureAuthored['savingThrowProficiencies']) ?? undefined,
    skillProficiencies: (row.skill_proficiencies as string[] | null) ?? undefined,
    languages: (row.languages as string[] | null) ?? undefined,
    challengeRatingId: row.challenge_rating_id ?? undefined,
    xp: row.xp ?? undefined,
    actions: actions.length > 0 ? actions : undefined,
    bonusActions: bonusActions.length > 0 ? bonusActions : undefined,
    reactions: reactions.length > 0 ? reactions : undefined,
    legendaryProfile: row.legendary_profile ? (row.legendary_profile as unknown as CreatureLegendaryProfile) : undefined,
    lairProfile: row.lair_profile ? (row.lair_profile as unknown as CreatureLairProfile) : undefined,
    mountProfile: row.mount_profile ? (row.mount_profile as unknown as CreatureMountProfile) : undefined,
    companionProfile: row.companion_profile ? (row.companion_profile as unknown as CreatureCompanionProfile) : undefined,
    npcProfile: row.npc_profile ? (row.npc_profile as unknown as CreatureNpcProfile) : undefined
  }
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
      const records = await Promise.all(rows.map((row) => hydrateCreatureById(db, row.id)))
      return records.filter((record): record is CreatureAuthored => record !== null)
    }
  }
}
