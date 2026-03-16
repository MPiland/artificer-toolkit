import type { NodeSubjectCode, OptionAuthored } from '@artificer-toolkit/shared'
import { FEATURE_ATTRIBUTE } from '@artificer-toolkit/shared'
import type { DBLike } from '../types/index.js'
import { upsertOption } from '../domains/features/upserts/option.js'
import { hydrateFacetById } from '../domains/shared/facets.js'
import { hydrateChargeById } from './grant-helpers.js'
import { createEffectRepository } from './effect.js'
import { createFeatGrantRepository } from './feat-grant.js'
import { createModifierGrantRepository } from './modifier-grant.js'
import { createProficiencyGrantRepository } from './proficiency-grant.js'
import { createSenseGrantRepository } from './sense-grant.js'
import { createSpellGrantRepository } from './spell-grant.js'
import type { OptionRepository } from './contracts.js'

function requireLinkedRecord<T>(
  value: T | null,
  message: string
): T {
  if (value === null) {
    throw new Error(message)
  }

  return value
}

function requireFeatureAttribute(
  optionId: string,
  value: string
): NonNullable<OptionAuthored['attributes']>[number] {
  if (!(value in FEATURE_ATTRIBUTE)) {
    throw new Error(`Option "${optionId}" has invalid attribute_code "${value}".`)
  }

  return value as NonNullable<OptionAuthored['attributes']>[number]
}

export async function hydrateOptionById(
  db: DBLike,
  id: string
): Promise<OptionAuthored | null> {
  const row = await db
    .selectFrom('options')
    .select([
      'id',
      'label',
      'description',
      'detail',
      'sort_order',
      'charge_id',
      'restriction_id'
    ])
    .where('id', '=', id)
    .executeTakeFirst()

  if (!row) return null

  const [
    effectLinks,
    attributeRows,
    featGrantLinks,
    modifierGrantLinks,
    proficiencyGrantLinks,
    senseGrantLinks,
    spellGrantLinks,
    charge,
    restrictions
  ] = await Promise.all([
    db.selectFrom('option_effects')
      .select(['effect_id'])
      .where('option_id', '=', id)
      .execute(),
    db.selectFrom('option_attributes')
      .select(['attribute_code', 'sort_order'])
      .where('option_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('option_feat_grants')
      .select(['feat_grant_id', 'sort_order'])
      .where('option_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('option_modifier_grants')
      .select(['modifier_grant_id', 'sort_order'])
      .where('option_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('option_proficiency_grants')
      .select(['proficiency_grant_id', 'sort_order'])
      .where('option_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('option_sense_grants')
      .select(['sense_grant_id', 'sort_order'])
      .where('option_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('option_spell_grants')
      .select(['spell_grant_id', 'sort_order'])
      .where('option_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    row.charge_id ? hydrateChargeById(db, row.charge_id) : Promise.resolve(null),
    row.restriction_id ? hydrateFacetById(db, row.restriction_id) : Promise.resolve(null)
  ])

  const effectRepository = createEffectRepository(db)
  const featGrantRepository = createFeatGrantRepository(db)
  const modifierGrantRepository = createModifierGrantRepository(db)
  const proficiencyGrantRepository = createProficiencyGrantRepository(db)
  const senseGrantRepository = createSenseGrantRepository(db)
  const spellGrantRepository = createSpellGrantRepository(db)

  const [effects, featGrants, modifierGrants, proficiencyGrants, senseGrants, spellGrants] = await Promise.all([
    Promise.all(effectLinks.map((link) => effectRepository.findById(link.effect_id))),
    Promise.all(featGrantLinks.map((link) => featGrantRepository.findById(link.feat_grant_id))),
    Promise.all(modifierGrantLinks.map((link) => modifierGrantRepository.findById(link.modifier_grant_id))),
    Promise.all(proficiencyGrantLinks.map((link) => proficiencyGrantRepository.findById(link.proficiency_grant_id))),
    Promise.all(senseGrantLinks.map((link) => senseGrantRepository.findById(link.sense_grant_id))),
    Promise.all(spellGrantLinks.map((link) => spellGrantRepository.findById(link.spell_grant_id)))
  ])

  const authoredEffects = effects.map((effect, index) => requireLinkedRecord(
    effect,
    `Option "${id}" is linked to missing effect "${effectLinks[index]?.effect_id}".`
  ))
  const authoredFeatGrants = featGrants.map((grant, index) => requireLinkedRecord(
    grant,
    `Option "${id}" is linked to missing feat grant "${featGrantLinks[index]?.feat_grant_id}".`
  ))
  const authoredModifierGrants = modifierGrants.map((grant, index) => requireLinkedRecord(
    grant,
    `Option "${id}" is linked to missing modifier grant "${modifierGrantLinks[index]?.modifier_grant_id}".`
  ))
  const authoredProficiencyGrants = proficiencyGrants.map((grant, index) => requireLinkedRecord(
    grant,
    `Option "${id}" is linked to missing proficiency grant "${proficiencyGrantLinks[index]?.proficiency_grant_id}".`
  ))
  const authoredSenseGrants = senseGrants.map((grant, index) => requireLinkedRecord(
    grant,
    `Option "${id}" is linked to missing sense grant "${senseGrantLinks[index]?.sense_grant_id}".`
  ))
  const authoredSpellGrants = spellGrants.map((grant, index) => requireLinkedRecord(
    grant,
    `Option "${id}" is linked to missing spell grant "${spellGrantLinks[index]?.spell_grant_id}".`
  ))

  return {
    id: row.id,
    label: row.label,
    description: row.description,
    attributes: attributeRows.length > 0
      ? attributeRows.map((attribute) => requireFeatureAttribute(id, attribute.attribute_code))
      : undefined,
    detail: row.detail ?? undefined,
    effects: authoredEffects.length > 0 ? authoredEffects : undefined,
    charges: row.charge_id
      ? requireLinkedRecord(charge, `Option "${id}" is linked to missing charge "${row.charge_id}".`)
      : undefined,
    grants:
      authoredFeatGrants.length > 0
      || authoredModifierGrants.length > 0
      || authoredProficiencyGrants.length > 0
      || authoredSenseGrants.length > 0
      || authoredSpellGrants.length > 0
        ? {
            feats: authoredFeatGrants.length > 0 ? authoredFeatGrants : undefined,
            modifiers: authoredModifierGrants.length > 0 ? authoredModifierGrants : undefined,
            proficiencies: authoredProficiencyGrants.length > 0 ? authoredProficiencyGrants : undefined,
            senses: authoredSenseGrants.length > 0 ? authoredSenseGrants : undefined,
            spells: authoredSpellGrants.length > 0 ? authoredSpellGrants : undefined
          }
        : undefined,
    restrictions: row.restriction_id
      ? requireLinkedRecord(restrictions, `Option "${id}" is linked to missing restriction facet "${row.restriction_id}".`)
      : undefined,
    order: row.sort_order
  }
}

async function hydrateOptionByIdTyped<N extends NodeSubjectCode>(
  db: DBLike,
  id: string
): Promise<OptionAuthored<N> | null> {
  return hydrateOptionById(db, id) as Promise<OptionAuthored<N> | null>
}

export function createOptionRepository<N extends NodeSubjectCode = NodeSubjectCode>(
  db: DBLike,
  defaultSystemId?: string
): OptionRepository<N> {
  return {
    async upsert(entity) {
      await upsertOption(db, entity, defaultSystemId)
    },

    async findById(id) {
      return hydrateOptionByIdTyped<N>(db, id)
    },

    async findAll() {
      const rows = await db
        .selectFrom('options')
        .select('id')
        .orderBy('sort_order')
        .execute()

      const records = await Promise.all(rows.map((row) => hydrateOptionByIdTyped<N>(db, row.id)))
      return records.filter((record): record is OptionAuthored<N> => record !== null)
    }
  }
}
