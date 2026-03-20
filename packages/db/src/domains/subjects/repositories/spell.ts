import {
  CASTING_TIME_UNIT_CODE,
  DURATION_KIND,
  MEASUREMENT_UNIT_CODE,
  RANGE_KIND,
  SPELL_ATTRIBUTE,
  type DurationAuthored,
  type RangeAuthored,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import type { DBLike } from '#types'
import { upsertSpell } from '../upserts/spell.js'
import { createEffectRepository } from '../../effects/repositories/effect.js'
import type { RepositoryFindAllOptions, SpellRepository } from '../../../repositories/contracts.js'

function requireCastingTimeUnit(
  spellId: string,
  value: string
): SpellAuthored['castingTime']['unit'] {
  if (!(value in CASTING_TIME_UNIT_CODE)) {
    throw new Error(`Spell "${spellId}" has invalid casting_time_unit "${value}".`)
  }

  return value as SpellAuthored['castingTime']['unit']
}

function requireSpellAttribute(
  spellId: string,
  value: string
): NonNullable<SpellAuthored['attributes']>[number] {
  if (!(value in SPELL_ATTRIBUTE)) {
    throw new Error(`Spell "${spellId}" has invalid attribute_code "${value}".`)
  }

  return value as NonNullable<SpellAuthored['attributes']>[number]
}

function requireRangeKind(spellId: string, value: string): RangeAuthored['rangeKind'] {
  if (!(value in RANGE_KIND)) {
    throw new Error(`Spell "${spellId}" has invalid range kind "${value}".`)
  }

  return value as RangeAuthored['rangeKind']
}

function requireMeasurementUnit(spellId: string, value: string): Extract<RangeAuthored, { rangeKind: 'DISTANCE' }>['unit'] {
  if (!(value in MEASUREMENT_UNIT_CODE)) {
    throw new Error(`Spell "${spellId}" has invalid range unit "${value}".`)
  }

  return value as Extract<RangeAuthored, { rangeKind: 'DISTANCE' }>['unit']
}

function requireDurationKind(spellId: string, value: string): DurationAuthored['durationKind'] {
  if (!(value in DURATION_KIND)) {
    throw new Error(`Spell "${spellId}" has invalid duration kind "${value}".`)
  }

  return value as DurationAuthored['durationKind']
}

async function hydrateRangeById(db: DBLike, spellId: string, id: string): Promise<RangeAuthored> {
  const row = await db
    .selectFrom('characteristic_ranges')
    .select(['kind', 'min', 'unit_code'])
    .where('characteristic_id', '=', id)
    .executeTakeFirst()

  if (!row) {
    throw new Error(`Spell "${spellId}" is linked to missing range "${id}".`)
  }

  const rangeKind = requireRangeKind(spellId, row.kind)

  if (rangeKind === RANGE_KIND.DISTANCE) {
    if (row.min == null || row.unit_code == null) {
      throw new Error(`Spell "${spellId}" range "${id}" is missing distance payload.`)
    }

    return {
      id,
      rangeKind,
      amount: row.min,
      unit: requireMeasurementUnit(spellId, row.unit_code)
    }
  }

  return {
    id,
    rangeKind
  }
}

async function hydrateDurationById(db: DBLike, spellId: string, id: string): Promise<DurationAuthored> {
  const row = await db
    .selectFrom('characteristic_durations')
    .select(['kind', 'amount'])
    .where('characteristic_id', '=', id)
    .executeTakeFirst()

  if (!row) {
    throw new Error(`Spell "${spellId}" is linked to missing duration "${id}".`)
  }

  const durationKind = requireDurationKind(spellId, row.kind)

  if (durationKind === DURATION_KIND.INSTANTANEOUS) {
    return {
      id,
      durationKind
    }
  }

  if (row.amount == null) {
    throw new Error(`Spell "${spellId}" duration "${id}" is missing amount.`)
  }

  return {
    id,
    durationKind,
    amount: row.amount
  }
}

async function hydrateSpellById(
  db: DBLike,
  id: string
): Promise<SpellAuthored | null> {
  const row = await db
    .selectFrom('spells')
    .select([
      'id',
      'system_id',
      'user_id',
      'label',
      'description',
      'level',
      'magic_school_id',
      'casting_time_unit',
      'casting_time_amount',
      'range_id',
      'duration_id',
      'at_higher_levels',
      'material_description'
    ])
    .where('id', '=', id)
    .executeTakeFirst()

  if (!row) return null
  if (!row.user_id) {
    throw new Error(`Spell "${id}" is missing user ownership and cannot be hydrated.`)
  }

  const [effectLinks, attributes, classes, range, duration] = await Promise.all([
    db.selectFrom('spell_effects')
      .select(['effect_id', 'sort_order'])
      .where('spell_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('spell_attributes')
      .select(['attribute_code', 'sort_order'])
      .where('spell_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('spell_classes')
      .select(['class_id'])
      .where('spell_id', '=', id)
      .orderBy('class_id')
      .execute(),
    row.range_id ? hydrateRangeById(db, id, row.range_id) : Promise.resolve(undefined),
    row.duration_id ? hydrateDurationById(db, id, row.duration_id) : Promise.resolve(undefined)
  ])

  const effectRepository = createEffectRepository(db)
  const effects = await Promise.all(effectLinks.map((link) => effectRepository.findById(link.effect_id)))
  const authoredEffects = effects.map((effect, index) => {
    if (effect === null) {
      throw new Error(`Spell "${id}" is linked to missing effect "${effectLinks[index]?.effect_id}".`)
    }

    return effect
  })

  return {
    kind: 'SPELL',
    id: row.id,
    label: row.label,
    attributes: attributes.length > 0
      ? attributes.map((attribute) => requireSpellAttribute(id, attribute.attribute_code))
      : undefined,
    description: row.description,
    castingTime: {
      unit: requireCastingTimeUnit(id, row.casting_time_unit),
      amount: row.casting_time_amount
    },
    range,
    duration,
    level: row.level,
    classIds: classes.map((entry) => entry.class_id),
    magicSchoolId: row.magic_school_id,
    effects: authoredEffects.length > 0 ? authoredEffects : undefined,
    atHigherLevels: row.at_higher_levels ?? undefined,
    materialDescription: row.material_description ?? undefined,
    userId: row.user_id,
    systemId: row.system_id
  }
}

export function createSpellRepository(db: DBLike): SpellRepository {
  return {
    async upsert(entity) {
      await upsertSpell(db, entity, entity.systemId)
    },

    async findById(id) {
      return hydrateSpellById(db, id)
    },

    async findAll(filter?: RepositoryFindAllOptions) {
      let query = db
        .selectFrom('spells')
        .select('id')
        .orderBy('label')

      if (filter?.systemId) {
        query = query.where('system_id', '=', filter.systemId)
      }

      if (filter?.userId) {
        query = query.where('user_id', '=', filter.userId)
      }

      const rows = await query.execute()
      const records = await Promise.all(rows.map((row) => hydrateSpellById(db, row.id)))
      return records.filter((record): record is SpellAuthored => record !== null)
    }
  }
}
