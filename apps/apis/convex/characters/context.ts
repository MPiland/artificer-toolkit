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
  readCharacterSourceRoots
} from './sourceReads'
export {
  readCharacterCampaign,
  readCharacterSources,
  readCharacterPublication,
  recordCharacterSourceIdentity,
  readCharacterSourceRoots
} from './sourceReads'
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
  authorityScope?: CampaignInternalScope
) {
  const system = await requireSystem(ctx, character.systemId)
  const sources = await readCharacterSources(ctx, character, userId, authorityScope)
  const sourceIds = new Set(sources.sources.map((source) => source.id))
  const canReadSharedRoot = async (root: Doc<'authoredRoots'>) =>
    sources.campaign !== null &&
    (await readCampaignSharedRootPublication(ctx, sources.campaign, root.subjectKind, root.id)) !==
      null
  const publications = new Map<string, AuthoredPublicationDocument | null>()
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

  async function readId(id: string) {
    if (!id) return null
    if (publications.has(id)) return publications.get(id) ?? null
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', id))
      .unique()
    if (root) return readRoot(root)
    publications.set(id, null)
    return null
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
          recordSource
        ),
      requireClassParent: async (document) => {
        await requireClassParent(
          ctx,
          document,
          userId,
          sourceIds,
          canReadSharedRoot,
          undefined,
          recordSource
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
          recordSource
        ),
      readFeatureSources: async (missingFeatures) => {
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
      readSpellCatalogue: async () => {
        const spells: Array<
          Extract<AuthoredPublicationDocument, { subjectKind: 'SPELL' }>['document']
        > = []
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
