import { authoredSourceKindsByTable } from '@artificer-toolkit/authoring/nodeRuntime/authoredSourceFacts'
import type {
  AuthoredCurrentSourceIdentity,
  AuthoredPublicationDocument
} from '@artificer-toolkit/schema/api/authoredPublication'
import type { ContentSnapshotIndexEntry } from '@artificer-toolkit/schema/api/contentSnapshots'
import type { BaseRaceAuthoredDto } from '@artificer-toolkit/schema/subjects/race'
import type { EquipmentAuthoredDto } from '@artificer-toolkit/schema/subjects/equipment'
import {
  prepareCharacterRuleContext,
  toCharacterRuleFactsPublication,
  toCharacterRulePublication,
  type CharacterRulePublication,
  type CharacterRuleSpellPublication
} from '@artificer-toolkit/rules-runtime/character/contextPreparation'
import type { CharacterClassSpellLists } from '@artificer-toolkit/rules-runtime/character/characterContextSpells'
import {
  characterFeatureProvenanceRootId,
  publicationFeatureIds
} from '@artificer-toolkit/rules-runtime/character/featureSourceHints'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { readRootCatalogue } from '../content/catalogueMetadata'
import { requireParentRoots } from '../content/relationshipReads'
import { readSourceFacts } from '../content/sourceFacts'
import { requireSystem } from '../content/systemDocuments'
import { readAuthoredVersionCompilation, readPublishedRootDocument } from '../content/documents'
import { readVerifiedPublicationDocument } from '../content/publicationDocumentRead'
import type { CampaignInternalScope } from '../campaigns/authority'
import { readCampaignSharedActiveRoot } from '../campaigns/contentAccess'
import { isImportRowVisible } from '../imports/visibility'

import {
  canReadCharacterRoot,
  readCharacterSources,
  recordCharacterSourceIdentity,
  readCharacterSourceRoots,
  rejectUnavailableSource
} from './sourceReads'
export {
  canReadCharacterRoot,
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
  /**
   * Rule publications read earlier in this transaction, shared with a post-materialization reload.
   * Commit builds them from root rows and stored compilations; it reads no authored payload (D163).
   */
  rulePublications: Map<string, CharacterRulePublication | null>
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

/** A root by public id, read once per commit transaction when `reads` is given. */
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

/** The stored compilation of a root's current version; nothing compiles at read time (D163). */
export async function readCharacterStoredCompilation(ctx: QueryCtx, root: Doc<'authoredRoots'>) {
  const compilation = await readAuthoredVersionCompilation(ctx, {
    versionId: root.currentVersionPublicId
  })
  if (!compilation || compilation.authoredChecksum !== root.checksum)
    throw new Error(
      `Character source compilation is missing or stale: ${root.subjectKind} ${root.id}.`
    )
  return { checksum: root.checksum, compilation }
}

/** A Spell's selector facts from its root's checksum-bound catalogue. */
export function readSpellIndexEntry(
  root: Doc<'authoredRoots'>
): ContentSnapshotIndexEntry<'SPELL'> {
  const metadata = readRootCatalogue(root)
  if (
    !metadata.spell ||
    metadata.description === null ||
    metadata.spell.selectionVersion !== 1 ||
    metadata.nameKey !== root.label.toLowerCase()
  )
    throw new Error('Character Spell selector facts are missing or stale.')
  const {
    selectionVersion: _selectionVersion,
    magicSchoolNameKey: _schoolKey,
    ...facts
  } = metadata.spell
  return { id: root.id, label: root.label, ...facts, description: metadata.description }
}

/** Current authorized source context; Character ownership is not a Campaign GM grant. */
export async function loadCharacterRuleContext(
  ctx: QueryCtx,
  character: CharacterAuthored,
  userId: string,
  /** Complete selector facts and referenced mechanics from this same transaction. */
  previousSources?: {
    spellCatalogueEntries: readonly ContentSnapshotIndexEntry<'SPELL'>[]
    currentSpellsById: ReadonlyMap<string, CharacterRuleSpellPublication>
    sourceIdentities: ReadonlyMap<string, AuthoredCurrentSourceIdentity>
  },
  authorityScope?: CampaignInternalScope,
  referenced?: CharacterReferencedReads,
  referenceSpellIds: readonly string[] = [],
  /** A view's Spell catalogue: every visible Spell, or the Character's class lists (Sheet). */
  spellCatalogue: 'complete' | 'classLists' = 'complete',
  /** The System and source access this transaction already read. */
  ruleInputs: CharacterReferencedReads['ruleInputs'] = referenced?.ruleInputs
) {
  const system = ruleInputs?.system ?? (await requireSystem(ctx, character.systemId))
  const sources =
    ruleInputs?.sources ?? (await readCharacterSources(ctx, character, userId, authorityScope))
  if (referenced) referenced.ruleInputs ??= { system, sources }
  const sourceIds = new Set(sources.sources.map((source) => source.id))
  const canReadSharedRoot = async (root: Doc<'authoredRoots'>) =>
    sources.campaign !== null &&
    (await readCampaignSharedActiveRoot(ctx, sources.campaign, root.subjectKind, root.id, root)) !==
      null
  // Views read current documents of authorized roots for presentation; commit reads none (D163).
  const publications = new Map<string, AuthoredPublicationDocument>()
  const rulePublications =
    referenced?.rulePublications ?? new Map<string, CharacterRulePublication | null>()
  const sourceIdentities = new Map(previousSources?.sourceIdentities)
  const roots = referenced?.roots ?? new Map<string, Doc<'authoredRoots'> | null>()
  const readRootById = (id: string) => readReferencedRoot(ctx, id, { roots })

  /** The current document of a root `toRulePublication` authorized; views only. */
  async function readDocument(root: Doc<'authoredRoots'>) {
    const cached = publications.get(root.id)
    if (cached) return cached
    const published = readVerifiedPublicationDocument(
      root.subjectKind,
      (await readPublishedRootDocument(ctx, root)).document
    )
    publications.set(root.id, published)
    return published
  }

  // Engines hydrate the stored compilation of the current version (D163). A subrace, subclass or
  // Equipment variant is readable only with its whole parent chain, authorized from root rows.
  async function toRulePublication(root: Doc<'authoredRoots'>) {
    if (!(await canReadCharacterRoot(ctx, root, character.systemId, userId, sources))) return null
    const ancestors = await requireParentRoots(ctx, root, {
      userId,
      allowedSourceIds: sourceIds,
      canReadSharedRoot,
      readRoot: readRootById
    })
    for (const ancestor of [root, ...ancestors])
      recordCharacterSourceIdentity(sourceIdentities, ancestor)
    const stored = await readCharacterStoredCompilation(ctx, root)
    if (referenced) {
      const facts = readRootCatalogue(root)
      return toCharacterRuleFactsPublication(
        { subjectKind: root.subjectKind, id: root.id, systemId: root.systemId, ...stored },
        {
          ...facts,
          raceParent:
            root.subjectKind === 'RACE' && ancestors[0]
              ? readRootCatalogue(ancestors[0]).race
              : undefined
        }
      )
    }
    const published = await readDocument(root)
    const parentDocuments = await Promise.all(ancestors.map(readDocument))
    const [raceParent] = parentDocuments
    return toCharacterRulePublication(
      published,
      stored,
      {
        race:
          raceParent?.subjectKind === 'RACE' && raceParent.document.category === 'BASE'
            ? (raceParent.document as BaseRaceAuthoredDto)
            : undefined,
        equipment: new Map(
          parentDocuments.flatMap((parent) =>
            parent.subjectKind === 'EQUIPMENT'
              ? [[parent.document.id, parent.document as EquipmentAuthoredDto] as const]
              : []
          )
        )
      },
      true
    )
  }
  async function readRuleRoot(root: Doc<'authoredRoots'>) {
    if (rulePublications.has(root.id)) return rulePublications.get(root.id) ?? null
    const rule = await toRulePublication(root)
    rulePublications.set(root.id, rule)
    return rule
  }
  async function readRuleId(id: string) {
    if (!id) return null
    if (rulePublications.has(id)) return rulePublications.get(id) ?? null
    const root = await readRootById(id)
    if (!root) {
      rulePublications.set(id, null)
      return null
    }
    const rule = await readRuleRoot(root)
    if (!rule) referenced?.unreadableRootIds.add(id)
    return rule
  }

  async function readReferencedFeatureSources(
    missingFeatures: ReadonlySet<string>,
    hints: ReadonlyMap<string, string>
  ) {
    const matched: CharacterRulePublication[] = []
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
        const published = await readRuleId(rootId)
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

  /** The Spells on the Character's class lists plus the required ones; authorized by the caller. */
  async function readClassListSpellRoots(
    classSpellLists: CharacterClassSpellLists,
    requiredSpellIds: ReadonlySet<string>
  ) {
    const spellIds = new Set([...classSpellLists.spellIds, ...requiredSpellIds])
    for (const classId of classSpellLists.classIds)
      for await (const row of ctx.db
        .query('authoredSpellClasses')
        .withIndex('by_classId', (q) => q.eq('classId', classId)))
        if (await isImportRowVisible(ctx, row.importJobId)) spellIds.add(row.spellId)
    const roots = await Promise.all(
      [...spellIds].map(async (id) => {
        const root = await readRootById(id)
        return root?.subjectKind === 'SPELL' && (await isImportRowVisible(ctx, root.importJobId))
          ? root
          : null
      })
    )
    return roots.filter((root) => root !== null)
  }

  const prepared = await prepareCharacterRuleContext(character, system, previousSources, {
    readPublication: readRuleId,
    readFeatureSources: async (missingFeatures) => {
      if (referenced)
        return readReferencedFeatureSources(missingFeatures, referenced.featureSourceHints)
      const matched: CharacterRulePublication[] = []
      // Standalone acquisitions retain feature UUIDs, not parent-root UUIDs. Use the existing
      // checksum-bound owner metadata to locate exact published documents, not draft JSON.
      for (const kind of authoredSourceKindsByTable.features ?? []) {
        for (const root of await visibleRoots(kind)) {
          const metadata = await readSourceFacts(ctx, root)
          if (
            !metadata.rows.features?.some(
              (row) => typeof row.id === 'string' && missingFeatures.has(row.id)
            )
          )
            continue
          const published = await readRuleRoot(root)
          if (published) matched.push(published)
        }
      }
      return matched
    },
    readSpellCatalogue: async (referencedSpellIds, classSpellLists) => {
      const requiredSpellIds = new Set([...referencedSpellIds, ...referenceSpellIds])
      const entries: ContentSnapshotIndexEntry<'SPELL'>[] = []
      const spells: CharacterRuleSpellPublication[] = []
      if (previousSources) {
        for (const id of requiredSpellIds) {
          const spell = previousSources.currentSpellsById.get(id) ?? (await readRuleId(id))
          if (spell?.subjectKind === 'SPELL') spells.push(spell)
        }
        return { entries: previousSources.spellCatalogueEntries, publications: spells }
      }
      if (referenced) {
        // Referenced ids include chosen-grant targets of other kinds; only Spells join.
        for (const id of referencedSpellIds) {
          const spell = await readRuleId(id)
          const root = await readRootById(id)
          if (spell?.subjectKind !== 'SPELL' || !root) continue
          spells.push(spell)
          entries.push(readSpellIndexEntry(root))
        }
        return { entries, publications: spells }
      }
      const catalogueRoots =
        spellCatalogue === 'complete'
          ? await visibleRoots('SPELL')
          : await readClassListSpellRoots(classSpellLists, requiredSpellIds)
      for (const root of catalogueRoots) {
        if (
          !(await canReadCharacterRoot(
            ctx,
            root,
            character.systemId,
            userId,
            sources,
            sourceIdentities
          ))
        )
          continue
        entries.push(readSpellIndexEntry(root))
        if (requiredSpellIds.has(root.id)) {
          const spell = await readRuleRoot(root)
          if (spell?.subjectKind === 'SPELL') spells.push(spell)
        }
      }
      return { entries, publications: spells }
    }
  })
  // Retained dependencies hydrate only held mechanics; current catalogues never include them.
  // The Builder may reuse these validated documents within this same source load.
  return { ...prepared, sourceAccess: sources, sourceIdentities, publications }
}
