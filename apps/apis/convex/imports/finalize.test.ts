import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import { authoredStoredDraftSchema } from '@artificer-toolkit/schema/api/authoredDrafts'
import { characterBuilderDraftDtoSchema } from '@artificer-toolkit/schema/api/characterBuilder'
import { beginImportJobInputSchema } from '@artificer-toolkit/schema/api/importJobs'
import type { ImportResultItemDto } from '@artificer-toolkit/schema/api/imports'
import {
  importStoredJobSchema,
  importStoredPreviewSessionSchema
} from '@artificer-toolkit/schema/projections/importJobPersistence'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { canonicalizeRuleDocument } from '@artificer-toolkit/shared/rules'
import { publicationFixture } from '../../tests/fixtures/publication'
import { readDraft } from '../content/documents'
import { completeRef } from './finalize'
import { stageCustomAuthoredRef } from './stageCustomAuthored'
import { stageAuthoredHeadRef, stageCharacterHeadRef } from './stageDrafts'
import { beginPlanRef, encodeImportResult, stageResultRef } from './stages'

const modules = import.meta.glob('/apps/apis/convex/**/*.*s')
const authModules = import.meta.glob('../betterAuth/**/*.*s')
const progress = makeFunctionReference<'query', { jobId: string }, unknown>('imports/jobs:progress')
const cleanup = makeFunctionReference<'mutation', { jobId: string }, null>(
  'imports/jobCleanup:cleanup'
)
const createCharacterDraft = makeFunctionReference<
  'mutation',
  { id: string; systemId: string },
  unknown
>('characters/drafts:create')
const discardCharacterDraft = makeFunctionReference<
  'mutation',
  { id: string; expectedDraftId: string },
  { ok: true }
>('characters/drafts:discard')

async function stagingJob(expectedStageCount = 3) {
  const base = await publicationFixture(modules, authModules, [])
  const jobId = crypto.randomUUID()
  const previewId = crypto.randomUUID()
  const entryId = 'portable-background'
  const name = 'portable-background.json'
  const claimId = crypto.randomUUID()
  const command = beginImportJobInputSchema.parse({
    commandId: crypto.randomUUID(),
    previewId,
    selectedEntryIds: [entryId],
    resolutions: [],
    customContentChoices: []
  })
  const nowMs = Date.now()
  const now = new Date(nowMs).toISOString()
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
  return { ...base, jobId, entryId, name }
}

async function stagedAuthoredImport() {
  const base = await stagingJob()
  const { jobId, entryId, name } = base
  const subjectId = crypto.randomUUID()
  const label = 'Imported Acolyte'
  const payload = {
    ...JSON.parse(JSON.stringify(acolyte)),
    id: subjectId,
    label,
    status: 'DRAFT',
    systemId: srdSystemRecord.id,
    userId: base.first.userId
  }
  const outputJson = await base.t.mutation(stageAuthoredHeadRef, {
    jobId,
    sequence: 0,
    entryId,
    source: 'ARTIFICER_JSON',
    externalId: 'portable-acolyte',
    subjectKind: 'BACKGROUND',
    targetId: subjectId,
    systemId: srdSystemRecord.id,
    label,
    payloadJson: canonicalizeRuleDocument(payload)
  })
  const output = JSON.parse(outputJson) as {
    draft: { publicId: string }
  }
  const result: ImportResultItemDto = {
    entryId,
    name,
    label,
    outcome: 'CREATED',
    issues: [],
    destination: { kind: 'AUTHORED_DRAFT', subjectKind: 'BACKGROUND', subjectId },
    publicId: output.draft.publicId
  }
  await base.t.mutation(stageResultRef, {
    jobId,
    sequence: 0,
    entryId,
    resultJson: encodeImportResult(result)
  })
  return { ...base, jobId, subjectId, outputJson }
}

/** A staged Character import; a long description makes its payload chunked (above 960 KiB). */
async function stagedCharacterImport(description?: string) {
  const base = await stagingJob()
  const characterId = crypto.randomUUID()
  const opened = characterBuilderDraftDtoSchema.parse(
    await base.first.caller.mutation(createCharacterDraft, {
      id: characterId,
      systemId: srdSystemRecord.id
    })
  )
  await base.first.caller.mutation(discardCharacterDraft, {
    id: characterId,
    expectedDraftId: opened.id
  })
  const label = opened.payload.character.label || 'Untitled Character'
  const outputJson = await base.t.mutation(stageCharacterHeadRef, {
    jobId: base.jobId,
    sequence: 0,
    entryId: base.entryId,
    source: 'ARTIFICER_JSON',
    externalId: 'portable-character',
    targetId: characterId,
    systemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id,
    label,
    payloadJson: canonicalizeRuleDocument(
      description === undefined
        ? opened.payload
        : { ...opened.payload, character: { ...opened.payload.character, description } }
    )
  })
  const output = JSON.parse(outputJson) as {
    draft: { publicId: string }
    stagedPayloadId: string
  }
  const result: ImportResultItemDto = {
    entryId: base.entryId,
    name: base.name,
    label,
    outcome: 'CREATED',
    issues: [],
    destination: { kind: 'CHARACTER_BUILDER_DRAFT', subjectId: characterId },
    publicId: output.draft.publicId
  }
  await base.t.mutation(stageResultRef, {
    jobId: base.jobId,
    sequence: 0,
    entryId: base.entryId,
    resultJson: encodeImportResult(result)
  })
  return { ...base, characterId, stagedPayloadId: output.stagedPayloadId }
}
async function stagedCustomImport(activate: boolean, count = 1) {
  const base = await stagingJob(count + 2)
  const subjects: Array<{ subjectId: string; label: string; outputJson: string }> = []
  for (let customSequence = 0; customSequence < count; customSequence += 1) {
    const subjectId = crypto.randomUUID()
    const label = `Imported Acolyte ${customSequence + 1}`
    const payloadJson = canonicalizeRuleDocument({
      ...JSON.parse(JSON.stringify(acolyte)),
      id: subjectId,
      label,
      status: 'DRAFT',
      systemId: srdSystemRecord.id,
      userId: base.first.userId
    })
    const outputJson = await base.t.mutation(stageCustomAuthoredRef, {
      jobId: base.jobId,
      sequence: 0,
      customSequence,
      entryId: base.entryId,
      source: 'ARTIFICER_JSON',
      externalId: `custom-acolyte-${customSequence}`,
      subjectKind: 'BACKGROUND',
      targetId: subjectId,
      systemId: srdSystemRecord.id,
      label,
      payloadJson,
      activate
    })
    subjects.push({ subjectId, label, outputJson })
  }
  const first = JSON.parse(subjects[0]!.outputJson) as { publicId: string }
  const result: ImportResultItemDto = {
    entryId: base.entryId,
    name: base.name,
    label: subjects[0]!.label,
    outcome: 'CREATED',
    issues: [],
    destination: {
      kind: activate ? 'ACTIVE_AUTHORED_CONTENT' : 'AUTHORED_DRAFT',
      subjectKind: 'BACKGROUND',
      subjectId: subjects[0]!.subjectId
    },
    publicId: first.publicId
  }
  await base.t.mutation(stageResultRef, {
    jobId: base.jobId,
    sequence: 0,
    entryId: base.entryId,
    resultJson: encodeImportResult(result)
  })
  return { ...base, subjects }
}
describe('native import finalization', () => {
  it('publishes a complete staged draft and its usage atomically', async () => {
    const base = await stagedAuthoredImport()
    expect(
      await base.t.run((ctx) =>
        ctx.db
          .query('authoredDrafts')
          .withIndex('by_subjectId', (query) => query.eq('subjectId', base.subjectId))
          .unique()
      )
    ).toBeNull()

    await base.t.mutation(completeRef, { jobId: base.jobId })

    const stored = await base.t.run(async (ctx) => {
      const draft = await ctx.db
        .query('authoredDrafts')
        .withIndex('by_subjectId', (query) => query.eq('subjectId', base.subjectId))
        .unique()
      if (!draft) throw new Error('Missing finalized authored draft.')
      return {
        draft: await readDraft(ctx, draft),
        job: await ctx.db
          .query('importJobs')
          .withIndex('by_publicId', (query) => query.eq('id', base.jobId))
          .unique(),
        usage: await ctx.db
          .query('accountUsageEntries')
          .withIndex('by_resource_sourceId', (query) =>
            query.eq('resource', 'homebrewRoots').eq('sourceId', base.subjectId)
          )
          .unique(),
        profile: await ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (query) => query.eq('userId', base.first.userId))
          .unique()
      }
    })
    expect(stored.draft).toMatchObject({ subjectId: base.subjectId, label: 'Imported Acolyte' })
    expect(stored.job).toMatchObject({
      status: 'COMPLETED',
      processedEntries: 1,
      summary: { created: 1, updated: 0, skipped: 0, failed: 0 }
    })
    expect(stored.usage).toMatchObject({
      ownerUserId: base.first.userId,
      importJobId: base.jobId
    })
    expect(stored.profile?.entitlementUsage?.homebrewRoots).toBe(1)
    await expect(base.first.caller.query(progress, { jobId: base.jobId })).resolves.toMatchObject({
      status: 'COMPLETED'
    })

    await base.t.mutation(cleanup, { jobId: base.jobId })
    await base.t.mutation(cleanup, { jobId: base.jobId })
    await base.t.mutation(cleanup, { jobId: base.jobId })
    const cleaned = await base.t.run(async (ctx) => ({
      stages: await ctx.db
        .query('importJobStages')
        .withIndex('by_jobId_stageKey', (query) => query.eq('jobId', base.jobId))
        .collect(),
      results: await ctx.db
        .query('importJobResults')
        .withIndex('by_jobId_sequence', (query) => query.eq('jobId', base.jobId))
        .collect(),
      job: await ctx.db
        .query('importJobs')
        .withIndex('by_publicId', (query) => query.eq('id', base.jobId))
        .unique(),
      draft: await ctx.db
        .query('authoredDrafts')
        .withIndex('by_subjectId', (query) => query.eq('subjectId', base.subjectId))
        .unique()
    }))
    expect(cleaned.stages).toEqual([])
    expect(cleaned.results).toHaveLength(1)
    expect(cleaned.job).toMatchObject({ status: 'COMPLETED', cleanupTableIndex: 3 })
    expect(cleaned.draft).not.toBeNull()
  }, 30_000)

  it('refuses a staged Character with a missing payload chunk without publishing state', async () => {
    const base = await stagedCharacterImport('🎲'.repeat(300_000))
    await base.t.run(async (ctx) => {
      const chunks = await ctx.db
        .query('characterDraftPayloadChunks')
        .withIndex('by_characterId_payloadId_chunkIndex', (query) =>
          query.eq('characterId', base.characterId).eq('payloadId', base.stagedPayloadId)
        )
        .collect()
      if (!chunks.length) throw new Error('Missing staged Character payload chunks.')
      await ctx.db.delete(chunks[0]!._id)
    })
    const snapshot = () =>
      base.t.run(async (ctx) => ({
        drafts: await ctx.db.query('characterDrafts').collect(),
        payloads: await ctx.db.query('characterDraftPayloads').collect(),
        chunks: await ctx.db.query('characterDraftPayloadChunks').collect(),
        usage: await ctx.db.query('accountUsageEntries').collect(),
        profiles: await ctx.db.query('userProfiles').collect(),
        jobs: await ctx.db.query('importJobs').collect(),
        stages: await ctx.db.query('importJobStages').collect(),
        routes: await ctx.db.query('authoredRouteIds').collect(),
        references: await ctx.db.query('authoredImportRefs').collect()
      }))
    const corrupted = await snapshot()

    await expect(base.t.mutation(completeRef, { jobId: base.jobId })).rejects.toThrow(
      'chunk count mismatch'
    )
    expect(await snapshot()).toEqual(corrupted)
    expect(corrupted.drafts).toEqual([])
  }, 30_000)
  it('refuses a changed destination without publishing any staged state', async () => {
    const base = await stagedAuthoredImport()
    const rawOutput: unknown = JSON.parse(base.outputJson)
    if (!rawOutput || typeof rawOutput !== 'object' || !('draft' in rawOutput))
      throw new Error('Missing staged draft output.')
    const draft = authoredStoredDraftSchema.parse(rawOutput.draft)
    await base.t.run((ctx) =>
      ctx.db.insert('authoredDrafts', {
        ...draft,
        label: 'Concurrent draft'
      })
    )

    await expect(base.t.mutation(completeRef, { jobId: base.jobId })).rejects.toThrow(
      'Import destination changed before publication'
    )
    const retained = await base.t.run(async (ctx) => ({
      job: await ctx.db
        .query('importJobs')
        .withIndex('by_publicId', (query) => query.eq('id', base.jobId))
        .unique(),
      profile: await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (query) => query.eq('userId', base.first.userId))
        .unique()
    }))
    expect(retained.job).toMatchObject({ status: 'RUNNING', phase: 'STAGING' })
    expect(retained.profile?.entitlementUsage?.homebrewRoots).toBe(0)
  }, 15_000)

  it('finalizes a staged custom draft with its exact supporting rows', async () => {
    const base = await stagedCustomImport(false)
    const subject = base.subjects[0]!
    await base.t.mutation(completeRef, { jobId: base.jobId })

    const stored = await base.t.run(async (ctx) => {
      const draft = await ctx.db
        .query('authoredDrafts')
        .withIndex('by_subjectId', (query) => query.eq('subjectId', subject.subjectId))
        .unique()
      if (!draft) throw new Error('Missing finalized custom draft.')
      return {
        draft,
        document: await readDraft(ctx, draft),
        root: await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (query) => query.eq('id', subject.subjectId))
          .unique(),
        route: await ctx.db
          .query('authoredRouteIds')
          .withIndex('by_subjectId', (query) => query.eq('subjectId', subject.subjectId))
          .unique(),
        reference: await ctx.db
          .query('authoredImportRefs')
          .withIndex('by_importJobId_subjectId', (query) =>
            query.eq('importJobId', base.jobId).eq('subjectId', subject.subjectId)
          )
          .unique(),
        usage: await ctx.db
          .query('accountUsageEntries')
          .withIndex('by_resource_sourceId', (query) =>
            query.eq('resource', 'homebrewRoots').eq('sourceId', subject.subjectId)
          )
          .unique(),
        image: await ctx.db
          .query('authoredImageSlots')
          .withIndex('by_subjectId_scope', (query) =>
            query.eq('subjectId', subject.subjectId).eq('scope', 'DRAFT')
          )
          .unique()
      }
    })
    expect(stored.draft).toMatchObject({
      subjectId: subject.subjectId,
      userId: base.first.userId,
      importJobId: base.jobId
    })
    expect(stored.document).toMatchObject({
      subjectId: subject.subjectId,
      label: subject.label,
      status: 'DRAFT'
    })
    expect(stored.root).toBeNull()
    expect(stored.route).toMatchObject({ importJobId: base.jobId, subjectId: subject.subjectId })
    expect(stored.reference).toMatchObject({
      importJobId: base.jobId,
      userId: base.first.userId,
      subjectId: subject.subjectId
    })
    expect(stored.usage).toMatchObject({
      importJobId: base.jobId,
      ownerUserId: base.first.userId,
      sourceId: subject.subjectId
    })
    expect(stored.image).toMatchObject({
      importJobId: base.jobId,
      subjectId: subject.subjectId,
      scope: 'DRAFT'
    })
  }, 15_000)

  it('finalizes active custom rows with one shared source and synchronized catalogue usage', async () => {
    const base = await stagedCustomImport(true, 2)
    const outputs = base.subjects.map(
      (subject) =>
        JSON.parse(subject.outputJson) as {
          contentSource: { id: string }
          createContentSource: boolean
        }
    )
    expect(outputs.map((output) => output.contentSource.id)).toEqual([
      outputs[0]!.contentSource.id,
      outputs[0]!.contentSource.id
    ])
    expect(outputs.every((output) => output.createContentSource)).toBe(true)
    const routeSequence = await base.t.run((ctx) =>
      ctx.db
        .query('authoredRouteSequence')
        .withIndex('by_key', (query) => query.eq('key', 'authored'))
        .unique()
    )

    await base.t.mutation(completeRef, { jobId: base.jobId })

    const stored = await base.t.run(async (ctx) => {
      const roots = await Promise.all(
        base.subjects.map((subject) =>
          ctx.db
            .query('authoredRoots')
            .withIndex('by_publicId', (query) => query.eq('id', subject.subjectId))
            .unique()
        )
      )
      return {
        roots,
        source: await ctx.db
          .query('contentSources')
          .withIndex('by_publicId', (query) => query.eq('id', outputs[0]!.contentSource.id))
          .unique(),
        sourceCounts: await ctx.db
          .query('authoredCatalogueCounts')
          .withIndex('by_source_kind', (query) =>
            query
              .eq('contentSourceId', outputs[0]!.contentSource.id)
              .eq('subjectKind', 'BACKGROUND')
          )
          .unique(),
        ownerCounts: await ctx.db
          .query('authoredCatalogueOwnerCounts')
          .withIndex('by_subjectKind_ownerUserId', (query) =>
            query.eq('subjectKind', 'BACKGROUND').eq('ownerUserId', base.first.userId)
          )
          .unique(),
        profile: await ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (query) => query.eq('userId', base.first.userId))
          .unique(),
        routeSequence: await ctx.db
          .query('authoredRouteSequence')
          .withIndex('by_key', (query) => query.eq('key', 'authored'))
          .unique()
      }
    })
    expect(stored.roots).toHaveLength(2)
    expect(stored.roots).toEqual(
      expect.arrayContaining(
        base.subjects.map((subject) =>
          expect.objectContaining({
            id: subject.subjectId,
            ownerUserId: base.first.userId,
            importJobId: base.jobId,
            contentSourceId: outputs[0]!.contentSource.id,
            catalogue: expect.objectContaining({ countsVersion: 1 })
          })
        )
      )
    )
    expect(stored.source).toMatchObject({
      id: outputs[0]!.contentSource.id,
      ownerUserId: base.first.userId,
      code: 'default'
    })
    expect(stored.sourceCounts).toMatchObject({ count: 2 })
    expect(stored.ownerCounts).toMatchObject({ count: 2 })
    expect(stored.profile?.entitlementUsage?.homebrewRoots).toBe(2)
    expect(stored.routeSequence?.lastNumber).toBe(routeSequence?.lastNumber)
  }, 20_000)

  it('rolls back custom publication when catalogue membership integrity mismatches', async () => {
    const base = await stagedCustomImport(true)
    const output = JSON.parse(base.subjects[0]!.outputJson) as {
      contentSource: { id: string }
    }
    await base.t.run((ctx) =>
      ctx.db.insert('authoredCatalogueOwnerCounts', {
        subjectKind: 'BACKGROUND',
        ownerUserId: base.first.userId,
        count: 1,
        categories: []
      })
    )

    await expect(base.t.mutation(completeRef, { jobId: base.jobId })).rejects.toThrow(
      'Catalogue owner membership integrity mismatch'
    )
    const retained = await base.t.run(async (ctx) => ({
      root: await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (query) => query.eq('id', base.subjects[0]!.subjectId))
        .unique(),
      source: await ctx.db
        .query('contentSources')
        .withIndex('by_publicId', (query) => query.eq('id', output.contentSource.id))
        .unique(),
      profile: await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (query) => query.eq('userId', base.first.userId))
        .unique(),
      job: await ctx.db
        .query('importJobs')
        .withIndex('by_publicId', (query) => query.eq('id', base.jobId))
        .unique()
    }))
    expect(retained.root).toMatchObject({ importJobId: base.jobId })
    expect(retained.root?.catalogue).toBeUndefined()
    expect(retained.source).toBeNull()
    expect(retained.profile?.entitlementUsage?.homebrewRoots).toBe(0)
    expect(retained.job).toMatchObject({ status: 'RUNNING', phase: 'STAGING' })
  }, 15_000)
})
