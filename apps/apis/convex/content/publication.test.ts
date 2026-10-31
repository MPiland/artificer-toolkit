import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_REUSABLE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { sourceImportDefinitionDtoSchema } from '@artificer-toolkit/schema/api/sourceImport'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type {
  AuthoredDetailReadInput,
  AuthoredDetailReadResult
} from '@artificer-toolkit/schema/api/content'
import {
  authoredPublishDraftInputSchema,
  type AuthoredDeleteActiveInput,
  type AuthoredPublishDraftInput,
  type AuthoredPublicationResult
} from '@artificer-toolkit/schema/api/authoredPublication'
import type { AuthoredDraftResult } from '@artificer-toolkit/schema/api/authoredDrafts'
import type {
  AuthoredCatalogueScope,
  AuthoredCatalogueCounts
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { backgroundAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/background'
import { compileSubjectWithMechanicsIndex } from '@artificer-toolkit/shared/subjects/compilers'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { authoredSourceFacts } from '@artificer-toolkit/authoring/nodeRuntime'
import { api, components, internal } from '../_generated/api'
import { removeEmptyFixtureSource } from './development'
import {
  importedSubject,
  publicationFixture,
  versionWithCompilation
} from '../../tests/fixtures/publication'
import { readVisibleCatalogue } from '../../tests/fixtures/contentSnapshotReaders'
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
const catalogueScope = {
  subjectKind: 'BACKGROUND' as const,
  systemId: acolyte.systemId
}

const equipmentIds = new Set([
  '00000000-0000-0000-0060-006000000000',
  '00000000-0000-0000-0060-00a500000000',
  '00000000-0000-0000-0060-016b00000000',
  '00000000-0000-0000-0060-016900000000',
  '00000000-0000-0000-0060-016a00000000',
  '00000000-0000-0000-0060-008300000000',
  '00000000-0000-0000-0060-009700000000'
])

async function fixture() {
  return publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [
      [
        importedSubject({
          subjectKind: 'BACKGROUND' as const,
          id: acolyte.id,
          systemId: acolyte.systemId,
          label: acolyte.label,
          document: acolyte
        }),
        ...srdBaselineContent.subjects.equipment
          .filter((item) => equipmentIds.has(item.id))
          .map((item) =>
            importedSubject({
              subjectKind: 'EQUIPMENT',
              ...item,
              document: item
            })
          )
      ]
    ]
  )
}

async function copyDraft(caller: Awaited<ReturnType<typeof fixture>>['first']['caller']) {
  return caller.mutation(api.content.drafts.duplicate, {
    subjectKind: 'BACKGROUND',
    subjectId: acolyte.id
  })
}

function publicationInput(draft: AuthoredDraftResult) {
  return authoredPublishDraftInputSchema.parse({
    subjectKind: 'BACKGROUND',
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: draft.updatedAt
  })
}

describe('native Background publication', () => {
  it.each(['owner', 'publication'] as const)(
    'rejects invalid definition %s evidence during authored publication without consuming the draft',
    async (corruption) => {
      const { t, first } = await fixture()
      const draft = await copyDraft(first.caller)
      const definition = sourceImportDefinitionDtoSchema.parse(SRD_REUSABLE_DEFINITIONS[0])
      await t.mutation(internal.content.import.importDefinitions, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        definitions: [definition]
      })
      await t.run(async (ctx) => {
        const stored = await ctx.db
          .query('reusableDefinitions')
          .withIndex('by_publicId', (q) => q.eq('id', definition.id))
          .unique()
        if (!stored) throw new Error('Missing definition fixture')
        await ctx.db.patch(
          stored._id,
          corruption === 'owner' ? { ownerUserId: first.userId } : { publishedAt: undefined }
        )
      })
      const before = await first.caller.query(api.content.drafts.get, {
        subjectKind: 'BACKGROUND',
        subjectId: draft.subjectId
      })
      await expect(first.caller.mutation(publish, publicationInput(draft))).rejects.toThrow(
        'Stored authoring definition mismatch'
      )
      expect(
        await first.caller.query(api.content.drafts.get, {
          subjectKind: 'BACKGROUND',
          subjectId: draft.subjectId
        })
      ).toEqual(before)
      expect(
        await t.run((ctx) =>
          ctx.db
            .query('authoredRoots')
            .withIndex('by_publicId', (q) => q.eq('id', draft.subjectId))
            .unique()
        )
      ).toBeNull()
    }
  )

  it('restricts CLI source cleanup to empty development fixture sources', async () => {
    const { t, first } = await fixture()
    const draft = await copyDraft(first.caller)
    await first.caller.mutation(publish, publicationInput(draft))
    const cleanup = makeFunctionReference<'mutation', { userId: string; systemId: string }, null>(
      'content/development:removeEmptyFixtureSource'
    )
    const input = { userId: first.userId, systemId: draft.systemId }
    expect(removeEmptyFixtureSource.isInternal).toBe(true)
    await expect(t.mutation(cleanup, input)).rejects.toThrow('Fixture account is required')
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', first.userId))
        .unique()
      if (!profile) throw new Error('Missing fixture profile')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email: 'draft_012345abcdef@example.invalid' }
        }
      })
    })
    await expect(t.mutation(cleanup, input)).rejects.toThrow('still referenced')
    await first.caller.mutation(deleteActive, {
      subjectKind: 'BACKGROUND',
      subjectId: draft.subjectId
    })
    vi.stubEnv('SITE_URL', 'https://example.com')
    try {
      await expect(t.mutation(cleanup, input)).rejects.toThrow('development application origin')
    } finally {
      vi.unstubAllEnvs()
    }
    const readSources = () =>
      t.run((ctx) =>
        ctx.db
          .query('contentSources')
          .withIndex('by_gameSystemId_kind_ownerUserId', (q) =>
            q.eq('gameSystemId', input.systemId).eq('kind', 'USER').eq('ownerUserId', input.userId)
          )
          .take(2)
      )
    expect(await readSources()).toHaveLength(1)
    await t.mutation(cleanup, input)
    expect(await readSources()).toEqual([])
    await expect(t.mutation(cleanup, input)).resolves.toBeNull()
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('contentSources')
          .withIndex('by_publicId', (q) => q.eq('id', SRD_CONTENT_SOURCE.id))
          .unique()
      )
    ).not.toBeNull()
  })

  it('copies only the owned published version while preserving private working edits', async () => {
    const { t, first, second } = await fixture()
    const original = await copyDraft(first.caller)
    await first.caller.mutation(publish, publicationInput(original))
    const lookup = {
      subjectKind: 'BACKGROUND' as const,
      subjectId: original.subjectId
    }
    const active = await first.caller.query(details, {
      subjectKind: 'BACKGROUND',
      id: original.subjectId
    })
    expect(active?.item).toBeDefined()
    const working = await first.caller.mutation(api.content.drafts.save, {
      ...lookup,
      systemId: original.systemId,
      label: 'Unpublished changes',
      payload: {
        ...original.payload,
        description: 'Private unfinished description'
      }
    })
    const visible = await readVisibleCatalogue(t, first.caller, 'BACKGROUND', catalogueScope)
    expect(visible.find((item) => item.id === original.subjectId)?.permissions.canCopy).toBe(true)
    await expect(t.mutation(api.content.drafts.duplicate, lookup)).rejects.toThrow(
      'Unauthenticated'
    )
    await expect(second.caller.mutation(api.content.drafts.duplicate, lookup)).rejects.toThrow(
      'Authored content not found'
    )
    const copied = await first.caller.mutation(api.content.drafts.duplicate, lookup)
    expect(copied.subjectId).not.toBe(original.subjectId)
    expect(copied.publicId).not.toBe(original.publicId)
    expect(copied).toMatchObject({
      userId: first.userId,
      label: `${original.label} Copy`,
      draftState: 'DRAFT_ONLY',
      baseActiveUpdatedAt: null
    })
    const payload = backgroundAuthoredDtoSchema.parse(copied.payload)
    const source = backgroundAuthoredDtoSchema.parse(original.payload)
    expect(payload.description).toBe(source.description)
    expect(payload.features?.[0]?.id).not.toBe(source.features?.[0]?.id)
    expect(await first.caller.query(api.content.drafts.get, lookup)).toEqual(working)
    expect(
      await first.caller.query(details, {
        subjectKind: 'BACKGROUND',
        id: original.subjectId
      })
    ).toMatchObject({ item: active?.item })
    expect(await t.run((ctx) => ctx.db.query('authoredDrafts').take(3))).toHaveLength(2)
  })

  it('deletes owned active content while retaining the exact working draft and route', async () => {
    const { t, first } = await fixture()
    const draft = await copyDraft(first.caller)
    expect((await first.caller.query(api.accountEntitlements.get, {})).usage.homebrewRoots).toBe(1)
    await first.caller.mutation(publish, publicationInput(draft))
    expect((await first.caller.query(api.accountEntitlements.get, {})).usage.homebrewRoots).toBe(1)
    const lookup = {
      subjectKind: 'BACKGROUND' as const,
      subjectId: draft.subjectId
    }
    const working = await first.caller.mutation(api.content.drafts.save, {
      ...lookup,
      systemId: draft.systemId,
      label: 'Work in progress',
      payload: draft.payload
    })
    await first.caller.mutation(deleteActive, lookup)
    expect((await first.caller.query(api.accountEntitlements.get, {})).usage.homebrewRoots).toBe(1)
    const retained = await first.caller.query(api.content.drafts.get, lookup)
    expect(retained).toMatchObject({
      ...working,
      draftState: 'DRAFT_ONLY',
      baseActiveUpdatedAt: null,
      updatedAt: expect.any(String)
    })
    expect(Date.parse(retained!.updatedAt!)).toBeGreaterThan(Date.parse(working.updatedAt!))
    expect(await first.caller.query(catalogueCounts, catalogueScope)).toEqual({
      activeCount: 1,
      masterCount: 1,
      ownedCount: 0
    })
    const versions = await t.run((ctx) =>
      ctx.db
        .query('authoredVersions')
        .withIndex('by_id_version', (q) => q.eq('id', draft.subjectId))
        .take(2)
    )
    expect(versions).toEqual([])
    await expect(first.caller.mutation(publish, publicationInput(working))).rejects.toThrow(
      'draft or published content changed'
    )
    const republished = await first.caller.mutation(publish, publicationInput(retained!))
    expect(republished.publicId).toBe(working.publicId)
    expect((await first.caller.query(api.accountEntitlements.get, {})).usage.homebrewRoots).toBe(1)
    await first.caller.mutation(api.content.drafts.save, {
      ...lookup,
      systemId: draft.systemId,
      label: 'Retained draft',
      payload: draft.payload
    })
    await first.caller.mutation(deleteActive, lookup)
    expect((await first.caller.query(api.accountEntitlements.get, {})).usage.homebrewRoots).toBe(1)
    await first.caller.mutation(api.content.drafts.discard, lookup)
    expect((await first.caller.query(api.accountEntitlements.get, {})).usage.homebrewRoots).toBe(0)
  })

  it('removes a deleted active route without a draft and decrements a nonempty catalogue', async () => {
    const { t, first } = await fixture()
    const firstDraft = await copyDraft(first.caller)
    const duplicate = await copyDraft(first.caller)
    const secondDraft = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'BACKGROUND',
      subjectId: duplicate.subjectId,
      systemId: duplicate.systemId,
      label: 'Acolyte second copy',
      payload: duplicate.payload
    })
    const drafts = [firstDraft, secondDraft]
    for (const draft of drafts) await first.caller.mutation(publish, publicationInput(draft))
    await first.caller.mutation(deleteActive, {
      subjectKind: 'BACKGROUND',
      subjectId: drafts[0].subjectId
    })
    expect(await first.caller.query(catalogueCounts, catalogueScope)).toEqual({
      activeCount: 2,
      masterCount: 1,
      ownedCount: 1
    })
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredRouteIds')
          .withIndex('by_subjectId', (q) => q.eq('subjectId', drafts[0].subjectId))
          .unique()
      )
    ).toBeNull()
  })

  it('denies anonymous, foreign, master, wrong-kind, and repeated active deletion', async () => {
    const { t, first, second } = await fixture()
    const draft = await copyDraft(first.caller)
    await first.caller.mutation(publish, publicationInput(draft))
    const input = {
      subjectKind: 'BACKGROUND' as const,
      subjectId: draft.subjectId
    }
    await expect(t.mutation(deleteActive, input)).rejects.toThrow()
    await expect(second.caller.mutation(deleteActive, input)).rejects.toThrow('cannot be deleted')
    await expect(
      first.caller.mutation(deleteActive, { ...input, subjectId: acolyte.id })
    ).rejects.toThrow('cannot be deleted')
    await expect(
      first.caller.mutation(deleteActive, {
        ...input,
        subjectId: [...equipmentIds][0]
      })
    ).rejects.toThrow('cannot be deleted')
    await first.caller.mutation(deleteActive, input)
    await expect(first.caller.mutation(deleteActive, input)).rejects.toThrow('cannot be deleted')
  })

  it('preserves the active version, route and draft when a corrupt counter rejects deletion', async () => {
    const { t, first } = await fixture()
    const copied = await copyDraft(first.caller)
    await first.caller.mutation(publish, publicationInput(copied))
    const input = {
      subjectKind: 'BACKGROUND' as const,
      subjectId: copied.subjectId
    }
    const working = await first.caller.mutation(api.content.drafts.save, {
      ...input,
      systemId: copied.systemId,
      label: copied.label,
      payload: copied.payload
    })
    const before = await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', input.subjectId))
        .unique()
      if (!root) throw new Error('Missing root fixture')
      const counts = await ctx.db
        .query('authoredCatalogueCounts')
        .withIndex('by_source_kind', (q) =>
          q.eq('contentSourceId', root.contentSourceId).eq('subjectKind', 'BACKGROUND')
        )
        .unique()
      if (!counts) throw new Error('Missing counter fixture')
      await ctx.db.patch(counts._id, { count: 0 })
      return {
        root,
        version: await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId)),
        route: await ctx.db
          .query('authoredRouteIds')
          .withIndex('by_subjectId', (q) => q.eq('subjectId', input.subjectId))
          .unique()
      }
    })
    await expect(first.caller.mutation(deleteActive, input)).rejects.toThrow(
      'count integrity mismatch'
    )
    expect(await first.caller.query(api.content.drafts.get, input)).toEqual(working)
    expect(
      await t.run(async (ctx) => ({
        root: await ctx.db.get(before.root._id),
        version: await versionWithCompilation(ctx, await ctx.db.get(before.root.currentVersionId)),
        route: await ctx.db
          .query('authoredRouteIds')
          .withIndex('by_subjectId', (q) => q.eq('subjectId', input.subjectId))
          .unique()
      }))
    ).toEqual(before)
  })

  it('rejects partially backfilled catalogue counts even when a counter already exists', async () => {
    const { t, first } = await fixture()
    const firstDraft = await copyDraft(first.caller)
    const duplicate = await copyDraft(first.caller)
    const secondDraft = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'BACKGROUND',
      subjectId: duplicate.subjectId,
      systemId: duplicate.systemId,
      label: 'Acolyte second copy',
      payload: duplicate.payload
    })
    const drafts = [firstDraft, secondDraft]
    for (const draft of drafts) await first.caller.mutation(publish, publicationInput(draft))
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', drafts[1].subjectId))
        .unique()
      if (!root) throw new Error('Missing fixture')
      const counts = await ctx.db
        .query('authoredCatalogueCounts')
        .withIndex('by_source_kind', (q) =>
          q.eq('contentSourceId', root.contentSourceId).eq('subjectKind', root.subjectKind)
        )
        .unique()
      if (!counts) throw new Error('Missing counter fixture')
      await ctx.db.patch(root._id, { catalogue: undefined })
      await ctx.db.patch(counts._id, { count: 1 })
    })
    await expect(first.caller.query(catalogueCounts, catalogueScope)).rejects.toThrow(
      'backfill is incomplete'
    )
  })

  it('lists only master and caller-owned rows, with exact counts and no mechanics', async () => {
    const { t, first, second } = await fixture()
    for (const label of ['zebra', 'Aaron', 'Acolyte']) {
      const copied = await copyDraft(first.caller)
      const draft = await first.caller.mutation(api.content.drafts.save, {
        subjectKind: 'BACKGROUND',
        subjectId: copied.subjectId,
        systemId: copied.systemId,
        label,
        payload: copied.payload
      })
      await first.caller.mutation(publish, publicationInput(draft))
    }
    const foreign = await copyDraft(second.caller)
    await second.caller.mutation(publish, publicationInput(foreign))
    const draftOnly = await copyDraft(first.caller)
    const items = await readVisibleCatalogue(t, first.caller, 'BACKGROUND', catalogueScope)
    expect(items.map((item) => item.label)).toEqual(['Aaron', 'Acolyte', 'Acolyte', 'zebra'])
    expect(new Set(items.map((item) => item.id)).size).toBe(4)
    expect(
      items.some((item) => item.id === foreign.subjectId || item.id === draftOnly.subjectId)
    ).toBe(false)
    expect(await first.caller.query(catalogueCounts, catalogueScope)).toEqual({
      activeCount: 4,
      masterCount: 1,
      ownedCount: 3
    })
    expect(await second.caller.query(catalogueCounts, catalogueScope)).toEqual({
      activeCount: 2,
      masterCount: 1,
      ownedCount: 1
    })
    expect(await t.query(catalogueCounts, catalogueScope)).toEqual({
      activeCount: 1,
      masterCount: 1,
      ownedCount: 0
    })
    expect(
      await readVisibleCatalogue(t, first.caller, 'BACKGROUND', {
        ...catalogueScope,
        source: 'OWNED'
      })
    ).toHaveLength(3)
    expect(
      await readVisibleCatalogue(t, first.caller, 'BACKGROUND', {
        ...catalogueScope,
        source: 'MASTER'
      })
    ).toHaveLength(1)
    for (const item of items) {
      expect(item).not.toHaveProperty('_id')
      expect(item).not.toHaveProperty('documentJson')
      expect(item).not.toHaveProperty('compilation')
      expect(item).not.toHaveProperty('checksum')
      expect(item.permissions.canEdit).toBe(item.provenance.kind === 'OWNED')
    }
  })

  it('refreshes list metadata without double counting replacement and preserves counts on rejected publication', async () => {
    const { t, first } = await fixture()
    const copied = await copyDraft(first.caller)
    await first.caller.mutation(publish, publicationInput(copied))
    const edit = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'BACKGROUND',
      subjectId: copied.subjectId,
      systemId: copied.systemId,
      label: 'New catalogue label',
      payload: copied.payload
    })
    await first.caller.mutation(publish, publicationInput(edit))
    await expect(first.caller.mutation(publish, publicationInput(edit))).rejects.toThrow()
    expect(await first.caller.query(catalogueCounts, catalogueScope)).toEqual({
      activeCount: 2,
      masterCount: 1,
      ownedCount: 1
    })
    const result = await readVisibleCatalogue(t, first.caller, 'BACKGROUND', {
      ...catalogueScope,
      source: 'OWNED'
    })
    expect(result.map((item) => item.label)).toEqual(['New catalogue label'])
  })

  it('gives same-millisecond saves distinct publication tokens', async () => {
    const { first } = await fixture()
    const draft = await copyDraft(first.caller)
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now())
    try {
      const input = {
        subjectKind: 'BACKGROUND' as const,
        subjectId: draft.subjectId,
        systemId: draft.systemId,
        label: draft.label,
        payload: draft.payload
      }
      const firstSave = await first.caller.mutation(api.content.drafts.save, input)
      const secondSave = await first.caller.mutation(api.content.drafts.save, input)
      expect(publicationInput(secondSave).expectedDraftUpdatedAt).not.toBe(
        publicationInput(firstSave).expectedDraftUpdatedAt
      )
      await expect(first.caller.mutation(publish, publicationInput(firstSave))).rejects.toThrow(
        'draft or published content changed'
      )
    } finally {
      clock.mockRestore()
    }
  })

  it('rejects a changed published base before replacing current content', async () => {
    const { t, first } = await fixture()
    const draft = await copyDraft(first.caller)
    await first.caller.mutation(publish, publicationInput(draft))
    const edit = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'BACKGROUND',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: 'Edited',
      payload: draft.payload
    })
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('authoredDrafts')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', draft.subjectId))
        .unique()
      if (!row) throw new Error('Missing edit fixture')
      await ctx.db.patch(row._id, { basePublishedChecksum: '0'.repeat(64) })
    })
    const before = await first.caller.query(details, {
      subjectKind: 'BACKGROUND',
      id: draft.subjectId
    })
    await expect(first.caller.mutation(publish, publicationInput(edit))).rejects.toThrow(
      'draft or published content changed'
    )
    expect(
      await first.caller.query(details, {
        subjectKind: 'BACKGROUND',
        id: draft.subjectId
      })
    ).toEqual(before)
  })

  it('publishes compiled content, exposes private details, and reuses the owner/System source', async () => {
    const { t, first, second } = await fixture()
    const draft = await copyDraft(first.caller)
    const result = await first.caller.mutation(publish, publicationInput(draft))
    expect(result).toMatchObject({
      subjectKind: 'BACKGROUND',
      subjectId: draft.subjectId,
      publicId: draft.publicId
    })
    const stored = await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', draft.subjectId))
        .unique()
      if (!root) throw new Error('Missing published root')
      const version = await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
      const source = await ctx.db
        .query('contentSources')
        .withIndex('by_publicId', (q) => q.eq('id', root.contentSourceId))
        .unique()
      return {
        root,
        version,
        source,
        document: version && (await readStoredAuthoredVersionDocument(ctx, version))
      }
    })
    expect(stored.version?.checksum).toBe(result.checksum)
    expect(stored.version?.compilation?.authoredChecksum).toBe(result.checksum)
    if (!stored.version?.compilation) throw new Error('Missing current compilation')
    const document = backgroundAuthoredDtoSchema.parse(stored.document)
    const projection = jsonValueSchema.parse(JSON.parse(stored.version.compilation.projectionJson))
    expect(projection).toEqual(
      JSON.parse(
        JSON.stringify(
          compileSubjectWithMechanicsIndex({
            subjectKind: 'BACKGROUND',
            authored: document
          }).compiled
        )
      )
    )
    expect(stored.version.compilation.projectionChecksum).toBe(checksumRuleDocument(projection))
    expect(stored.source).toMatchObject({
      id: stored.root.contentSourceId,
      kind: 'USER',
      code: 'default',
      ownerUserId: first.userId,
      gameSystemId: srdSystemRecord.id
    })
    expect(
      await first.caller.query(details, {
        subjectKind: 'BACKGROUND',
        id: draft.subjectId
      })
    ).toMatchObject({
      item: expect.objectContaining({
        startingEquipment: draft.payload.startingEquipment
      })
    })
    expect(
      await first.caller.query(api.content.drafts.get, {
        subjectKind: 'BACKGROUND',
        subjectId: draft.subjectId
      })
    ).toBeNull()
    expect(
      await t.query(details, {
        subjectKind: 'BACKGROUND',
        id: draft.subjectId
      })
    ).toBeNull()
    expect(
      await second.caller.query(details, {
        subjectKind: 'BACKGROUND',
        id: draft.subjectId
      })
    ).toBeNull()
    const copiedAgain = await copyDraft(first.caller)
    const secondDraft = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'BACKGROUND',
      subjectId: copiedAgain.subjectId,
      systemId: copiedAgain.systemId,
      label: 'Acolyte second copy',
      payload: copiedAgain.payload
    })
    const secondResult = await first.caller.mutation(publish, publicationInput(secondDraft))
    expect(secondResult.subjectId).not.toBe(result.subjectId)
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('contentSources')
          .withIndex('by_gameSystemId_kind_ownerUserId', (q) =>
            q
              .eq('gameSystemId', srdSystemRecord.id)
              .eq('kind', 'USER')
              .eq('ownerUserId', first.userId)
          )
          .take(10)
      )
    ).toHaveLength(1)
  })

  it('replaces the current version, rejects stale or invalid drafts, and preserves failed state', async () => {
    const { t, first } = await fixture()
    const draft = await copyDraft(first.caller)
    const stale = publicationInput(draft)
    const saved = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'BACKGROUND',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: 'Edited',
      payload: draft.payload
    })
    await expect(first.caller.mutation(publish, stale)).rejects.toThrow(
      'draft or published content changed'
    )
    const firstResult = await first.caller.mutation(publish, publicationInput(saved))
    const originalFacts = await t.run((ctx) =>
      readStoredSourceFacts(ctx, { id: draft.subjectId, checksum: firstResult.checksum })
    )
    expect(originalFacts?.rows.features?.length).toBeGreaterThan(0)
    const edited = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'BACKGROUND',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: 'Broken',
      payload: { ...draft.payload, details: [null] }
    })
    const before = await t.run((ctx) =>
      ctx.db
        .query('authoredVersions')
        .withIndex('by_id_version', (q) => q.eq('id', draft.subjectId))
        .take(10)
    )
    await expect(first.caller.mutation(publish, publicationInput(edited))).rejects.toThrow()
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredVersions')
          .withIndex('by_id_version', (q) => q.eq('id', draft.subjectId))
          .take(10)
      )
    ).toEqual(before)
    expect(firstResult.checksum).toBe(before[0]?.checksum)
    expect(
      await first.caller.query(api.content.drafts.get, {
        subjectKind: 'BACKGROUND',
        subjectId: draft.subjectId
      })
    ).toEqual(edited)
    const repaired = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'BACKGROUND',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: 'Replacement',
      payload: { ...draft.payload, features: [] }
    })
    const replacement = await first.caller.mutation(publish, publicationInput(repaired))
    const remaining = await t.run(async (ctx) => {
      const versions = await ctx.db
        .query('authoredVersions')
        .withIndex('by_id_version', (q) => q.eq('id', draft.subjectId))
        .take(10)
      const version = versions[0]
      if (!version) throw new Error('Missing replacement version')
      return {
        versions,
        document: await readStoredAuthoredVersionDocument(ctx, version)
      }
    })
    expect(remaining.versions).toHaveLength(1)
    expect(remaining.versions[0]).toMatchObject({
      checksum: replacement.checksum,
      version: 2
    })
    const replacedFacts = await t.run((ctx) =>
      readStoredSourceFacts(ctx, { id: draft.subjectId, checksum: replacement.checksum })
    )
    expect(replacedFacts).toEqual(
      authoredSourceFacts({
        subjectKind: 'BACKGROUND',
        document: backgroundAuthoredDtoSchema.parse(remaining.document),
        checksum: replacement.checksum
      })
    )
    expect(replacedFacts?.rows.features).toBeUndefined()
    expect(await t.run((ctx) => ctx.db.get(before[0]._id))).toBeNull()
    await expect(first.caller.mutation(publish, publicationInput(repaired))).rejects.toThrow(
      'cannot be published'
    )
  })

  it('denies anonymous, stranger, and master publication', async () => {
    const { t, first, second } = await fixture()
    const draft = await copyDraft(first.caller)
    const input = publicationInput(draft)
    await expect(t.mutation(publish, input)).rejects.toThrow()
    await expect(second.caller.mutation(publish, input)).rejects.toThrow()
    await expect(
      first.caller.mutation(publish, { ...input, subjectId: acolyte.id })
    ).rejects.toThrow()
  })

  it('rolls back the inserted source when the stored route mismatches', async () => {
    const { t, first } = await fixture()
    const draft = await copyDraft(first.caller)
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('authoredDrafts')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', draft.subjectId))
        .unique()
      if (!row) throw new Error('Missing draft')
      await ctx.db.patch(row._id, { publicId: 'wrong-route' })
    })
    const before = await t.run((ctx) =>
      ctx.db
        .query('contentSources')
        .withIndex('by_gameSystemId_kind_ownerUserId', (q) =>
          q
            .eq('gameSystemId', srdSystemRecord.id)
            .eq('kind', 'USER')
            .eq('ownerUserId', first.userId)
        )
        .take(10)
    )
    await expect(first.caller.mutation(publish, publicationInput(draft))).rejects.toThrow(
      'route mismatch'
    )
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('contentSources')
          .withIndex('by_gameSystemId_kind_ownerUserId', (q) =>
            q
              .eq('gameSystemId', srdSystemRecord.id)
              .eq('kind', 'USER')
              .eq('ownerUserId', first.userId)
          )
          .take(10)
      )
    ).toEqual(before)
  })
})
