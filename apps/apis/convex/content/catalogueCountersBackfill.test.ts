import { describe, expect, it } from 'vitest'
import type { AuthoredCatalogueSearchBackfillResult } from '@artificer-toolkit/schema/api/authoredCatalogue'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { light } from '@artificer-toolkit/source-data/srd/spells/light.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { api, internal } from '../_generated/api'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'
import { syncCatalogueMetadata } from './catalogueMetadata'

const subjects = [
  importedSubject({ subjectKind: 'BACKGROUND', ...acolyte, document: acolyte }),
  importedSubject({ subjectKind: 'EQUIPMENT', ...club, document: club })
]
const firstPage = { paginationOpts: { cursor: null, numItems: 8 } }

async function fixture() {
  return publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [subjects]
  )
}

async function snapshot(t: Awaited<ReturnType<typeof fixture>>['t']) {
  return t.run(async (ctx) => ({
    roots: await ctx.db.query('authoredRoots').withIndex('by_publicId').take(10),
    versions: await ctx.db.query('authoredVersions').withIndex('by_versionId').take(10),
    sourceCounts: await ctx.db
      .query('authoredCatalogueCounts')
      .withIndex('by_source_kind')
      .take(10),
    ownerCounts: await ctx.db
      .query('authoredCatalogueOwnerCounts')
      .withIndex('by_subjectKind_ownerUserId')
      .take(10)
  }))
}

describe('exact catalogue counter backfill', () => {
  it.each(['components', 'publishedActive'] as const)(
    'backfills complete Spell selector facts exactly and rejects corrupt marked %s',
    async (corruptField) => {
      const { t } = await fixture()
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects: [importedSubject({ subjectKind: 'SPELL', ...light, document: light })]
      })
      const original = await t.run((ctx) =>
        ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', light.id))
          .unique()
      )
      if (!original?.catalogue?.spell) throw new Error('Missing Spell catalogue fixture.')
      const {
        selectionVersion: _marker,
        publishedActive: _active,
        attributes: _attributes,
        components: _components,
        materialDescription: _material,
        ...oldSpell
      } = original.catalogue.spell
      await t.run((ctx) =>
        ctx.db.patch(original._id, { catalogue: { ...original.catalogue!, spell: oldSpell } })
      )
      for (let replay = 0; replay < 2; replay++) {
        if (replay === 1) {
          const { publishedActive: _active, ...markedSpell } = original.catalogue.spell
          await t.run((ctx) =>
            ctx.db.patch(original._id, {
              catalogue: { ...original.catalogue!, spell: markedSpell }
            })
          )
        }
        let cursor: string | null = null
        let isDone = false
        while (!isDone) {
          const page: AuthoredCatalogueSearchBackfillResult = await t.mutation(
            internal.content.catalogueSearchBackfill.backfill,
            {
              paginationOpts: { cursor, numItems: 8 }
            }
          )
          cursor = page.continueCursor
          isDone = page.isDone
        }
        expect((await t.run((ctx) => ctx.db.get(original._id)))?.catalogue).toEqual(
          original.catalogue
        )
      }
      await t.run((ctx) =>
        ctx.db.patch(original._id, {
          catalogue: {
            ...original.catalogue!,
            spell: {
              ...original.catalogue!.spell!,
              ...(corruptField === 'components'
                ? { components: [] }
                : { publishedActive: !original.catalogue!.spell!.publishedActive })
            }
          }
        })
      )
      let cursor: string | null = null
      await expect(
        (async () => {
          for (;;) {
            const page: AuthoredCatalogueSearchBackfillResult = await t.mutation(
              internal.content.catalogueSearchBackfill.backfill,
              {
                paginationOpts: { cursor, numItems: 8 }
              }
            )
            if (page.isDone) break
            cursor = page.continueCursor
          }
        })()
      ).rejects.toThrow('metadata mismatch')
    }
  )
  it.each(['search-present', 'search-absent'] as const)(
    'canonical replay fills only missing owner memberships (%s)',
    async (searchState) => {
      const { t } = await fixture()
      const initial = await snapshot(t)
      await t.run(async (ctx) => {
        for (const root of initial.roots) {
          if (!root.catalogue) throw new Error('Missing catalogue fixture')
          const { countsVersion: _version, search, ...metadata } = root.catalogue
          await ctx.db.patch(root._id, {
            catalogue: { ...metadata, ...(searchState === 'search-present' ? { search } : {}) }
          })
        }
        for (const count of initial.ownerCounts) await ctx.db.delete(count._id)
      })
      const input = { contentSourceId: SRD_CONTENT_SOURCE.id, subjects }
      await t.mutation(internal.content.import.importSubjects, input)
      const restored = await snapshot(t)
      expect(restored.roots).toEqual(initial.roots)
      expect(restored.versions).toEqual(initial.versions)
      expect(restored.sourceCounts).toEqual(initial.sourceCounts)
      expect(
        restored.ownerCounts.map(({ subjectKind, count, categories }) => ({
          subjectKind,
          count,
          categories
        }))
      ).toEqual([
        { subjectKind: 'BACKGROUND', count: 1, categories: [] },
        { subjectKind: 'EQUIPMENT', count: 1, categories: [{ category: 'WEAPON', count: 1 }] }
      ])
      await t.mutation(internal.content.import.importSubjects, input)
      expect(await snapshot(t)).toEqual(restored)
    }
  )

  it('backfills master and owned roots in bounded pages without recounting already marked roots', async () => {
    const { t, first } = await fixture()
    const draft = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'BACKGROUND',
      subjectId: acolyte.id
    })
    if (!draft.updatedAt) throw new Error('Missing draft revision')
    await first.caller.mutation(api.content.publication.publishDraft, {
      subjectKind: 'BACKGROUND',
      subjectId: draft.subjectId,
      expectedDraftUpdatedAt: draft.updatedAt
    })
    const initial = await snapshot(t)
    const expectedRoots = initial.roots.map((root) => {
      if (root.subjectKind !== 'EQUIPMENT') return root
      if (!root.equipmentOptions) throw new Error('Missing Equipment option facts fixture')
      return {
        ...root,
        equipmentOptions: {
          ...root.equipmentOptions,
          builder: {
            version: 1 as const,
            parentEquipmentId: null,
            category: 'WEAPON' as const,
            properties: ['SIMPLE', 'MELEE', 'LIGHT'] as const,
            isContainer: false,
            requiresAttunement: false
          }
        }
      }
    })
    await t.run(async (ctx) => {
      for (const root of initial.roots) {
        if (root.subjectKind !== 'BACKGROUND') continue
        if (!root.catalogue) throw new Error('Missing catalogue fixture')
        const { countsVersion: _version, ...catalogue } = root.catalogue
        await ctx.db.patch(root._id, { catalogue })
      }
      for (const count of initial.ownerCounts) {
        if (count.subjectKind === 'BACKGROUND') await ctx.db.delete(count._id)
      }
    })
    for (let replay = 0; replay < 2; replay++) {
      const firstResult = await t.mutation(
        internal.content.catalogueSearchBackfill.backfill,
        firstPage
      )
      expect(firstResult).toMatchObject({ processed: 2, isDone: false })
      expect(
        await t.mutation(internal.content.catalogueSearchBackfill.backfill, {
          paginationOpts: { cursor: firstResult.continueCursor, numItems: 8 }
        })
      ).toMatchObject({ processed: 1, isDone: true })
      const restored = await snapshot(t)
      expect(restored.roots).toEqual(expectedRoots)
      expect(restored.versions).toEqual(initial.versions)
      expect(restored.sourceCounts).toEqual(initial.sourceCounts)
      expect(restored.ownerCounts.map(({ _id, _creationTime, ...count }) => count)).toEqual(
        initial.ownerCounts.map(({ _id, _creationTime, ...count }) => count)
      )
    }
  })

  it.each(['canonical', 'all-roots'] as const)(
    'rejects conflicting existing search and rolls back earlier counter writes (%s)',
    async (path) => {
      const { t } = await fixture()
      const initial = await snapshot(t)
      await t.run(async (ctx) => {
        for (const root of initial.roots) {
          if (!root.catalogue?.search) throw new Error('Missing catalogue fixture')
          const { countsVersion: _version, ...catalogue } = root.catalogue
          await ctx.db.patch(root._id, {
            catalogue: {
              ...catalogue,
              ...(root.subjectKind === 'EQUIPMENT'
                ? { search: { version: 1 as const, text: 'corrupt' } }
                : {})
            }
          })
        }
        for (const count of initial.ownerCounts) await ctx.db.delete(count._id)
      })
      const before = await snapshot(t)
      expect(before.roots.map((root) => root.subjectKind)).toEqual(['BACKGROUND', 'EQUIPMENT'])
      const run = () =>
        path === 'canonical'
          ? t.mutation(internal.content.import.importSubjects, {
              contentSourceId: SRD_CONTENT_SOURCE.id,
              subjects
            })
          : t.mutation(internal.content.catalogueSearchBackfill.backfill, firstPage)
      await expect(run()).rejects.toThrow(
        path === 'canonical' ? 'Canonical content conflict' : 'metadata mismatch'
      )
      expect(await snapshot(t)).toEqual(before)
    }
  )

  it.each(['orphan', 'missing', 'overflow'] as const)(
    'rejects inconsistent owner counters before restoring a marker (%s)',
    async (corruption) => {
      const { t } = await fixture()
      const document = {
        ...acolyte,
        id: '00000000-0000-4000-8000-000000000099',
        label: 'Second acolyte'
      }
      const input = {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects: [importedSubject({ subjectKind: 'BACKGROUND', ...document, document })]
      }
      await t.mutation(internal.content.import.importSubjects, input)
      await t.run(async (ctx) => {
        const roots = await ctx.db
          .query('authoredRoots')
          .withIndex('by_system_kind_owner_name_id', (q) =>
            q
              .eq('systemId', acolyte.systemId)
              .eq('subjectKind', 'BACKGROUND')
              .eq('ownerUserId', undefined)
          )
          .take(3)
        for (const root of roots) {
          if (root.id !== document.id && corruption !== 'orphan') continue
          if (!root.catalogue) throw new Error('Missing catalogue fixture')
          const { countsVersion: _version, ...catalogue } = root.catalogue
          await ctx.db.patch(root._id, { catalogue })
        }
        const counts = await ctx.db
          .query('authoredCatalogueOwnerCounts')
          .withIndex('by_subjectKind_ownerUserId', (q) =>
            q.eq('subjectKind', 'BACKGROUND').eq('ownerUserId', undefined)
          )
          .unique()
        if (!counts) throw new Error('Missing owner count fixture')
        if (corruption === 'missing') await ctx.db.delete(counts._id)
        else if (corruption === 'overflow')
          await ctx.db.patch(counts._id, { count: Number.MAX_SAFE_INTEGER })
      })
      const before = await snapshot(t)
      await expect(t.mutation(internal.content.import.importSubjects, input)).rejects.toThrow()
      expect(await snapshot(t)).toEqual(before)
    }
  )

  it('rejects source count overflow without retaining the new root or version', async () => {
    const { t } = await fixture()
    await t.run(async (ctx) => {
      const counts = await ctx.db
        .query('authoredCatalogueCounts')
        .withIndex('by_source_kind', (q) =>
          q.eq('contentSourceId', SRD_CONTENT_SOURCE.id).eq('subjectKind', 'BACKGROUND')
        )
        .unique()
      if (!counts) throw new Error('Missing source count fixture')
      await ctx.db.patch(counts._id, { count: Number.MAX_SAFE_INTEGER })
    })
    const before = await snapshot(t)
    const document = {
      ...acolyte,
      id: '00000000-0000-4000-8000-000000000099',
      label: 'Second acolyte'
    }
    await expect(
      t.mutation(internal.content.import.importSubjects, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects: [importedSubject({ subjectKind: 'BACKGROUND', ...document, document })]
      })
    ).rejects.toThrow('Catalogue count integrity mismatch')
    expect(await snapshot(t)).toEqual(before)
  })

  it('never removes the membership marker while syncing metadata', async () => {
    const { t } = await fixture()
    const before = await snapshot(t)
    const root = before.roots[0]
    if (!root?.catalogue) throw new Error('Missing catalogue fixture')
    const { countsVersion: _version, ...metadata } = root.catalogue
    await expect(t.run((ctx) => syncCatalogueMetadata(ctx, root._id, metadata))).rejects.toThrow(
      'membership marker is required'
    )
    expect(await snapshot(t)).toEqual(before)
  })
})
