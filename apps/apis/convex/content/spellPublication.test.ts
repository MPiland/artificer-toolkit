import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import { sorcerer } from '@artificer-toolkit/source-data/srd/classes/sorcerer.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { fireball } from '@artificer-toolkit/source-data/srd/spells/fireball.js'
import { prismaticWall } from '@artificer-toolkit/source-data/srd/spells/prismatic-wall.js'
import { passwall } from '@artificer-toolkit/source-data/srd/spells/passwall.js'
import { daylight } from '@artificer-toolkit/source-data/srd/spells/daylight.js'
import { dispelMagic } from '@artificer-toolkit/source-data/srd/spells/dispel-magic.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  spellResponseDtoSchema,
  type AuthoredDetailReadInput,
  type AuthoredDetailReadResult
} from '@artificer-toolkit/schema/api/content'
import type { AuthoredDraftResult } from '@artificer-toolkit/schema/api/authoredDrafts'
import {
  authoredPublishDraftInputSchema,
  type AuthoredPublishDraftInput,
  type AuthoredDeleteActiveInput,
  type AuthoredPublicationResult
} from '@artificer-toolkit/schema/api/authoredPublication'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import type { AuthoredCatalogueSearchBackfillResult } from '@artificer-toolkit/schema/api/authoredCatalogue'
import { summarizeContentCatalogue } from '@artificer-toolkit/rules-runtime/contentCatalogue'
import { nodeRuntimeResolveRequestDtoSchema } from '@artificer-toolkit/schema/api/nodeRuntime'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { authoredSourceFacts } from '@artificer-toolkit/authoring/nodeRuntime'
import { compileSubjectWithMechanicsIndex } from '@artificer-toolkit/shared/subjects/compilers'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { collectReferenceIds, stripPortableMetadata } from '@artificer-toolkit/shared/utils'
import { api, internal } from '../_generated/api'
import {
  importedSubject,
  importSeededSubjects,
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
function depth(value: unknown): number {
  if (!value || typeof value !== 'object') return 0
  return 1 + Math.max(0, ...Object.values(value).map(depth))
}

async function fixture() {
  return publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [
      [
        importedSubject({
          subjectKind: 'SPELL',
          ...fireball,
          document: fireball
        }),
        importedSubject({
          subjectKind: 'SPELL',
          ...prismaticWall,
          document: prismaticWall
        })
      ],
      [
        importedSubject({
          subjectKind: 'CLASS',
          ...sorcerer,
          document: sorcerer
        })
      ],
      [importedSubject({ subjectKind: 'CLASS', ...wizard, document: wizard })]
    ]
  )
}

async function copyDraft(
  caller: Awaited<ReturnType<typeof fixture>>['first']['caller'],
  subjectId = fireball.id
) {
  return caller.mutation(api.content.drafts.duplicate, {
    subjectKind: 'SPELL',
    subjectId
  })
}

function publicationInput(draft: AuthoredDraftResult): AuthoredPublishDraftInput {
  if (!draft.updatedAt) throw new Error('Missing Spell draft revision')
  return authoredPublishDraftInputSchema.parse({
    subjectKind: 'SPELL',
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: draft.updatedAt
  })
}

describe('native Spell publication', () => {
  it('rebuilds missing Class dependencies on exact canonical replay without duplicating them', async () => {
    const { t } = await fixture()
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', fireball.id))
        .unique()
      if (!root) throw new Error('Missing canonical Spell')
      await ctx.db.patch(root._id, { spellClassesIndexed: undefined })
      const classes = await ctx.db
        .query('authoredSpellClasses')
        .withIndex('by_spellId', (q) => q.eq('spellId', fireball.id))
        .collect()
      for (const row of classes) await ctx.db.delete(row._id)
    })
    const input = {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [
        importedSubject({
          subjectKind: 'SPELL',
          ...fireball,
          document: fireball
        })
      ]
    }
    await importSeededSubjects(t, input)
    const rebuilt = await t.run(async (ctx) => ({
      root: await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', fireball.id))
        .unique(),
      classes: await ctx.db
        .query('authoredSpellClasses')
        .withIndex('by_spellId', (q) => q.eq('spellId', fireball.id))
        .collect()
    }))
    expect(rebuilt.root?.spellClassesIndexed).toBe(true)
    expect(rebuilt.classes.map((row) => row.classId).sort()).toEqual([...fireball.classIds].sort())
    await importSeededSubjects(t, input)
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredSpellClasses')
          .withIndex('by_spellId', (q) => q.eq('spellId', fireball.id))
          .collect()
      )
    ).toEqual(rebuilt.classes)
  })

  it('publishes Fireball with its classIds, effects, compilation, private detail, and source identity', async () => {
    const { t, first, second } = await fixture()
    const draft = await copyDraft(first.caller)
    const copied = spellAuthoredDtoSchema.parse(draft.payload)
    expect(
      (
        await first.caller.query(api.content.exports.get, {
          subjectKind: 'SPELL',
          id: draft.publicId,
          view: 'draft'
        })
      ).item
    ).toEqual({ kind: 'SPELL', data: stripPortableMetadata(draft.payload) })
    const result = await first.caller.mutation(publish, publicationInput(draft))
    const systemId = fireball.systemId
    expect(
      (await readVisibleCatalogue(t, first.caller, 'SPELL', { systemId }))
        .map((item) => item.id)
        .sort()
    ).toEqual([fireball.id, prismaticWall.id, draft.subjectId].sort())
    expect(
      (await readVisibleCatalogue(t, second.caller, 'SPELL', { systemId }))
        .map((item) => item.id)
        .sort()
    ).toEqual([fireball.id, prismaticWall.id].sort())
    expect(
      await readVisibleCatalogue(t, first.caller, 'SPELL', { systemId: crypto.randomUUID() })
    ).toEqual([])
    const stored = await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', draft.subjectId))
        .unique()
      if (!root) throw new Error('Missing published Spell root')
      const version = await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
      return {
        root,
        sourceFacts: await readStoredSourceFacts(ctx, root),
        version,
        document: version && (await readStoredAuthoredVersionDocument(ctx, version)),
        source: await ctx.db
          .query('contentSources')
          .withIndex('by_publicId', (q) => q.eq('id', root.contentSourceId))
          .unique(),
        route: await ctx.db
          .query('authoredRouteIds')
          .withIndex('by_subjectId', (q) => q.eq('subjectId', draft.subjectId))
          .unique()
      }
    })
    const document = spellAuthoredDtoSchema.parse(stored.document)
    expect(stored.root).toMatchObject({
      subjectKind: 'SPELL',
      activeNameKey: draft.label.trim().toLowerCase(),
      ownerUserId: first.userId
    })
    expect(stored.source).toMatchObject({
      kind: 'USER',
      ownerUserId: first.userId
    })
    expect(stored.route?.publicId).toBe(draft.publicId)
    expect(document.classIds).toEqual(fireball.classIds)
    expect(document.effects).toEqual(copied.effects)
    const runtimeInput = nodeRuntimeResolveRequestDtoSchema.parse({
      mapId: 'spell',
      systemId: document.systemId,
      values: document
    })
    const resolved = await first.caller.query(api.authoring.nodeRuntime.resolve, runtimeInput)
    expect(resolved.mapId).toBe('spell')
    expect(resolved.steps.length).toBeGreaterThan(0)
    expect(resolved.scopes).toBeDefined()
    const normalized = await first.caller.query(
      api.authoring.nodeRuntime.normalizeValues,
      runtimeInput
    )
    expect(normalized.values).toMatchObject({
      classIds: document.classIds,
      magicSchoolId: document.magicSchoolId,
      castingTime: document.castingTime
    })
    expect(normalized.clearedPaths).toEqual([])
    expect(
      (
        await first.caller.query(api.content.exports.get, {
          subjectKind: 'SPELL',
          id: draft.publicId,
          view: 'active'
        })
      ).item
    ).toEqual({ kind: 'SPELL', data: stripPortableMetadata(document) })
    await expect(
      second.caller.query(api.content.exports.get, {
        subjectKind: 'SPELL',
        id: draft.subjectId,
        view: 'active'
      })
    ).rejects.toThrow('Only owned authored content')
    expect(stored.version?.checksum).toBe(result.checksum)
    expect(stored.version?.compilation?.authoredChecksum).toBe(result.checksum)
    const projection = jsonValueSchema.parse(
      JSON.parse(stored.version!.compilation!.projectionJson)
    )
    expect(projection).toEqual(
      JSON.parse(
        JSON.stringify(
          compileSubjectWithMechanicsIndex({
            subjectKind: 'SPELL',
            authored: document
          }).compiled
        )
      )
    )
    expect(stored.version?.compilation?.projectionChecksum).toBe(checksumRuleDocument(projection))
    expect(stored.sourceFacts).toEqual(
      authoredSourceFacts({
        subjectKind: 'SPELL',
        document,
        checksum: result.checksum
      })
    )
    expect(
      await first.caller.query(api.content.drafts.get, {
        subjectKind: 'SPELL',
        subjectId: draft.subjectId
      })
    ).toBeNull()
    expect(await t.query(details, { subjectKind: 'SPELL', id: draft.subjectId })).toBeNull()
    expect(
      await second.caller.query(details, {
        subjectKind: 'SPELL',
        id: draft.subjectId
      })
    ).toBeNull()
    const detail = spellResponseDtoSchema.parse(
      await first.caller.query(details, {
        subjectKind: 'SPELL',
        id: draft.publicId,
        meta: ['classes', 'conditionTypes', 'damageTypes', 'magicSchools']
      })
    )
    expect(detail).toMatchObject({
      item: expect.objectContaining({ id: draft.subjectId, status: 'ACTIVE' })
    })
    expect(detail?.meta?.classes?.map((option) => option.value).sort()).toEqual(
      [...fireball.classIds].sort()
    )
    expect(detail?.meta?.magicSchools).toEqual([
      { value: fireball.magicSchoolId, label: 'Evocation' }
    ])
    expect(detail?.meta?.conditionTypes).toEqual([])
    expect(detail?.meta?.damageTypes?.map((option) => option.value).sort()).toEqual(
      collectReferenceIds(document, 'damageTypeId', 'damageTypeIds').sort()
    )
  })

  it('lists Spell facts and facets from the list part, and backfills Spell catalogue metadata', async () => {
    const { t, first, second } = await fixture()
    const systemId = fireball.systemId
    const draft = await copyDraft(first.caller)
    await first.caller.mutation(publish, publicationInput(draft))
    const items = await readVisibleCatalogue(t, first.caller, 'SPELL', { systemId })
    expect(items.find((item) => item.id === fireball.id)).toMatchObject({
      classIds: [...fireball.classIds].sort(),
      classLabels: expect.arrayContaining([sorcerer.label, wizard.label]),
      level: fireball.level,
      magicSchoolId: fireball.magicSchoolId,
      magicSchoolLabel: 'Evocation',
      castingTimeUnit: fireball.castingTime.unit,
      castingTimeAmount: fireball.castingTime.amount
    })
    expect(items.map((item) => item.id)).toEqual(
      expect.arrayContaining([fireball.id, prismaticWall.id, draft.subjectId])
    )
    expect(summarizeContentCatalogue('SPELL', items)).toMatchObject({
      ownedCount: 1,
      spellFacets: {
        classes: expect.arrayContaining([{ id: wizard.id, label: wizard.label }]),
        schools: expect.arrayContaining([{ id: fireball.magicSchoolId, label: 'Evocation' }]),
        levels: expect.arrayContaining([{ id: fireball.level }, { id: prismaticWall.level }])
      }
    })
    expect(
      (await readVisibleCatalogue(t, second.caller, 'SPELL', { systemId, source: 'OWNED' })).length
    ).toBe(0)
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', fireball.id))
        .unique()
      if (!root?.catalogue?.spell) throw new Error('Missing Spell catalogue metadata')
      await ctx.db.patch(root._id, {
        catalogue: { ...root.catalogue, spell: undefined }
      })
    })
    let backfillCursor: string | null = null
    for (let index = 0; index < 4; index++) {
      const result: AuthoredCatalogueSearchBackfillResult = await t.mutation(
        internal.content.catalogueSearchBackfill.backfill,
        { paginationOpts: { cursor: backfillCursor, numItems: 8 } }
      )
      if (result.isDone) break
      backfillCursor = result.continueCursor
    }
    expect(
      await t.run(async (ctx) => {
        const root = await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', fireball.id))
          .unique()
        return root?.catalogue?.spell?.level
      })
    ).toBe(fireball.level)
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', fireball.id))
        .unique()
      if (!root?.catalogue?.spell) throw new Error('Missing restored Spell catalogue metadata')
      await ctx.db.patch(root._id, {
        catalogue: {
          ...root.catalogue,
          spell: { ...root.catalogue.spell, level: 9 }
        }
      })
    })
    await expect(
      importSeededSubjects(t, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects: [
          importedSubject({
            subjectKind: 'SPELL',
            ...fireball,
            document: fireball
          })
        ]
      })
    ).rejects.toThrow('Canonical content conflict')
  })

  it('preserves active Spell content through working, stale, and invalid drafts before replacing it', async () => {
    const { t, first } = await fixture()
    const draft = await copyDraft(first.caller)
    await first.caller.mutation(publish, publicationInput(draft))
    const activeBefore = await first.caller.query(details, {
      subjectKind: 'SPELL',
      id: draft.subjectId
    })
    const working = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'SPELL',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: 'Working Fireball',
      payload: { ...draft.payload, description: 'Unpublished' }
    })
    await expect(first.caller.mutation(publish, publicationInput(draft))).rejects.toThrow(
      'draft or published content changed'
    )
    expect(
      await first.caller.query(details, {
        subjectKind: 'SPELL',
        id: draft.subjectId
      })
    ).toMatchObject({
      item: activeBefore?.item,
      activeUpdatedAt: activeBefore?.activeUpdatedAt,
      hasDraft: true
    })
    const versionsBefore = await t.run((ctx) =>
      ctx.db
        .query('authoredVersions')
        .withIndex('by_id_version', (q) => q.eq('id', draft.subjectId))
        .take(3)
    )
    const invalid = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'SPELL',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: 'Broken Fireball',
      payload: { ...working.payload, level: 99 }
    })
    await expect(first.caller.mutation(publish, publicationInput(invalid))).rejects.toThrow()
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
        subjectKind: 'SPELL',
        subjectId: draft.subjectId
      })
    ).toEqual(invalid)
    const replacement = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'SPELL',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: 'Replacement Fireball',
      payload: { ...draft.payload, description: 'Published replacement' }
    })
    const result = await first.caller.mutation(publish, publicationInput(replacement))
    const versionsAfter = await t.run((ctx) =>
      ctx.db
        .query('authoredVersions')
        .withIndex('by_id_version', (q) => q.eq('id', draft.subjectId))
        .take(3)
    )
    expect(versionsAfter).toHaveLength(1)
    expect(versionsAfter[0]).toMatchObject({
      version: 2,
      checksum: result.checksum
    })
  })

  it('publishes the depth-22 Prismatic Wall document without flattening its mechanics', async () => {
    const { t, first } = await fixture()
    await importSeededSubjects(t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [passwall, daylight, dispelMagic].map((spell) =>
        importedSubject({ subjectKind: 'SPELL', ...spell, document: spell })
      )
    })
    const draft = await copyDraft(first.caller, prismaticWall.id)
    const copied = spellAuthoredDtoSchema.parse(draft.payload)
    expect(depth(prismaticWall)).toBe(22)
    expect(depth(copied)).toBe(22)
    const runtimeInput = nodeRuntimeResolveRequestDtoSchema.parse({
      mapId: 'spell',
      systemId: copied.systemId,
      values: copied
    })
    const resolved = await first.caller.query(api.authoring.nodeRuntime.resolve, runtimeInput)
    expect(resolved.mapId).toBe('spell')
    expect(resolved.scopes.length).toBeGreaterThan(0)
    const normalized = await first.caller.query(
      api.authoring.nodeRuntime.normalizeValues,
      runtimeInput
    )
    expect(normalized.values.effects).toEqual(copied.effects)
    expect(normalized.values.classIds).toEqual(copied.classIds)
    const result = await first.caller.mutation(publish, publicationInput(draft))
    const stored = await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', draft.subjectId))
        .unique()
      if (!root) throw new Error('Missing published Prismatic Wall root')
      const version = await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
      return {
        root,
        sourceFacts: await readStoredSourceFacts(ctx, root),
        version,
        document: version && (await readStoredAuthoredVersionDocument(ctx, version))
      }
    })
    const document = spellAuthoredDtoSchema.parse(stored.document)
    expect(document.classIds).toEqual(prismaticWall.classIds)
    expect(document.effects).toEqual(copied.effects)
    expect(depth(document)).toBe(22)
    const projection = jsonValueSchema.parse(
      JSON.parse(stored.version!.compilation!.projectionJson)
    )
    expect(projection).toEqual(
      JSON.parse(
        JSON.stringify(
          compileSubjectWithMechanicsIndex({
            subjectKind: 'SPELL',
            authored: document
          }).compiled
        )
      )
    )
    expect(stored.version?.checksum).toBe(result.checksum)
    expect(stored.version?.compilation?.projectionChecksum).toBe(checksumRuleDocument(projection))
  })

  it('rejects anonymous, foreign, master, wrong-kind, and duplicate owned Spell publication', async () => {
    const { t, first, second } = await fixture()
    const draft = await copyDraft(first.caller)
    const input = publicationInput(draft)
    await expect(t.mutation(publish, input)).rejects.toThrow()
    await expect(second.caller.mutation(publish, input)).rejects.toThrow()
    await expect(
      first.caller.mutation(publish, { ...input, subjectId: fireball.id })
    ).rejects.toThrow()
    await expect(
      first.caller.mutation(publish, { ...input, subjectKind: 'FEAT' })
    ).rejects.toThrow()
    await first.caller.mutation(publish, input)
    const duplicate = await copyDraft(first.caller)
    const conflicting = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'SPELL',
      subjectId: duplicate.subjectId,
      systemId: duplicate.systemId,
      label: `  ${draft.label.toUpperCase()}  `,
      payload: duplicate.payload
    })
    await expect(first.caller.mutation(publish, publicationInput(conflicting))).rejects.toThrow(
      'ACTIVE_NAME_CONFLICT'
    )
    expect(
      await first.caller.query(api.content.drafts.get, {
        subjectKind: 'SPELL',
        subjectId: conflicting.subjectId
      })
    ).toEqual(conflicting)
  })

  it('deletes only an owned Spell while retaining a working draft and route', async () => {
    const { t, first, second } = await fixture()
    const owned = await copyDraft(first.caller)
    await first.caller.mutation(publish, publicationInput(owned))
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredCatalogueOwnerCounts')
          .withIndex('by_subjectKind_ownerUserId', (q) =>
            q.eq('subjectKind', 'SPELL').eq('ownerUserId', first.userId)
          )
          .unique()
      )
    ).toMatchObject({ count: 1 })
    const working = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'SPELL',
      subjectId: owned.subjectId,
      systemId: owned.systemId,
      label: 'Working Fireball',
      payload: owned.payload
    })
    await expect(
      t.mutation(deleteActive, {
        subjectKind: 'SPELL',
        subjectId: owned.subjectId
      })
    ).rejects.toThrow()
    await expect(
      second.caller.mutation(deleteActive, {
        subjectKind: 'SPELL',
        subjectId: owned.subjectId
      })
    ).rejects.toThrow()
    await expect(
      first.caller.mutation(deleteActive, {
        subjectKind: 'SPELL',
        subjectId: fireball.id
      })
    ).rejects.toThrow()
    const classReferences = await t.run((ctx) =>
      ctx.db
        .query('authoredSpellClasses')
        .withIndex('by_spellId', (q) => q.eq('spellId', owned.subjectId))
        .collect()
    )
    expect(classReferences.length).toBeGreaterThan(0)
    await first.caller.mutation(deleteActive, {
      subjectKind: 'SPELL',
      subjectId: owned.subjectId
    })
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredSpellClasses')
          .withIndex('by_spellId', (q) => q.eq('spellId', owned.subjectId))
          .collect()
      )
    ).toEqual([])
    expect(await t.query(details, { subjectKind: 'SPELL', id: owned.subjectId })).toBeNull()
    expect(
      await first.caller.query(api.content.drafts.get, {
        subjectKind: 'SPELL',
        subjectId: owned.subjectId
      })
    ).toMatchObject({
      payload: working.payload,
      draftState: 'DRAFT_ONLY',
      baseActiveUpdatedAt: null,
      publicId: working.publicId
    })
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredRouteIds')
          .withIndex('by_subjectId', (q) => q.eq('subjectId', owned.subjectId))
          .unique()
      )
    ).toMatchObject({ publicId: working.publicId })
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredCatalogueOwnerCounts')
          .withIndex('by_subjectKind_ownerUserId', (q) =>
            q.eq('subjectKind', 'SPELL').eq('ownerUserId', first.userId)
          )
          .unique()
      )
    ).toBeNull()
  })
})
