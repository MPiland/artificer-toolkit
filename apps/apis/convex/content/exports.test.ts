import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { grappler } from '@artificer-toolkit/source-data/srd/feats/grappler.js'
import { longsword } from '@artificer-toolkit/source-data/srd/equipment/longsword.js'
import { longswordPlus1 } from '@artificer-toolkit/source-data/srd/equipment/longsword-plus-1.js'
import {
  IMPORT_MAX_PORTABLE_REFERENCES,
  type ArtificerPortableContentDto,
  type AuthoredContentExportRequestDto
} from '@artificer-toolkit/schema/api/imports'
import type { AuthoredDraftResult } from '@artificer-toolkit/schema/api/authoredDrafts'
import {
  authoredPublishDraftInputSchema,
  type AuthoredPublicationResult,
  type AuthoredPublishDraftInput
} from '@artificer-toolkit/schema/api/authoredPublication'
import { api } from '../_generated/api'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'

const publish = makeFunctionReference<
  'mutation',
  AuthoredPublishDraftInput,
  AuthoredPublicationResult
>('content/publication:publishDraft')
const exportContent = makeFunctionReference<
  'query',
  AuthoredContentExportRequestDto,
  ArtificerPortableContentDto
>('content/exports:get')

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

async function copyDraft(caller: Awaited<ReturnType<typeof fixture>>['first']['caller']) {
  return caller.mutation(api.content.drafts.duplicate, {
    subjectKind: 'FEAT',
    subjectId: grappler.id
  })
}

function publicationInput(draft: AuthoredDraftResult) {
  return authoredPublishDraftInputSchema.parse({
    subjectKind: 'FEAT' as const,
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: draft.updatedAt
  })
}

describe('native authored content export', () => {
  it('includes a variant parent reference in draft and active exports', async () => {
    const { first } = await publicationFixture(
      import.meta.glob('/apps/apis/convex/**/*.*s'),
      import.meta.glob('../betterAuth/**/*.*s'),
      [
        [longsword, longswordPlus1].map((item) =>
          importedSubject({
            subjectKind: 'EQUIPMENT',
            id: item.id,
            systemId: item.systemId,
            label: item.label,
            document: item
          })
        )
      ]
    )
    const draft = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'EQUIPMENT',
      subjectId: longswordPlus1.id
    })
    for (const view of ['draft', 'active'] as const) {
      if (view === 'active') {
        await first.caller.mutation(
          publish,
          authoredPublishDraftInputSchema.parse({
            subjectKind: 'EQUIPMENT',
            subjectId: draft.subjectId,
            expectedDraftUpdatedAt: draft.updatedAt
          })
        )
      }
      const exported = await first.caller.query(exportContent, {
        subjectKind: 'EQUIPMENT',
        id: draft.subjectId,
        view
      })
      expect(exported.item.data.parentEquipmentId).toBe(longsword.id)
      expect(exported.references).toContainEqual({
        kind: 'EQUIPMENT',
        id: longsword.id,
        label: longsword.label,
        importSource: null,
        importId: null
      })
    }
  })

  it('exports a draft by UUID or public route and strips metadata recursively without losing authored ids', async () => {
    const { first } = await fixture()
    const draft = await copyDraft(first.caller)
    const payload = {
      ...draft.payload,
      unknownId: 'keep-unknown-id',
      nested: {
        id: 'keep-nested-id',
        status: 'DRAFT',
        provenance: { kind: 'OWNED' },
        value: 'preserve'
      }
    }
    const saved = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'FEAT',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: draft.label,
      payload
    })
    const exported = await first.caller.query(exportContent, {
      subjectKind: 'FEAT',
      id: saved.publicId,
      view: 'draft'
    })
    expect(exported.item.kind).toBe('FEAT')
    expect(exported.item.data).toMatchObject({
      id: saved.subjectId,
      unknownId: 'keep-unknown-id',
      nested: { id: 'keep-nested-id', value: 'preserve' }
    })
    expect(exported.item.data).not.toHaveProperty('userId')
    expect(exported.item.data).not.toHaveProperty('nested.status')
    expect(exported.references).toEqual([])
    expect(
      await first.caller.query(exportContent, {
        subjectKind: 'FEAT',
        id: saved.subjectId,
        view: 'draft'
      })
    ).toEqual(exported)
    await expect(
      first.caller.query(exportContent, {
        subjectKind: 'FEAT',
        id: saved.subjectId,
        view: 'active'
      })
    ).rejects.toThrow()
  })

  it('exports the original active payload separately from an edited and schema-incomplete draft', async () => {
    const { first } = await fixture()
    const draft = await copyDraft(first.caller)
    await first.caller.mutation(publish, publicationInput(draft))
    const edited = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'FEAT',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: 'Edited Grappler',
      payload: {
        ...draft.payload,
        description: 'Private edit',
        features: null,
        unknownField: { id: 'nested' }
      }
    })
    const active = await first.caller.query(exportContent, {
      subjectKind: 'FEAT',
      id: draft.publicId,
      view: 'active'
    })
    const working = await first.caller.query(exportContent, {
      subjectKind: 'FEAT',
      id: draft.subjectId,
      view: 'draft'
    })
    expect(active.item.data).toMatchObject({
      id: draft.subjectId,
      description: draft.payload.description
    })
    expect(working.item.data).toMatchObject({
      id: edited.subjectId,
      description: 'Private edit',
      features: null,
      unknownField: { id: 'nested' }
    })
    expect(working.item.data).not.toHaveProperty('userId')
    expect(active.item.data).not.toHaveProperty('unknownField')
  })

  it('deduplicates references in first-seen order and enriches only visible canonical or owned targets', async () => {
    const { t, first, second } = await fixture()
    const draft = await copyDraft(first.caller)
    const foreignTarget = await copyDraft(second.caller)
    await second.caller.mutation(publish, publicationInput(foreignTarget))
    const ownedTarget = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'FEAT',
      subjectId: 'abcdefab-abcd-4abc-8abc-abcdefabcdef',
      systemId: grappler.systemId,
      label: 'Owned reference',
      payload: grappler
    })
    await first.caller.mutation(publish, publicationInput(ownedTarget))
    const payload = {
      ...draft.payload,
      classId: grappler.id,
      nested: [
        { featId: grappler.id, featIds: ['missing-feat', grappler.id] },
        { featId: foreignTarget.subjectId, equipmentId: 'missing-equipment' },
        { featId: ownedTarget.subjectId.toUpperCase() }
      ]
    }
    const saved = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'FEAT',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: draft.label,
      payload
    })
    await t.run(async (ctx) => {
      const now = new Date().toISOString()
      await ctx.db.insert('authoredImportRefs', {
        userId: first.userId,
        source: 'ARTIFICER_JSON',
        subjectKind: 'FEAT',
        subjectId: grappler.id,
        externalId: 'late-canonical',
        createdAt: now,
        updatedAt: now
      })
      await ctx.db.insert('authoredImportRefs', {
        userId: first.userId,
        source: 'ARTIFICER_JSON',
        subjectKind: 'FEAT',
        subjectId: grappler.id,
        externalId: 'early-canonical',
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: now
      })
      await ctx.db.insert('authoredImportRefs', {
        userId: first.userId,
        source: 'DND_BEYOND',
        subjectKind: 'FEAT',
        subjectId: ownedTarget.subjectId,
        externalId: 'owned-external-id',
        createdAt: now,
        updatedAt: now
      })
      await ctx.db.insert('authoredImportRefs', {
        userId: second.userId,
        source: 'ARTIFICER_JSON',
        subjectKind: 'FEAT',
        subjectId: foreignTarget.subjectId,
        externalId: 'foreign',
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: now
      })
    })
    const exported = await first.caller.query(exportContent, {
      subjectKind: 'FEAT',
      id: saved.subjectId,
      view: 'draft'
    })
    expect(exported.references).toEqual([
      { kind: 'CLASS', id: grappler.id, label: grappler.id, importSource: null, importId: null },
      {
        kind: 'FEAT',
        id: grappler.id,
        label: grappler.label,
        importSource: 'ARTIFICER_JSON',
        importId: 'early-canonical'
      },
      {
        kind: 'FEAT',
        id: 'missing-feat',
        label: 'missing-feat',
        importSource: null,
        importId: null
      },
      {
        kind: 'EQUIPMENT',
        id: 'missing-equipment',
        label: 'missing-equipment',
        importSource: null,
        importId: null
      },
      {
        kind: 'FEAT',
        id: foreignTarget.subjectId,
        label: foreignTarget.subjectId,
        importSource: null,
        importId: null
      },
      {
        kind: 'FEAT',
        id: ownedTarget.subjectId.toUpperCase(),
        label: 'Owned reference',
        importSource: 'DND_BEYOND',
        importId: 'owned-external-id'
      }
    ])
  })

  it('denies anonymous, foreign, master, wrong-kind, and spoofed-user export requests', async () => {
    const { t, first, second } = await fixture()
    const draft = await copyDraft(first.caller)
    const input = { subjectKind: 'FEAT' as const, id: draft.subjectId, view: 'draft' as const }
    await expect(t.query(exportContent, input)).rejects.toThrow()
    await expect(second.caller.query(exportContent, input)).rejects.toThrow()
    await expect(
      first.caller.query(exportContent, { subjectKind: 'FEAT', id: grappler.id, view: 'active' })
    ).rejects.toThrow()
    await expect(
      first.caller.query(exportContent, {
        subjectKind: 'BACKGROUND',
        id: draft.subjectId,
        view: 'draft'
      })
    ).rejects.toThrow()
    const forged = { ...input, userId: first.userId }
    await expect(first.caller.query(exportContent, forged)).rejects.toThrow()
    await first.caller.mutation(publish, publicationInput(draft))
    for (const view of ['active', 'draft'] as const) {
      await expect(t.query(exportContent, { ...input, view })).rejects.toThrow()
      await expect(second.caller.query(exportContent, { ...input, view })).rejects.toThrow()
      await expect(
        first.caller.query(exportContent, { ...input, id: grappler.id, view })
      ).rejects.toThrow()
    }
  })

  it('rejects oversized portable arrays and total references without truncating the payload', async () => {
    const { first } = await fixture()
    const draft = await copyDraft(first.caller)
    const ids = Array.from(
      { length: IMPORT_MAX_PORTABLE_REFERENCES + 1 },
      (_, index) => `feat-${index}`
    )
    await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'FEAT',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: draft.label,
      payload: { featIds: ids.slice(0, IMPORT_MAX_PORTABLE_REFERENCES) }
    })
    const maximum = await first.caller.query(exportContent, {
      subjectKind: 'FEAT',
      id: draft.subjectId,
      view: 'draft'
    })
    expect(maximum.references.map(({ id }) => id)).toEqual(
      ids.slice(0, IMPORT_MAX_PORTABLE_REFERENCES)
    )
    for (const payload of [
      { featIds: ids },
      { featIds: ids.slice(0, 1), nested: { featIds: ids.slice(1) } }
    ]) {
      await first.caller.mutation(api.content.drafts.save, {
        subjectKind: 'FEAT',
        subjectId: draft.subjectId,
        systemId: draft.systemId,
        label: draft.label,
        payload
      })
      await expect(
        first.caller.query(exportContent, {
          subjectKind: 'FEAT',
          id: draft.subjectId,
          view: 'draft'
        })
      ).rejects.toThrow()
    }
  })

  it('rejects an active export when its stored checksum is corrupt', async () => {
    const { t, first } = await fixture()
    const draft = await copyDraft(first.caller)
    await first.caller.mutation(publish, publicationInput(draft))
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', draft.subjectId))
        .unique()
      if (!root) throw new Error('Missing published root')
      await ctx.db.patch(root.currentVersionId, { checksum: '0'.repeat(64) })
    })
    await expect(
      first.caller.query(exportContent, {
        subjectKind: 'FEAT',
        id: draft.subjectId,
        view: 'active'
      })
    ).rejects.toThrow()
  })
})
