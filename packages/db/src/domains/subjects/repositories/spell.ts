import {
  CASTING_TIME_UNIT_CODE,
  SPELL_ATTRIBUTE,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import type { DBLike } from '#types'
import { upsertSpell } from '../upserts/spell.js'
import { createEffectRepository } from '../../effects/repositories/effect.js'
import type { RepositoryFindAllOptions, SpellRepository } from '../../../repositories/contracts.js'
import { hydrateSubjectStatus } from '../status.js'

const SPELL_COMPONENT_CODES: Record<NonNullable<SpellAuthored['components']>[number], true> = {
  VERBAL: true,
  SOMATIC: true,
  MATERIAL: true
}

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

function requireSpellComponent(
  spellId: string,
  value: string
): NonNullable<SpellAuthored['components']>[number] {
  if (!(value in SPELL_COMPONENT_CODES)) {
    throw new Error(`Spell "${spellId}" has invalid component_code "${value}".`)
  }

  return value as NonNullable<SpellAuthored['components']>[number]
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
      'status',
      'level',
      'magic_school_id',
      'casting_time_unit',
      'casting_time_amount',
      'material_description'
    ] as const)
    .where('id', '=', id)
    .executeTakeFirst()

  if (!row) return null
  if (!row.user_id) {
    throw new Error(`Spell "${id}" is missing user ownership and cannot be hydrated.`)
  }

  const [effectLinks, attributes, classes] = await Promise.all([
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
      .execute()
  ])

  const effectRepository = createEffectRepository(db)
  const effects = await Promise.all(effectLinks.map((link) => effectRepository.findById(link.effect_id)))
  const authoredEffects = effects.map((effect, index) => {
    if (effect === null) {
      throw new Error(`Spell "${id}" is linked to missing effect "${effectLinks[index]?.effect_id}".`)
    }

    return effect
  })

  const attributeValues = attributes
    .map((attribute) => attribute.attribute_code)
    .filter((code): code is string => code in SPELL_ATTRIBUTE)
    .map((code) => requireSpellAttribute(id, code))

  const componentValues = attributes
    .map((attribute) => attribute.attribute_code)
    .filter((code): code is string => code in SPELL_COMPONENT_CODES)
    .map((code) => requireSpellComponent(id, code))

  const unknownCodes = attributes
    .map((attribute) => attribute.attribute_code)
    .filter((code) => !(code in SPELL_ATTRIBUTE) && !(code in SPELL_COMPONENT_CODES))

  if (unknownCodes.length > 0) {
    throw new Error(`Spell "${id}" has invalid spell_attributes codes: ${unknownCodes.join(', ')}`)
  }

  return {
    kind: 'SPELL',
    id: row.id,
    label: row.label,
    attributes: attributeValues.length > 0 ? attributeValues : undefined,
    components: componentValues.length > 0 ? componentValues : undefined,
    description: row.description,
    status: hydrateSubjectStatus(row.status),
    castingTime: {
      unit: requireCastingTimeUnit(id, row.casting_time_unit),
      amount: row.casting_time_amount
    },
    level: row.level,
    classIds: classes.map((entry) => entry.class_id),
    magicSchoolId: row.magic_school_id,
    effects: authoredEffects.length > 0 ? authoredEffects : undefined,
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



