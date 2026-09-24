import {
  createCharacterBuilderCatalog,
  type CharacterBuilderEquipmentCatalogRecord,
  type CharacterBuilderFeatCatalogRecord,
  toCharacterBuilderSpellCatalogRecord
} from '@artificer-toolkit/rules-runtime/character/builderCatalog'
import { authoredEquipmentOptionFactsSchema } from '@artificer-toolkit/schema/api/authoredOptions'
import type { CharacterBuilderContext } from '@artificer-toolkit/rules-runtime/character/builderTypes'
import { prepareActiveCharacterBuilderContext } from '@artificer-toolkit/rules-runtime/character/contextPreparation'
import type {
  BackgroundAuthored,
  CharacterAuthored,
  ClassAuthored,
  EquipmentAuthored,
  CreatureAuthored,
  RaceAuthored,
  VehicleAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import {
  resolveEquipmentAuthored,
  resolveRaceAuthored,
  type ResolvedEquipment,
  type ResolvedRace
} from '@artificer-toolkit/shared/subjects/compilers'
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
  const loadsCurrentSelections = catalogScope !== 'selectors'
  const races: ResolvedRace[] = loadsCurrentSelections ? [...context.registry.races] : []
  const classes = new Map<string, ClassAuthored>(
    loadsCurrentSelections ? context.registry.classes.map((record) => [record.id, record]) : []
  )
  const backgrounds: BackgroundAuthored[] = loadsCurrentSelections
    ? [...context.registry.backgrounds]
    : []
  const equipmentDocuments = new Map<string, EquipmentAuthored>()
  let equipmentRecords: CharacterBuilderEquipmentCatalogRecord[] | null = null
  let featRecords: CharacterBuilderFeatCatalogRecord[] = []
  for (const kind of ['RACE', 'CLASS', 'BACKGROUND', 'EQUIPMENT', 'FEAT'] as const) {
    if (catalogScope !== 'selectors') {
      if (kind === 'RACE' || kind === 'BACKGROUND') continue
      if (
        kind === 'CLASS' &&
        !character.intent.classes.some((selection) =>
          context.registry.classes.some(
            (record) =>
              record.id === selection.classId &&
              record.category === 'BASE' &&
              record.subclassSelectionLevel !== undefined &&
              selection.classLevel >= record.subclassSelectionLevel
          )
        )
      )
        continue
    }
    const roots = await readCharacterSourceRoots(ctx, character.systemId, sources, kind)
    roots.sort(
      (left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
    )
    if (kind === 'EQUIPMENT') {
      equipmentRecords = await readProjectedEquipmentCatalogue(
        ctx,
        roots,
        character.systemId,
        userId,
        sources,
        context.sourceIdentities
      )
      if (equipmentRecords) continue
    }
    if (kind === 'FEAT') {
      featRecords = await readCharacterFeatCatalogue(
        ctx,
        roots,
        character.systemId,
        userId,
        sources,
        context.sourceIdentities
      )
      continue
    }
    const publishedRoots = await Promise.all(
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
    for (const { root, published } of publishedRoots) {
      if (!published) continue
      // Authored charge refinements narrow beyond the validated DTO's inferred type.
      switch (published.subjectKind) {
        case 'RACE': {
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
          races.push(
            resolveRaceAuthored(
              published.document as RaceAuthored,
              (id) => (id === parent?.id ? parent : undefined) as RaceAuthored | undefined
            )
          )
          break
        }
        case 'CLASS':
          classes.set(root.id, published.document as ClassAuthored)
          break
        case 'BACKGROUND':
          backgrounds.push(published.document as BackgroundAuthored)
          break
        case 'EQUIPMENT':
          if (
            root.parentEquipmentId !==
            (published.document.category === 'VARIANT'
              ? published.document.parentEquipmentId
              : null)
          )
            throw new Error('Stored Equipment parent metadata mismatch.')
          equipmentDocuments.set(root.id, published.document as EquipmentAuthored)
          break
      }
    }
  }
  for (const record of classes.values()) {
    if (record.category === 'SUBCLASS' && classes.get(record.parentClassId)?.category !== 'BASE')
      throw new Error('A readable base class in the same System is required.')
  }
  // The complete authorized set already contains every readable parent. Resolve each once,
  // without rereading ancestors or compiling mechanics the selector never consumes.
  const resolvedEquipment = new Map<string, ResolvedEquipment>()
  const resolving = new Set<string>()
  function resolveEquipment(document: EquipmentAuthored): ResolvedEquipment {
    const existing = resolvedEquipment.get(document.id)
    if (existing) return existing
    if (resolving.has(document.id)) throw new Error('Equipment variant cycle detected.')
    resolving.add(document.id)
    const effective = resolveEquipmentAuthored(document, (parentId) => {
      const parent = equipmentDocuments.get(parentId)
      if (!parent) throw new Error('Readable parent Equipment in the same System is required.')
      return resolveEquipment(parent)
    })
    resolving.delete(document.id)
    resolvedEquipment.set(document.id, effective)
    return effective
  }
  return {
    ...context,
    catalog: createCharacterBuilderCatalog({
      system: context.registry.system,
      races,
      classes: [...classes.values()],
      backgrounds,
      equipment: equipmentRecords ?? [...equipmentDocuments.values()].map(resolveEquipment),
      feats: featRecords,
      spells: [...context.currentSpellDocumentsById.values()]
        .sort(
          (left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
        )
        .map(toCharacterBuilderSpellCatalogRecord)
    })
  }
}

async function readProjectedEquipmentCatalogue(
  ctx: QueryCtx,
  roots: readonly Doc<'authoredRoots'>[],
  systemId: string,
  userId: string,
  sources: Awaited<ReturnType<typeof readCharacterSources>>,
  sourceIdentities: Awaited<ReturnType<typeof loadCharacterRuleContext>>['sourceIdentities']
): Promise<CharacterBuilderEquipmentCatalogRecord[] | null> {
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

  const resolving = new Set<string>()
  const resolved = new Set<string>()
  function verifyParentGraph(id: string) {
    if (resolved.has(id)) return
    if (resolving.has(id)) throw new Error('Equipment variant cycle detected.')
    const builder = factsById.get(id)
    if (!builder) throw new Error('Readable parent Equipment in the same System is required.')
    resolving.add(id)
    if (builder.parentEquipmentId !== null) {
      if (!factsById.has(builder.parentEquipmentId))
        throw new Error('Readable parent Equipment in the same System is required.')
      verifyParentGraph(builder.parentEquipmentId)
    }
    resolving.delete(id)
    resolved.add(id)
  }
  for (const root of readableRoots) verifyParentGraph(root.id)

  return readableRoots.map((root) => {
    const builder = factsById.get(root.id)
    if (!builder) throw new Error('Equipment builder projection is missing.')
    return {
      id: root.id,
      label: root.label,
      category: builder.category,
      isContainer: builder.isContainer,
      ...(builder.maxStack === undefined ? {} : { maxStack: builder.maxStack }),
      properties: [...builder.properties],
      requiresAttunement: builder.requiresAttunement
    }
  })
}

async function readCharacterFeatCatalogue(
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
