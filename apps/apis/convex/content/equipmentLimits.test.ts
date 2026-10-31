import { afterEach, expect, it, vi } from 'vitest'
import { getFunctionName } from 'convex/server'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { authoredSourceFacts } from '@artificer-toolkit/authoring/nodeRuntime'
import { api, internal } from '../_generated/api'
import { publicationFixture, versionWithCompilation } from '../../tests/fixtures/publication'
import { verifyEquipmentCapacity } from '../../tests/developmentEquipmentCapacity'
import { catalogueMetadata, syncCatalogueMetadata } from './catalogueMetadata'
import { equipmentOptionFacts } from '@artificer-toolkit/rules-runtime/character/equipmentOptionFacts'
import { ensureAuthoredRouteId } from './routeIds'
import { compilePublicationDocument } from './publicationDocument'
import { writeSourceFacts } from './sourceFacts'
import { activePublicationNameKey } from './publicationPersistence'

afterEach(() => {
  vi.useRealTimers()
})

it('runs the full-SRD public 500-visible-option capacity journey and restores all fixture state', async () => {
  // Full-corpus work must not expire the fixture's one-minute auth session.
  vi.useFakeTimers({ toFake: ['Date'] })
  const { t, first } = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    []
  )
  expect(await t.action(internal.content.seed.seed, {})).toMatchObject({
    subjects: 1057
  })
  expect(
    await first.caller.query(api.content.equipmentOptions.list, {
      systemId: club.systemId
    })
  ).toHaveLength(371)
  await t.run((ctx) =>
    ctx.db.insert('accountEntitlements', {
      userId: first.userId,
      tier: 'PLAYER'
    })
  )
  let retriedCommittedDeletion = false
  await verifyEquipmentCapacity({
    owner: {
      query: (query, ...args) => first.caller.run((ctx) => ctx.runQuery(query, ...args)),
      mutation: async (mutation, ...args) => {
        const result = await first.caller.run((ctx) => ctx.runMutation(mutation, ...args))
        if (
          !retriedCommittedDeletion &&
          getFunctionName(mutation) === 'content/deletion:deleteActive'
        ) {
          retriedCommittedDeletion = true
          throw new Error('InternalServerError after committed fixture deletion')
        }
        return result
      }
    },
    userId: first.userId
  })
  expect(retriedCommittedDeletion).toBe(true)
  await t.run(async (ctx) => {
    expect(await ctx.db.query('authoredDrafts').collect()).toHaveLength(0)
    expect(await ctx.db.query('authoredRoots').collect()).toHaveLength(1057)
    expect(await ctx.db.query('authoredVersions').collect()).toHaveLength(1057)
    expect(await ctx.db.query('authoredRouteIds').collect()).toHaveLength(1057)
  })
}, 240_000)

it('recompiles the complete 500-Equipment chain without recursive descendant source reads', async () => {
  const { t, first } = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    []
  )
  const document = {
    kind: 'EQUIPMENT' as const,
    id: crypto.randomUUID(),
    label: 'Bounded root',
    description: null,
    category: 'ADVENTURING_GEAR' as const,
    properties: [],
    rarityId: club.rarityId,
    userId: first.userId,
    systemId: club.systemId,
    weight: { amount: 2, unit: 'POUNDS' as const }
  }
  const lookup = { subjectKind: 'EQUIPMENT' as const, subjectId: document.id }
  const saved = await first.caller.mutation(api.content.drafts.save, {
    ...lookup,
    systemId: document.systemId,
    label: document.label,
    payload: document
  })
  if (!saved.updatedAt) throw new Error('Missing draft token')
  await first.caller.mutation(api.content.publication.publishDraft, {
    ...lookup,
    expectedDraftUpdatedAt: saved.updatedAt
  })
  // Exact persisted fixtures isolate the single parent publication from 499 unrelated
  // authoring journeys. Every child has genuine routes, source facts, options and counters.
  const leaf = await t.run(async (ctx) => {
    const base = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', document.id))
      .unique()
    if (!base) throw new Error('Missing base')
    const baseVersion = await ctx.db.get(base.currentVersionId)
    if (!baseVersion) throw new Error('Missing base version')
    let parentId = base.id
    let leafVersionId = base.currentVersionId
    for (let index = 1; index < 500; index++) {
      const child = equipmentAuthoredDtoSchema.parse({
        ...document,
        id: crypto.randomUUID(),
        label: `Generation ${index}`,
        status: 'ACTIVE',
        category: 'VARIANT',
        parentEquipmentId: parentId
      })
      const checksum = checksumRuleDocument(child)
      const publicId = await ensureAuthoredRouteId(ctx, 'EQUIPMENT', child.id)
      const effective = {
        ...document,
        id: child.id,
        label: child.label,
        status: 'ACTIVE' as const,
        category: 'ADVENTURING_GEAR' as const,
        properties: []
      }
      const publicVersionId = crypto.randomUUID()
      const versionId = await ctx.db.insert('authoredVersions', {
        subjectKind: 'EQUIPMENT',
        id: child.id,
        systemId: child.systemId,
        label: child.label,
        checksum,
        contentSourceId: base.contentSourceId,
        versionId: publicVersionId,
        version: 1,
        documentSchemaVersion: 1,
        documentJson: canonicalizeRuleDocument(child)
      })
      await ctx.db.insert('authoredVersionCompilations', {
        subjectId: child.id,
        systemId: child.systemId,
        versionId: publicVersionId,
        compilation: compilePublicationDocument(
          { subjectKind: 'EQUIPMENT', document: child },
          effective
        )
      })
      const rootId = await ctx.db.insert('authoredRoots', {
        id: child.id,
        subjectKind: 'EQUIPMENT',
        systemId: child.systemId,
        label: child.label,
        checksum,
        contentSourceId: base.contentSourceId,
        ownerUserId: first.userId,
        activeNameKey: activePublicationNameKey(child.label),
        currentVersionId: versionId,
        currentVersionPublicId: publicVersionId,
        parentEquipmentId: parentId,
        equipmentOptions: equipmentOptionFacts(child, checksum)
      })
      await writeSourceFacts(
        ctx,
        child.id,
        authoredSourceFacts({
          subjectKind: 'EQUIPMENT',
          document: child,
          checksum
        })
      )
      const version = await ctx.db.get(versionId)
      if (!version) throw new Error('Missing child version')
      await syncCatalogueMetadata(
        ctx,
        rootId,
        await catalogueMetadata(
          ctx,
          { subjectKind: 'EQUIPMENT', document: child },
          {
            checksum,
            publicId,
            createdAt: version._creationTime
          }
        )
      )
      parentId = child.id
      leafVersionId = versionId
    }
    return await ctx.db.get(leafVersionId)
  })
  if (!leaf) throw new Error('Missing leaf')
  expect(
    (
      await first.caller.query(api.content.catalogue.counts, {
        subjectKind: 'EQUIPMENT',
        systemId: document.systemId
      })
    ).ownedCount
  ).toBe(500)
  const replacement = await first.caller.mutation(api.content.drafts.save, {
    ...lookup,
    systemId: document.systemId,
    label: document.label,
    payload: { ...document, weight: { amount: 9, unit: 'POUNDS' } }
  })
  if (!replacement.updatedAt) throw new Error('Missing replacement token')
  await first.caller.mutation(api.content.publication.publishDraft, {
    ...lookup,
    expectedDraftUpdatedAt: replacement.updatedAt
  })
  const updated = await t.run(async (ctx) =>
    versionWithCompilation(ctx, await ctx.db.get(leaf._id))
  )
  expect(updated?.documentJson).toBe(leaf.documentJson)
  expect(updated?.checksum).toBe(leaf.checksum)
  expect(updated?._creationTime).toBe(leaf._creationTime)
  expect(JSON.parse(updated!.compilation!.projectionJson)).toMatchObject({
    weight: { amount: 9 }
  })
  const leafDraft = await first.caller.mutation(api.content.drafts.save, {
    subjectKind: 'EQUIPMENT',
    subjectId: leaf.id,
    systemId: document.systemId,
    label: 'Republished deepest variant',
    payload: equipmentAuthoredDtoSchema.parse(JSON.parse(leaf.documentJson))
  })
  if (!leafDraft.updatedAt) throw new Error('Missing leaf token')
  await first.caller.mutation(api.content.publication.publishDraft, {
    subjectKind: 'EQUIPMENT',
    subjectId: leaf.id,
    expectedDraftUpdatedAt: leafDraft.updatedAt
  })
  const republishedLeaf = await t.run(async (ctx) => {
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', leaf.id))
      .unique()
    if (!root) throw new Error('Missing republished leaf')
    return await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
  })
  expect(republishedLeaf?.label).toBe(leafDraft.label)
  expect(JSON.parse(republishedLeaf!.compilation!.projectionJson)).toMatchObject({
    weight: { amount: 9 }
  })
}, 120_000)
