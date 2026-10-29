import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CreateReusableDefinitionInputDto,
  PublishReusableDefinitionDraftInputDto,
  ReusableDefinitionWorkspaceDto,
  SaveReusableDefinitionDraftInputDto
} from '@artificer-toolkit/schema/api/reusableDefinitions'
import type {
  AuthoredDeleteActiveInput,
  AuthoredPublicationResult,
  AuthoredPublishDraftInput
} from '@artificer-toolkit/schema/api/authoredPublication'
import { authoredContentSourceDtoSchema } from '@artificer-toolkit/schema/api/sourceImport'
import { reusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { SRD_SENSE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/senses.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'
import { api, internal } from '../_generated/api'
import { runAccountDeletionStep } from '../../tests/fixtures/accountDeletion'
import { startAccountDeletion } from '../accountDeletionJobs'

type Fixture = Awaited<ReturnType<typeof publicationFixture>>

/** Puts the account's deletion job at the SOURCES step so this suite exercises that step alone. */
async function holdAtSources({ t }: Fixture, userId: string) {
  await t.run(async (ctx) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
    if (!profile) throw new Error('Missing deleting account profile.')
    await startAccountDeletion(ctx, profile.authUserId, userId)
    const job = await ctx.db
      .query('accountDeletionJobs')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
    if (!job) throw new Error('Missing account deletion job.')
    await ctx.db.patch(job._id, { step: 'SOURCES' })
  })
}

/** Runs the SOURCES step until the job moves on, as the scheduler would. */
async function removeSources({ t }: Fixture, userId: string) {
  for (;;) {
    await runAccountDeletionStep(t, userId, internal.content.accountDefinitionDeletion.step)
    const job = await t.run((ctx) =>
      ctx.db
        .query('accountDeletionJobs')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
    )
    if (job?.step !== 'SOURCES') return
  }
}

const modules = import.meta.glob('/apps/apis/convex/**/*.*s')
const authModules = import.meta.glob('/apps/apis/convex/betterAuth/**/*.*s')
const create = makeFunctionReference<
  'mutation',
  CreateReusableDefinitionInputDto,
  ReusableDefinitionWorkspaceDto
>('content/definitions:create')
const saveDraft = makeFunctionReference<
  'mutation',
  SaveReusableDefinitionDraftInputDto,
  ReusableDefinitionWorkspaceDto
>('content/definitions:saveDraft')
const publish = makeFunctionReference<
  'mutation',
  PublishReusableDefinitionDraftInputDto,
  ReusableDefinitionWorkspaceDto
>('content/definitions:publish')
const publishAuthored = makeFunctionReference<
  'mutation',
  AuthoredPublishDraftInput,
  AuthoredPublicationResult
>('content/publication:publishDraft')
const deleteActive = makeFunctionReference<'mutation', AuthoredDeleteActiveInput, null>(
  'content/deletion:deleteActive'
)

const createDefinition = () => ({
  gameSystemId: srdSystemRecord.id,
  definitionFamilyKey: 'sense',
  label: 'Account cleanup',
  description: null
})

function document(id: string) {
  return { ...reusableDefinitionDocumentDtoSchema.parse(SRD_SENSE_DEFINITIONS[0].document), id }
}

async function sourceFor(
  t: Awaited<ReturnType<typeof publicationFixture>>['t'],
  definitionId: string
) {
  const definition = await t.run((ctx) =>
    ctx.db
      .query('reusableDefinitions')
      .withIndex('by_publicId', (q) => q.eq('id', definitionId))
      .unique()
  )
  if (!definition) throw new Error('Missing reusable definition.')
  const source = await t.run((ctx) =>
    ctx.db
      .query('contentSources')
      .withIndex('by_publicId', (q) => q.eq('id', definition.contentSourceId))
      .unique()
  )
  if (!source) throw new Error('Missing content source.')
  return source
}

async function snapshot(t: Awaited<ReturnType<typeof publicationFixture>>['t']) {
  return t.run(async (ctx) => ({
    sources: await ctx.db.query('contentSources').collect(),
    definitions: await ctx.db.query('reusableDefinitions').collect(),
    drafts: await ctx.db.query('reusableDefinitionDrafts').collect(),
    roots: await ctx.db.query('authoredRoots').collect(),
    versions: await ctx.db.query('authoredVersions').collect(),
    catalogues: await ctx.db.query('rulesCatalogues').collect(),
    counts: await ctx.db.query('authoredCatalogueCounts').collect()
  }))
}

describe('account content-source cleanup', () => {
  it('removes owned published, draft, unpublished, and empty sources while preserving unrelated data', async () => {
    const fixture = await publicationFixture(modules, authModules, [])
    const { t, first, second } = fixture
    const published = await first.caller.mutation(create, createDefinition())
    await first.caller.mutation(saveDraft, {
      definitionId: published.id,
      expectedDefinitionVersion: 0,
      expectedDraftVersion: null,
      document: document(published.id)
    })
    await first.caller.mutation(publish, {
      definitionId: published.id,
      expectedDefinitionVersion: 0,
      expectedDraftVersion: 0
    })
    await first.caller.mutation(saveDraft, {
      definitionId: published.id,
      expectedDefinitionVersion: 1,
      expectedDraftVersion: null,
      document: document(published.id)
    })
    const unpublished = await first.caller.mutation(create, createDefinition())
    const unrelated = await second.caller.mutation(create, createDefinition())
    const ownedSource = await sourceFor(t, published.id)
    const emptySourceId = crypto.randomUUID()
    await t.run((ctx) =>
      ctx.db.insert(
        'contentSources',
        authoredContentSourceDtoSchema.parse({
          id: emptySourceId,
          gameSystemId: srdSystemRecord.id,
          kind: 'USER',
          ownerUserId: first.userId,
          code: 'empty',
          label: 'Empty account source',
          description: ''
        })
      )
    )
    await t.run((ctx) =>
      ctx.db.insert('authoredCatalogueCounts', {
        contentSourceId: emptySourceId,
        subjectKind: 'BACKGROUND',
        count: 0
      })
    )
    await holdAtSources(fixture, first.userId)
    const before = await snapshot(t)
    await removeSources(fixture, first.userId)
    const after = await snapshot(t)
    expect(after.sources).toEqual(before.sources.filter((row) => row.ownerUserId !== first.userId))
    expect(after.definitions).toEqual(
      before.definitions.filter((row) => row.ownerUserId !== first.userId)
    )
    expect(after.drafts).toEqual(before.drafts.filter((row) => row.authorUserId !== first.userId))
    expect(after.roots).toEqual(before.roots)
    expect(after.versions).toEqual(before.versions)
    expect(after.catalogues).toEqual(before.catalogues)
    expect(after.counts).toEqual(
      before.counts.filter((row) => row.contentSourceId !== emptySourceId)
    )
    expect(after.definitions).toEqual([expect.objectContaining({ id: unrelated.id })])
    expect(ownedSource.ownerUserId).toBe(first.userId)
    expect(unpublished.id).not.toBe(published.id)
  }, 30000)

  it('refuses retained roots and rolls back definition removal when a later catalogue guard fails', async () => {
    const fixture = await publicationFixture(modules, authModules, [
      [importedSubject({ ...acolyte, subjectKind: 'BACKGROUND', document: acolyte })]
    ])
    const { t, first } = fixture
    const created = await first.caller.mutation(create, createDefinition())
    const source = await sourceFor(t, created.id)
    const draft = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'BACKGROUND',
      subjectId: acolyte.id
    })
    if (!draft.updatedAt) throw new Error('Missing authored draft revision.')
    await first.caller.mutation(publishAuthored, {
      subjectKind: 'BACKGROUND',
      subjectId: draft.subjectId,
      expectedDraftUpdatedAt: draft.updatedAt
    })
    await holdAtSources(fixture, first.userId)
    const withRoot = await snapshot(t)
    await expect(removeSources(fixture, first.userId)).rejects.toThrow(
      'still contains authored roots'
    )
    expect(await snapshot(t)).toEqual(withRoot)
    await first.caller.mutation(deleteActive, {
      subjectKind: 'BACKGROUND',
      subjectId: draft.subjectId
    })
    await t.run(async (ctx) => {
      const catalogue = await ctx.db.query('rulesCatalogues').first()
      if (!catalogue) throw new Error('Missing rules catalogue.')
      await ctx.db.patch(catalogue._id, {
        contentSourceIds: [...catalogue.contentSourceIds, source.id]
      })
    })
    const beforeCatalogueFailure = await snapshot(t)
    await expect(removeSources(fixture, first.userId)).rejects.toThrow(
      'retained by a rules catalogue'
    )
    expect(await snapshot(t)).toEqual(beforeCatalogueFailure)
  }, 30000)
})
