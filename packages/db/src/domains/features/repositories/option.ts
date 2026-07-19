import type {
  ChargeAuthored,
  DetailAuthored,
  EffectAuthored,
  FacetAuthored,
  FeatGrantAuthored,
  ModifierGrantAuthored,
  NodeSubjectCode,
  OptionAuthored,
  ProficiencyGrantAuthored,
  SenseGrantAuthored,
  SpellGrantAuthored
} from '@artificer-toolkit/shared'
import { FEATURE_ATTRIBUTE } from '@artificer-toolkit/shared'
import type { DBLike } from '#types'
import { upsertOption } from '../upserts/option.js'
import { hydrateFacetById } from '../../shared/facets.js'
import { hydrateChargesByIds } from '../../grants/repositories/helpers.js'
import { createEffectRepository } from '../../effects/repositories/effect.js'
import { createFeatGrantRepository } from '../../grants/repositories/feat.js'
import { createModifierGrantRepository } from '../../grants/repositories/modifier.js'
import { createProficiencyGrantRepository } from '../../grants/repositories/proficiency.js'
import { createSenseGrantRepository } from '../../grants/repositories/sense.js'
import { createSpellGrantRepository } from '../../grants/repositories/spell.js'
import { createDetailRepository } from '../../shared/repositories/detail.js'
import type {
  OptionRepository,
  RepositoryFindAllOptions
} from '../../../repositories/contracts.js'
import { hydrateByIds, orderedHydratedRecords, uniqueIds } from '../../../repositories/batch.js'

export interface OptionRepositoryReadOptions extends RepositoryFindAllOptions {
  includeEffects?: boolean
}

export type OptionRepositoryWithReadOptions<N extends NodeSubjectCode = NodeSubjectCode> = Omit<
  OptionRepository<N>,
  'findById' | 'findByIds'
> & {
  findById(id: string, filter?: OptionRepositoryReadOptions): Promise<OptionAuthored<N> | null>
  findByIds(
    ids: readonly string[],
    filter?: OptionRepositoryReadOptions
  ): Promise<Map<string, OptionAuthored<N>>>
}

type OptionRow = {
  id: string
  label: string
  description: string
  charge_id: string | null
  restriction_id: string | null
  sort_order: number
}

type OptionEffectLinkRow = {
  option_id: string
  effect_id: string
}

type OptionDetailLinkRow = {
  option_id: string
  detail_id: string
  sort_order: number
}

type OptionGrantLinkRow = {
  option_id: string
  sort_order: number
}

type OptionFeatGrantLinkRow = OptionGrantLinkRow & {
  feat_grant_id: string
}

type OptionModifierGrantLinkRow = OptionGrantLinkRow & {
  modifier_grant_id: string
}

type OptionProficiencyGrantLinkRow = OptionGrantLinkRow & {
  proficiency_grant_id: string
}

type OptionSenseGrantLinkRow = OptionGrantLinkRow & {
  sense_grant_id: string
}

type OptionSpellGrantLinkRow = OptionGrantLinkRow & {
  spell_grant_id: string
}

type OptionAttributeRow = OptionGrantLinkRow & {
  attribute_code: string
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

function requireFeatureAttribute(
  optionId: string,
  value: string
): NonNullable<OptionAuthored['attributes']>[number] {
  if (!(value in FEATURE_ATTRIBUTE)) {
    throw new Error(`Option "${optionId}" has invalid attribute_code "${value}".`)
  }

  return value as NonNullable<OptionAuthored['attributes']>[number]
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

function groupByOptionId<T extends { option_id: string }>(rows: readonly T[]): Map<string, T[]> {
  const rowsByOptionId = new Map<string, T[]>()

  for (const row of rows) {
    rowsByOptionId.set(row.option_id, [...(rowsByOptionId.get(row.option_id) ?? []), row])
  }

  return rowsByOptionId
}

function orderedOptionRows(rows: readonly OptionRow[], ids: readonly string[]): OptionRow[] {
  const rowsById = new Map(rows.map((row) => [row.id, row]))

  return ids.flatMap((id) => {
    const row = rowsById.get(id)
    return row ? [row] : []
  })
}

async function hydrateOptionsByIds<N extends NodeSubjectCode>(
  db: DBLike,
  ids: readonly string[],
  options: OptionRepositoryReadOptions = {}
): Promise<Map<string, OptionAuthored<N>>> {
  const distinctIds = uniqueIds(ids)
  if (distinctIds.length === 0) {
    return new Map()
  }

  const rows = await db
    .selectFrom('options')
    .select([
      'id',
      'label',
      'description',
      'sort_order',
      'charge_id',
      'restriction_id'
    ])
    .where('id', 'in', distinctIds)
    .execute() as OptionRow[]

  const optionIds = rows.map((row) => row.id)
  if (optionIds.length === 0) {
    return new Map()
  }

  const [
    effectLinks,
    detailLinks,
    attributeRows,
    featGrantLinks,
    modifierGrantLinks,
    proficiencyGrantLinks,
    senseGrantLinks,
    spellGrantLinks
  ] = await Promise.all([
    options.includeEffects === false
      ? Promise.resolve([] as OptionEffectLinkRow[])
      : db.selectFrom('option_effects')
          .select(['option_id', 'effect_id'])
          .where('option_id', 'in', optionIds)
          .execute() as Promise<OptionEffectLinkRow[]>,
    db.selectFrom('option_details')
      .select(['option_id', 'detail_id', 'sort_order'])
      .where('option_id', 'in', optionIds)
      .orderBy('sort_order')
      .execute() as Promise<OptionDetailLinkRow[]>,
    db.selectFrom('option_attributes')
      .select(['option_id', 'attribute_code', 'sort_order'])
      .where('option_id', 'in', optionIds)
      .orderBy('sort_order')
      .execute() as Promise<OptionAttributeRow[]>,
    db.selectFrom('option_feat_grants')
      .select(['option_id', 'feat_grant_id', 'sort_order'])
      .where('option_id', 'in', optionIds)
      .orderBy('sort_order')
      .execute() as Promise<OptionFeatGrantLinkRow[]>,
    db.selectFrom('option_modifier_grants')
      .select(['option_id', 'modifier_grant_id', 'sort_order'])
      .where('option_id', 'in', optionIds)
      .orderBy('sort_order')
      .execute() as Promise<OptionModifierGrantLinkRow[]>,
    db.selectFrom('option_proficiency_grants')
      .select(['option_id', 'proficiency_grant_id', 'sort_order'])
      .where('option_id', 'in', optionIds)
      .orderBy('sort_order')
      .execute() as Promise<OptionProficiencyGrantLinkRow[]>,
    db.selectFrom('option_sense_grants')
      .select(['option_id', 'sense_grant_id', 'sort_order'])
      .where('option_id', 'in', optionIds)
      .orderBy('sort_order')
      .execute() as Promise<OptionSenseGrantLinkRow[]>,
    db.selectFrom('option_spell_grants')
      .select(['option_id', 'spell_grant_id', 'sort_order'])
      .where('option_id', 'in', optionIds)
      .orderBy('sort_order')
      .execute() as Promise<OptionSpellGrantLinkRow[]>
  ])

  const detailRepository = createDetailRepository(db)
  const featGrantRepository = createFeatGrantRepository(db)
  const modifierGrantRepository = createModifierGrantRepository(db)
  const proficiencyGrantRepository = createProficiencyGrantRepository(db)
  const senseGrantRepository = createSenseGrantRepository(db)
  const spellGrantRepository = createSpellGrantRepository(db)

  const [
    chargesById,
    restrictionsById,
    effectsById,
    detailsById,
    featGrantsById,
    modifierGrantsById,
    proficiencyGrantsById,
    senseGrantsById,
    spellGrantsById
  ] = await Promise.all([
    hydrateChargesByIds(db, rows.flatMap((row) => row.charge_id ? [row.charge_id] : [])),
    hydrateByIds(
      rows.flatMap((row) => row.restriction_id ? [row.restriction_id] : []),
      (restrictionId) => hydrateFacetById(db, restrictionId)
    ),
    options.includeEffects === false
      ? Promise.resolve(new Map<string, EffectAuthored>())
      : createEffectRepository(db).findByIds(effectLinks.map((link) => link.effect_id)),
    detailRepository.findByIds(detailLinks.map((link) => link.detail_id)),
    featGrantRepository.findByIds(featGrantLinks.map((link) => link.feat_grant_id)),
    modifierGrantRepository.findByIds(modifierGrantLinks.map((link) => link.modifier_grant_id)),
    proficiencyGrantRepository.findByIds(proficiencyGrantLinks.map((link) => link.proficiency_grant_id)),
    senseGrantRepository.findByIds(senseGrantLinks.map((link) => link.sense_grant_id)),
    spellGrantRepository.findByIds(spellGrantLinks.map((link) => link.spell_grant_id))
  ])

  const effectLinksByOptionId = groupByOptionId(effectLinks)
  const detailLinksByOptionId = groupByOptionId(detailLinks)
  const attributeRowsByOptionId = groupByOptionId(attributeRows)
  const featGrantLinksByOptionId = groupByOptionId(featGrantLinks)
  const modifierGrantLinksByOptionId = groupByOptionId(modifierGrantLinks)
  const proficiencyGrantLinksByOptionId = groupByOptionId(proficiencyGrantLinks)
  const senseGrantLinksByOptionId = groupByOptionId(senseGrantLinks)
  const spellGrantLinksByOptionId = groupByOptionId(spellGrantLinks)
  const recordsById = new Map<string, OptionAuthored<N>>()

  for (const row of orderedOptionRows(rows, distinctIds)) {
    const id = row.id
    const optionEffectLinks = effectLinksByOptionId.get(id) ?? []
    const optionDetailLinks = detailLinksByOptionId.get(id) ?? []
    const optionAttributeRows = attributeRowsByOptionId.get(id) ?? []
    const optionFeatGrantLinks = featGrantLinksByOptionId.get(id) ?? []
    const optionModifierGrantLinks = modifierGrantLinksByOptionId.get(id) ?? []
    const optionProficiencyGrantLinks = proficiencyGrantLinksByOptionId.get(id) ?? []
    const optionSenseGrantLinks = senseGrantLinksByOptionId.get(id) ?? []
    const optionSpellGrantLinks = spellGrantLinksByOptionId.get(id) ?? []
    const authoredEffects: EffectAuthored[] = hydrateLinkedRecords(
      optionEffectLinks,
      effectsById,
      (link) => link.effect_id,
      (linkedId) => `Option "${id}" is linked to missing effect "${linkedId}".`
    )
    const authoredDetails: DetailAuthored[] = hydrateLinkedRecords(
      optionDetailLinks,
      detailsById,
      (link) => link.detail_id,
      (linkedId) => `Option "${id}" is linked to missing detail "${linkedId}".`
    )
    const authoredFeatGrants: FeatGrantAuthored[] = hydrateLinkedRecords(
      optionFeatGrantLinks,
      featGrantsById,
      (link) => link.feat_grant_id,
      (linkedId) => `Option "${id}" is linked to missing feat grant "${linkedId}".`
    )
    const authoredModifierGrants: ModifierGrantAuthored[] = hydrateLinkedRecords(
      optionModifierGrantLinks,
      modifierGrantsById,
      (link) => link.modifier_grant_id,
      (linkedId) => `Option "${id}" is linked to missing modifier grant "${linkedId}".`
    )
    const authoredProficiencyGrants: ProficiencyGrantAuthored[] = hydrateLinkedRecords(
      optionProficiencyGrantLinks,
      proficiencyGrantsById,
      (link) => link.proficiency_grant_id,
      (linkedId) => `Option "${id}" is linked to missing proficiency grant "${linkedId}".`
    )
    const authoredSenseGrants: SenseGrantAuthored[] = hydrateLinkedRecords(
      optionSenseGrantLinks,
      senseGrantsById,
      (link) => link.sense_grant_id,
      (linkedId) => `Option "${id}" is linked to missing sense grant "${linkedId}".`
    )
    const authoredSpellGrants: SpellGrantAuthored[] = hydrateLinkedRecords(
      optionSpellGrantLinks,
      spellGrantsById,
      (link) => link.spell_grant_id,
      (linkedId) => `Option "${id}" is linked to missing spell grant "${linkedId}".`
    )
    const charge = row.charge_id ? chargesById.get(row.charge_id) ?? null : null
    const restrictions = row.restriction_id ? restrictionsById.get(row.restriction_id) ?? null : null

    recordsById.set(id, {
      id: row.id,
      label: row.label,
      description: row.description,
      attributes: optionAttributeRows.length > 0
        ? optionAttributeRows.map((attribute) => requireFeatureAttribute(id, attribute.attribute_code))
        : undefined,
      details: authoredDetails.length > 0 ? authoredDetails : undefined,
      effects: authoredEffects.length > 0 ? authoredEffects : undefined,
      charges: row.charge_id
        ? requireLinkedRecord(charge as ChargeAuthored | null, `Option "${id}" is linked to missing charge "${row.charge_id}".`)
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
        ? requireLinkedRecord(restrictions as FacetAuthored<N> | null, `Option "${id}" is linked to missing restriction facet "${row.restriction_id}".`)
        : undefined,
      order: row.sort_order
    } as OptionAuthored<N>)
  }

  return recordsById
}

export async function hydrateOptionById(
  db: DBLike,
  id: string,
  options: OptionRepositoryReadOptions = {}
): Promise<OptionAuthored | null> {
  const optionsById = await hydrateOptionsByIds<NodeSubjectCode>(db, [id], options)
  return optionsById.get(id) ?? null
}

async function hydrateOptionByIdTyped<N extends NodeSubjectCode>(
  db: DBLike,
  id: string,
  options: OptionRepositoryReadOptions = {}
): Promise<OptionAuthored<N> | null> {
  return hydrateOptionById(db, id, options) as Promise<OptionAuthored<N> | null>
}

export function createOptionRepository<N extends NodeSubjectCode = NodeSubjectCode>(
  db: DBLike,
  defaultSystemId?: string
): OptionRepositoryWithReadOptions<N> {
  return {
    async upsert(entity) {
      await upsertOption(db, entity, defaultSystemId)
    },

    async findById(id, filter) {
      return hydrateOptionByIdTyped<N>(db, id, filter)
    },

    async findByIds(ids, filter) {
      return hydrateOptionsByIds<N>(db, ids, filter)
    },

    async findAll() {
      const rows = await db
        .selectFrom('options')
        .select('id')
        .orderBy('sort_order')
        .execute()

      return orderedHydratedRecords(
        rows.map((row) => row.id),
        await hydrateOptionsByIds<N>(db, rows.map((row) => row.id))
      )
    }
  }
}



