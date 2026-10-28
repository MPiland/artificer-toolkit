import type {
  AuthoredPublicationDocument,
  AuthoredStoredCompilation
} from '@artificer-toolkit/schema/api/authoredPublication'
import type { CharacterBuilderResolveInput } from '@artificer-toolkit/schema/api/characterBuilderQueries'
import {
  contentSnapshotDocumentsObjectSchema,
  contentSnapshotKindSchema,
  type ContentSnapshotPublicationVersion
} from '@artificer-toolkit/schema/api/contentSnapshots'
import { toCharacterBuilderRaceCatalogSource } from '@artificer-toolkit/rules-runtime/character/builderCatalog'
import type {
  CharacterBuilderCatalogueReaders,
  CharacterRuleContextReaders
} from '@artificer-toolkit/rules-runtime/character/contextPreparation'
import {
  previewSnapshotCharacterBuilder,
  resolveSnapshotCharacterBuilderPayload,
  type SnapshotCharacterBuilderInput
} from '@artificer-toolkit/rules-runtime/character/snapshotBuilderEvaluation'
import { createSnapshotReaders } from '@artificer-toolkit/rules-runtime/character/snapshotReaders'
import { toContentSnapshotIndexEntry } from '@artificer-toolkit/rules-runtime/contentSnapshots'
import type {
  CharacterAuthored,
  EquipmentAuthored,
  RaceAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import { resolveRaceAuthored } from '@artificer-toolkit/shared/subjects/compilers'
import { api } from '../../convex/_generated/api'
import { requireSystem } from '../../convex/content/systemDocuments'
import type { ContentSnapshotScopeRef } from '../../convex/contentSnapshots/marking'
import { loadCharacterDraftCandidate } from '../../convex/characters/documents'
import { readAuthoredVersionCompilation } from '../../convex/content/documents'
import {
  readCharacterPublication,
  readCharacterSourceRoots,
  readCharacterSources
} from '../../convex/characters/sourceReads'
import type { fixture } from './characters'
import { createBrowserReaders, readScopeObjects } from './contentSnapshotReaders'

type Test = Awaited<ReturnType<typeof fixture>>['t']
type Caller = Awaited<ReturnType<typeof fixture>>['owner']['caller']
type Readers = CharacterRuleContextReaders & CharacterBuilderCatalogueReaders
type FullPoolPublication = AuthoredPublicationDocument & {
  publicationVersion: ContentSnapshotPublicationVersion
  compilation: AuthoredStoredCompilation
}

/**
 * Every current publication the Character can read, through the Convex source authority
 * (`readCharacterSources`, `readCharacterSourceRoots`, `readCharacterPublication`).
 */
async function readFullPoolPublications(t: Test, character: CharacterAuthored, userId: string) {
  return t.run(async (ctx) => {
    const access = await readCharacterSources(ctx, character, userId)
    const publications: FullPoolPublication[] = []
    for (const kind of contentSnapshotKindSchema.options)
      for (const root of await readCharacterSourceRoots(ctx, character.systemId, access, kind)) {
        const published = await readCharacterPublication(
          ctx,
          root,
          character.systemId,
          userId,
          access
        )
        if (published) {
          const version = await ctx.db.get(root.currentVersionId)
          if (!version) throw new Error('Missing full-pool publication version.')
          const compilation = await readAuthoredVersionCompilation(ctx, version)
          if (!compilation) throw new Error('Missing full-pool publication compilation.')
          publications.push({
            ...published,
            compilation,
            publicationVersion: {
              identity: {
                subjectKind: root.subjectKind,
                subjectId: root.id,
                systemId: root.systemId,
                contentSourceId: root.contentSourceId,
                versionId: root.currentVersionPublicId,
                checksum: root.checksum
              },
              version: version.version,
              ...(root.subjectKind === 'CLASS'
                ? { storedParentId: root.parentClassId }
                : root.subjectKind === 'RACE'
                  ? { storedParentId: root.parentRaceId }
                  : root.subjectKind === 'EQUIPMENT'
                    ? { storedParentId: root.parentEquipmentId }
                    : {})
            }
          })
        }
      }
    return publications
  })
}

/**
 * Pure full-pool Builder readers over readable publications, independent of the snapshot build:
 * picker facts come straight from the documents (a subrace resolved against its base Race, and
 * Equipment resolved from its documents rather than the stored projection).
 */
function createFullPoolReaders(publications: readonly FullPoolPublication[]): Readers {
  const ruleReaders = createSnapshotReaders(
    contentSnapshotKindSchema.options.flatMap((kind) => {
      const scopes = new Map<string, FullPoolPublication[]>()
      for (const published of publications.filter((published) => published.subjectKind === kind)) {
        const scopeId = published.publicationVersion.identity.contentSourceId
        const entries = scopes.get(scopeId) ?? []
        entries.push(published)
        scopes.set(scopeId, entries)
      }
      return [...scopes].map(([scopeId, entries]) =>
        contentSnapshotDocumentsObjectSchema.parse({
          format: 3,
          scope: 'SOURCE',
          scopeId,
          kind,
          part: 'documents',
          roots: entries.map((entry) => entry.document),
          versions: entries.map((entry) => entry.publicationVersion),
          compilations: entries.map((entry) => entry.compilation)
        })
      )
    })
  )
  const ofKind = <Kind extends AuthoredPublicationDocument['subjectKind']>(kind: Kind) =>
    publications.filter(
      (published): published is Extract<FullPoolPublication, { subjectKind: Kind }> =>
        published.subjectKind === kind
    )
  return {
    ...ruleReaders,
    readRaces: async () => {
      // Authored charge refinements narrow beyond the validated DTO's inferred type.
      const races = ofKind('RACE').map(({ document }) => document as RaceAuthored)
      return races.map((race) => {
        const parent =
          race.category === 'SUBRACE'
            ? races.find((candidate) => candidate.id === race.parentRaceId)
            : undefined
        if (race.category === 'SUBRACE' && parent?.category !== 'BASE')
          throw new Error('A readable base Race in the same System is required.')
        return toCharacterBuilderRaceCatalogSource(
          resolveRaceAuthored(race, (id) => (id === parent?.id ? parent : undefined))
        )
      })
    },
    readClasses: async () =>
      ofKind('CLASS').map((published) => toContentSnapshotIndexEntry(published)),
    readBackgrounds: async () =>
      ofKind('BACKGROUND').map((published) => toContentSnapshotIndexEntry(published)),
    readEquipment: async () => ({
      documents: ofKind('EQUIPMENT').map(({ document }) => document as EquipmentAuthored)
    }),
    readFeats: async () => ofKind('FEAT').map(({ document: { id, label } }) => ({ id, label })),
    // The picker entries come from the Spell documents, as the snapshot index part carries them.
    readSpellCatalogue: async (referencedSpellIds, classSpellLists) => ({
      ...(await ruleReaders.readSpellCatalogue(referencedSpellIds, classSpellLists)),
      entries: ofKind('SPELL').map((published) => toContentSnapshotIndexEntry(published))
    })
  }
}

/**
 * The browser Builder's evaluation of a draft candidate from the S2 build's snapshot objects of the
 * Character's sources (ADR 0036 S6), beside a pure full-pool evaluation of the same candidate over
 * the publications Convex authorizes. The server no longer resolves the Builder (S9); commit is
 * checked against the complete pool in `commitReferencedContext.test.ts`.
 *
 * `scopeReads` lets a caller whose published content is unchanged between evaluations share one
 * snapshot read per scope; without it every evaluation reads the scopes afresh.
 */
export async function evaluateBuilderCandidate(
  t: Test,
  caller: Caller,
  userId: string,
  request: CharacterBuilderResolveInput,
  scopeReads = new Map<string, ReturnType<typeof readScopeObjects>>()
) {
  const { candidate, system, sources } = await t.run(async (ctx) => {
    const candidate = await loadCharacterDraftCandidate(ctx, userId, request)
    return {
      candidate,
      system: await requireSystem(ctx, request.character.systemId),
      sources: await readCharacterSources(ctx, candidate.character, userId)
    }
  })
  const scopes: ContentSnapshotScopeRef[] = [
    ...sources.sources.map((source) => ({ scope: 'SOURCE' as const, scopeId: source.id })),
    ...(sources.campaign ? [{ scope: 'CAMPAIGN' as const, scopeId: sources.campaign.id }] : [])
  ]
  const objects = (
    await Promise.all(
      scopes.map((ref) => {
        const key = `${ref.scope}:${ref.scopeId}`
        const read = scopeReads.get(key) ?? readScopeObjects(t, ref)
        scopeReads.set(key, read)
        return read
      })
    )
  ).flat()
  // Validated Character DTOs use literal starting-equipment sources for the authored string enum.
  const character = candidate.character as CharacterAuthored
  const input: SnapshotCharacterBuilderInput = {
    character,
    // The browser reads the previous Character through `builder.activeCharacter`.
    previousCharacter: (await caller.query(api.characters.builder.activeCharacter, {
      id: request.character.id
    })) as CharacterAuthored | null,
    mode: request.mode,
    system,
    builderIntent: candidate.draft.payload.builderIntent,
    publicId: candidate.draft.publicId,
    baseActiveUpdatedAt: candidate.draft.baseActiveUpdatedAt ?? null,
    contentMaturity: sources.campaign?.contentMaturity ?? null
  }
  const browser = createBrowserReaders(objects)
  const fullPool = createFullPoolReaders(await readFullPoolPublications(t, character, userId))
  return {
    input,
    objects,
    loadedKinds: browser.loadedKinds,
    browserReaders: browser.readers,
    resolve: () => resolveSnapshotCharacterBuilderPayload(input, browser.readers),
    preview: () => previewSnapshotCharacterBuilder(input, browser.readers),
    fullPoolResolve: () => resolveSnapshotCharacterBuilderPayload(input, fullPool),
    fullPoolPreview: () => previewSnapshotCharacterBuilder(input, fullPool)
  }
}
