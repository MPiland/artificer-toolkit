import { describe, expect, it } from 'vitest'
import { authoredStoredDraftSchema } from '@artificer-toolkit/schema/api/authoredDrafts'
import { beginImportJobInputSchema } from '@artificer-toolkit/schema/api/importJobs'
import {
  importStoredJobSchema,
  importStoredPreviewSessionSchema
} from '@artificer-toolkit/schema/projections/importJobPersistence'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { dwarf, hillDwarf } from '@artificer-toolkit/source-data/srd/races/dwarf.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { canonicalizeRuleDocument } from '@artificer-toolkit/shared/rules'
import { publicationFixture } from '../../tests/fixtures/publication'
import { readAuthoredVersion, readPublishedDocument } from '../content/documents'
import { readImageSlot } from '../content/imageSlots'
import { beginPlanRef } from './stages'
import { stageCustomAuthoredRef } from './stageCustomAuthored'
import { isImportRowVisible } from './visibility'

const modules = import.meta.glob('/apps/apis/convex/**/*.*s')
const authModules = import.meta.glob('/apps/apis/convex/betterAuth/**/*.*s')

type Fixture = Awaited<ReturnType<typeof publicationFixture>>

async function stagingJob(base: Fixture, expectedStageCount: number) {
  const jobId = crypto.randomUUID()
  const previewId = crypto.randomUUID()
  const claimId = crypto.randomUUID()
  const entryId = 'portable-character'
  const name = 'portable-character.json'
  const nowMs = Date.now()
  const now = new Date(nowMs).toISOString()
  const command = beginImportJobInputSchema.parse({
    commandId: crypto.randomUUID(),
    previewId,
    selectedEntryIds: [entryId],
    resolutions: [],
    customContentChoices: []
  })
  await base.t.run(async (ctx) => {
    await ctx.db.insert(
      'importPreviewSessions',
      importStoredPreviewSessionSchema.parse({
        id: previewId,
        ownerUserId: base.first.userId,
        source: 'ARTIFICER_JSON',
        entries: [{ claimId, entryId, name }],
        descriptor: {
          source: 'ARTIFICER_JSON',
          entries: [{ claimId, entryId, name }]
        },
        status: 'CLAIMED',
        jobId,
        expiresAt: nowMs + 60_000,
        createdAt: now,
        updatedAt: now
      })
    )
    await ctx.db.insert(
      'importJobs',
      importStoredJobSchema.parse({
        id: jobId,
        ownerUserId: base.first.userId,
        previewId,
        command,
        inputFingerprint: checksumCanonicalJson({
          operation: 'PORTABLE_IMPORT',
          ownerUserId: base.first.userId,
          command
        }),
        source: 'ARTIFICER_JSON',
        status: 'RUNNING',
        terminalStatus: null,
        phase: 'PLANNING',
        entryIndex: 0,
        cursor: null,
        processedEntries: 0,
        totalEntries: 1,
        failureReason: null,
        summary: null,
        cleanupTableIndex: 0,
        cleanupCursor: null,
        expiresAt: nowMs + 60_000,
        createdAt: now,
        updatedAt: now
      })
    )
  })
  await base.t.mutation(beginPlanRef, {
    jobId,
    entryId,
    generatedIds: [],
    expectedStageCount
  })
  return { jobId, entryId }
}

function payload(
  template: object,
  ownerUserId: string,
  id: string,
  label: string,
  overrides: Record<string, unknown> = {}
) {
  return canonicalizeRuleDocument({
    ...JSON.parse(JSON.stringify(template)),
    ...overrides,
    id,
    label,
    systemId: srdSystemRecord.id,
    userId: ownerUserId,
    status: 'DRAFT'
  })
}

function args(
  job: Awaited<ReturnType<typeof stagingJob>>,
  targetId: string,
  label: string,
  payloadJson: string,
  activate: boolean,
  customSequence = 0,
  subjectKind = 'BACKGROUND'
) {
  return {
    ...job,
    sequence: 0,
    customSequence,
    source: 'ARTIFICER_JSON',
    externalId: 'custom-' + customSequence,
    subjectKind,
    targetId,
    systemId: srdSystemRecord.id,
    label,
    payloadJson,
    activate
  }
}

describe('custom authored import staging', () => {
  it('keeps a staged draft hidden except to its current import job', async () => {
    const base = await publicationFixture(modules, authModules, [])
    const job = await stagingJob(base, 2)
    const subjectId = crypto.randomUUID()
    const outputJson = await base.t.mutation(
      stageCustomAuthoredRef,
      args(
        job,
        subjectId,
        'Imported Acolyte',
        payload(acolyte, base.first.userId, subjectId, 'Imported Acolyte'),
        false
      )
    )
    const output = JSON.parse(outputJson) as {
      destination: unknown
      publicId: string
      draft: unknown
      stagedPayloadId: string
    }
    const draft = authoredStoredDraftSchema.parse(output.draft)
    expect(output.destination).toEqual({
      kind: 'AUTHORED_DRAFT',
      subjectKind: 'BACKGROUND',
      subjectId
    })
    if (!('payloadId' in draft)) throw new Error('Expected a staged draft payload id.')
    expect(draft.payloadId).toBe(output.stagedPayloadId)
    expect(draft.importJobId).toBe(job.jobId)

    const rows = await base.t.run(async (ctx) => {
      const [head, route, reference, usage, storedPayload, image] = await Promise.all([
        ctx.db
          .query('authoredDrafts')
          .withIndex('by_subjectId', (query) => query.eq('subjectId', subjectId))
          .unique(),
        ctx.db
          .query('authoredRouteIds')
          .withIndex('by_subjectId', (query) => query.eq('subjectId', subjectId))
          .unique(),
        ctx.db
          .query('authoredImportRefs')
          .withIndex('by_importJobId_subjectId', (query) =>
            query.eq('importJobId', job.jobId).eq('subjectId', subjectId)
          )
          .unique(),
        ctx.db
          .query('accountUsageEntries')
          .withIndex('by_importJobId_sourceId', (query) =>
            query.eq('importJobId', job.jobId).eq('sourceId', subjectId)
          )
          .unique(),
        ctx.db
          .query('authoredDraftPayloads')
          .withIndex('by_publicId', (query) => query.eq('id', output.stagedPayloadId))
          .unique(),
        readImageSlot(ctx, subjectId, 'DRAFT', job.jobId)
      ])
      return {
        head,
        route,
        reference,
        usage,
        storedPayload,
        image,
        visible: await Promise.all(
          [route, reference, usage, storedPayload, image].map((row) =>
            isImportRowVisible(ctx, row?.importJobId)
          )
        ),
        current: await Promise.all(
          [route, reference, usage, storedPayload, image].map((row) =>
            isImportRowVisible(ctx, row?.importJobId, job.jobId)
          )
        )
      }
    })
    expect(rows.head).toBeNull()
    expect(rows.route).toMatchObject({ importJobId: job.jobId, publicId: output.publicId })
    expect(rows.reference).toMatchObject({ importJobId: job.jobId, subjectId })
    expect(rows.usage).toMatchObject({ importJobId: job.jobId, sourceId: subjectId })
    expect(rows.storedPayload).toMatchObject({ importJobId: job.jobId, subjectId })
    expect(rows.image).toMatchObject({ importJobId: job.jobId, scope: 'DRAFT' })
    expect(rows.visible).toEqual([false, false, false, false, false])
    expect(rows.current).toEqual([true, true, true, true, true])

    await expect(base.t.run((ctx) => isImportRowVisible(ctx, draft.importJobId))).resolves.toBe(
      false
    )
    await expect(
      base.t.run((ctx) => isImportRowVisible(ctx, draft.importJobId, crypto.randomUUID()))
    ).resolves.toBe(false)
    await expect(
      base.t.run((ctx) => isImportRowVisible(ctx, draft.importJobId, job.jobId))
    ).resolves.toBe(true)
  }, 10_000)

  it('keeps staged active rows hidden and exposes their exact document only to the current job', async () => {
    const base = await publicationFixture(modules, authModules, [])
    const job = await stagingJob(base, 2)
    const subjectId = crypto.randomUUID()
    const outputJson = await base.t.mutation(
      stageCustomAuthoredRef,
      args(
        job,
        subjectId,
        'Imported Acolyte',
        payload(acolyte, base.first.userId, subjectId, 'Imported Acolyte'),
        true
      )
    )
    const output = JSON.parse(outputJson) as {
      destination: unknown
      publicId: string
      stagedRootId: string
      stagedRootChecksum: string
      stagedVersionId: string
      stagedVersionChecksum: string
      contentSource: { id: string }
      createContentSource: boolean
    }
    expect(output.destination).toEqual({
      kind: 'ACTIVE_AUTHORED_CONTENT',
      subjectKind: 'BACKGROUND',
      subjectId
    })
    expect(output.createContentSource).toBe(true)

    const staged = await base.t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (query) => query.eq('id', subjectId))
        .unique()
      if (!root || root._id !== output.stagedRootId) throw new Error('Missing staged root.')
      const version = await ctx.db.get(root.currentVersionId)
      if (!version || version._id !== output.stagedVersionId)
        throw new Error('Missing staged version.')
      const { _id: _rootId, _creationTime: _rootTime, ...rootFields } = root
      const { _id: _versionId, _creationTime: _versionTime, ...versionFields } = version
      return {
        root,
        rootChecksum: checksumCanonicalJson(rootFields),
        versionChecksum: checksumCanonicalJson(versionFields),
        rootVisible: await isImportRowVisible(ctx, root.importJobId),
        rootCurrent: await isImportRowVisible(ctx, root.importJobId, job.jobId),
        versionCurrent: await isImportRowVisible(ctx, version.importJobId, job.jobId),
        source: await ctx.db
          .query('contentSources')
          .withIndex('by_publicId', (query) => query.eq('id', output.contentSource.id))
          .unique(),
        image: await readImageSlot(ctx, subjectId, 'ACTIVE', job.jobId)
      }
    })
    expect(staged.root).toMatchObject({
      importJobId: job.jobId,
      ownerUserId: base.first.userId,
      contentSourceId: output.contentSource.id
    })
    expect(staged.root.catalogue).toBeUndefined()
    expect(staged.root.spellClassesIndexed).toBeUndefined()
    expect(staged.rootChecksum).toBe(output.stagedRootChecksum)
    expect(staged.versionChecksum).toBe(output.stagedVersionChecksum)
    expect(staged.rootVisible).toBe(false)
    expect(staged.rootCurrent).toBe(true)
    expect(staged.versionCurrent).toBe(true)
    expect(staged.source).toBeNull()
    expect(staged.image).toMatchObject({ importJobId: job.jobId, scope: 'ACTIVE' })

    await expect(
      base.t.run(async (ctx) => {
        const root = await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (query) => query.eq('id', subjectId))
          .unique()
        if (!root || root._id !== output.stagedRootId) throw new Error('Missing staged root.')
        return readAuthoredVersion(ctx, root)
      })
    ).rejects.toThrow('Stored authored content identity mismatch')
    await expect(
      base.t.run(async (ctx) => {
        const root = await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (query) => query.eq('id', subjectId))
          .unique()
        if (!root || root._id !== output.stagedRootId) throw new Error('Missing staged root.')
        return readAuthoredVersion(ctx, root, crypto.randomUUID())
      })
    ).rejects.toThrow('Stored authored content identity mismatch')
    await expect(
      base.t.run(async (ctx) => {
        const root = await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (query) => query.eq('id', subjectId))
          .unique()
        if (!root || root._id !== output.stagedRootId) throw new Error('Missing staged root.')
        const version = await readAuthoredVersion(ctx, root, job.jobId)
        return readPublishedDocument(ctx, root, version)
      })
    ).resolves.toMatchObject({ id: subjectId, label: 'Imported Acolyte', status: 'ACTIVE' })
  })

  it('validates and compiles a staged child against its same-job parent', async () => {
    const base = await publicationFixture(modules, authModules, [])
    const job = await stagingJob(base, 3)
    const parentId = crypto.randomUUID()
    const childId = crypto.randomUUID()
    const parentOutput = JSON.parse(
      await base.t.mutation(
        stageCustomAuthoredRef,
        args(
          job,
          parentId,
          'Imported Dwarf',
          payload(dwarf, base.first.userId, parentId, 'Imported Dwarf'),
          true,
          0,
          'RACE'
        )
      )
    ) as { contentSource: { id: string } }
    const childOutput = JSON.parse(
      await base.t.mutation(
        stageCustomAuthoredRef,
        args(
          job,
          childId,
          'Imported Hill Dwarf',
          payload(hillDwarf, base.first.userId, childId, 'Imported Hill Dwarf', {
            parentRaceId: parentId
          }),
          true,
          1,
          'RACE'
        )
      )
    ) as {
      contentSource: { id: string }
      catalogueFamily: { id: string; nameKey: string }
    }

    expect(childOutput.contentSource.id).toBe(parentOutput.contentSource.id)
    expect(childOutput.catalogueFamily).toEqual({
      id: parentId,
      nameKey: 'imported dwarf'
    })
  })

  it('rolls back every staged row when final stage validation fails', async () => {
    const base = await publicationFixture(modules, authModules, [])
    const job = await stagingJob(base, 1)
    const subjectId = crypto.randomUUID()
    await expect(
      base.t.mutation(
        stageCustomAuthoredRef,
        args(
          job,
          subjectId,
          'Rejected Acolyte',
          payload(acolyte, base.first.userId, subjectId, 'Rejected Acolyte'),
          false
        )
      )
    ).rejects.toThrow('Import staged output exceeds its plan')

    const retained = await base.t.run(async (ctx) => {
      const [root, draft, route, reference, usage, image] = await Promise.all([
        ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (query) => query.eq('id', subjectId))
          .unique(),
        ctx.db
          .query('authoredDrafts')
          .withIndex('by_subjectId', (query) => query.eq('subjectId', subjectId))
          .unique(),
        ctx.db
          .query('authoredRouteIds')
          .withIndex('by_subjectId', (query) => query.eq('subjectId', subjectId))
          .unique(),
        ctx.db
          .query('authoredImportRefs')
          .withIndex('by_importJobId_subjectId', (query) =>
            query.eq('importJobId', job.jobId).eq('subjectId', subjectId)
          )
          .unique(),
        ctx.db
          .query('accountUsageEntries')
          .withIndex('by_importJobId_sourceId', (query) =>
            query.eq('importJobId', job.jobId).eq('sourceId', subjectId)
          )
          .unique(),
        readImageSlot(ctx, subjectId, 'DRAFT', job.jobId)
      ])
      const payloads = await ctx.db
        .query('authoredDraftPayloads')
        .withIndex('by_importJobId_id', (query) => query.eq('importJobId', job.jobId))
        .take(1)
      return { root, draft, route, reference, usage, image, payloads }
    })
    expect(retained).toEqual({
      root: null,
      draft: null,
      route: null,
      reference: null,
      usage: null,
      image: null,
      payloads: []
    })
  })
})
