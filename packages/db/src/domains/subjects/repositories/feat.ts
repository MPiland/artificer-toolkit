import type { DetailAuthored, FeatAuthored } from '@artificer-toolkit/shared'
import type { DBLike } from '#types'
import { upsertFeat } from '../upserts/feat.js'
import { createEffectRepository } from '../../effects/repositories/effect.js'
import { createFeatureRepository } from '../../features/repositories/feature.js'
import { hydrateChargeById } from '../../grants/repositories/helpers.js'
import { hydrateFacetById } from '../../shared/facets.js'
import { createDetailRepository } from '../../shared/repositories/detail.js'
import { createModifierGrantRepository } from '../../grants/repositories/modifier.js'
import { createProficiencyGrantRepository } from '../../grants/repositories/proficiency.js'
import { createSenseGrantRepository } from '../../grants/repositories/sense.js'
import { createSpellGrantRepository } from '../../grants/repositories/spell.js'
import type { FeatRepository, RepositoryFindAllOptions } from '../../../repositories/contracts.js'
import { hydrateByIds, orderedHydratedRecords } from '../../../repositories/batch.js'
import { hydrateSubjectStatus } from '../status.js'

function requireLinkedRecord<T>(
  value: T | null | undefined,
  message: string
): T {
  if (value == null) {
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

  const [effectLinks, detailLinks] = await Promise.all([
    db.selectFrom('feat_effects')
      .select(['effect_id', 'sort_order'])
      .where('feat_id', '=', id)
      .orderBy('sort_order')
      .execute(),
    db.selectFrom('feat_details')
      .select(['detail_id', 'sort_order'])
      .where('feat_id', '=', id)
      .orderBy('sort_order')
      .execute()
  ])

  const effectRepository = createEffectRepository(db)
  const detailRepository = createDetailRepository(db)
  const featureRepository = createFeatureRepository(db, row.system_id)
  const modifierRepository = createModifierGrantRepository(db)
  const proficiencyRepository = createProficiencyGrantRepository(db)
  const senseRepository = createSenseGrantRepository(db)
  const spellRepository = createSpellGrantRepository(db)

  const [
    charge,
    prerequisite,
    effectsById,
    detailsById,
    featureLinksOrdered,
    proficiencyLinks,
    senseLinks,
    spellLinks,
    modifierLinks
  ] = await Promise.all([
    row.charge_id ? hydrateChargeById(db, row.charge_id) : Promise.resolve(null),
    row.prerequisite_id ? hydrateFacetById<'CHARACTER'>(db, row.prerequisite_id) : Promise.resolve(null),
    effectRepository.findByIds(effectLinks.map((link) => link.effect_id)),
    detailRepository.findByIds(detailLinks.map((link) => link.detail_id)),
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
    featuresById,
    proficienciesById,
    sensesById,
    spellsById,
    modifiersById
  ] = await Promise.all([
    featureRepository.findByIds(featureLinksOrdered.map((link) => link.feature_id)),
    proficiencyRepository.findByIds(proficiencyLinks.map((link) => link.proficiency_grant_id)),
    senseRepository.findByIds(senseLinks.map((link) => link.sense_grant_id)),
    spellRepository.findByIds(spellLinks.map((link) => link.spell_grant_id)),
    modifierRepository.findByIds(modifierLinks.map((link) => link.modifier_grant_id))
  ])

  const authoredFeatures = featureLinksOrdered.map((link) => requireLinkedRecord(featuresById.get(link.feature_id), `Feat "${id}" is linked to missing feature "${link.feature_id}".`))
  const authoredEffects = effectLinks.map((link) => requireLinkedRecord(effectsById.get(link.effect_id), `Feat "${id}" is linked to missing effect "${link.effect_id}".`))
  const authoredDetails: DetailAuthored[] = detailLinks.map((link) => requireLinkedRecord(detailsById.get(link.detail_id), `Feat "${id}" is linked to missing detail "${link.detail_id}".`))
  const authoredProficiencies = proficiencyLinks.map((link) => requireLinkedRecord(proficienciesById.get(link.proficiency_grant_id), `Feat "${id}" is linked to missing proficiency grant "${link.proficiency_grant_id}".`))
  const authoredSenses = senseLinks.map((link) => requireLinkedRecord(sensesById.get(link.sense_grant_id), `Feat "${id}" is linked to missing sense grant "${link.sense_grant_id}".`))
  const authoredSpells = spellLinks.map((link) => requireLinkedRecord(spellsById.get(link.spell_grant_id), `Feat "${id}" is linked to missing spell grant "${link.spell_grant_id}".`))
  const authoredModifiers = modifierLinks.map((link) => requireLinkedRecord(modifiersById.get(link.modifier_grant_id), `Feat "${id}" is linked to missing modifier grant "${link.modifier_grant_id}".`))
  const authoredCharge = row.charge_id
    ? requireLinkedRecord(charge, `Feat "${id}" is linked to missing charge "${row.charge_id}".`)
    : null

  return {
    id: row.id,
    label: row.label,
    description: row.description,
    details: authoredDetails.length > 0 ? authoredDetails : undefined,
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

    async findByIds(ids) {
      return hydrateByIds(ids, (id) => hydrateFeatById(db, id))
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
      return orderedHydratedRecords(
        rows.map((row) => row.id),
        await hydrateByIds(rows.map((row) => row.id), (id) => hydrateFeatById(db, id))
      )
    }
  }
}



