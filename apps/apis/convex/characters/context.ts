import { authoredSourceKindsByTable } from '@artificer-toolkit/authoring/nodeRuntime/authoredSourceFacts'
import { authoredNodeRuntimeSourceFactsSchema } from '@artificer-toolkit/schema/api/nodeRuntimeSources'
import type {
  AuthoredCurrentSourceIdentity,
  AuthoredPublicationDocument
} from '@artificer-toolkit/schema/api/authoredPublication'
import { prepareCharacterRuleContext } from '@artificer-toolkit/rules-runtime/character/contextPreparation'
import type { CharacterAuthored, SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { requireClassParent } from '../content/classRelationships'
import { requireEquipmentParents, requireRaceParent } from '../content/relationshipReads'
import { requireSystem } from '../content/systemDocuments'
import type { CampaignInternalScope } from '../campaigns/authority'
import { readCampaignSharedRootPublication } from '../campaigns/contentAccess'

import {
  readCharacterSources,
  readCharacterPublication,
  recordCharacterSourceIdentity,
  readCharacterSourceRoots,
  rejectUnavailableSource
} from './sourceReads'
export {
  readCharacterCampaign,
  readCharacterSources,
  readCharacterPublication,
  recordCharacterSourceIdentity,
  readCharacterSourceRoots
} from './sourceReads'
/**
 * Commit reads only the content a Character references (ADR 0036 S7). Features are found through
 * their acquisition's root, or a verified hint when the provenance names none.
 */
export type CharacterReferencedReads = {
  /** Standalone feature id to the root the client found it in; verified before use. */
  featureSourceHints: ReadonlyMap<string, string>
  /** Publications read earlier in this transaction, shared with a post-materialization reload. */
  publications: Map<string, AuthoredPublicationDocument | null>
  /** Referenced ids whose root exists but is not readable to this Character. */
  unreadableRootIds: Set<string>
  /** Roots by public id, read once per transaction. */
  roots: Map<string, Doc<'authoredRoots'> | null>
  /** The System and source access, read once per transaction. */
  ruleInputs?: {
    system: Awaited<ReturnType<typeof requireSystem>>
    sources: Awaited<ReturnType<typeof readCharacterSources>>
  }
}

/** A root by public id, read once per commit transaction when
eads is given. */
export async function readReferencedRoot(
  ctx: QueryCtx,
  id: string,
  reads?: Pick<CharacterReferencedReads, 'roots'>
) {
  if (reads?.roots.has(id)) return reads.roots.get(id) ?? null
  const root = await ctx.db
    .query('authoredRoots')
    .withIndex('by_publicId', (q) => q.eq('id', id))
    .unique()
  reads?.roots.set(id, root)
  return root
}

type FeatureProvenance = CharacterAuthored['intent']['featureAcquisitions'][number]['source']

/** The root an acquisition's provenance names; OPTION follows its parent acquisition. */
function provenanceRootId(
  character: CharacterAuthored,
  source: FeatureProvenance,
  visited = new Set<string>()
): string | undefined {
  switch (source.kind) {
    case 'CLASS':
      return source.classId
    case 'SUBCLASS':
      return source.subclassId
    case 'RACE':
      return source.raceId
    case 'SUBRACE':
      return source.subraceId
    case 'BACKGROUND':
      return source.backgroundId
    case 'FEAT':
      return source.featId
    case 'OPTION': {
      if (visited.has(source.acquiredParentId)) return undefined
      visited.add(source.acquiredParentId)
      const parent = character.intent.featureAcquisitions.find(
        (acquisition) => acquisition.id === source.acquiredParentId
      )
      return parent ? provenanceRootId(character, parent.source, visited) : undefined
    }
    default:
      return undefined
  }
}

/** Feature ids `prepareCharacterRuleContext` takes from a publication. */
function publicationFeatureIds(published: AuthoredPublicationDocument): Set<string> {
  const { document } = published
  const features = 'features' in document ? (document.features ?? []) : []
  const ancestry =
    published.subjectKind === 'RACE' && published.document.category === 'BASE'
      ? (published.document.ancestry?.options.flatMap((option) => option.features ?? []) ?? [])
      : []
  return new Set([...features, ...ancestry].map((feature) => feature.id))
}

/** Current authorized source context; Character ownership is not a Campaign GM grant. */
export async function loadCharacterRuleContext(
  ctx: QueryCtx,
  character: CharacterAuthored,
  userId: string,
  /** Complete Spell catalogue from the same read-only preparation transaction. */
  previousSources?: {
    spellDocumentsById: ReadonlyMap<string, SpellAuthored>
    sourceIdentities: ReadonlyMap<string, AuthoredCurrentSourceIdentity>
  },
  authorityScope?: CampaignInternalScope,
  referenced?: CharacterReferencedReads
) {
  const system = referenced?.ruleInputs?.system ?? (await requireSystem(ctx, character.systemId))
  const sources =
    referenced?.ruleInputs?.sources ??
    (await readCharacterSources(ctx, character, userId, authorityScope))
  if (referenced) referenced.ruleInputs ??= { system, sources }
  const sourceIds = new Set(sources.sources.map((source) => source.id))
  const canReadSharedRoot = async (root: Doc<'authoredRoots'>) =>
    sources.campaign !== null &&
    (await readCampaignSharedRootPublication(ctx, sources.campaign, root.subjectKind, root.id)) !==
      null
  const publications =
    referenced?.publications ?? new Map<string, AuthoredPublicationDocument | null>()
  const sourceIdentities = new Map(previousSources?.sourceIdentities)
  const recordSource = (root: Doc<'authoredRoots'>) =>
    recordCharacterSourceIdentity(sourceIdentities, root)

  async function readRoot(root: Doc<'authoredRoots'>) {
    if (publications.has(root.id)) return publications.get(root.id) ?? null
    const published = await readCharacterPublication(
      ctx,
      root,
      character.systemId,
      userId,
      sources,
      sourceIdentities
    )
    publications.set(root.id, published)
    return published
  }

  const readRootById = (id: string) => readReferencedRoot(ctx, id, referenced)
  // Commit reads each root once per transaction, parents included.
  const readParentRoot = referenced ? readRootById : undefined

  async function readId(id: string) {
    if (!id) return null
    if (publications.has(id)) return publications.get(id) ?? null
    const root = await readRootById(id)
    if (root) {
      const published = await readRoot(root)
      if (!published) referenced?.unreadableRootIds.add(id)
      return published
    }
    publications.set(id, null)
    return null
  }

  async function readReferencedFeatureSources(
    missingFeatures: ReadonlySet<string>,
    hints: ReadonlyMap<string, string>
  ) {
    const matched: AuthoredPublicationDocument[] = []
    for (const featureId of missingFeatures) {
      const rootIds = new Set(
        character.intent.featureAcquisitions.flatMap((acquisition) => {
          if (acquisition.featureId !== featureId) return []
          const rootId = provenanceRootId(character, acquisition.source)
          return rootId ? [rootId] : []
        })
      )
      const hinted = rootIds.size === 0
      if (hinted) {
        const hint = hints.get(featureId)
        if (!hint) throw new Error(`Standalone feature ${featureId} requires its source root.`)
        rootIds.add(hint)
      }
      for (const rootId of rootIds) {
        const published = await readId(rootId)
        if (!published) {
          // A root the provenance names but cannot be read fails closed after preparation.
          if (hinted) rejectUnavailableSource(rootId)
          continue
        }
        if (hinted && !publicationFeatureIds(published).has(featureId))
          throw new Error(`Feature source hint ${rootId} does not hold feature ${featureId}.`)
        matched.push(published)
      }
    }
    return matched
  }

  async function visibleRoots(kind: Doc<'authoredRoots'>['subjectKind']) {
    return readCharacterSourceRoots(ctx, character.systemId, sources, kind)
  }

  const prepared = await prepareCharacterRuleContext(
    character,
    system,
    previousSources?.spellDocumentsById,
    {
      readPublication: readId,
      readRaceParent: (document) =>
        requireRaceParent(
          ctx,
          document,
          userId,
          sourceIds,
          canReadSharedRoot,
          undefined,
          recordSource,
          readParentRoot
        ),
      requireClassParent: async (document) => {
        await requireClassParent(
          ctx,
          document,
          userId,
          sourceIds,
          canReadSharedRoot,
          undefined,
          recordSource,
          readParentRoot
        )
      },
      readEquipmentParents: (document) =>
        requireEquipmentParents(
          ctx,
          document,
          userId,
          sourceIds,
          canReadSharedRoot,
          undefined,
          recordSource,
          readParentRoot
        ),
      readFeatureSources: async (missingFeatures) => {
        if (referenced)
          return readReferencedFeatureSources(missingFeatures, referenced.featureSourceHints)
        const matched: AuthoredPublicationDocument[] = []
        // Standalone acquisitions retain feature UUIDs, not parent-root UUIDs. Use the existing
        // checksum-bound owner metadata to locate exact published documents, not draft JSON.
        for (const kind of authoredSourceKindsByTable.features ?? []) {
          for (const root of await visibleRoots(kind)) {
            if (!root.authoringSources)
              throw new Error('Character feature source facts are not materialized.')
            const metadata = authoredNodeRuntimeSourceFactsSchema.parse(root.authoringSources)
            if (metadata.checksum !== root.checksum)
              throw new Error('Stored Character feature source checksum mismatch.')
            if (
              !metadata.rows.features?.some(
                (row) => typeof row.id === 'string' && missingFeatures.has(row.id)
              )
            )
              continue
            const published = await readRoot(root)
            if (published) matched.push(published)
          }
        }
        return matched
      },
      readSpellCatalogue: async (referencedSpellIds) => {
        const spells: Array<
          Extract<AuthoredPublicationDocument, { subjectKind: 'SPELL' }>['document']
        > = []
        if (referenced) {
          // Referenced ids include chosen-grant targets of other kinds; only Spells join.
          for (const id of referencedSpellIds) {
            const published = await readId(id)
            if (published?.subjectKind === 'SPELL') spells.push(published.document)
          }
          return spells
        }
        for (const root of await visibleRoots('SPELL')) {
          const published = await readRoot(root)
          if (published?.subjectKind === 'SPELL') spells.push(published.document)
        }
        return spells
      }
    }
  )
  // Retained dependencies hydrate only held mechanics; current catalogues never include them.
  // The Builder may reuse these validated documents within this same source load.
  return {
    ...prepared,
    sourceAccess: sources,
    sourceIdentities,
    publications
  }
}
