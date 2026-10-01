import { authoredSourceKindsByTable } from '@artificer-toolkit/authoring/nodeRuntime/authoredSourceFacts'
import { authoredNodeRuntimeSourceFactsSchema } from '@artificer-toolkit/schema/api/nodeRuntimeSources'
import type {
  AuthoredCurrentSourceIdentity,
  AuthoredPublicationDocument
} from '@artificer-toolkit/schema/api/authoredPublication'
import { authoredCatalogueMetadataSchema } from '@artificer-toolkit/schema/api/authoredCatalogue'
import type { ContentSnapshotIndexEntry } from '@artificer-toolkit/schema/api/contentSnapshots'
import { toContentSnapshotIndexEntry } from '@artificer-toolkit/rules-runtime/contentSnapshots'
import { prepareCharacterRuleContext } from '@artificer-toolkit/rules-runtime/character/contextPreparation'
import {
  characterFeatureProvenanceRootId,
  publicationFeatureIds
} from '@artificer-toolkit/rules-runtime/character/featureSourceHints'
import type { CharacterAuthored, SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { requireClassParent } from '../content/classRelationships'
import { requireEquipmentParents, requireRaceParent } from '../content/relationshipReads'
import { requireSystem } from '../content/systemDocuments'
import { canReadAuthoredRoot } from '../content/documents'
import type { CampaignInternalScope } from '../campaigns/authority'
import {
  readCampaignSharedRoot,
  readCampaignSharedRootPublication
} from '../campaigns/contentAccess'

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

/** Current authorized source context; Character ownership is not a Campaign GM grant. */
export async function loadCharacterRuleContext(
  ctx: QueryCtx,
  character: CharacterAuthored,
  userId: string,
  /** Complete selector facts and referenced mechanics from this same transaction. */
  previousSources?: {
    spellCatalogueEntries: readonly ContentSnapshotIndexEntry<'SPELL'>[]
    currentSpellDocumentsById: ReadonlyMap<string, SpellAuthored>
    sourceIdentities: ReadonlyMap<string, AuthoredCurrentSourceIdentity>
  },
  authorityScope?: CampaignInternalScope,
  referenced?: CharacterReferencedReads,
  referenceSpellIds: readonly string[] = []
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
          const rootId = characterFeatureProvenanceRootId(character, acquisition.source)
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

  const prepared = await prepareCharacterRuleContext(character, system, previousSources, {
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
      const requiredSpellIds = new Set([...referencedSpellIds, ...referenceSpellIds])
      const entries: ContentSnapshotIndexEntry<'SPELL'>[] = []
      const spells: Array<
        Extract<AuthoredPublicationDocument, { subjectKind: 'SPELL' }>['document']
      > = []
      if (previousSources) {
        for (const id of requiredSpellIds) {
          const existing = previousSources.currentSpellDocumentsById.get(id)
          if (existing)
            spells.push(
              existing as Extract<AuthoredPublicationDocument, { subjectKind: 'SPELL' }>['document']
            )
          else {
            const published = await readId(id)
            if (published?.subjectKind === 'SPELL') spells.push(published.document)
          }
        }
        return { entries: previousSources.spellCatalogueEntries, documents: spells }
      }
      if (referenced) {
        // Referenced ids include chosen-grant targets of other kinds; only Spells join.
        for (const id of referencedSpellIds) {
          const published = await readId(id)
          if (published?.subjectKind === 'SPELL') {
            spells.push(published.document)
            entries.push(toContentSnapshotIndexEntry(published))
          }
        }
        return { entries, documents: spells }
      }
      for (const root of await visibleRoots('SPELL')) {
        const source = sources.sources.find((source) => source.id === root.contentSourceId)
        if (
          !(source && (await canReadAuthoredRoot(ctx, root, userId, source))) &&
          !(
            sources.campaign &&
            (await readCampaignSharedRoot(ctx, sources.campaign, 'SPELL', root.id, root))
          )
        )
          continue
        const metadata = root.catalogue && authoredCatalogueMetadataSchema.parse(root.catalogue)
        if (
          !metadata?.spell ||
          metadata.description === null ||
          metadata.spell.selectionVersion !== 1 ||
          metadata.spell.publishedActive === undefined ||
          metadata.checksum !== root.checksum ||
          metadata.nameKey !== root.label.toLowerCase()
        )
          throw new Error('Character Spell selector facts are missing or stale.')
        const {
          selectionVersion: _selectionVersion,
          publishedActive: _active,
          magicSchoolNameKey: _schoolKey,
          ...facts
        } = metadata.spell
        entries.push({
          id: root.id,
          label: root.label,
          ...facts,
          description: metadata.description
        })
        recordSource(root)
        if (requiredSpellIds.has(root.id)) {
          const published = await readRoot(root)
          if (published?.subjectKind === 'SPELL') spells.push(published.document)
        }
      }
      return { entries, documents: spells }
    }
  })
  // Retained dependencies hydrate only held mechanics; current catalogues never include them.
  // The Builder may reuse these validated documents within this same source load.
  return {
    ...prepared,
    sourceAccess: sources,
    sourceIdentities,
    publications
  }
}
