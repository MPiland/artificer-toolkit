import type { FeatAuthored } from '@artificer-toolkit/shared'
import type { DBLike } from '#types'
import { upsertFeat } from '../upserts/feat.js'
import { createEffectRepository } from '../../effects/repositories/effect.js'
import { createFeatureRepository } from '../../features/repositories/feature.js'
import { hydrateChargeById } from '../../grants/repositories/helpers.js'
import { hydrateFacetById } from '../../shared/facets.js'
import { createModifierGrantRepository } from '../../grants/repositories/modifier.js'
import { createProficiencyGrantRepository } from '../../grants/repositories/proficiency.js'
import { createSenseGrantRepository } from '../../grants/repositories/sense.js'
import { createSpellGrantRepository } from '../../grants/repositories/spell.js'
import type { FeatRepository, RepositoryFindAllOptions } from '../../../repositories/contracts.js'
import { hydrateSubjectStatus } from '../status.js'

function requireLinkedRecord<T>(
  value: T | null,
  message: string
): T {
  if (value === null) {
    throw new Error(message)
  }

  return value
}

async function hydrateFeatById(
  db: DBLike,
  id: string
): Promise<FeatAuthored | null> {
  const row = await db
    .selectFrom('feats')
    .select([
      'id',
      'system_id',
      'user_id',
      'label',
      'description',
      'detail',
      'status',
      'prerequisite_id',
      'charge_id'
    ])
    .where('id', '=', id)
    .executeTakeFirst()

  if (!row) return null
  if (!row.user_id) {
    throw new Error(`Feat "${id}" is missing user ownership and cannot be hydrated.`)
  }

  const [effectLinks] = await Promise.all([
    db.selectFrom('feat_effects')
      .select(['effect_id', 'sort_order'])
      .where('feat_id', '=', id)
      .orderBy('sort_order')
      .execute()
  ])

  const effectRepository = createEffectRepository(db)
  const featureRepository = createFeatureRepository(db, row.system_id)
  const modifierRepository = createModifierGrantRepository(db)
  const proficiencyRepository = createProficiencyGrantRepository(db)
  const senseRepository = createSenseGrantRepository(db)
  const spellRepository = createSpellGrantRepository(db)

  const [
    charge,
    prerequisite,
    effects,
    featureLinksOrdered,
    proficiencyLinks,
    senseLinks,
    spellLinks,
    modifierLinks
  ] = await Promise.all([
    row.charge_id ? hydrateChargeById(db, row.charge_id) : Promise.resolve(null),
    row.prerequisite_id ? hydrateFacetById<'CHARACTER'>(db, row.prerequisite_id) : Promise.resolve(null),
    Promise.all(effectLinks.map((link) => effectRepository.findById(link.effect_id))),
    db.selectFrom('feat_features')
      .select(['feature_id', 'sort_order'])
      .where('feat_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('feat_proficiency_grants')
      .select(['proficiency_grant_id', 'sort_order'])
      .where('feat_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('feat_sense_grants')
      .select(['sense_grant_id', 'sort_order'])
      .where('feat_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('feat_spell_grants')
      .select(['spell_grant_id', 'sort_order'])
      .where('feat_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('feat_modifier_grants')
      .select(['modifier_grant_id', 'sort_order'])
      .where('feat_id', '=', id)
      .orderBy('sort_order')
      .execute()
  ])

  const [
    features,
    proficiencies,
    senses,
    spells,
    modifiers
  ] = await Promise.all([
    Promise.all(featureLinksOrdered.map((link) => featureRepository.findById(link.feature_id))),
    Promise.all(proficiencyLinks.map((link) => proficiencyRepository.findById(link.proficiency_grant_id))),
    Promise.all(senseLinks.map((link) => senseRepository.findById(link.sense_grant_id))),
    Promise.all(spellLinks.map((link) => spellRepository.findById(link.spell_grant_id))),
    Promise.all(modifierLinks.map((link) => modifierRepository.findById(link.modifier_grant_id)))
  ])

  const authoredFeatures = features.map((feature, index) => requireLinkedRecord(feature, `Feat "${id}" is linked to missing feature "${featureLinksOrdered[index]?.feature_id}".`))
  const authoredEffects = effects.map((effect, index) => requireLinkedRecord(effect, `Feat "${id}" is linked to missing effect "${effectLinks[index]?.effect_id}".`))
  const authoredProficiencies = proficiencies.map((grant, index) => requireLinkedRecord(grant, `Feat "${id}" is linked to missing proficiency grant "${proficiencyLinks[index]?.proficiency_grant_id}".`))
  const authoredSenses = senses.map((grant, index) => requireLinkedRecord(grant, `Feat "${id}" is linked to missing sense grant "${senseLinks[index]?.sense_grant_id}".`))
  const authoredSpells = spells.map((grant, index) => requireLinkedRecord(grant, `Feat "${id}" is linked to missing spell grant "${spellLinks[index]?.spell_grant_id}".`))
  const authoredModifiers = modifiers.map((grant, index) => requireLinkedRecord(grant, `Feat "${id}" is linked to missing modifier grant "${modifierLinks[index]?.modifier_grant_id}".`))
  const authoredCharge = row.charge_id
    ? requireLinkedRecord(charge, `Feat "${id}" is linked to missing charge "${row.charge_id}".`)
    : null

  return {
    id: row.id,
    label: row.label,
    description: row.description,
    detail: row.detail ?? undefined,
    status: hydrateSubjectStatus(row.status),
    prerequisites: prerequisite ?? undefined,
    effects: authoredEffects.length > 0 ? authoredEffects : undefined,
    features: authoredFeatures.length > 0 ? authoredFeatures : undefined,
    charges: authoredCharge ?? undefined,
    grants:
      authoredProficiencies.length > 0
      || authoredModifiers.length > 0
      || authoredSenses.length > 0
      || authoredSpells.length > 0
        ? {
            modifiers: authoredModifiers.length > 0 ? authoredModifiers : undefined,
            proficiencies: authoredProficiencies.length > 0 ? authoredProficiencies : undefined,
            senses: authoredSenses.length > 0 ? authoredSenses : undefined,
            spells: authoredSpells.length > 0 ? authoredSpells : undefined
          }
        : undefined,
    userId: row.user_id,
    systemId: row.system_id
  }
}

export function createFeatRepository(db: DBLike): FeatRepository {
  return {
    async upsert(entity) {
      await upsertFeat(db, entity, entity.systemId)
    },

    async findById(id) {
      return hydrateFeatById(db, id)
    },

    async findAll(filter?: RepositoryFindAllOptions) {
      let query = db
        .selectFrom('feats')
        .select('id')
        .orderBy('label')

      if (filter?.systemId) {
        query = query.where('system_id', '=', filter.systemId)
      }

      if (filter?.userId) {
        query = query.where('user_id', '=', filter.userId)
      }

      const rows = await query.execute()
      const records = await Promise.all(rows.map((row) => hydrateFeatById(db, row.id)))
      return records.filter((record): record is FeatAuthored => record !== null)
    }
  }
}



