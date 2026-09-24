import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { clubPlus1 } from '@artificer-toolkit/source-data/srd/equipment/club-plus-1.js'
import type { AuthoredDraftResult } from '@artificer-toolkit/schema/api/authoredDrafts'
import {
  authoredDeleteActiveInputSchema,
  authoredPublishDraftInputSchema,
  type AuthoredDeleteActiveInput,
  type AuthoredPublicationResult,
  type AuthoredPublishDraftInput
} from '@artificer-toolkit/schema/api/authoredPublication'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/authored'
import {
  compileSubjectWithMechanicsIndex,
  resolveEquipmentAuthored
} from '@artificer-toolkit/shared/subjects/compilers'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { toCharacterBuilderEquipmentCatalogRecord } from '@artificer-toolkit/rules-runtime/character/builderCatalog'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { api } from '../_generated/api'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'
import { compileCurrentEquipment } from './equipmentRelationships'
import { readStoredAuthoredVersionDocument } from './documents'

const publish = makeFunctionReference<
  'mutation',
  AuthoredPublishDraftInput,
  AuthoredPublicationResult
>('content/publication:publishDraft')
const deleteActive = makeFunctionReference<'mutation', AuthoredDeleteActiveInput, null>(
  'content/deletion:deleteActive'
)

const canonicalBase = importedSubject({
  subjectKind: 'EQUIPMENT',
  id: club.id,
  systemId: club.systemId,
  label: club.label,
  document: club
})
const canonicalVariant = importedSubject({
  subjectKind: 'EQUIPMENT',
  id: clubPlus1.id,
  systemId: clubPlus1.systemId,
  label: clubPlus1.label,
  document: clubPlus1
})

async function fixture() {
  return publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [[canonicalBase, canonicalVariant]]
  )
}

async function copy(
  caller: Awaited<ReturnType<typeof fixture>>['first']['caller'],
  subjectId: string
) {
  return caller.mutation(api.content.drafts.duplicate, {
    subjectKind: 'EQUIPMENT',
    subjectId
  })
}

function input(draft: AuthoredDraftResult) {
  return authoredPublishDraftInputSchema.parse({
    subjectKind: 'EQUIPMENT',
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: draft.updatedAt
  })
}

describe('native Equipment publication', () => {
  it('rejects wrong-kind and cross-System parents at the current-source boundary', async () => {
    const { t, first } = await fixture()
    const draft = await copy(first.caller, clubPlus1.id)
    const document = equipmentAuthoredDtoSchema.parse(draft.payload)
    const parent = await t.run((ctx) =>
      ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', club.id))
        .unique()
    )
    if (!parent) throw new Error('Missing canonical parent')
    await t.run((ctx) => ctx.db.patch(parent._id, { subjectKind: 'FEAT' }))
    await expect(
      t.run((ctx) => compileCurrentEquipment(ctx, document, first.userId))
    ).rejects.toThrow('Readable parent Equipment in the same System is required.')
    await t.run((ctx) =>
      ctx.db.patch(parent._id, {
        subjectKind: 'EQUIPMENT',
        systemId: crypto.randomUUID()
      })
    )
    await expect(
      t.run((ctx) => compileCurrentEquipment(ctx, document, first.userId))
    ).rejects.toThrow('Readable parent Equipment in the same System is required.')
  })

  it('rolls back parent publication and draft consumption when a descendant fails reconciliation', async () => {
    const { t, first } = await fixture()
    const base = await copy(first.caller, club.id)
    await first.caller.mutation(publish, input(base))
    const copied = await copy(first.caller, clubPlus1.id)
    const child = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'EQUIPMENT',
      subjectId: copied.subjectId,
      systemId: copied.systemId,
      label: copied.label,
      payload: { ...copied.payload, parentEquipmentId: base.subjectId }
    })
    await first.caller.mutation(publish, input(child))
    const replacement = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'EQUIPMENT',
      subjectId: base.subjectId,
      systemId: base.systemId,
      label: base.label,
      payload: { ...base.payload, weight: { amount: 9, unit: 'POUNDS' } }
    })
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', child.subjectId))
        .unique()
      if (!root) throw new Error('Missing child')
      const version = await ctx.db.get(root.currentVersionId)
      if (!version) throw new Error('Missing child version')
      // Source corruption is encountered after commitPublication has staged the parent writes.
      const chunk = await ctx.db
        .query('authoredVersionPayloadChunks')
        .withIndex('by_versionId_chunkIndex', (query) => query.eq('versionId', version.versionId))
        .first()
      if (!chunk) throw new Error('Missing child version chunk')
      const corrupted = chunk.bytes.slice(0)
      const corruptedBytes = new Uint8Array(corrupted)
      corruptedBytes[0] = (corruptedBytes[0] ?? 0) ^ 1
      await ctx.db.patch(chunk._id, { bytes: corrupted })
    })
    const before = await t.run(async (ctx) => ({
      roots: await ctx.db.query('authoredRoots').take(10),
      versions: await ctx.db.query('authoredVersions').take(10),
      drafts: await ctx.db.query('authoredDrafts').take(10),
      counts: await ctx.db.query('authoredCatalogueCounts').take(10)
    }))
    await expect(first.caller.mutation(publish, input(replacement))).rejects.toThrow()
    expect(
      await t.run(async (ctx) => ({
        roots: await ctx.db.query('authoredRoots').take(10),
        versions: await ctx.db.query('authoredVersions').take(10),
        drafts: await ctx.db.query('authoredDrafts').take(10),
        counts: await ctx.db.query('authoredCatalogueCounts').take(10)
      }))
    ).toEqual(before)
  })

  it('publishes a base, owned variant, and variant-of-variant with inherited compilations', async () => {
    const { t, first } = await fixture()
    const base = await copy(first.caller, club.id)
    await first.caller.mutation(publish, input(base))
    const variant = await copy(first.caller, clubPlus1.id)
    const ownedVariant = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'EQUIPMENT',
      subjectId: variant.subjectId,
      systemId: variant.systemId,
      label: 'Club +1 owned',
      payload: { ...variant.payload, parentEquipmentId: base.subjectId }
    })
    await first.caller.mutation(publish, input(ownedVariant))
    const grandchild = await copy(first.caller, clubPlus1.id)
    const ownedGrandchild = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'EQUIPMENT',
      subjectId: grandchild.subjectId,
      systemId: grandchild.systemId,
      label: 'Club +1 inherited',
      payload: {
        ...grandchild.payload,
        parentEquipmentId: ownedVariant.subjectId
      }
    })
    await first.caller.mutation(publish, input(ownedGrandchild))
    const roots = await t.run(async (ctx) => {
      return Promise.all(
        [base, ownedVariant, ownedGrandchild].map(async (draft) => {
          const root = await ctx.db
            .query('authoredRoots')
            .withIndex('by_publicId', (q) => q.eq('id', draft.subjectId))
            .unique()
          if (!root) throw new Error('Missing equipment root')
          const version = await ctx.db.get(root.currentVersionId)
          return {
            root,
            version,
            document: version && (await readStoredAuthoredVersionDocument(ctx, version))
          }
        })
      )
    })
    expect(roots.map(({ root }) => root?.parentEquipmentId)).toEqual([
      null,
      base.subjectId,
      ownedVariant.subjectId
    ])
    const documents = new Map(
      roots.map(({ version, document }) => [
        version!.id,
        equipmentAuthoredDtoSchema.parse(document)
      ])
    )
    for (const { root, version } of roots) {
      expect(version?.compilation).toBeDefined()
      expect(version?.checksum).toBeTruthy()
      const document = documents.get(version!.id)!
      expect(document.id).toBe(version!.id)
      const effective = resolveEquipmentAuthored(
        document as EquipmentAuthored,
        (parentId) => documents.get(parentId) as EquipmentAuthored | undefined
      )
      const expected = compileSubjectWithMechanicsIndex({
        subjectKind: 'EQUIPMENT',
        authored: effective
      }).compiled
      const {
        id: _id,
        label: _label,
        ...builder
      } = toCharacterBuilderEquipmentCatalogRecord(effective)
      expect(root?.equipmentOptions).toEqual({
        checksum: root!.checksum,
        category: document.category,
        properties: document.properties ?? [],
        builder: {
          version: 1,
          parentEquipmentId: document.category === 'VARIANT' ? document.parentEquipmentId : null,
          ...builder
        }
      })
      const projection = jsonValueSchema.parse(JSON.parse(version!.compilation!.projectionJson))
      expect(projection).toEqual(JSON.parse(JSON.stringify(expected)))
      expect(version!.compilation!.projectionChecksum).toBe(checksumRuleDocument(projection))
    }
  })

  it('recompiles descendants on parent replacement while preserving descendant identity and drafts', async () => {
    const { t, first } = await fixture()
    const base = await copy(first.caller, club.id)
    await first.caller.mutation(publish, input(base))
    const variant = await copy(first.caller, clubPlus1.id)
    const child = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'EQUIPMENT',
      subjectId: variant.subjectId,
      systemId: variant.systemId,
      label: variant.label,
      payload: { ...variant.payload, parentEquipmentId: base.subjectId }
    })
    await first.caller.mutation(publish, input(child))
    const grandchildDraft = await copy(first.caller, clubPlus1.id)
    const grandchild = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'EQUIPMENT',
      subjectId: grandchildDraft.subjectId,
      systemId: grandchildDraft.systemId,
      label: 'Grandchild',
      payload: {
        ...grandchildDraft.payload,
        parentEquipmentId: child.subjectId
      }
    })
    await first.caller.mutation(publish, input(grandchild))
    const draft = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'EQUIPMENT',
      subjectId: child.subjectId,
      systemId: child.systemId,
      label: 'Unpublished child edit',
      payload: { ...child.payload, description: 'private' }
    })
    const replacement = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'EQUIPMENT',
      subjectId: base.subjectId,
      systemId: base.systemId,
      label: 'Updated Club',
      payload: { ...base.payload, weight: { amount: 9, unit: 'POUNDS' } }
    })
    const before = await t.run(async (ctx) =>
      Promise.all(
        [child, grandchild].map(async (item) => {
          const root = await ctx.db
            .query('authoredRoots')
            .withIndex('by_publicId', (q) => q.eq('id', item.subjectId))
            .unique()
          if (!root) throw new Error('Missing descendant root')
          const version = await ctx.db.get(root.currentVersionId)
          return {
            root,
            version,
            document: version && (await readStoredAuthoredVersionDocument(ctx, version))
          }
        })
      )
    )
    await first.caller.mutation(publish, input(replacement))
    const state = await t.run(async (ctx) => {
      return Promise.all(
        [child, grandchild].map(async (item) => {
          const root = await ctx.db
            .query('authoredRoots')
            .withIndex('by_publicId', (q) => q.eq('id', item.subjectId))
            .unique()
          if (!root) throw new Error('Missing descendant root')
          const version = await ctx.db.get(root.currentVersionId)
          return {
            root,
            version,
            document: version && (await readStoredAuthoredVersionDocument(ctx, version))
          }
        })
      )
    })
    expect(state.map(({ root }) => root?.parentEquipmentId)).toEqual([
      base.subjectId,
      child.subjectId
    ])
    for (const [index, item] of state.entries()) {
      expect(item.version?.compilation).toBeDefined()
      expect(item.root?.currentVersionId).toBe(before[index]?.root.currentVersionId)
      expect(item.version?._creationTime).toBe(before[index]?.version?._creationTime)
      expect(item.document).toEqual(before[index]?.document)
      expect(item.version?.checksum).toBe(before[index]?.version?.checksum)
      expect(item.root?.checksum).toBe(before[index]?.root.checksum)
      expect(item.version?.compilation?.projectionJson).not.toBe(
        before[index]?.version?.compilation?.projectionJson
      )
      expect(JSON.parse(item.version!.compilation!.projectionJson)).toMatchObject({
        weight: { amount: 9 }
      })
    }
    expect(
      await first.caller.query(api.content.drafts.get, {
        subjectKind: 'EQUIPMENT',
        subjectId: child.subjectId
      })
    ).toEqual(draft)
  })

  it('rejects invalid parent chains and retains variants when an owner deletes the parent', async () => {
    const { t, first, second } = await fixture()
    const base = await copy(first.caller, club.id)
    await first.caller.mutation(publish, input(base))
    const variant = await copy(first.caller, clubPlus1.id)
    for (const parentEquipmentId of [variant.subjectId, crypto.randomUUID()]) {
      const invalid = await first.caller.mutation(api.content.drafts.save, {
        subjectKind: 'EQUIPMENT',
        subjectId: variant.subjectId,
        systemId: variant.systemId,
        label: variant.label,
        payload: { ...variant.payload, parentEquipmentId }
      })
      await expect(first.caller.mutation(publish, input(invalid))).rejects.toThrow()
    }
    const canonicalParent = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'EQUIPMENT',
      subjectId: variant.subjectId,
      systemId: variant.systemId,
      label: variant.label,
      payload: { ...variant.payload, parentEquipmentId: clubPlus1.id }
    })
    await first.caller.mutation(publish, input(canonicalParent))
    const foreign = await copy(second.caller, club.id)
    await second.caller.mutation(publish, input(foreign))
    const foreignParent = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'EQUIPMENT',
      subjectId: variant.subjectId,
      systemId: variant.systemId,
      label: variant.label,
      payload: { ...variant.payload, parentEquipmentId: foreign.subjectId }
    })
    await expect(first.caller.mutation(publish, input(foreignParent))).rejects.toThrow()
    const valid = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'EQUIPMENT',
      subjectId: variant.subjectId,
      systemId: variant.systemId,
      label: variant.label,
      payload: { ...variant.payload, parentEquipmentId: base.subjectId }
    })
    await first.caller.mutation(publish, input(valid))
    const cycle = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'EQUIPMENT',
      subjectId: base.subjectId,
      systemId: base.systemId,
      label: base.label,
      payload: {
        ...base.payload,
        category: 'VARIANT',
        parentEquipmentId: variant.subjectId
      }
    })
    await expect(first.caller.mutation(publish, input(cycle))).rejects.toThrow()
    expect(
      await first.caller.query(api.content.drafts.get, {
        subjectKind: 'EQUIPMENT',
        subjectId: base.subjectId
      })
    ).toEqual(cycle)
    const readChild = () =>
      t.run(async (ctx) => {
        const root = await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', variant.subjectId))
          .unique()
        if (!root) throw new Error('Missing retained variant.')
        return {
          root,
          version: await ctx.db.get(root.currentVersionId),
          draft: await ctx.db
            .query('authoredDrafts')
            .withIndex('by_subjectId', (q) => q.eq('subjectId', variant.subjectId))
            .unique()
        }
      })
    const childBefore = await readChild()
    await first.caller.mutation(
      deleteActive,
      authoredDeleteActiveInputSchema.parse({
        subjectKind: 'EQUIPMENT',
        subjectId: base.subjectId
      })
    )
    const childAfter = await readChild()
    expect(childAfter.version).toEqual(childBefore.version)
    expect(childAfter.draft).toEqual(childBefore.draft)
    expect(childAfter.version?.compilation).toEqual(childBefore.version?.compilation)
    expect(childAfter.root.catalogue?.deletedReferences).toContainEqual({
      subjectKind: 'EQUIPMENT',
      subjectId: base.subjectId,
      label: base.label
    })
    await expect(
      first.caller.query(api.content.details.get, {
        subjectKind: 'EQUIPMENT',
        id: base.subjectId
      })
    ).resolves.toBeNull()
  })

  it('denies anonymous, foreign, and master publication or deletion and fails closed on missing metadata', async () => {
    const { t, first, second } = await fixture()
    const draft = await copy(first.caller, club.id)
    await expect(t.mutation(publish, input(draft))).rejects.toThrow()
    await expect(second.caller.mutation(publish, input(draft))).rejects.toThrow()
    await expect(
      first.caller.mutation(publish, { ...input(draft), subjectId: club.id })
    ).rejects.toThrow()
    await expect(
      t.mutation(deleteActive, {
        subjectKind: 'EQUIPMENT',
        subjectId: club.id
      })
    ).rejects.toThrow()
    await expect(
      second.caller.mutation(deleteActive, {
        subjectKind: 'EQUIPMENT',
        subjectId: club.id
      })
    ).rejects.toThrow()
    await expect(
      first.caller.mutation(deleteActive, {
        subjectKind: 'EQUIPMENT',
        subjectId: club.id
      })
    ).rejects.toThrow()
    await first.caller.mutation(publish, input(draft))
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', draft.subjectId))
        .unique()
      if (!root) throw new Error('Missing owned equipment root')
      await ctx.db.patch(root._id, { parentEquipmentId: undefined })
    })
    await first.caller.mutation(deleteActive, {
      subjectKind: 'EQUIPMENT',
      subjectId: draft.subjectId
    })
    expect(
      await t.run(async (ctx) => ({
        root: await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', draft.subjectId))
          .unique(),
        versions: await ctx.db
          .query('authoredVersions')
          .filter((q) => q.eq(q.field('id'), draft.subjectId))
          .collect(),
        route: await ctx.db
          .query('authoredRouteIds')
          .withIndex('by_subjectId', (q) => q.eq('subjectId', draft.subjectId))
          .unique()
      }))
    ).toEqual({ root: null, versions: [], route: null })
    expect(
      await first.caller.query(api.content.drafts.get, {
        subjectKind: 'EQUIPMENT',
        subjectId: draft.subjectId
      })
    ).toBeNull()
  })
})
