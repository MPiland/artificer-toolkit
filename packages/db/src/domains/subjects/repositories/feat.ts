import type { DetailAuthored, FeatAuthored } from '@artificer-toolkit/shared'
import type { DBLike } from '#types'
import { upsertFeat } from '../upserts/feat.js'
import { createEffectRepository } from '../../effects/repositories/effect.js'
import { createFeatureRepository } from '../../features/repositories/feature.js'
import { hydrateChargesByIds } from '../../grants/repositories/helpers.js'
import { hydrateFacetById } from '../../shared/facets.js'
import { createDetailRepository } from '../../shared/repositories/detail.js'
import { createFeatGrantRepository } from '../../grants/repositories/feat.js'
import { createModifierGrantRepository } from '../../grants/repositories/modifier.js'
import { createProficiencyGrantRepository } from '../../grants/repositories/proficiency.js'
import { createSenseGrantRepository } from '../../grants/repositories/sense.js'
import { createSpellGrantRepository } from '../../grants/repositories/spell.js'
import type { FeatRepository, RepositoryFindAllOptions } from '../../../repositories/contracts.js'
import { hydrateByIds, orderedHydratedRecords, uniqueIds } from '../../../repositories/batch.js'
import { hydrateSubjectStatus } from '../status.js'

export interface FeatRepositoryReadOptions extends RepositoryFindAllOptions {
  allowedFeatureIds?: ReadonlySet<string>
  includeEffects?: boolean
}

export type FeatRepositoryWithReadOptions = Omit<FeatRepository, 'findById' | 'findByIds'> & {
  findById(id: string, filter?: FeatRepositoryReadOptions): Promise<FeatAuthored | null>
  findByIds(
    ids: readonly string[],
    filter?: FeatRepositoryReadOptions
  ): Promise<Map<string, FeatAuthored>>
}

const FEAT_COLUMNS = [
  'id',
  'system_id',
  'user_id',
  'label',
  'description',
  'status',
  'prerequisite_id',
  'charge_id'
] as const

type FeatRow = {
  id: string
  system_id: string
  user_id: string | null
  label: string
  description: string
  status: string
  prerequisite_id: string | null
  charge_id: string | null
}

type FeatOwnedRow = { feat_id: string }

function requireLinkedRecord<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw new Error(message)
  }

  return value
}

async function hydrateFeatById(
  db: DBLike,
  id: string,
  options: FeatRepositoryReadOptions = {}
): Promise<FeatAuthored | null> {
  const featsById = await hydrateFeatsByIds(db, [id], options)
  return featsById.get(id) ?? null
}

function groupFeatRows<T extends FeatOwnedRow>(rows: readonly T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>()

  for (const row of rows) {
    const bucket = grouped.get(row.feat_id)
    if (bucket) {
      bucket.push(row)
    } else {
      grouped.set(row.feat_id, [row])
    }
  }

  return grouped
}

async function hydrateFeatRows(
  db: DBLike,
  rows: readonly FeatRow[],
  options: FeatRepositoryReadOptions = {}
): Promise<Map<string, FeatAuthored>> {
  const expectedSystemId =
    rows.length > 0 && rows.every((row) => row.system_id === rows[0]?.system_id)
      ? rows[0]?.system_id
      : undefined
  const featIds = rows.map((row) => row.id)
  if (featIds.length === 0) {
    return new Map()
  }

  const [
    effectLinks,
    detailLinks,
    featureLinks,
    featGrantLinks,
    proficiencyLinks,
    senseLinks,
    spellLinks,
    modifierLinks,
    chargesById,
    prerequisitesById
  ] = await Promise.all([
    options.includeEffects === false
      ? Promise.resolve([])
      : db
          .selectFrom('feat_effects')
          .select(['feat_id', 'effect_id', 'sort_order'])
          .where('feat_id', 'in', featIds)
          .orderBy('sort_order')
          .execute(),
    db
      .selectFrom('feat_details')
      .select(['feat_id', 'detail_id', 'sort_order'])
      .where('feat_id', 'in', featIds)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('feat_features')
      .select(['feat_id', 'feature_id', 'sort_order'])
      .where('feat_id', 'in', featIds)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('feat_feat_grants')
      .select(['feat_id', 'feat_grant_id', 'sort_order'])
      .where('feat_id', 'in', featIds)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('feat_proficiency_grants')
      .select(['feat_id', 'proficiency_grant_id', 'sort_order'])
      .where('feat_id', 'in', featIds)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('feat_sense_grants')
      .select(['feat_id', 'sense_grant_id', 'sort_order'])
      .where('feat_id', 'in', featIds)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('feat_spell_grants')
      .select(['feat_id', 'spell_grant_id', 'sort_order'])
      .where('feat_id', 'in', featIds)
      .orderBy('sort_order')
      .execute(),
    db
      .selectFrom('feat_modifier_grants')
      .select(['feat_id', 'modifier_grant_id', 'sort_order'])
      .where('feat_id', 'in', featIds)
      .orderBy('sort_order')
      .execute(),
    hydrateChargesByIds(
      db,
      rows.flatMap((row) => (row.charge_id ? [row.charge_id] : []))
    ),
    hydrateByIds(
      rows.flatMap((row) => (row.prerequisite_id ? [row.prerequisite_id] : [])),
      (prerequisiteId) => hydrateFacetById<'CHARACTER'>(db, prerequisiteId)
    )
  ])
  const effectRepository = createEffectRepository(db, expectedSystemId)
  const detailRepository = createDetailRepository(db)
  const featGrantRepository = createFeatGrantRepository(db)
  const modifierRepository = createModifierGrantRepository(db)
  const proficiencyRepository = createProficiencyGrantRepository(db)
  const senseRepository = createSenseGrantRepository(db)
  const spellRepository = createSpellGrantRepository(db)
  const selectedFeatureLinks = options.allowedFeatureIds
    ? featureLinks.filter((link) => options.allowedFeatureIds?.has(link.feature_id))
    : featureLinks
  const featureLinksByFeat = groupFeatRows(selectedFeatureLinks)

  const [
    effectsById,
    detailsById,
    featsById,
    proficienciesById,
    sensesById,
    spellsById,
    modifiersById,
    featuresById
  ] = await Promise.all([
    options.includeEffects === false
      ? Promise.resolve(new Map<string, NonNullable<FeatAuthored['effects']>[number]>())
      : effectRepository.findByIds(effectLinks.map((link) => link.effect_id)),
    detailRepository.findByIds(detailLinks.map((link) => link.detail_id)),
    featGrantRepository.findByIds(featGrantLinks.map((link) => link.feat_grant_id)),
    proficiencyRepository.findByIds(proficiencyLinks.map((link) => link.proficiency_grant_id)),
    senseRepository.findByIds(senseLinks.map((link) => link.sense_grant_id)),
    spellRepository.findByIds(spellLinks.map((link) => link.spell_grant_id)),
    modifierRepository.findByIds(modifierLinks.map((link) => link.modifier_grant_id)),
    createFeatureRepository(db, expectedSystemId).findByIds(
      selectedFeatureLinks.map((link) => link.feature_id),
      { includeEffects: options.includeEffects }
    )
  ])
  const effectLinksByFeat = groupFeatRows(effectLinks)
  const detailLinksByFeat = groupFeatRows(detailLinks)
  const featGrantLinksByFeat = groupFeatRows(featGrantLinks)
  const proficiencyLinksByFeat = groupFeatRows(proficiencyLinks)
  const senseLinksByFeat = groupFeatRows(senseLinks)
  const spellLinksByFeat = groupFeatRows(spellLinks)
  const modifierLinksByFeat = groupFeatRows(modifierLinks)
  const authoredById = new Map<string, FeatAuthored>()

  for (const row of rows) {
    if (!row.user_id) {
      throw new Error(`Feat "${row.id}" is missing user ownership and cannot be hydrated.`)
    }

    const id = row.id
    const authoredFeatures = (featureLinksByFeat.get(id) ?? []).map((link) =>
      requireLinkedRecord(
        featuresById.get(link.feature_id),
        `Feat "${id}" is linked to missing feature "${link.feature_id}".`
      )
    )
    const authoredFeatGrants = (featGrantLinksByFeat.get(id) ?? []).map((link) =>
      requireLinkedRecord(
        featsById.get(link.feat_grant_id),
        `Feat "${id}" is linked to missing feat grant "${link.feat_grant_id}".`
      )
    )
    const authoredEffects = (effectLinksByFeat.get(id) ?? []).map((link) =>
      requireLinkedRecord(
        effectsById.get(link.effect_id),
        `Feat "${id}" is linked to missing effect "${link.effect_id}".`
      )
    )
    const authoredDetails: DetailAuthored[] = (detailLinksByFeat.get(id) ?? []).map((link) =>
      requireLinkedRecord(
        detailsById.get(link.detail_id),
        `Feat "${id}" is linked to missing detail "${link.detail_id}".`
      )
    )
    const authoredProficiencies = (proficiencyLinksByFeat.get(id) ?? []).map((link) =>
      requireLinkedRecord(
        proficienciesById.get(link.proficiency_grant_id),
        `Feat "${id}" is linked to missing proficiency grant "${link.proficiency_grant_id}".`
      )
    )
    const authoredSenses = (senseLinksByFeat.get(id) ?? []).map((link) =>
      requireLinkedRecord(
        sensesById.get(link.sense_grant_id),
        `Feat "${id}" is linked to missing sense grant "${link.sense_grant_id}".`
      )
    )
    const authoredSpells = (spellLinksByFeat.get(id) ?? []).map((link) =>
      requireLinkedRecord(
        spellsById.get(link.spell_grant_id),
        `Feat "${id}" is linked to missing spell grant "${link.spell_grant_id}".`
      )
    )
    const authoredModifiers = (modifierLinksByFeat.get(id) ?? []).map((link) =>
      requireLinkedRecord(
        modifiersById.get(link.modifier_grant_id),
        `Feat "${id}" is linked to missing modifier grant "${link.modifier_grant_id}".`
      )
    )
    const authoredCharge = row.charge_id
      ? requireLinkedRecord(
          chargesById.get(row.charge_id),
          `Feat "${id}" is linked to missing charge "${row.charge_id}".`
        )
      : null

    authoredById.set(id, {
      id,
      label: row.label,
      description: row.description,
      details: authoredDetails.length > 0 ? authoredDetails : undefined,
      status: hydrateSubjectStatus(row.status),
      prerequisites: row.prerequisite_id ? prerequisitesById.get(row.prerequisite_id) : undefined,
      effects: authoredEffects.length > 0 ? authoredEffects : undefined,
      features: authoredFeatures.length > 0 ? authoredFeatures : undefined,
      charges: authoredCharge ?? undefined,
      grants:
        authoredFeatGrants.length > 0 ||
        authoredProficiencies.length > 0 ||
        authoredModifiers.length > 0 ||
        authoredSenses.length > 0 ||
        authoredSpells.length > 0
          ? {
              feats: authoredFeatGrants.length > 0 ? authoredFeatGrants : undefined,
              modifiers: authoredModifiers.length > 0 ? authoredModifiers : undefined,
              proficiencies: authoredProficiencies.length > 0 ? authoredProficiencies : undefined,
              senses: authoredSenses.length > 0 ? authoredSenses : undefined,
              spells: authoredSpells.length > 0 ? authoredSpells : undefined
            }
          : undefined,
      userId: row.user_id,
      systemId: row.system_id
    })
  }

  return authoredById
}

async function hydrateFeatsByIds(
  db: DBLike,
  ids: readonly string[],
  options: FeatRepositoryReadOptions = {}
): Promise<Map<string, FeatAuthored>> {
  const distinctIds = uniqueIds(ids)
  if (distinctIds.length === 0) {
    return new Map()
  }

  const rows = (await db
    .selectFrom('feats')
    .select(FEAT_COLUMNS)
    .where('id', 'in', distinctIds)
    .execute()) as FeatRow[]
  const rowsById = new Map(rows.map((row) => [row.id, row]))

  return hydrateFeatRows(
    db,
    distinctIds.flatMap((id) => {
      const row = rowsById.get(id)
      return row ? [row] : []
    }),
    options
  )
}

export function createFeatRepository(db: DBLike): FeatRepositoryWithReadOptions {
  return {
    async upsert(entity, options) {
      await upsertFeat(db, entity, entity.systemId, options.contentSourceId)
    },

    async findById(id, filter) {
      return hydrateFeatById(db, id, filter)
    },

    async findByIds(ids, filter) {
      return hydrateFeatsByIds(db, ids, filter)
    },

    async findAll(filter?: RepositoryFindAllOptions) {
      let query = db.selectFrom('feats').select(FEAT_COLUMNS).orderBy('label')

      if (filter?.systemId) {
        query = query.where('system_id', '=', filter.systemId)
      }

      if (filter?.userId) {
        query = query.where('user_id', '=', filter.userId)
      }

      const rows = await query.execute()
      return orderedHydratedRecords(
        rows.map((row) => row.id),
        await hydrateFeatRows(db, rows as FeatRow[])
      )
    }
  }
}
