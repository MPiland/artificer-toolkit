import {
  toCharacterBuilderRaceCatalogSource,
  type CharacterBuilderFeatCatalogRecord,
  type CharacterBuilderRaceCatalogSource
} from '@artificer-toolkit/rules-runtime/character/builderCatalog'
import { authoredEquipmentOptionFactsSchema } from '@artificer-toolkit/schema/api/authoredOptions'
import type { ContentSnapshotIndexEntry } from '@artificer-toolkit/schema/api/contentSnapshots'
import type { CharacterBuilderContext } from '@artificer-toolkit/rules-runtime/character/builderTypes'
import {
  assembleCharacterBuilderContext,
  prepareActiveCharacterBuilderContext
} from '@artificer-toolkit/rules-runtime/character/contextPreparation'
import { toContentSnapshotIndexEntry } from '@artificer-toolkit/rules-runtime/contentSnapshots'
import type {
  CharacterAuthored,
  ClassAuthored,
  EquipmentAuthored,
  CreatureAuthored,
  RaceAuthored,
  VehicleAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import { resolveRaceAuthored } from '@artificer-toolkit/shared/subjects/compilers'
import type { QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { readCampaignSharedRootPublication } from '../campaigns/contentAccess'
import { canReadAuthoredRoot } from '../content/documents'
import { requireRaceParent } from '../content/relationshipReads'
import {
  loadCharacterRuleContext,
  readCharacterSources,
  readCharacterPublication,
  readCharacterSourceRoots,
  recordCharacterSourceIdentity
} from './context'

/** Resolution omits structural selectors that cannot affect current readiness. */
export async function loadCharacterBuilderContext(
  ctx: QueryCtx,
  character: CharacterAuthored,
  userId: string,
  catalogScope: 'selectors' | 'resolution' | 'active' = 'selectors',
  authorityScope?: import('../campaigns/authority').CampaignInternalScope
): Promise<
  CharacterBuilderContext & {
    creaturesById: ReadonlyMap<string, CreatureAuthored>
    vehiclesById: ReadonlyMap<string, VehicleAuthored>
    sourceAccess: Awaited<ReturnType<typeof readCharacterSources>>
    publications: Awaited<ReturnType<typeof loadCharacterRuleContext>>['publications']
    sourceIdentities: Awaited<ReturnType<typeof loadCharacterRuleContext>>['sourceIdentities']
  }
> {
  const context = await loadCharacterRuleContext(ctx, character, userId, undefined, authorityScope)
  const sources = context.sourceAccess
  if (catalogScope === 'active') {
    return prepareActiveCharacterBuilderContext(character, context, async () => {
      const roots = await readCharacterSourceRoots(ctx, character.systemId, sources, 'CLASS')
      roots.sort(
        (left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
      )
      const classes: ClassAuthored[] = []
      for (const root of roots) {
        const published = context.publications.has(root.id)
          ? context.publications.get(root.id)
          : await readCharacterPublication(
              ctx,
              root,
              character.systemId,
              userId,
              sources,
              context.sourceIdentities
            )
        if (published?.subjectKind === 'CLASS') classes.push(published.document as ClassAuthored)
      }
      return classes
    })
  }
  const sourceIds = new Set(sources.sources.map((source) => source.id))
  const canReadSharedRoot = async (root: Doc<'authoredRoots'>) =>
    sources.campaign !== null &&
    (await readCampaignSharedRootPublication(ctx, sources.campaign, root.subjectKind, root.id)) !==
      null
  const readPublished = (roots: readonly Doc<'authoredRoots'>[]) =>
    Promise.all(
      roots.map(async (root) => ({
        root,
        published: context.publications.has(root.id)
          ? context.publications.get(root.id)
          : await readCharacterPublication(
              ctx,
              root,
              character.systemId,
              userId,
              sources,
              context.sourceIdentities
            )
      }))
    )
  const readRoots = (kind: Doc<'authoredRoots'>['subjectKind']) =>
    readCharacterSourceRoots(ctx, character.systemId, sources, kind)
  return assembleCharacterBuilderContext(
    character,
    context,
    {
      readRaces: async () => {
        const races: CharacterBuilderRaceCatalogSource[] = []
        for (const { published } of await readPublished(await readRoots('RACE'))) {
          if (published?.subjectKind !== 'RACE') continue
          const parent =
            published.document.category === 'SUBRACE'
              ? await requireRaceParent(
                  ctx,
                  published.document,
                  userId,
                  sourceIds,
                  canReadSharedRoot,
                  undefined,
                  (root) => recordCharacterSourceIdentity(context.sourceIdentities, root)
                )
              : undefined
          // Authored charge refinements narrow beyond the validated DTO's inferred type.
          races.push(
            toCharacterBuilderRaceCatalogSource(
              resolveRaceAuthored(
                published.document as RaceAuthored,
                (id) => (id === parent?.id ? parent : undefined) as RaceAuthored | undefined
              )
            )
          )
        }
        return races
      },
      readClasses: async () =>
        (await readPublished(await readRoots('CLASS'))).flatMap(({ published }) =>
          published?.subjectKind === 'CLASS' ? [toContentSnapshotIndexEntry(published)] : []
        ),
      readBackgrounds: async () =>
        (await readPublished(await readRoots('BACKGROUND'))).flatMap(({ published }) =>
          published?.subjectKind === 'BACKGROUND' ? [toContentSnapshotIndexEntry(published)] : []
        ),
      readEquipment: async () =>
        readCharacterEquipmentCatalogue(
          ctx,
          await readRoots('EQUIPMENT'),
          character.systemId,
          userId,
          context
        ),
      readFeats: async () =>
        readCharacterFeatCatalogue(
          ctx,
          await readRoots('FEAT'),
          character.systemId,
          userId,
          sources,
          context.sourceIdentities
        )
    },
    catalogScope
  )
}

/** Readable Equipment among `roots`: stored projections, or documents while one is missing. */
export async function readCharacterEquipmentCatalogue(
  ctx: QueryCtx,
  roots: readonly Doc<'authoredRoots'>[],
  systemId: string,
  userId: string,
  context: Pick<
    Awaited<ReturnType<typeof loadCharacterRuleContext>>,
    'sourceAccess' | 'sourceIdentities' | 'publications'
  >
): Promise<
  { entries: ContentSnapshotIndexEntry<'EQUIPMENT'>[] } | { documents: EquipmentAuthored[] }
> {
  const entries = await readProjectedEquipmentCatalogue(
    ctx,
    roots,
    systemId,
    userId,
    context.sourceAccess,
    context.sourceIdentities
  )
  if (entries) return { entries }
  const documents: EquipmentAuthored[] = []
  for (const root of roots) {
    const published = context.publications.has(root.id)
      ? context.publications.get(root.id)
      : await readCharacterPublication(
          ctx,
          root,
          systemId,
          userId,
          context.sourceAccess,
          context.sourceIdentities
        )
    if (published?.subjectKind !== 'EQUIPMENT') continue
    if (
      root.parentEquipmentId !==
      (published.document.category === 'VARIANT' ? published.document.parentEquipmentId : null)
    )
      throw new Error('Stored Equipment parent metadata mismatch.')
    documents.push(published.document as EquipmentAuthored)
  }
  return { documents }
}

async function readProjectedEquipmentCatalogue(
  ctx: QueryCtx,
  roots: readonly Doc<'authoredRoots'>[],
  systemId: string,
  userId: string,
  sources: Awaited<ReturnType<typeof readCharacterSources>>,
  sourceIdentities: Awaited<ReturnType<typeof loadCharacterRuleContext>>['sourceIdentities']
): Promise<ContentSnapshotIndexEntry<'EQUIPMENT'>[] | null> {
  const sourceById = new Map(sources.sources.map((source) => [source.id, source]))
  const readableRoots: Doc<'authoredRoots'>[] = []
  for (const root of roots) {
    if (root.subjectKind !== 'EQUIPMENT' || root.systemId !== systemId)
      throw new Error('Stored Character source System mismatch.')
    const source = sourceById.get(root.contentSourceId)
    if (source && (await canReadAuthoredRoot(ctx, root, userId, source))) {
      readableRoots.push(root)
      continue
    }
    // Campaign shares retain the established current publication parse and authority check.
    const published = await readCharacterPublication(
      ctx,
      root,
      systemId,
      userId,
      sources,
      sourceIdentities
    )
    if (!published) continue
    if (published.subjectKind !== 'EQUIPMENT')
      throw new Error('Stored Equipment subject metadata mismatch.')
    const document = published.document as EquipmentAuthored
    if (
      root.parentEquipmentId !==
      (document.category === 'VARIANT' ? document.parentEquipmentId : null)
    )
      throw new Error('Stored Equipment parent metadata mismatch.')
    readableRoots.push(root)
  }

  const factsById = new Map<
    string,
    NonNullable<ReturnType<typeof authoredEquipmentOptionFactsSchema.parse>['builder']>
  >()
  let hasMissingProjection = false
  for (const root of readableRoots) {
    // Missing projections are a backfill state. Any present projection must validate exactly.
    if (root.equipmentOptions === undefined || root.equipmentOptions.builder === undefined) {
      hasMissingProjection = true
      continue
    }
    const facts = authoredEquipmentOptionFactsSchema.parse(root.equipmentOptions)
    if (facts.checksum !== root.checksum)
      throw new Error('Stored equipment option checksum mismatch.')
    const builder = facts.builder
    if (builder === undefined) {
      hasMissingProjection = true
      continue
    }
    if (builder.parentEquipmentId !== root.parentEquipmentId)
      throw new Error('Stored Equipment parent metadata mismatch.')
    if ((facts.category === 'VARIANT') !== (root.parentEquipmentId !== null))
      throw new Error('Stored Equipment parent metadata mismatch.')
    factsById.set(root.id, builder)
    recordCharacterSourceIdentity(sourceIdentities, root)
  }
  if (hasMissingProjection) return null
  // Parent graph verification is shared with the snapshot path in `assembleCharacterBuilderContext`.
  return readableRoots.map((root) => {
    const builder = factsById.get(root.id)
    if (!builder) throw new Error('Equipment builder projection is missing.')
    return {
      id: root.id,
      label: root.label,
      parentEquipmentId: builder.parentEquipmentId,
      category: builder.category,
      isContainer: builder.isContainer,
      ...(builder.maxStack === undefined ? {} : { maxStack: builder.maxStack }),
      properties: [...builder.properties],
      requiresAttunement: builder.requiresAttunement
    }
  })
}

export async function readCharacterFeatCatalogue(
  ctx: QueryCtx,
  roots: readonly Doc<'authoredRoots'>[],
  systemId: string,
  userId: string,
  sources: Awaited<ReturnType<typeof readCharacterSources>>,
  sourceIdentities: Awaited<ReturnType<typeof loadCharacterRuleContext>>['sourceIdentities']
): Promise<CharacterBuilderFeatCatalogRecord[]> {
  const sourceById = new Map(sources.sources.map((source) => [source.id, source]))
  const records: CharacterBuilderFeatCatalogRecord[] = []
  for (const root of roots) {
    if (root.subjectKind !== 'FEAT' || root.systemId !== systemId)
      throw new Error('Stored Character source System mismatch.')
    const source = sourceById.get(root.contentSourceId)
    if (source && (await canReadAuthoredRoot(ctx, root, userId, source))) {
      records.push({ id: root.id, label: root.label })
      recordCharacterSourceIdentity(sourceIdentities, root)
      continue
    }
    // Campaign shares retain the established current publication parse and authority check.
    const published = await readCharacterPublication(
      ctx,
      root,
      systemId,
      userId,
      sources,
      sourceIdentities
    )
    if (!published) continue
    if (published.subjectKind !== 'FEAT') throw new Error('Stored Feat subject metadata mismatch.')
    records.push({ id: root.id, label: root.label })
  }
  return records
}
