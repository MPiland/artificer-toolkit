import { MEASUREMENT_UNIT_CODE, SIZE_CODE, type CreatureAuthored } from '@artificer-toolkit/shared'
import {
  creatureAbilityScoresDtoSchema,
  creatureCompanionProfileDtoSchema,
  creatureEquipmentLoadoutDtoSchema,
  creatureMountProfileDtoSchema,
  creatureNpcProfileDtoSchema
} from '@artificer-toolkit/schema/subjects/creature'
import { costDtoSchema } from '@artificer-toolkit/schema/subjects/shared'
import type { DBLike } from '#types'
import { upsertCreature } from '../upserts/creature.js'
import { createDetailRepository } from '../../shared/repositories/detail.js'
import { createFeatureRepository } from '../../features/repositories/feature.js'
import { createProficiencyGrantRepository } from '../../grants/repositories/proficiency.js'
import type {
  CreatureRepository,
  RepositoryFindAllOptions
} from '../../../repositories/contracts.js'
import { hydrateByIds, orderedHydratedRecords } from '../../../repositories/batch.js'
import { hydrateSubjectStatus } from '../status.js'

function requireLinkedRecord<T>(value: T | null, message: string): T {
  if (value === null) throw new Error(message)
  return value
}

function requireSizeCode(
  creatureId: string,
  value?: string | null
): CreatureAuthored['size'] | undefined {
  if (value == null) {
    return undefined
  }
  if (!(value in SIZE_CODE)) {
    throw new Error(`Creature "${creatureId}" has invalid size_code "${value}".`)
  }
  return value as CreatureAuthored['size']
}

function parseCreatureJson<T>(
  creatureId: string,
  field: string,
  value: unknown,
  parse: (input: unknown) => T
): T {
  try {
    return parse(value)
  } catch (error) {
    const reason = error instanceof Error ? ` ${error.message}` : ''
    throw new Error(`Creature "${creatureId}" has invalid ${field}.${reason}`)
  }
}

function hydrateAbilityScores(
  creatureId: string,
  value: unknown
): CreatureAuthored['abilityScores'] {
  if (value != null) {
    return parseCreatureJson(creatureId, 'ability_scores', value, (input) =>
      creatureAbilityScoresDtoSchema.parse(input)
    )
  }

  return {
    STRENGTH: 10,
    DEXTERITY: 10,
    CONSTITUTION: 10,
    INTELLIGENCE: 10,
    WISDOM: 10,
    CHARISMA: 10
  }
}

function selectCreatureIds(db: DBLike, filter?: RepositoryFindAllOptions) {
  let query = db.selectFrom('creatures').select('id')

  if (filter?.systemId) {
    query = query.where('system_id', '=', filter.systemId)
  }
  if (filter?.userId && filter.includeMaster) {
    query = query.where((eb) =>
      eb.or([eb('user_id', '=', filter.userId!), eb('is_master', '=', true)])
    )
  } else if (filter?.userId) {
    query = query.where('user_id', '=', filter.userId)
  } else if (filter?.includeMaster) {
    query = query.where('is_master', '=', true)
  }

  return query
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

async function hydrateCreatureById(db: DBLike, id: string): Promise<CreatureAuthored | null> {
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
      'hit_dice_count',
      'hit_die',
      'hit_dice_modifier',
      'senses',
      'passive_perception',
      'challenge_rating_id',
      'xp',
      'mount_profile',
      'companion_profile',
      'npc_profile',
      'equipment_loadout',
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
    resistanceRows,
    immunityRows,
    vulnerabilityRows,
    conditionImmunityRows
  ] = await Promise.all([
    db
      .selectFrom('creature_features')
      .select(['feature_id', 'sort_order'])
      .where('creature_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('creature_details')
      .select(['detail_id', 'sort_order'])
      .where('creature_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('creature_proficiency_grants')
      .select(['proficiency_grant_id', 'sort_order'])
      .where('creature_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('creature_speeds')
      .select(['speed_id', 'amount', 'unit_code'])
      .where('creature_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('creature_damage_resistances')
      .select(['damage_type_id', 'sort_order'])
      .where('creature_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('creature_damage_immunities')
      .select(['damage_type_id', 'sort_order'])
      .where('creature_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('creature_damage_vulnerabilities')
      .select(['damage_type_id', 'sort_order'])
      .where('creature_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('creature_condition_immunities')
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
    proficiencyGrantRepository.findByIds(proficiencyLinks.map((link) => link.proficiency_grant_id))
  ])

  const authoredDetails = detailLinks.map((link) =>
    requireLinkedRecord(
      detailsById.get(link.detail_id) ?? null,
      `Creature "${id}" is linked to missing detail "${link.detail_id}".`
    )
  )
  const authoredFeatures = featureLinks.map((link) =>
    requireLinkedRecord(
      featuresById.get(link.feature_id) ?? null,
      `Creature "${id}" is linked to missing feature "${link.feature_id}".`
    )
  )
  const authoredProficiencies = proficiencyLinks.map((link) =>
    requireLinkedRecord(
      proficienciesById.get(link.proficiency_grant_id) ?? null,
      `Creature "${id}" is linked to missing proficiency grant "${link.proficiency_grant_id}".`
    )
  )

  const authoredSpeeds = speedRows.map((speed) => ({
    speedId: speed.speed_id,
    amount: speed.amount,
    unit: requireMeasurementUnit(id, speed.speed_id, speed.unit_code)
  }))

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
    category: row.category as CreatureAuthored['category'],
    creatureTypeId: row.creature_type_id ?? '',
    size: requireSizeCode(id, row.size_code) ?? SIZE_CODE.MEDIUM,
    alignmentId: row.alignment_id ?? undefined,
    tags: row.tags ?? undefined,
    speeds: authoredSpeeds,
    mountProfile:
      row.mount_profile == null
        ? undefined
        : parseCreatureJson(id, 'mount_profile', row.mount_profile, (value) =>
            creatureMountProfileDtoSchema.parse(value)
          ),
    companionProfile:
      row.companion_profile == null
        ? undefined
        : parseCreatureJson(id, 'companion_profile', row.companion_profile, (value) =>
            creatureCompanionProfileDtoSchema.parse(value)
          ),
    abilityScores: hydrateAbilityScores(id, row.ability_scores),
    armorClass: Number(row.armor_class ?? 0),
    armorClassNote: row.armor_class_note ?? undefined,
    hitPoints: Number(row.hit_points ?? 0),
    hitDice:
      row.hit_dice_count == null || row.hit_die == null
        ? undefined
        : {
            count: Number(row.hit_dice_count),
            die: Number(row.hit_die),
            modifier: Number(row.hit_dice_modifier ?? 0)
          },
    senses: row.senses ?? undefined,
    passivePerception: row.passive_perception ?? undefined,
    ...(vulnerabilityRows.length > 0
      ? { damageVulnerabilities: vulnerabilityRows.map((entry) => entry.damage_type_id) }
      : {}),
    ...(resistanceRows.length > 0
      ? { damageResistances: resistanceRows.map((entry) => entry.damage_type_id) }
      : {}),
    ...(immunityRows.length > 0
      ? { damageImmunities: immunityRows.map((entry) => entry.damage_type_id) }
      : {}),
    ...(conditionImmunityRows.length > 0
      ? { conditionImmunities: conditionImmunityRows.map((entry) => entry.condition_type_id) }
      : {}),
    challengeRatingId: row.challenge_rating_id ?? undefined,
    xp: row.xp ?? undefined,
    npcProfile:
      row.npc_profile == null
        ? undefined
        : parseCreatureJson(id, 'npc_profile', row.npc_profile, (value) =>
            creatureNpcProfileDtoSchema.parse(value)
          ),
    equipmentLoadout:
      row.equipment_loadout == null
        ? undefined
        : parseCreatureJson(id, 'equipment_loadout', row.equipment_loadout, (value) =>
            creatureEquipmentLoadoutDtoSchema.parse(value)
          ),
    cost:
      row.cost == null
        ? undefined
        : parseCreatureJson(id, 'cost', row.cost, (value) => costDtoSchema.parse(value)),
    carryingCapacity:
      row.carrying_capacity_amount != null && row.carrying_capacity_unit
        ? {
            amount: Number(row.carrying_capacity_amount),
            unit: requireMeasurementUnit(id, 'carryingCapacity', row.carrying_capacity_unit)
          }
        : undefined,
    logisticsNotes: row.logistics_notes ?? undefined
  }

  return base satisfies CreatureAuthored
}

export function createCreatureRepository(db: DBLike): CreatureRepository {
  return {
    async upsert(entity, options) {
      await upsertCreature(db, entity, entity.systemId, options.contentSourceId)
    },

    async findById(id, filter) {
      const row = await selectCreatureIds(db, filter).where('id', '=', id).executeTakeFirst()
      return row ? hydrateCreatureById(db, row.id) : null
    },

    async findByIds(ids, filter) {
      const rows = await selectCreatureIds(db, filter).where('id', 'in', ids).execute()
      return hydrateByIds(
        rows.map((row) => row.id),
        (id) => hydrateCreatureById(db, id)
      )
    },

    async findAll(filter?: RepositoryFindAllOptions) {
      const rows = await selectCreatureIds(db, filter).orderBy('label').execute()
      return orderedHydratedRecords(
        rows.map((row) => row.id),
        await hydrateByIds(
          rows.map((row) => row.id),
          (id) => hydrateCreatureById(db, id)
        )
      )
    }
  }
}
