import type {
  ChargeAuthored,
  EffectAuthored,
  FeatGrantAuthored,
  FacetAuthored,
  FeatureAuthored,
  ModifierGrantAuthored,
  NodeSubjectCode,
  OptionAuthored,
  ProficiencyGrantAuthored,
  SenseGrantAuthored,
  SpellGrantAuthored
} from '@artificer-toolkit/shared'
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
import { hydrateByIds, orderedHydratedRecords, uniqueIds } from '../../../repositories/batch.js'

type FeatureRow = {
  id: string
  label: string
  description: string
  detail: string | null
  charge_id: string | null
  restriction_id: string | null
  sort_order: number
  available_at_level: number | null
}

type FeatureEffectLinkRow = {
  feature_id: string
  effect_id: string
}

type FeatureGrantLinkRow = {
  feature_id: string
  sort_order: number
}

type FeatureFeatGrantLinkRow = FeatureGrantLinkRow & {
  feat_grant_id: string
}

type FeatureModifierGrantLinkRow = FeatureGrantLinkRow & {
  modifier_grant_id: string
}

type FeatureProficiencyGrantLinkRow = FeatureGrantLinkRow & {
  proficiency_grant_id: string
}

type FeatureSenseGrantLinkRow = FeatureGrantLinkRow & {
  sense_grant_id: string
}

type FeatureSpellGrantLinkRow = FeatureGrantLinkRow & {
  spell_grant_id: string
}

type FeatureOptionLinkRow = FeatureGrantLinkRow & {
  option_id: string
}

type FeatureAttributeRow = FeatureGrantLinkRow & {
  attribute_code: string
}

type FeatureOptionChoiceRow = FeatureGrantLinkRow & {
  level: number
  count: number
  replace_count: number | null
}

function requireLinkedRecord<T>(
  value: T | null,
  message: string
): T {
  if (value === null) {
    throw new Error(message)
  }

  return value
}

function hydrateLinkedRecords<Link, Record>(
  links: readonly Link[],
  recordsById: ReadonlyMap<string, Record>,
  getId: (link: Link) => string,
  buildMessage: (linkedId: string) => string
): Record[] {
  return links.map((link) => {
    const linkedId = getId(link)
    return requireLinkedRecord(
      recordsById.get(linkedId) ?? null,
      buildMessage(linkedId)
    )
  })
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

function groupByFeatureId<T extends { feature_id: string }>(rows: readonly T[]): Map<string, T[]> {
  const rowsByFeatureId = new Map<string, T[]>()

  for (const row of rows) {
    rowsByFeatureId.set(row.feature_id, [...(rowsByFeatureId.get(row.feature_id) ?? []), row])
  }

  return rowsByFeatureId
}

function orderedFeatureRows(rows: readonly FeatureRow[], ids: readonly string[]): FeatureRow[] {
  const rowsById = new Map(rows.map((row) => [row.id, row]))

  return ids.flatMap((id) => {
    const row = rowsById.get(id)
    return row ? [row] : []
  })
}

async function hydrateFeaturesByIds<N extends NodeSubjectCode>(
  db: DBLike,
  ids: readonly string[]
): Promise<Map<string, FeatureAuthored<N>>> {
  const distinctIds = uniqueIds(ids)
  if (distinctIds.length === 0) {
    return new Map()
  }

  const rows = await db
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
    .where('id', 'in', distinctIds)
    .execute() as FeatureRow[]

  const featureIds = rows.map((row) => row.id)
  if (featureIds.length === 0) {
    return new Map()
  }

  const [
    effectLinks,
    attributeRows,
    featGrantLinks,
    modifierGrantLinks,
    proficiencyGrantLinks,
    senseGrantLinks,
    spellGrantLinks,
    optionLinks,
    optionChoiceRows
  ] = await Promise.all([
    db.selectFrom('feature_effects')
      .select(['feature_id', 'effect_id'])
      .where('feature_id', 'in', featureIds)
      .execute() as Promise<FeatureEffectLinkRow[]>,
    db.selectFrom('feature_attributes')
      .select(['feature_id', 'attribute_code', 'sort_order'])
      .where('feature_id', 'in', featureIds)
      .orderBy('sort_order')
      .execute() as Promise<FeatureAttributeRow[]>,
    db.selectFrom('feature_feat_grants')
      .select(['feature_id', 'feat_grant_id', 'sort_order'])
      .where('feature_id', 'in', featureIds)
      .orderBy('sort_order')
      .execute() as Promise<FeatureFeatGrantLinkRow[]>,
    db.selectFrom('feature_modifier_grants')
      .select(['feature_id', 'modifier_grant_id', 'sort_order'])
      .where('feature_id', 'in', featureIds)
      .orderBy('sort_order')
      .execute() as Promise<FeatureModifierGrantLinkRow[]>,
    db.selectFrom('feature_proficiency_grants')
      .select(['feature_id', 'proficiency_grant_id', 'sort_order'])
      .where('feature_id', 'in', featureIds)
      .orderBy('sort_order')
      .execute() as Promise<FeatureProficiencyGrantLinkRow[]>,
    db.selectFrom('feature_sense_grants')
      .select(['feature_id', 'sense_grant_id', 'sort_order'])
      .where('feature_id', 'in', featureIds)
      .orderBy('sort_order')
      .execute() as Promise<FeatureSenseGrantLinkRow[]>,
    db.selectFrom('feature_spell_grants')
      .select(['feature_id', 'spell_grant_id', 'sort_order'])
      .where('feature_id', 'in', featureIds)
      .orderBy('sort_order')
      .execute() as Promise<FeatureSpellGrantLinkRow[]>,
    db.selectFrom('feature_options')
      .select(['feature_id', 'option_id', 'sort_order'])
      .where('feature_id', 'in', featureIds)
      .orderBy('sort_order')
      .execute() as Promise<FeatureOptionLinkRow[]>,
    db.selectFrom('feature_option_levels')
      .select(['feature_id', 'level', 'count', 'replace_count', 'sort_order'])
      .where('feature_id', 'in', featureIds)
      .orderBy('sort_order')
      .execute() as Promise<FeatureOptionChoiceRow[]>
  ])

  const effectRepository = createEffectRepository(db)
  const featGrantRepository = createFeatGrantRepository(db)
  const modifierGrantRepository = createModifierGrantRepository(db)
  const proficiencyGrantRepository = createProficiencyGrantRepository(db)
  const senseGrantRepository = createSenseGrantRepository(db)
  const spellGrantRepository = createSpellGrantRepository(db)
  const optionRepository = createOptionRepository<NodeSubjectCode>(db)

  const [
    chargesById,
    restrictionsById,
    effectsById,
    featGrantsById,
    modifierGrantsById,
    proficiencyGrantsById,
    senseGrantsById,
    spellGrantsById,
    optionsById
  ] = await Promise.all([
    hydrateByIds(
      rows.flatMap((row) => row.charge_id ? [row.charge_id] : []),
      (chargeId) => hydrateChargeById(db, chargeId)
    ),
    hydrateByIds(
      rows.flatMap((row) => row.restriction_id ? [row.restriction_id] : []),
      (restrictionId) => hydrateFacetById(db, restrictionId)
    ),
    effectRepository.findByIds(effectLinks.map((link) => link.effect_id)),
    featGrantRepository.findByIds(featGrantLinks.map((link) => link.feat_grant_id)),
    modifierGrantRepository.findByIds(modifierGrantLinks.map((link) => link.modifier_grant_id)),
    proficiencyGrantRepository.findByIds(proficiencyGrantLinks.map((link) => link.proficiency_grant_id)),
    senseGrantRepository.findByIds(senseGrantLinks.map((link) => link.sense_grant_id)),
    spellGrantRepository.findByIds(spellGrantLinks.map((link) => link.spell_grant_id)),
    optionRepository.findByIds(optionLinks.map((link) => link.option_id))
  ])

  const effectLinksByFeatureId = groupByFeatureId(effectLinks)
  const attributeRowsByFeatureId = groupByFeatureId(attributeRows)
  const featGrantLinksByFeatureId = groupByFeatureId(featGrantLinks)
  const modifierGrantLinksByFeatureId = groupByFeatureId(modifierGrantLinks)
  const proficiencyGrantLinksByFeatureId = groupByFeatureId(proficiencyGrantLinks)
  const senseGrantLinksByFeatureId = groupByFeatureId(senseGrantLinks)
  const spellGrantLinksByFeatureId = groupByFeatureId(spellGrantLinks)
  const optionLinksByFeatureId = groupByFeatureId(optionLinks)
  const optionChoiceRowsByFeatureId = groupByFeatureId(optionChoiceRows)
  const recordsById = new Map<string, FeatureAuthored<N>>()

  for (const row of orderedFeatureRows(rows, distinctIds)) {
    const id = row.id
    const featureEffectLinks = effectLinksByFeatureId.get(id) ?? []
    const featureFeatGrantLinks = featGrantLinksByFeatureId.get(id) ?? []
    const featureModifierGrantLinks = modifierGrantLinksByFeatureId.get(id) ?? []
    const featureProficiencyGrantLinks = proficiencyGrantLinksByFeatureId.get(id) ?? []
    const featureSenseGrantLinks = senseGrantLinksByFeatureId.get(id) ?? []
    const featureSpellGrantLinks = spellGrantLinksByFeatureId.get(id) ?? []
    const featureOptionLinks = optionLinksByFeatureId.get(id) ?? []
    const authoredEffects: EffectAuthored[] = hydrateLinkedRecords(
      featureEffectLinks,
      effectsById,
      (link) => link.effect_id,
      (linkedId) => `Feature "${id}" is linked to missing effect "${linkedId}".`
    )
    const authoredFeatGrants: FeatGrantAuthored[] = hydrateLinkedRecords(
      featureFeatGrantLinks,
      featGrantsById,
      (link) => link.feat_grant_id,
      (linkedId) => `Feature "${id}" is linked to missing feat grant "${linkedId}".`
    )
    const authoredModifierGrants: ModifierGrantAuthored[] = hydrateLinkedRecords(
      featureModifierGrantLinks,
      modifierGrantsById,
      (link) => link.modifier_grant_id,
      (linkedId) => `Feature "${id}" is linked to missing modifier grant "${linkedId}".`
    )
    const authoredProficiencyGrants: ProficiencyGrantAuthored[] = hydrateLinkedRecords(
      featureProficiencyGrantLinks,
      proficiencyGrantsById,
      (link) => link.proficiency_grant_id,
      (linkedId) => `Feature "${id}" is linked to missing proficiency grant "${linkedId}".`
    )
    const authoredSenseGrants: SenseGrantAuthored[] = hydrateLinkedRecords(
      featureSenseGrantLinks,
      senseGrantsById,
      (link) => link.sense_grant_id,
      (linkedId) => `Feature "${id}" is linked to missing sense grant "${linkedId}".`
    )
    const authoredSpellGrants: SpellGrantAuthored[] = hydrateLinkedRecords(
      featureSpellGrantLinks,
      spellGrantsById,
      (link) => link.spell_grant_id,
      (linkedId) => `Feature "${id}" is linked to missing spell grant "${linkedId}".`
    )
    const authoredOptions: OptionAuthored[] = hydrateLinkedRecords(
      featureOptionLinks,
      optionsById,
      (link) => link.option_id,
      (linkedId) => `Feature "${id}" is linked to missing option "${linkedId}".`
    )
    const charge = row.charge_id ? chargesById.get(row.charge_id) ?? null : null
    const restrictions = row.restriction_id ? restrictionsById.get(row.restriction_id) ?? null : null

    recordsById.set(id, {
      id,
      label: row.label,
      description: row.description,
      attributes: (attributeRowsByFeatureId.get(id) ?? []).length > 0
        ? (attributeRowsByFeatureId.get(id) ?? []).map((attribute) => requireFeatureAttribute(id, attribute.attribute_code))
        : undefined,
      detail: row.detail ?? undefined,
      effects: authoredEffects.length > 0 ? authoredEffects : undefined,
      charges: row.charge_id
        ? requireLinkedRecord(charge as ChargeAuthored | null, `Feature "${id}" is linked to missing charge "${row.charge_id}".`)
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
        ? requireLinkedRecord(restrictions as FacetAuthored<N> | null, `Feature "${id}" is linked to missing restriction facet "${row.restriction_id}".`)
        : undefined,
      order: row.sort_order,
      availableAtLevel: row.available_at_level ?? undefined,
      optionChoices: (optionChoiceRowsByFeatureId.get(id) ?? []).length > 0
        ? (optionChoiceRowsByFeatureId.get(id) ?? []).map((choice) => ({
            level: choice.level,
            count: choice.count,
            replaceCount: choice.replace_count ?? undefined
          }))
        : undefined,
      options: authoredOptions.length > 0 ? authoredOptions : undefined
    } as FeatureAuthored<N>)
  }

  return recordsById
}

export async function hydrateFeatureById(
  db: DBLike,
  id: string
): Promise<FeatureAuthored | null> {
  const featuresById = await hydrateFeaturesByIds(db, [id])
  return featuresById.get(id) ?? null
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

    async findByIds(ids) {
      return hydrateFeaturesByIds<N>(db, ids)
    },

    async findAll() {
      const rows = await db
        .selectFrom('features')
        .select('id')
        .orderBy('sort_order')
        .execute()

      return orderedHydratedRecords(
        rows.map((row) => row.id),
        await hydrateFeaturesByIds<N>(db, rows.map((row) => row.id))
      )
    }
  }
}



