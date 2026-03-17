import type { FeatureAuthored, NodeSubjectCode } from '@artificer-toolkit/shared'
import { FEATURE_ATTRIBUTE } from '@artificer-toolkit/shared'
import type { DBLike } from '#types'
import { upsertFeature } from '../upserts/feature.js'
import { hydrateFacetById } from '../../shared/facets.js'
import { hydrateChargeById } from '../../grants/repositories/helpers.js'
import { createEffectRepository } from '../../effects/repositories/effect.js'
import { createFeatGrantRepository } from '../../grants/repositories/feat.js'
import { createModifierGrantRepository } from '../../grants/repositories/modifier.js'
import { createOptionRepository } from './option.js'
import { createProficiencyGrantRepository } from '../../grants/repositories/proficiency.js'
import { createSenseGrantRepository } from '../../grants/repositories/sense.js'
import { createSpellGrantRepository } from '../../grants/repositories/spell.js'
import type { FeatureRepository } from '../../../repositories/contracts.js'

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
  featureId: string,
  value: string
): NonNullable<FeatureAuthored['attributes']>[number] {
  if (!(value in FEATURE_ATTRIBUTE)) {
    throw new Error(`Feature "${featureId}" has invalid attribute_code "${value}".`)
  }

  return value as NonNullable<FeatureAuthored['attributes']>[number]
}

export async function hydrateFeatureById(
  db: DBLike,
  id: string
): Promise<FeatureAuthored | null> {
  const row = await db
    .selectFrom('features')
    .select([
      'id',
      'label',
      'description',
      'detail',
      'charge_id',
      'restriction_id',
      'sort_order',
      'available_at_level'
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
    optionLinks,
    optionChoiceRows,
    charge,
    restrictions
  ] = await Promise.all([
    db.selectFrom('feature_effects')
      .select(['effect_id'])
      .where('feature_id', '=', id)
      .execute(),
    db.selectFrom('feature_attributes')
      .select(['attribute_code', 'sort_order'])
      .where('feature_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('feature_feat_grants')
      .select(['feat_grant_id', 'sort_order'])
      .where('feature_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('feature_modifier_grants')
      .select(['modifier_grant_id', 'sort_order'])
      .where('feature_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('feature_proficiency_grants')
      .select(['proficiency_grant_id', 'sort_order'])
      .where('feature_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('feature_sense_grants')
      .select(['sense_grant_id', 'sort_order'])
      .where('feature_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('feature_spell_grants')
      .select(['spell_grant_id', 'sort_order'])
      .where('feature_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('feature_options')
      .select(['option_id', 'sort_order'])
      .where('feature_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('feature_option_levels')
      .select([
        'level', 'count', 'replace_count', 'sort_order'
      ])
      .where('feature_id', '=', id)
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
  const optionRepository = createOptionRepository<NodeSubjectCode>(db)

  const [
    effects,
    featGrants,
    modifierGrants,
    proficiencyGrants,
    senseGrants,
    spellGrants,
    options
  ] = await Promise.all([
    Promise.all(effectLinks.map((link) => effectRepository.findById(link.effect_id))),
    Promise.all(featGrantLinks.map((link) => featGrantRepository.findById(link.feat_grant_id))),
    Promise.all(modifierGrantLinks.map((link) => modifierGrantRepository.findById(link.modifier_grant_id))),
    Promise.all(proficiencyGrantLinks.map((link) => proficiencyGrantRepository.findById(link.proficiency_grant_id))),
    Promise.all(senseGrantLinks.map((link) => senseGrantRepository.findById(link.sense_grant_id))),
    Promise.all(spellGrantLinks.map((link) => spellGrantRepository.findById(link.spell_grant_id))),
    Promise.all(optionLinks.map((link) => optionRepository.findById(link.option_id)))
  ])

  const authoredEffects = effects.map((effect, index) => requireLinkedRecord(effect, `Feature "${id}" is linked to missing effect "${effectLinks[index]?.effect_id}".`))
  const authoredFeatGrants = featGrants.map((grant, index) => requireLinkedRecord(grant, `Feature "${id}" is linked to missing feat grant "${featGrantLinks[index]?.feat_grant_id}".`))
  const authoredModifierGrants = modifierGrants.map((grant, index) => requireLinkedRecord(grant, `Feature "${id}" is linked to missing modifier grant "${modifierGrantLinks[index]?.modifier_grant_id}".`))
  const authoredProficiencyGrants = proficiencyGrants.map((grant, index) => requireLinkedRecord(grant, `Feature "${id}" is linked to missing proficiency grant "${proficiencyGrantLinks[index]?.proficiency_grant_id}".`))
  const authoredSenseGrants = senseGrants.map((grant, index) => requireLinkedRecord(grant, `Feature "${id}" is linked to missing sense grant "${senseGrantLinks[index]?.sense_grant_id}".`))
  const authoredSpellGrants = spellGrants.map((grant, index) => requireLinkedRecord(grant, `Feature "${id}" is linked to missing spell grant "${spellGrantLinks[index]?.spell_grant_id}".`))
  const authoredOptions = options.map((option, index) => requireLinkedRecord(option, `Feature "${id}" is linked to missing option "${optionLinks[index]?.option_id}".`))

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
      ? requireLinkedRecord(charge, `Feature "${id}" is linked to missing charge "${row.charge_id}".`)
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
      ? requireLinkedRecord(restrictions, `Feature "${id}" is linked to missing restriction facet "${row.restriction_id}".`)
      : undefined,
    order: row.sort_order,
    availableAtLevel: row.available_at_level ?? undefined,
    optionChoices: optionChoiceRows.length > 0
      ? optionChoiceRows.map((choice) => ({
          level: choice.level,
          count: choice.count,
          replaceCount: choice.replace_count ?? undefined
        }))
      : undefined,
    options: authoredOptions.length > 0 ? authoredOptions : undefined
  }
}

async function hydrateFeatureByIdTyped<N extends NodeSubjectCode>(
  db: DBLike,
  id: string
): Promise<FeatureAuthored<N> | null> {
  return hydrateFeatureById(db, id) as Promise<FeatureAuthored<N> | null>
}

export function createFeatureRepository<N extends NodeSubjectCode = NodeSubjectCode>(
  db: DBLike,
  defaultSystemId?: string
): FeatureRepository<N> {
  return {
    async upsert(entity) {
      await upsertFeature<N>(db, entity, defaultSystemId)
    },

    async findById(id) {
      return hydrateFeatureByIdTyped<N>(db, id)
    },

    async findAll() {
      const rows = await db
        .selectFrom('features')
        .select('id')
        .orderBy('sort_order')
        .execute()

      const records = await Promise.all(rows.map((row) => hydrateFeatureByIdTyped<N>(db, row.id)))
      return records.filter((record): record is FeatureAuthored<N> => record !== null)
    }
  }
}
