import { describe, expect, it } from 'vitest'
import { srdRaces } from '@artificer-toolkit/source-data/srd/races/index.js'
import { srdEquipment } from '@artificer-toolkit/source-data/srd/equipment/index.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import type { AuthoredDraftResult } from '@artificer-toolkit/schema/api/authoredDrafts'
import {
  authoredPublishDraftInputSchema,
  authoredStoredCompilationSchema
} from '@artificer-toolkit/schema/api/authoredPublication'
import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import { nodeRuntimeResolveRequestDtoSchema } from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  compileSubjectWithMechanicsIndex,
  resolveRaceAuthored
} from '@artificer-toolkit/shared/subjects/compilers'
import { collectReferenceIds, stripPortableMetadata } from '@artificer-toolkit/shared/utils'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { RaceAuthored } from '@artificer-toolkit/shared/authored'
import {
  importedSubject,
  publicationFixture,
  setVersionCompilation,
  versionWithCompilation
} from '../../tests/fixtures/publication'
import { readVisibleCatalogue } from '../../tests/fixtures/contentSnapshotReaders'
import { api, internal } from '../_generated/api'
import { readStoredAuthoredVersionDocument } from './documents'

const syncDerived = internal.content.raceRelationships.syncDerived
const publish = api.content.publication.publishDraft

const subjects = srdRaces.map((race) =>
  importedSubject({ subjectKind: 'RACE', ...race, document: race })
)
const spellIds = new Set(collectReferenceIds(srdRaces, 'spellId', 'spellIds'))
const equipmentIds = new Set(collectReferenceIds(srdRaces, 'equipmentId', 'equipmentIds'))
const referencedSubjects = [
  ...srdSpells
    .filter((spell) => spellIds.has(spell.id))
    .map((spell) => importedSubject({ subjectKind: 'SPELL', ...spell, document: spell })),
  ...srdEquipment
    .filter((equipment) => equipmentIds.has(equipment.id))
    .map((equipment) =>
      importedSubject({
        subjectKind: 'EQUIPMENT',
        ...equipment,
        document: equipment
      })
    )
]

function batches<T>(items: readonly T[]) {
  return Array.from({ length: Math.ceil(items.length / 10) }, (_, index) =>
    items.slice(index * 10, index * 10 + 10)
  )
}

async function fixture() {
  const result = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    batches([...subjects, ...referencedSubjects])
  )
  for (const subject of subjects) {
    const document = raceAuthoredDtoSchema.parse(subject.document)
    if (document.category === 'BASE')
      await result.t.mutation(syncDerived, {
        id: subject.id,
        checksum: subject.checksum
      })
  }
  for (const subject of subjects) {
    const document = raceAuthoredDtoSchema.parse(subject.document)
    if (document.category === 'SUBRACE')
      await result.t.mutation(syncDerived, {
        id: subject.id,
        checksum: subject.checksum
      })
  }
  return result
}

function publicationInput(draft: AuthoredDraftResult) {
  const input = authoredPublishDraftInputSchema.parse({
    subjectKind: 'RACE',
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: draft.updatedAt
  })
  return { ...input, subjectKind: 'RACE' as const }
}

function storedState(t: Awaited<ReturnType<typeof fixture>>['t']) {
  return t.run(async (ctx) => ({
    roots: await ctx.db.query('authoredRoots').collect(),
    versions: await ctx.db.query('authoredVersions').collect(),
    versionChunks: await ctx.db.query('authoredVersionPayloadChunks').collect(),
    compilations: await ctx.db.query('authoredVersionCompilations').collect(),
    drafts: await ctx.db.query('authoredDrafts').collect(),
    routes: await ctx.db.query('authoredRouteIds').collect()
  }))
}

describe('native Race publication', () => {
  it('publishes every canonical Race copy with source retention, current inheritance and private ownership', async () => {
    const { t, first, second } = await fixture()
    expect(subjects).toHaveLength(13)
    expect(referencedSubjects).toHaveLength(spellIds.size + equipmentIds.size)
    const records = await t.run(async (ctx) =>
      Promise.all(
        subjects.map(async (subject) => {
          const root = await ctx.db
            .query('authoredRoots')
            .withIndex('by_publicId', (q) => q.eq('id', subject.id))
            .unique()
          if (!root) throw new Error('Missing canonical Race root')
          const version = await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
          return {
            root,
            version,
            subject,
            document: version && (await readStoredAuthoredVersionDocument(ctx, version))
          }
        })
      )
    )
    const copiedIds: string[] = []
    for (const { root, subject, version, document: storedDocument } of records) {
      if (!version?.compilation || !storedDocument) throw new Error('Missing Race compilation')
      const document = raceAuthoredDtoSchema.parse(storedDocument)
      expect(root.parentRaceId).toBe(document.category === 'SUBRACE' ? document.parentRaceId : null)
      expect(version.checksum).toBe(subject.checksum)
      expect(document).toMatchObject(raceAuthoredDtoSchema.parse(subject.document))
      const parent =
        document.category === 'SUBRACE'
          ? raceAuthoredDtoSchema.parse(
              subjects.find((candidate) => candidate.id === document.parentRaceId)?.document
            )
          : undefined
      const effective = resolveRaceAuthored(
        document as RaceAuthored,
        (id) => (id === parent?.id ? parent : undefined) as RaceAuthored | undefined
      )
      expect(jsonValueSchema.parse(JSON.parse(version.compilation.projectionJson))).toEqual(
        JSON.parse(
          JSON.stringify(
            compileSubjectWithMechanicsIndex({
              subjectKind: 'RACE',
              authored: document,
              effectiveAuthored: effective
            }).compiled
          )
        )
      )
      expect(version.compilation.projectionChecksum).toBe(
        checksumRuleDocument(JSON.parse(version.compilation.projectionJson))
      )
      const copy = await first.caller.mutation(api.content.drafts.duplicate, {
        subjectKind: 'RACE',
        subjectId: subject.id
      })
      const copied = raceAuthoredDtoSchema.parse(copy.payload)
      const result = await first.caller.mutation(publish, publicationInput(copy))
      copiedIds.push(copy.subjectId)
      const stored = await t.run(async (ctx) => {
        const ownedRoot = await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', copy.subjectId))
          .unique()
        if (!ownedRoot) throw new Error('Missing published Race copy')
        const version = await versionWithCompilation(
          ctx,
          await ctx.db.get(ownedRoot.currentVersionId)
        )
        return {
          root: ownedRoot,
          version,
          document: version && (await readStoredAuthoredVersionDocument(ctx, version))
        }
      })
      if (!stored.version?.compilation) throw new Error('Missing published Race compilation')
      const published = raceAuthoredDtoSchema.parse(stored.document)
      expect(published).toMatchObject({ ...copied, status: 'ACTIVE' })
      expect(stored.root.ownerUserId).toBe(first.userId)
      expect(result.publicId).toBe(copy.publicId)
      expect(result.checksum).toBe(checksumRuleDocument(published))
      const resolvedForm = await first.caller.query(
        api.authoring.nodeRuntime.resolve,
        nodeRuntimeResolveRequestDtoSchema.parse({
          mapId: 'race',
          systemId: published.systemId,
          values: published
        })
      )
      expect(resolvedForm.mapId).toBe('race')
      expect(resolvedForm.steps.length).toBeGreaterThan(0)
      expect(
        (
          await first.caller.query(api.content.exports.get, {
            subjectKind: 'RACE',
            id: copy.publicId,
            view: 'active'
          })
        ).item
      ).toEqual({ kind: 'RACE', data: stripPortableMetadata(published) })
      await expect(
        second.caller.query(api.content.exports.get, {
          subjectKind: 'RACE',
          id: copy.subjectId,
          view: 'active'
        })
      ).rejects.toThrow('Only owned authored content')
      expect(collectReferenceIds(published, 'spellId', 'spellIds')).toEqual(
        collectReferenceIds(document, 'spellId', 'spellIds')
      )
      expect(collectReferenceIds(published, 'equipmentId', 'equipmentIds')).toEqual(
        collectReferenceIds(document, 'equipmentId', 'equipmentIds')
      )
      const resolved = resolveRaceAuthored(
        published as RaceAuthored,
        (id) => (id === parent?.id ? parent : undefined) as RaceAuthored | undefined
      )
      expect(JSON.parse(stored.version.compilation.projectionJson)).toEqual(
        JSON.parse(
          JSON.stringify(
            compileSubjectWithMechanicsIndex({
              subjectKind: 'RACE',
              authored: published,
              effectiveAuthored: resolved
            }).compiled
          )
        )
      )
      if (published.category === 'SUBRACE') {
        expect(published.parentRaceId).toBe(parent?.id)
        expect(published).not.toHaveProperty('size')
        expect(published).not.toHaveProperty('speeds')
      }
      expect(
        await first.caller.query(api.content.drafts.get, {
          subjectKind: 'RACE',
          subjectId: copy.subjectId
        })
      ).toBeNull()
      expect(
        await second.caller.query(api.content.details.get, {
          subjectKind: 'RACE',
          id: copy.subjectId
        })
      ).toBeNull()
      expect(await t.run((ctx) => ctx.db.get(root._id))).toEqual(root)
    }
    const systemId = subjects[0]!.systemId
    const masterIds = subjects.map((subject) => subject.id).sort()
    const ownedCatalogue = await readVisibleCatalogue(t, first.caller, 'RACE', {
      systemId
    })
    expect(ownedCatalogue.map((item) => item.id).sort()).toEqual(
      [...masterIds, ...copiedIds].sort()
    )
    expect(ownedCatalogue.filter((item) => item.category === 'BASE')).toHaveLength(18)
    expect(
      (await readVisibleCatalogue(t, second.caller, 'RACE', { systemId }))
        .map((item) => item.id)
        .sort()
    ).toEqual(masterIds)
    expect(
      await readVisibleCatalogue(t, first.caller, 'RACE', {
        systemId: crypto.randomUUID()
      })
    ).toEqual([])
  }, 30_000)

  it('rejects child sync until a legacy base parent has its missing parent metadata backfilled', async () => {
    const child = subjects.find(
      (subject) => raceAuthoredDtoSchema.parse(subject.document).category === 'SUBRACE'
    )!
    const childDocument = raceAuthoredDtoSchema.parse(child.document)
    if (childDocument.category !== 'SUBRACE') throw new Error('Expected canonical subrace')
    const base = subjects.find((subject) => subject.id === childDocument.parentRaceId)
    if (!base) throw new Error('Missing canonical subrace parent')
    const result = await publicationFixture(
      import.meta.glob('/apps/apis/convex/**/*.*s'),
      import.meta.glob('../betterAuth/**/*.*s'),
      [[base, child]]
    )
    await result.t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', base.id))
        .unique()
      if (!root) throw new Error('Missing base Race fixture')
      expect(root.parentRaceId).toBeNull()
      await ctx.db.patch(root._id, { parentRaceId: undefined })
    })
    await expect(
      result.t.mutation(syncDerived, {
        id: child.id,
        checksum: child.checksum
      })
    ).rejects.toThrow('A readable base Race in the same System is required.')
    await result.t.mutation(syncDerived, {
      id: base.id,
      checksum: base.checksum
    })
    await expect(
      result.t.mutation(syncDerived, {
        id: child.id,
        checksum: child.checksum
      })
    ).resolves.toBeNull()
  })

  it('publishes owned base and subrace current sources, then atomically refreshes only the child projection', async () => {
    const { first, second, t } = await fixture()
    const baseSource = subjects.find(
      (subject) => raceAuthoredDtoSchema.parse(subject.document).category === 'BASE'
    )!
    const childSource = subjects.find((subject) => {
      const document = raceAuthoredDtoSchema.parse(subject.document)
      return document.category === 'SUBRACE' && document.parentRaceId === baseSource.id
    })!
    const base = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'RACE',
      subjectId: baseSource.id
    })
    const baseDocument = raceAuthoredDtoSchema.parse(base.payload)
    if (baseDocument.category !== 'BASE') throw new Error('Expected owned base race')
    await first.caller.mutation(publish, publicationInput(base))
    const copied = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'RACE',
      subjectId: childSource.id
    })
    const child = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'RACE',
      subjectId: copied.subjectId,
      systemId: copied.systemId,
      label: copied.label,
      payload: { ...copied.payload, parentRaceId: base.subjectId }
    })
    await first.caller.mutation(publish, publicationInput(child))
    const before = await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', child.subjectId))
        .unique()
      if (!root) throw new Error('Missing owned subrace')
      const version = await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
      return {
        root,
        version,
        document: version && (await readStoredAuthoredVersionDocument(ctx, version))
      }
    })
    const working = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'RACE',
      subjectId: child.subjectId,
      systemId: child.systemId,
      label: child.label,
      payload: { ...child.payload, description: 'Private working child edit' }
    })
    expect(
      (
        await first.caller.query(api.content.exports.get, {
          subjectKind: 'RACE',
          id: child.publicId,
          view: 'active'
        })
      ).item.data
    ).toEqual(stripPortableMetadata(raceAuthoredDtoSchema.parse(before.document)))
    expect(
      (
        await first.caller.query(api.content.exports.get, {
          subjectKind: 'RACE',
          id: child.publicId,
          view: 'draft'
        })
      ).item.data
    ).toEqual(stripPortableMetadata(working.payload))
    const replacement = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'RACE',
      subjectId: base.subjectId,
      systemId: base.systemId,
      label: 'Aardvark renamed parent',
      payload: {
        ...base.payload,
        speeds: baseDocument.speeds.map((speed, index) =>
          index === 0 ? { ...speed, amount: speed.amount + 5 } : speed
        )
      }
    })
    await first.caller.mutation(publish, publicationInput(replacement))
    const after = await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', child.subjectId))
        .unique()
      if (!root) throw new Error('Missing owned subrace')
      const version = await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId))
      return {
        root,
        version,
        document: version && (await readStoredAuthoredVersionDocument(ctx, version))
      }
    })
    expect(after.root.parentRaceId).toBe(base.subjectId)
    expect(after.root).toEqual({
      ...before.root,
      catalogueFamily: {
        id: base.subjectId,
        nameKey: 'aardvark renamed parent'
      }
    })
    expect(after.root.currentVersionId).toBe(before.root.currentVersionId)
    expect(after.document).toEqual(before.document)
    expect(after.version?.checksum).toBe(before.version?.checksum)
    expect(after.version?.compilation?.projectionJson).not.toBe(
      before.version?.compilation?.projectionJson
    )
    expect(
      await first.caller.query(api.content.drafts.get, {
        subjectKind: 'RACE',
        subjectId: child.subjectId
      })
    ).toEqual(working)
    // Fail after the parent commit has run: the entire mutation must roll back.
    if (!after.version) throw new Error('Missing child version')
    const afterChunk = await t.run(async (ctx) => {
      const chunk = await ctx.db
        .query('authoredVersionPayloadChunks')
        .withIndex('by_versionId_chunkIndex', (query) =>
          query.eq('versionId', after.version!.versionId)
        )
        .first()
      if (!chunk) throw new Error('Missing child version chunk')
      const corrupted = chunk.bytes.slice(0)
      const corruptedBytes = new Uint8Array(corrupted)
      corruptedBytes[0] = (corruptedBytes[0] ?? 0) ^ 1
      await ctx.db.patch(chunk._id, { bytes: corrupted })
      return chunk
    })
    const retry = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'RACE',
      subjectId: base.subjectId,
      systemId: base.systemId,
      label: 'Zebra rejected rename',
      payload: replacement.payload
    })
    const beforeFailure = await storedState(t)
    await expect(first.caller.mutation(publish, publicationInput(retry))).rejects.toThrow()
    expect(await storedState(t)).toEqual(beforeFailure)
    await t.run((ctx) => ctx.db.patch(afterChunk._id, { bytes: afterChunk.bytes }))
    const conversion = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'RACE',
      subjectId: base.subjectId,
      systemId: base.systemId,
      label: base.label,
      payload: {
        ...child.payload,
        id: base.subjectId,
        category: 'SUBRACE',
        parentRaceId: baseSource.id
      }
    })
    await expect(first.caller.mutation(publish, publicationInput(conversion))).rejects.toThrow(
      'published subraces'
    )
    const readChild = () =>
      t.run(async (ctx) => {
        const root = await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', child.subjectId))
          .unique()
        if (!root) throw new Error('Missing retained subrace.')
        return {
          root,
          version: await versionWithCompilation(ctx, await ctx.db.get(root.currentVersionId)),
          draft: await ctx.db
            .query('authoredDrafts')
            .withIndex('by_subjectId', (q) => q.eq('subjectId', child.subjectId))
            .unique()
        }
      })
    const childBeforeDelete = await readChild()
    await first.caller.mutation(api.content.deletion.deleteActive, {
      subjectKind: 'RACE',
      subjectId: base.subjectId
    })
    const childAfterDelete = await readChild()
    expect(childAfterDelete.version).toEqual(childBeforeDelete.version)
    expect(childAfterDelete.draft).toEqual(childBeforeDelete.draft)
    expect(childAfterDelete.version?.compilation).toEqual(childBeforeDelete.version?.compilation)
    expect(childAfterDelete.root.catalogue?.deletedReferences).toContainEqual({
      subjectKind: 'RACE',
      subjectId: base.subjectId,
      label: 'Aardvark renamed parent'
    })
    const deleteInput = {
      subjectKind: 'RACE' as const,
      subjectId: child.subjectId
    }
    const beforeDeniedDelete = await storedState(t)
    await expect(t.mutation(api.content.deletion.deleteActive, deleteInput)).rejects.toThrow()
    await expect(
      second.caller.mutation(api.content.deletion.deleteActive, deleteInput)
    ).rejects.toThrow()
    await expect(
      first.caller.mutation(api.content.deletion.deleteActive, {
        ...deleteInput,
        subjectId: childSource.id
      })
    ).rejects.toThrow()
    await expect(
      first.caller.mutation(api.content.deletion.deleteActive, {
        ...deleteInput,
        subjectKind: 'BACKGROUND'
      })
    ).rejects.toThrow()
    expect(await storedState(t)).toEqual(beforeDeniedDelete)
    await first.caller.mutation(api.content.deletion.deleteActive, {
      subjectKind: 'RACE',
      subjectId: child.subjectId
    })
    const retained = await first.caller.query(api.content.drafts.get, deleteInput)
    expect(retained).toMatchObject({
      payload: working.payload,
      publicId: working.publicId,
      draftState: 'DRAFT_ONLY',
      baseActiveUpdatedAt: null
    })
    const deletedState = await storedState(t)
    expect(deletedState.drafts.find((draft) => draft.subjectId === child.subjectId)).toMatchObject({
      basePublishedChecksum: null
    })
    expect(deletedState.routes.some((route) => route.subjectId === child.subjectId)).toBe(true)
    await first.caller.mutation(api.content.drafts.discard, deleteInput)
    expect((await storedState(t)).routes.some((route) => route.subjectId === child.subjectId)).toBe(
      false
    )
  })

  it('preserves state on unauthorized, stale, invalid-parent, invalid-source and duplicate-name publication', async () => {
    const { t, first, second } = await fixture()
    const baseSource = subjects.find(
      (entry) => raceAuthoredDtoSchema.parse(entry.document).category === 'BASE'
    )!
    const childSource = subjects.find(
      (entry) => raceAuthoredDtoSchema.parse(entry.document).category === 'SUBRACE'
    )!
    const base = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'RACE',
      subjectId: baseSource.id
    })
    const input = publicationInput(base)
    const beforeDenied = await storedState(t)
    await expect(t.mutation(publish, input)).rejects.toThrow()
    await expect(second.caller.mutation(publish, input)).rejects.toThrow()
    await expect(
      first.caller.mutation(publish, { ...input, subjectId: baseSource.id })
    ).rejects.toThrow()
    await expect(
      first.caller.mutation(publish, { ...input, subjectKind: 'BACKGROUND' })
    ).rejects.toThrow()
    expect(await storedState(t)).toEqual(beforeDenied)
    await first.caller.mutation(publish, input)
    const duplicate = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'RACE',
      subjectId: baseSource.id
    })
    const collision = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'RACE',
      subjectId: duplicate.subjectId,
      systemId: duplicate.systemId,
      label: ` ${base.label.toUpperCase()} `,
      payload: duplicate.payload
    })
    const beforeCollision = await storedState(t)
    await expect(first.caller.mutation(publish, publicationInput(collision))).rejects.toThrow(
      'ACTIVE_NAME_CONFLICT'
    )
    expect(await storedState(t)).toEqual(beforeCollision)
    const invalid = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'RACE',
      subjectId: base.subjectId,
      systemId: base.systemId,
      label: base.label,
      payload: { ...base.payload, category: 'INVALID' }
    })
    const beforeInvalid = await storedState(t)
    await expect(first.caller.mutation(publish, input)).rejects.toThrow(
      'draft or published content changed'
    )
    await expect(first.caller.mutation(publish, publicationInput(invalid))).rejects.toThrow()
    expect(await storedState(t)).toEqual(beforeInvalid)
    const foreign = await second.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'RACE',
      subjectId: baseSource.id
    })
    await second.caller.mutation(publish, publicationInput(foreign))
    const child = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'RACE',
      subjectId: childSource.id
    })
    const wrongKind = referencedSubjects[0]!
    for (const parentRaceId of [
      crypto.randomUUID(),
      child.subjectId,
      foreign.subjectId,
      childSource.id,
      wrongKind.id
    ]) {
      const badParent = await first.caller.mutation(api.content.drafts.save, {
        subjectKind: 'RACE',
        subjectId: child.subjectId,
        systemId: child.systemId,
        label: child.label,
        payload: { ...child.payload, parentRaceId }
      })
      const beforeParent = await storedState(t)
      await expect(first.caller.mutation(publish, publicationInput(badParent))).rejects.toThrow(
        'A readable base Race in the same System is required.'
      )
      expect(await storedState(t)).toEqual(beforeParent)
    }
    const foreignSystemId = crypto.randomUUID()
    const rootId = await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', base.subjectId))
        .unique()
      if (!root) throw new Error('Missing owned base')
      await ctx.db.patch(root._id, { systemId: foreignSystemId })
      return root._id
    })
    const wrongSystem = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'RACE',
      subjectId: child.subjectId,
      systemId: child.systemId,
      label: child.label,
      payload: { ...child.payload, parentRaceId: base.subjectId }
    })
    const beforeSystem = await storedState(t)
    await expect(first.caller.mutation(publish, publicationInput(wrongSystem))).rejects.toThrow(
      'A readable base Race in the same System is required.'
    )
    expect(await storedState(t)).toEqual(beforeSystem)
    await t.run((ctx) => ctx.db.patch(rootId, { systemId: base.systemId }))
  })

  it('replays canonical derived backfill without writes and fails closed on conflicts or missing metadata', async () => {
    const { t, first } = await fixture()
    const before = await storedState(t)
    for (const subject of subjects)
      await t.mutation(syncDerived, {
        id: subject.id,
        checksum: subject.checksum
      })
    expect(await storedState(t)).toEqual(before)
    const root = before.roots.find((entry) => entry.id === subjects[0]!.id)!
    const version = before.versions.find((entry) => entry._id === root.currentVersionId)!
    const stored = before.compilations.find(
      (entry) => entry.versionId === version.versionId
    )?.compilation
    // Publication stores the current compiler's output; parsing proves it.
    const compilation = stored && authoredStoredCompilationSchema.parse(stored)
    await expect(t.mutation(syncDerived, { id: root.id, checksum: 'wrong' })).rejects.toThrow()
    await t.run((ctx) => ctx.db.patch(root._id, { parentRaceId: crypto.randomUUID() }))
    const parentConflict = await storedState(t)
    await expect(t.mutation(syncDerived, { id: root.id, checksum: root.checksum })).rejects.toThrow(
      'Canonical content conflict'
    )
    expect(await storedState(t)).toEqual(parentConflict)
    await t.run((ctx) => ctx.db.patch(root._id, { parentRaceId: root.parentRaceId }))
    if (!compilation) throw new Error('Missing compilation')
    await t.run((ctx) =>
      setVersionCompilation(ctx, version, {
        ...compilation,
        projectionChecksum: 'conflict'
      })
    )
    const compilationConflict = await storedState(t)
    await expect(t.mutation(syncDerived, { id: root.id, checksum: root.checksum })).rejects.toThrow(
      'Canonical content conflict'
    )
    expect(await storedState(t)).toEqual(compilationConflict)
    await t.run((ctx) => setVersionCompilation(ctx, version, compilation))
    const draft = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'RACE',
      subjectId: root.id
    })
    await first.caller.mutation(publish, publicationInput(draft))
    const working = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'RACE',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: draft.label,
      payload: draft.payload
    })
    await t.run((ctx) => ctx.db.patch(root._id, { parentRaceId: undefined }))
    const incomplete = await storedState(t)
    await expect(first.caller.mutation(publish, publicationInput(working))).rejects.toThrow(
      'backfill is incomplete'
    )
    expect(await storedState(t)).toEqual(incomplete)
    await first.caller.mutation(api.content.deletion.deleteActive, {
      subjectKind: 'RACE',
      subjectId: draft.subjectId
    })
    const afterDelete = await storedState(t)
    expect(afterDelete.roots.find((entry) => entry.id === root.id)).toEqual(
      incomplete.roots.find((entry) => entry.id === root.id)
    )
    expect(afterDelete.versions.find((entry) => entry._id === root.currentVersionId)).toEqual(
      incomplete.versions.find((entry) => entry._id === root.currentVersionId)
    )
    expect(afterDelete.roots.some((entry) => entry.id === draft.subjectId)).toBe(false)
  })

  it('admits 499 subraces, allows republishing a member, and rolls back a 500th child', async () => {
    const { t, first, second } = await fixture()
    const source = subjects.find(
      (entry) => raceAuthoredDtoSchema.parse(entry.document).category === 'SUBRACE'
    )!
    const sourceDocument = raceAuthoredDtoSchema.parse(source.document)
    if (sourceDocument.category !== 'SUBRACE') throw new Error('Expected subrace')
    // Only sibling index membership matters to admission; the new publication is real.
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', source.id))
        .unique()
      if (!root) throw new Error('Missing canonical subrace')
      const siblings = await ctx.db
        .query('authoredRoots')
        .withIndex('by_system_kind_parentRaceId', (q) =>
          q
            .eq('systemId', source.systemId)
            .eq('subjectKind', 'RACE')
            .eq('parentRaceId', sourceDocument.parentRaceId)
        )
        .collect()
      const { _id, _creationTime, ...fields } = root
      for (let index = siblings.length; index < 498; index++)
        await ctx.db.insert('authoredRoots', {
          ...fields,
          id: crypto.randomUUID(),
          ownerUserId: second.userId
        })
    })
    const accepted = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'RACE',
      subjectId: source.id
    })
    await first.caller.mutation(publish, publicationInput(accepted))
    const working = await first.caller.mutation(api.content.drafts.save, {
      subjectKind: 'RACE',
      subjectId: accepted.subjectId,
      systemId: accepted.systemId,
      label: accepted.label,
      payload: accepted.payload
    })
    await first.caller.mutation(publish, publicationInput(working))
    const rejected = await first.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'RACE',
      subjectId: source.id
    })
    const before = await storedState(t)
    await expect(first.caller.mutation(publish, publicationInput(rejected))).rejects.toThrow(
      'inheritance exceeds the authoring limit'
    )
    expect(await storedState(t)).toEqual(before)
  }, 30_000)
})
