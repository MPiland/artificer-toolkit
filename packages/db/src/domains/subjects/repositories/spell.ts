import {
  CASTING_TIME_UNIT_CODE,
  SPELL_ATTRIBUTE,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import type { DBLike } from '#types'
import { upsertSpell } from '../upserts/spell.js'
import { createEffectRepository } from '../../effects/repositories/effect.js'
import type { RepositoryFindAllOptions, SpellRepository } from '../../../repositories/contracts.js'
import { orderedHydratedRecords, uniqueIds } from '../../../repositories/batch.js'
import { hydrateSubjectStatus } from '../status.js'

const SPELL_COLUMNS = [
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
] as const

type SpellRow = {
  id: string
  system_id: string
  user_id: string | null
  label: string
  description: string
  status: string
  level: number
  magic_school_id: string
  casting_time_unit: string
  casting_time_amount: number
  material_description: string | null
}

type SpellOwnedRow = { spell_id: string }

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

async function hydrateSpellById(db: DBLike, id: string): Promise<SpellAuthored | null> {
  const spellsById = await hydrateSpellsByIds(db, [id])
  return spellsById.get(id) ?? null
}

function groupSpellRows<T extends SpellOwnedRow>(rows: readonly T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>()

  for (const row of rows) {
    const bucket = grouped.get(row.spell_id)
    if (bucket) {
      bucket.push(row)
    } else {
      grouped.set(row.spell_id, [row])
    }
  }

  return grouped
}

async function hydrateSpellRows(
  db: DBLike,
  rows: readonly SpellRow[]
): Promise<Map<string, SpellAuthored>> {
  const expectedSystemId =
    rows.length > 0 && rows.every((row) => row.system_id === rows[0]?.system_id)
      ? rows[0]?.system_id
      : undefined
  const spellIds = rows.map((row) => row.id)
  if (spellIds.length === 0) {
    return new Map()
  }

  const [effectLinks, attributes, classes] = await Promise.all([
    db
      .selectFrom('spell_effects')
      .select(['spell_id', 'effect_id', 'sort_order'])
      .where('spell_id', 'in', spellIds)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('spell_attributes')
      .select(['spell_id', 'attribute_code', 'sort_order'])
      .where('spell_id', 'in', spellIds)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('spell_classes')
      .select(['spell_id', 'class_id'])
      .where('spell_id', 'in', spellIds)
      .orderBy('class_id')
      .execute()
  ])
  const effectRepository = createEffectRepository(db, expectedSystemId)
  const effectsById = await effectRepository.findByIds(effectLinks.map((link) => link.effect_id))
  const effectLinksBySpell = groupSpellRows(effectLinks)
  const attributesBySpell = groupSpellRows(attributes)
  const classesBySpell = groupSpellRows(classes)
  const authoredById = new Map<string, SpellAuthored>()

  for (const row of rows) {
    if (!row.user_id) {
      throw new Error(`Spell "${row.id}" is missing user ownership and cannot be hydrated.`)
    }

    const id = row.id
    const spellAttributes = attributesBySpell.get(id) ?? []
    const authoredEffects = (effectLinksBySpell.get(id) ?? []).map((link) => {
      const effect = effectsById.get(link.effect_id)
      if (!effect) {
        throw new Error(`Spell "${id}" is linked to missing effect "${link.effect_id}".`)
      }

      return effect
    })
    const attributeValues = spellAttributes
      .map((attribute) => attribute.attribute_code)
      .filter((code): code is string => code in SPELL_ATTRIBUTE)
      .map((code) => requireSpellAttribute(id, code))
    const componentValues = spellAttributes
      .map((attribute) => attribute.attribute_code)
      .filter((code): code is string => code in SPELL_COMPONENT_CODES)
      .map((code) => requireSpellComponent(id, code))
    const unknownCodes = spellAttributes
      .map((attribute) => attribute.attribute_code)
      .filter((code) => !(code in SPELL_ATTRIBUTE) && !(code in SPELL_COMPONENT_CODES))

    if (unknownCodes.length > 0) {
      throw new Error(
        `Spell "${id}" has invalid spell_attributes codes: ${unknownCodes.join(', ')}`
      )
    }

    authoredById.set(id, {
      kind: 'SPELL',
      id,
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
      classIds: (classesBySpell.get(id) ?? []).map((entry) => entry.class_id),
      magicSchoolId: row.magic_school_id,
      effects: authoredEffects.length > 0 ? authoredEffects : undefined,
      materialDescription: row.material_description ?? undefined,
      userId: row.user_id,
      systemId: row.system_id
    })
  }

  return authoredById
}

async function hydrateSpellsByIds(
  db: DBLike,
  ids: readonly string[]
): Promise<Map<string, SpellAuthored>> {
  const distinctIds = uniqueIds(ids)
  if (distinctIds.length === 0) {
    return new Map()
  }

  const rows = (await db
    .selectFrom('spells')
    .select(SPELL_COLUMNS)
    .where('id', 'in', distinctIds)
    .execute()) as SpellRow[]
  const rowsById = new Map(rows.map((row) => [row.id, row]))

  return hydrateSpellRows(
    db,
    distinctIds.flatMap((id) => {
      const row = rowsById.get(id)
      return row ? [row] : []
    })
  )
}

export function createSpellRepository(db: DBLike): SpellRepository {
  return {
    async upsert(entity, options) {
      await upsertSpell(db, entity, entity.systemId, options.contentSourceId)
    },

    async findById(id) {
      return hydrateSpellById(db, id)
    },

    async findByIds(ids) {
      return hydrateSpellsByIds(db, ids)
    },

    async findAll(filter?: RepositoryFindAllOptions) {
      let query = db.selectFrom('spells').select(SPELL_COLUMNS).orderBy('label')

      if (filter?.systemId) {
        query = query.where('system_id', '=', filter.systemId)
      }

      if (filter?.userId) {
        query = query.where('user_id', '=', filter.userId)
      }

      const rows = await query.execute()
      return orderedHydratedRecords(
        rows.map((row) => row.id),
        await hydrateSpellRows(db, rows as SpellRow[])
      )
    }
  }
}
