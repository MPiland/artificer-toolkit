import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { grappler } from '@artificer-toolkit/source-data/srd/feats/grappler.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type {
  AuthoredDetailReadInput,
  AuthoredDetailReadResult
} from '@artificer-toolkit/schema/api/content'
import {
  authoredPublishDraftInputSchema,
  type AuthoredDeleteActiveInput,
  type AuthoredPublicationResult,
  type AuthoredPublishDraftInput
} from '@artificer-toolkit/schema/api/authoredPublication'
import type { AuthoredDraftResult } from '@artificer-toolkit/schema/api/authoredDrafts'
import type {
  AuthoredCatalogueScope,
  AuthoredCatalogueCounts
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { featAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/feat'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { authoredSourceFacts } from '@artificer-toolkit/authoring/nodeRuntime'
import { compileSubjectWithMechanicsIndex } from '@artificer-toolkit/shared/subjects/compilers'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { api } from '../_generated/api'
import {
  importedSubject,
  importSeededSubjects,
  publicationFixture,
  versionWithCompilation
} from '../../tests/fixtures/publication'
import { readStoredAuthoredVersionDocument } from './documents'
import { readStoredSourceFacts } from './sourceFacts'

const publish = makeFunctionReference<
  'mutation',
  AuthoredPublishDraftInput,
  AuthoredPublicationResult
>('content/publication:publishDraft')
const deleteActive = makeFunctionReference<'mutation', AuthoredDeleteActiveInput, null>(
  'content/deletion:deleteActive'
)
const details = makeFunctionReference<'query', AuthoredDetailReadInput, AuthoredDetailReadResult>(
  'content/details:get'
)
const catalogueCounts = makeFunctionReference<
  'query',
  Omit<AuthoredCatalogueScope, 'source'>,
  AuthoredCatalogueCounts
>('content/catalogue:counts')
const grapplerSubject = importedSubject({
  subjectKind: 'FEAT',
  id: grappler.id,
  systemId: grappler.systemId,
  label: grappler.label,
  document: grappler
})

async function fixture() {
  return publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [
      [
        grapplerSubject,
        importedSubject({
          subjectKind: 'BACKGROUND',
          id: acolyte.id,
          systemId: acolyte.systemId,
          label: acolyte.label,
          document: acolyte
        })
      ]
    ]
  )
}

async function copyDraft(
  caller: Awaited<ReturnType<typeof fixture>>['first']['caller'],
  subjectId = grappler.id
) {
  return caller.mutation(api.content.drafts.duplicate, {
    subjectKind: 'FEAT',
    subjectId
  })
}

function publicationInput(draft: AuthoredDraftResult) {
  return authoredPublishDraftInputSchema.parse({
    subjectKind: 'FEAT',
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: draft.updatedAt
  })
}

const scope = { subjectKind: 'FEAT' as const, systemId: srdSystemRecord.id }

describe('native Feat publication', () => {
  it('publishes Grappler with exact compiled mechanics, private detail, route, counter, and consumed draft', async () => {
    const { t, first, second } = await fixture()
    const draft = await copyDraft(first.caller)
    const result = await first.caller.mutation(publish, publicationInput(draft))
    expect(result).toMatchObject({
      subjectKind: 'FEAT',
      subjectId: draft.subjectId,
      publicId: draft.publicId
    })

    const stored = await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', draft.subjectId))
        .unique()
      if (!root) throw new Error('Missing published Feat root')
      const version = await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
      const source = await ctx.db
        .query('contentSources')
        .withIndex('by_publicId', (q) => q.eq('id', root.contentSourceId))
        .unique()
      const route = await ctx.db
        .query('authoredRouteIds')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', draft.subjectId))
        .unique()
      return {
        root,
        sourceFacts: await readStoredSourceFacts(ctx, root),
        version,
        source,
        route,
        document: version && (await readStoredAuthoredVersionDocument(ctx, version))
      }
    })
    expect(stored.root).toMatchObject({ subjectKind: 'FEAT' })
    expect(stored.version?.checksum).toBe(result.checksum)
    expect(stored.source).toMatchObject({
      id: stored.root.contentSourceId,
      kind: 'USER',
      ownerUserId: first.userId,
      gameSystemId: srdSystemRecord.id
    })
    expect(stored.route?.publicId).toBe(draft.publicId)

    const document = featAuthoredDtoSchema.parse(stored.document)
    expect(document.prerequisites?.groups).toHaveLength(1)
    const advantagePath = document.features?.[0]?.effects?.[0]?.paths?.[0]
    expect(advantagePath).toMatchObject({
      groupType: 'SINGLE',
      resultBlock: { resultKind: 'SINGLE' }
    })
    if (advantagePath?.selectionKind !== 'FIXED')
      throw new Error('Missing Grappler advantage result block')
    expect(advantagePath.resultBlock.outcomes?.[0]).toMatchObject({
      effectKind: 'CLOSED_RULE',
      ruleKind: 'GRAPPLER_ADVANTAGE_ON_GRAPPLED_TARGET'
    })
    const pinPath = document.features?.[1]?.effects?.[0]?.paths?.[0]
    expect(pinPath).toMatchObject({
      groupType: 'SINGLE',
      resultBlock: { resultKind: 'SINGLE' }
    })
    if (pinPath?.selectionKind !== 'FIXED') throw new Error('Missing Grappler pin result block')
    expect(pinPath.resultBlock.outcomes?.[0]).toMatchObject({
      effectKind: 'CLOSED_RULE',
      ruleKind: 'GRAPPLER_PIN'
    })
    expect(stored.version?.compilation?.authoredChecksum).toBe(result.checksum)
    const projection = jsonValueSchema.parse(
      JSON.parse(stored.version!.compilation!.projectionJson)
    )
    expect(projection).toEqual(
      JSON.parse(
        JSON.stringify(
          compileSubjectWithMechanicsIndex({
            subjectKind: 'FEAT',
            authored: document
          }).compiled
        )
      )
    )
    expect(stored.version?.compilation?.projectionChecksum).toBe(checksumRuleDocument(projection))
    expect(stored.sourceFacts).toEqual(
      authoredSourceFacts({
        subjectKind: 'FEAT',
        document,
        checksum: result.checksum
      })
    )
    expect(
      await first.caller.query(api.content.drafts.get, {
        subjectKind: 'FEAT',
        subjectId: draft.subjectId
      })
    ).toBeNull()
    expect(
      await first.caller.query(details, {
        subjectKind: 'FEAT',
        id: draft.subjectId
      })
    ).toMatchObject({
      item: expect.objectContaining({
        id: draft.subjectId,
        label: draft.label,
        status: 'ACTIVE'
      })
    })
    const canonicalBefore = await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', grappler.id))
        .unique()
      if (!root) throw new Error('Missing canonical Feat root')
      const version = await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
      return {
        root,
        sourceFacts: await readStoredSourceFacts(ctx, root),
        version,
        document: version && (await readStoredAuthoredVersionDocument(ctx, version))
      }
    })
    if (!canonicalBefore.version?.compilation) throw new Error('Missing canonical Feat compilation')
    expect(canonicalBefore.root.checksum).toBe(grapplerSubject.checksum)
    expect(canonicalBefore.version.compilation.authoredChecksum).toBe(grapplerSubject.checksum)
    const canonicalDocument = featAuthoredDtoSchema.parse(canonicalBefore.document)
    const canonicalProjection = jsonValueSchema.parse(
      JSON.parse(canonicalBefore.version.compilation.projectionJson)
    )
    expect(canonicalProjection).toEqual(
      JSON.parse(
        JSON.stringify(
          compileSubjectWithMechanicsIndex({
            subjectKind: 'FEAT',
            authored: canonicalDocument
          }).compiled
        )
      )
    )
    expect(canonicalBefore.version.compilation.projectionChecksum).toBe(
      checksumRuleDocument(canonicalProjection)
    )
    await expect(
      importSeededSubjects(t, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects: [grapplerSubject]
      })
    ).resolves.toEqual({ inserted: 0, reused: 1, replaced: 0 })
    expect(
      await t.run(async (ctx) => {
        const root = await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', grappler.id))
          .unique()
        if (!root) return null
        const version = await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
        return {
          root,
          sourceFacts: await readStoredSourceFacts(ctx, root),
          version,
          document: version && (await readStoredAuthoredVersionDocument(ctx, version))
        }
      })
    ).toEqual(canonicalBefore)
    expect(await t.query(details, { subjectKind: 'FEAT', id: draft.subjectId })).toBeNull()
    expect(
      await second.caller.query(details, {
        subjectKind: 'FEAT',
        id: draft.subjectId
      })
    ).toBeNull()
    expect(await first.caller.query(catalogueCounts, scope)).toEqual({
      activeCount: 2,
      masterCount: 1,
      ownedCount: 1
    })
  })

  it('keeps active content unchanged for working edits and rejects stale or invalid publication', async () => {
    const { t, first } = await fixture()
    const draft = await copyDraft(first.caller)
    await first.caller.mutation(publish, publicationInput(draft))
    const before = await first.caller.query(details, {
      subjectKind: 'FEAT',
      id: draft.subjectId
    })
    if (!before?.item) throw new Error('Missing published Feat detail')
    const edited = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'FEAT',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: 'Edited Grappler',
      payload: { ...draft.payload, description: 'Private unfinished edit' }
    })
    await expect(first.caller.mutation(publish, publicationInput(draft))).rejects.toThrow(
      'draft or published content changed'
    )
    expect(
      await first.caller.query(details, {
        subjectKind: 'FEAT',
        id: draft.subjectId
      })
    ).toMatchObject({
      item: before.item,
      activeUpdatedAt: before.activeUpdatedAt,
      hasDraft: true
    })
    const broken = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'FEAT',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: 'Broken',
      payload: { ...edited.payload, details: [null] }
    })
    const versionsBefore = await t.run((ctx) =>
      ctx.db
        .query('authoredVersions')
        .withIndex('by_id_version', (q) => q.eq('id', draft.subjectId))
        .take(3)
    )
    await expect(first.caller.mutation(publish, publicationInput(broken))).rejects.toThrow()
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredVersions')
          .withIndex('by_id_version', (q) => q.eq('id', draft.subjectId))
          .take(3)
      )
    ).toEqual(versionsBefore)
    expect(
      await first.caller.query(api.content.drafts.get, {
        subjectKind: 'FEAT',
        subjectId: draft.subjectId
      })
    ).toEqual(broken)
    const replacement = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'FEAT',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: 'Replacement',
      payload: { ...draft.payload, description: 'Published replacement' }
    })
    const replaced = await first.caller.mutation(publish, publicationInput(replacement))
    const versionsAfter = await t.run((ctx) =>
      ctx.db
        .query('authoredVersions')
        .withIndex('by_id_version', (q) => q.eq('id', draft.subjectId))
        .take(3)
    )
    expect(versionsAfter).toHaveLength(1)
    expect(versionsAfter[0]).toMatchObject({
      version: 2,
      checksum: replaced.checksum
    })
    expect(await t.run((ctx) => ctx.db.get(versionsBefore[0]!._id))).toBeNull()
    await expect(first.caller.mutation(publish, publicationInput(replacement))).rejects.toThrow(
      'cannot be published'
    )
  })

  it('denies anonymous, foreign, master, wrong-kind publication, and wrong-kind deletion', async () => {
    const { t, first, second } = await fixture()
    const draft = await copyDraft(first.caller)
    const input = publicationInput(draft)
    await expect(t.mutation(publish, input)).rejects.toThrow()
    await expect(second.caller.mutation(publish, input)).rejects.toThrow()
    await expect(
      first.caller.mutation(publish, { ...input, subjectId: grappler.id })
    ).rejects.toThrow()
    await expect(
      first.caller.mutation(publish, { ...input, subjectKind: 'BACKGROUND' })
    ).rejects.toThrow()
    await expect(
      first.caller.mutation(deleteActive, {
        subjectKind: 'FEAT',
        subjectId: acolyte.id
      })
    ).rejects.toThrow()
    await expect(
      first.caller.mutation(deleteActive, {
        subjectKind: 'BACKGROUND',
        subjectId: grappler.id
      })
    ).rejects.toThrow()
    await first.caller.mutation(publish, input)
    await expect(
      t.mutation(deleteActive, {
        subjectKind: 'FEAT',
        subjectId: draft.subjectId
      })
    ).rejects.toThrow()
    await expect(
      second.caller.mutation(deleteActive, {
        subjectKind: 'FEAT',
        subjectId: draft.subjectId
      })
    ).rejects.toThrow()
    await expect(
      first.caller.mutation(deleteActive, {
        subjectKind: 'FEAT',
        subjectId: grappler.id
      })
    ).rejects.toThrow()
  })

  it('deletes only owned active Feat, retaining its working draft and route while preserving foreign content and counts', async () => {
    const { t, first, second } = await fixture()
    const owned = await copyDraft(first.caller)
    await first.caller.mutation(publish, publicationInput(owned))
    const foreign = await copyDraft(second.caller)
    await second.caller.mutation(publish, publicationInput(foreign))
    const working = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'FEAT',
      subjectId: owned.subjectId,
      systemId: owned.systemId,
      label: 'Working Grappler',
      payload: owned.payload
    })
    await first.caller.mutation(deleteActive, {
      subjectKind: 'FEAT',
      subjectId: owned.subjectId
    })
    const retained = await first.caller.query(api.content.drafts.get, {
      subjectKind: 'FEAT',
      subjectId: owned.subjectId
    })
    if (!retained) throw new Error('Missing retained Feat draft')
    expect(retained).toMatchObject({
      subjectId: working.subjectId,
      publicId: working.publicId,
      userId: working.userId,
      systemId: working.systemId,
      payload: working.payload,
      draftState: 'DRAFT_ONLY',
      baseActiveUpdatedAt: null
    })
    expect(retained.updatedAt).not.toBe(working.updatedAt)
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredRouteIds')
          .withIndex('by_subjectId', (q) => q.eq('subjectId', owned.subjectId))
          .unique()
      )
    ).not.toBeNull()
    expect(
      await first.caller.query(details, {
        subjectKind: 'FEAT',
        id: owned.subjectId
      })
    ).toBeNull()
    expect(
      await second.caller.query(details, {
        subjectKind: 'FEAT',
        id: foreign.subjectId
      })
    ).toMatchObject({ item: expect.anything() })
    expect(await first.caller.query(catalogueCounts, scope)).toEqual({
      activeCount: 1,
      masterCount: 1,
      ownedCount: 0
    })
  })
})
