import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import { srdVehicles } from '@artificer-toolkit/source-data/srd/vehicles/index.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { rowboat } from '@artificer-toolkit/source-data/srd/vehicles/rowboat.js'
import { warship } from '@artificer-toolkit/source-data/srd/vehicles/warship.js'
import type {
  AuthoredDetailReadInput,
  AuthoredDetailReadResult
} from '@artificer-toolkit/schema/api/content'
import type { AuthoredDraftResult } from '@artificer-toolkit/schema/api/authoredDrafts'
import {
  authoredPublishDraftInputSchema,
  type AuthoredDeleteActiveInput,
  type AuthoredPublicationResult,
  type AuthoredPublishDraftInput
} from '@artificer-toolkit/schema/api/authoredPublication'
import { vehicleAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/vehicle'
import { nodeRuntimeResolveRequestDtoSchema } from '@artificer-toolkit/schema/api/nodeRuntime'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { authoredSourceFacts } from '@artificer-toolkit/authoring/nodeRuntime'
import { compileSubjectWithMechanicsIndex } from '@artificer-toolkit/shared/subjects/compilers'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { stripPortableMetadata } from '@artificer-toolkit/shared/utils'
import { api } from '../_generated/api'
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
const vehicleSubjects = srdVehicles.map((vehicle) =>
  importedSubject({ subjectKind: 'VEHICLE', ...vehicle, document: vehicle })
)

async function fixture() {
  return publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [vehicleSubjects.slice(0, 8), vehicleSubjects.slice(8)]
  )
}

async function copyDraft(
  caller: Awaited<ReturnType<typeof fixture>>['first']['caller'],
  subjectId = cart.id
) {
  return caller.mutation(api.content.drafts.duplicate, {
    subjectKind: 'VEHICLE',
    subjectId
  })
}

function publicationInput(draft: AuthoredDraftResult): AuthoredPublishDraftInput {
  if (!draft.updatedAt) throw new Error('Missing Vehicle draft revision')
  return authoredPublishDraftInputSchema.parse({
    subjectKind: 'VEHICLE',
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: draft.updatedAt
  })
}

describe('native Vehicle publication', () => {
  it('publishes all canonical Vehicle copies with cloned mechanics, source facts, category metadata, and private active detail', async () => {
    const { t, first, second } = await fixture()
    const canonicalBefore = await t.run(async (ctx) =>
      Promise.all(
        srdVehicles.map(async (vehicle) => {
          const root = await ctx.db
            .query('authoredRoots')
            .withIndex('by_publicId', (q) => q.eq('id', vehicle.id))
            .unique()
          if (!root) throw new Error(`Missing canonical Vehicle ${vehicle.label}`)
          return [
            vehicle.id,
            { checksum: root.checksum, versionId: root.currentVersionId }
          ] as const
        })
      )
    )
    const copies: Array<{
      draft: AuthoredDraftResult
      result: AuthoredPublicationResult
    }> = []
    for (const vehicle of srdVehicles) {
      const draft = await copyDraft(first.caller, vehicle.id)
      copies.push({
        draft,
        result: await first.caller.mutation(publish, publicationInput(draft))
      })
    }
    const systemId = cart.systemId
    const ownedCatalogue = await readVisibleCatalogue(t, first.caller, 'VEHICLE', { systemId })
    expect(ownedCatalogue.map((item) => item.id).sort()).toEqual(
      [
        ...srdVehicles.map((vehicle) => vehicle.id),
        ...copies.map(({ draft }) => draft.subjectId)
      ].sort()
    )
    const masterIds = srdVehicles.map((vehicle) => vehicle.id).sort()
    expect(
      (await readVisibleCatalogue(t, second.caller, 'VEHICLE', { systemId }))
        .map((item) => item.id)
        .sort()
    ).toEqual(masterIds)
    expect(
      await readVisibleCatalogue(t, first.caller, 'VEHICLE', { systemId: crypto.randomUUID() })
    ).toEqual([])
    const stored = await t.run(async (ctx) =>
      Promise.all(
        copies.map(async ({ draft, result }) => {
          const root = await ctx.db
            .query('authoredRoots')
            .withIndex('by_publicId', (q) => q.eq('id', draft.subjectId))
            .unique()
          if (!root) throw new Error(`Missing published Vehicle ${draft.label}`)
          const version = await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
          const route = await ctx.db
            .query('authoredRouteIds')
            .withIndex('by_subjectId', (q) => q.eq('subjectId', draft.subjectId))
            .unique()
          return {
            draft,
            result,
            root,
            sourceFacts: await readStoredSourceFacts(ctx, root),
            route,
            version,
            document: version && (await readStoredAuthoredVersionDocument(ctx, version))
          }
        })
      )
    )
    for (const entry of stored) {
      const copied = vehicleAuthoredDtoSchema.parse(entry.draft.payload)
      const document = vehicleAuthoredDtoSchema.parse(entry.document)
      const projection = jsonValueSchema.parse(
        JSON.parse(entry.version!.compilation!.projectionJson)
      )
      expect(entry.result).toMatchObject({
        subjectKind: 'VEHICLE',
        subjectId: entry.draft.subjectId,
        publicId: entry.draft.publicId
      })
      expect(entry.root).toMatchObject({
        subjectKind: 'VEHICLE',
        ownerUserId: first.userId,
        catalogue: expect.objectContaining({ category: document.category })
      })
      expect(entry.route?.publicId).toBe(entry.draft.publicId)
      expect(entry.version?.checksum).toBe(entry.result.checksum)
      expect(document).toMatchObject({ ...copied, status: 'ACTIVE' })
      expect(checksumRuleDocument(document)).toBe(entry.result.checksum)
      const resolved = await first.caller.query(
        api.authoring.nodeRuntime.resolve,
        nodeRuntimeResolveRequestDtoSchema.parse({
          mapId: 'vehicle',
          systemId: document.systemId,
          values: document
        })
      )
      expect(resolved.mapId).toBe('vehicle')
      expect(resolved.steps.length).toBeGreaterThan(0)
      const exported = await first.caller.query(api.content.exports.get, {
        subjectKind: 'VEHICLE',
        id: entry.draft.publicId,
        view: 'active'
      })
      expect(exported.item).toEqual({
        kind: 'VEHICLE',
        data: stripPortableMetadata(document)
      })
      await expect(
        second.caller.query(api.content.exports.get, {
          subjectKind: 'VEHICLE',
          id: entry.draft.subjectId,
          view: 'active'
        })
      ).rejects.toThrow('Only owned authored content')
      expect(entry.version?.compilation?.authoredChecksum).toBe(entry.result.checksum)
      expect(projection).toEqual(
        JSON.parse(
          JSON.stringify(
            compileSubjectWithMechanicsIndex({
              subjectKind: 'VEHICLE',
              authored: document
            }).compiled
          )
        )
      )
      expect(entry.version?.compilation?.projectionChecksum).toBe(checksumRuleDocument(projection))
      expect(entry.sourceFacts).toEqual(
        authoredSourceFacts({
          subjectKind: 'VEHICLE',
          document,
          checksum: entry.result.checksum
        })
      )
      expect(
        await first.caller.query(api.content.drafts.get, {
          subjectKind: 'VEHICLE',
          subjectId: entry.draft.subjectId
        })
      ).toBeNull()
      expect(
        await t.query(details, {
          subjectKind: 'VEHICLE',
          id: entry.draft.subjectId
        })
      ).toBeNull()
      expect(
        await second.caller.query(details, {
          subjectKind: 'VEHICLE',
          id: entry.draft.subjectId
        })
      ).toBeNull()
      expect(
        await first.caller.query(details, {
          subjectKind: 'VEHICLE',
          id: entry.draft.subjectId
        })
      ).toMatchObject({ item: expect.objectContaining({ status: 'ACTIVE' }) })
    }
    const documents = new Map(
      stored.map((entry) => [entry.draft.label, vehicleAuthoredDtoSchema.parse(entry.document)])
    )
    expect(documents.get(`${rowboat.label} Copy`)?.speed).toBe(1.5)
    expect(documents.get(`${warship.label} Copy`)?.speed).toBe(2.5)
    const copiedCart = documents.get(`${cart.label} Copy`)
    expect(copiedCart?.features?.[0]?.id).not.toBe(cart.features?.[0]?.id)
    expect(copiedCart?.features?.[0]?.effects?.[0]?.id).not.toBe(
      cart.features?.[0]?.effects?.[0]?.id
    )
    expect(copiedCart?.cost?.currencyId).toBe(cart.cost?.currencyId)
    expect(
      await t.run(async (ctx) =>
        Promise.all(
          canonicalBefore.map(async ([id]) => {
            const root = await ctx.db
              .query('authoredRoots')
              .withIndex('by_publicId', (q) => q.eq('id', id))
              .unique()
            return (
              root && {
                checksum: root.checksum,
                versionId: root.currentVersionId
              }
            )
          })
        )
      )
    ).toEqual(canonicalBefore.map(([, before]) => before))
  })

  it('preserves custom zero, capacity, cost, properties, details, and nested feature fields while rejecting stale and invalid publication', async () => {
    const { t, first } = await fixture()
    const draft = await copyDraft(first.caller)
    const copied = vehicleAuthoredDtoSchema.parse(draft.payload)
    const custom = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'VEHICLE',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: 'Custom Cart',
      payload: {
        ...copied,
        armorClass: 0,
        hitPoints: 0,
        speed: 0,
        speedNote: 'Stationary',
        crewMin: 0,
        crewMax: 0,
        passengerCapacity: 0,
        cargoCapacity: '0 lb.',
        weight: { amount: 0, unit: 'POUNDS' },
        cost: { amount: 0, currencyId: cart.cost!.currencyId },
        properties: ['CUSTOM'],
        details: [
          {
            id: crypto.randomUUID(),
            label: 'Custom detail',
            description: 'Saved detail.',
            order: 1
          }
        ],
        features: copied.features?.map((feature) => ({
          ...feature,
          label: 'Custom feature',
          description: 'Saved nested feature.'
        }))
      }
    })
    const result = await first.caller.mutation(publish, publicationInput(custom))
    const activeBefore = await first.caller.query(details, {
      subjectKind: 'VEHICLE',
      id: custom.subjectId
    })
    const document = vehicleAuthoredDtoSchema.parse(activeBefore?.item)
    expect(document).toMatchObject({
      armorClass: 0,
      hitPoints: 0,
      speed: 0,
      speedNote: 'Stationary',
      crewMin: 0,
      crewMax: 0,
      passengerCapacity: 0,
      cargoCapacity: '0 lb.',
      weight: { amount: 0, unit: 'POUNDS' },
      cost: { amount: 0, currencyId: cart.cost!.currencyId },
      properties: ['CUSTOM']
    })
    expect(document.details).toMatchObject([
      { label: 'Custom detail', description: 'Saved detail.' }
    ])
    expect(document.features).toMatchObject([
      { label: 'Custom feature', description: 'Saved nested feature.' }
    ])
    const working = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'VEHICLE',
      subjectId: custom.subjectId,
      systemId: custom.systemId,
      label: 'Working Cart',
      payload: { ...custom.payload, description: 'Unpublished edit' }
    })
    expect(
      (
        await first.caller.query(api.content.exports.get, {
          subjectKind: 'VEHICLE',
          id: custom.publicId,
          view: 'active'
        })
      ).item.data
    ).toEqual(stripPortableMetadata(document))
    expect(
      (
        await first.caller.query(api.content.exports.get, {
          subjectKind: 'VEHICLE',
          id: custom.subjectId,
          view: 'draft'
        })
      ).item.data
    ).toMatchObject({ id: custom.subjectId, description: 'Unpublished edit' })
    await expect(first.caller.mutation(publish, publicationInput(custom))).rejects.toThrow(
      'draft or published content changed'
    )
    expect(
      await first.caller.query(details, {
        subjectKind: 'VEHICLE',
        id: custom.subjectId
      })
    ).toMatchObject({
      item: activeBefore?.item,
      activeUpdatedAt: activeBefore?.activeUpdatedAt,
      hasDraft: true
    })
    const invalid = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'VEHICLE',
      subjectId: custom.subjectId,
      systemId: custom.systemId,
      label: 'Broken Cart',
      payload: { ...working.payload, hitPoints: -1 }
    })
    const versionsBefore = await t.run((ctx) =>
      ctx.db
        .query('authoredVersions')
        .withIndex('by_id_version', (q) => q.eq('id', custom.subjectId))
        .take(3)
    )
    await expect(first.caller.mutation(publish, publicationInput(invalid))).rejects.toThrow()
    expect(
      await first.caller.query(api.content.drafts.get, {
        subjectKind: 'VEHICLE',
        subjectId: custom.subjectId
      })
    ).toEqual(invalid)
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredVersions')
          .withIndex('by_id_version', (q) => q.eq('id', custom.subjectId))
          .take(3)
      )
    ).toEqual(versionsBefore)
    const replacement = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'VEHICLE',
      subjectId: custom.subjectId,
      systemId: custom.systemId,
      label: 'Replacement Cart',
      payload: { ...custom.payload, description: 'Published replacement' }
    })
    const replaced = await first.caller.mutation(publish, publicationInput(replacement))
    const versionsAfter = await t.run((ctx) =>
      ctx.db
        .query('authoredVersions')
        .withIndex('by_id_version', (q) => q.eq('id', custom.subjectId))
        .take(3)
    )
    expect(replaced.publicId).toBe(custom.publicId)
    expect(versionsAfter).toHaveLength(1)
    expect(versionsAfter[0]).toMatchObject({
      version: 2,
      checksum: replaced.checksum
    })
    expect(await t.run((ctx) => ctx.db.get(versionsBefore[0]!._id))).toBeNull()
    expect(result.publicId).toBe(custom.publicId)
  })

  it('denies anonymous, foreign, master, wrong-kind, and duplicate active Vehicle publication without changing state', async () => {
    const { t, first, second } = await fixture()
    const draft = await copyDraft(first.caller)
    const input = publicationInput(draft)
    await expect(t.mutation(publish, input)).rejects.toThrow()
    await expect(second.caller.mutation(publish, input)).rejects.toThrow()
    await expect(first.caller.mutation(publish, { ...input, subjectId: cart.id })).rejects.toThrow()
    await expect(
      first.caller.mutation(publish, { ...input, subjectKind: 'BACKGROUND' })
    ).rejects.toThrow()
    const published = await first.caller.mutation(publish, input)
    const duplicate = await copyDraft(first.caller)
    const normalizedDuplicate = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'VEHICLE',
      subjectId: duplicate.subjectId,
      systemId: duplicate.systemId,
      label: ` ${draft.label.toUpperCase()} `,
      payload: duplicate.payload
    })
    await expect(
      first.caller.mutation(publish, publicationInput(normalizedDuplicate))
    ).rejects.toThrow('ACTIVE_NAME_CONFLICT')
    expect(
      await first.caller.query(api.content.drafts.get, {
        subjectKind: 'VEHICLE',
        subjectId: duplicate.subjectId
      })
    ).toEqual(normalizedDuplicate)
    expect(
      await first.caller.query(details, {
        subjectKind: 'VEHICLE',
        id: draft.subjectId
      })
    ).toMatchObject({
      item: expect.objectContaining({ id: draft.subjectId }),
      activeUpdatedAt: published.activeUpdatedAt
    })
  })

  it('deletes owned active Vehicle while retaining a working draft and route, then removes the route when no draft remains', async () => {
    const { t, first, second } = await fixture()
    const owned = await copyDraft(first.caller)
    await first.caller.mutation(publish, publicationInput(owned))
    const deleteInput = {
      subjectKind: 'VEHICLE' as const,
      subjectId: owned.subjectId
    }
    await expect(t.mutation(deleteActive, deleteInput)).rejects.toThrow()
    await expect(second.caller.mutation(deleteActive, deleteInput)).rejects.toThrow()
    await expect(
      first.caller.mutation(deleteActive, {
        ...deleteInput,
        subjectId: cart.id
      })
    ).rejects.toThrow()
    await expect(
      first.caller.mutation(deleteActive, {
        ...deleteInput,
        subjectKind: 'BACKGROUND'
      })
    ).rejects.toThrow()
    const working = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'VEHICLE',
      subjectId: owned.subjectId,
      systemId: owned.systemId,
      label: 'Working Cart',
      payload: owned.payload
    })
    await first.caller.mutation(deleteActive, {
      subjectKind: 'VEHICLE',
      subjectId: owned.subjectId
    })
    const retained = await first.caller.query(api.content.drafts.get, {
      subjectKind: 'VEHICLE',
      subjectId: owned.subjectId
    })
    expect(retained).toMatchObject({
      subjectId: working.subjectId,
      publicId: working.publicId,
      userId: working.userId,
      systemId: working.systemId,
      payload: working.payload,
      draftState: 'DRAFT_ONLY',
      baseActiveUpdatedAt: null
    })
    expect(retained?.updatedAt).not.toBe(working.updatedAt)
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredDrafts')
          .withIndex('by_subjectId', (q) => q.eq('subjectId', owned.subjectId))
          .unique()
      )
    ).toMatchObject({ basePublishedChecksum: null })
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
        subjectKind: 'VEHICLE',
        id: owned.subjectId
      })
    ).toBeNull()
    const ownerCounts = await t.run((ctx) =>
      ctx.db
        .query('authoredCatalogueOwnerCounts')
        .withIndex('by_subjectKind_ownerUserId', (q) =>
          q.eq('subjectKind', 'VEHICLE').eq('ownerUserId', first.userId)
        )
        .unique()
    )
    expect(ownerCounts).toBeNull()
    const withoutDraft = await copyDraft(first.caller, warship.id)
    await first.caller.mutation(publish, publicationInput(withoutDraft))
    await first.caller.mutation(deleteActive, {
      subjectKind: 'VEHICLE',
      subjectId: withoutDraft.subjectId
    })
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredRouteIds')
          .withIndex('by_subjectId', (q) => q.eq('subjectId', withoutDraft.subjectId))
          .unique()
      )
    ).toBeNull()
    await first.caller.mutation(api.content.drafts.discard, {
      subjectKind: 'VEHICLE',
      subjectId: owned.subjectId
    })
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredRouteIds')
          .withIndex('by_subjectId', (q) => q.eq('subjectId', owned.subjectId))
          .unique()
      )
    ).toBeNull()
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', cart.id))
          .unique()
      )
    ).not.toBeNull()
  })
})
