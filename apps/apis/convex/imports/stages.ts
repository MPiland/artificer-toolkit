import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { z } from 'zod'
import {
  importResultItemDtoSchema,
  type ImportResultItemDto
} from '@artificer-toolkit/schema/api/imports'
import {
  IMPORT_MAX_STAGE_ROWS,
  importStoredPreviewSessionSchema,
  importStoredStageSchema
} from '@artificer-toolkit/schema/projections/importJobPersistence'
import { uuidSchema } from '@artificer-toolkit/schema/api/campaignContractSchemas'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { internalQuery } from '../lib/queries'
import { internalMutation } from '../lib/mutations'
import { parseImportJob, requireCurrentImportOwner } from './jobs'

const planOutputSchema = z.strictObject({
  generatedIds: z.array(uuidSchema).max(IMPORT_MAX_STAGE_ROWS),
  expectedStageCount: z.number().int().positive().max(IMPORT_MAX_STAGE_ROWS)
})

export type ImportRunnerPlan = z.infer<typeof planOutputSchema>

const planOutputValidator = v.object({
  generatedIds: v.array(v.string()),
  expectedStageCount: v.number()
})

function sequenceKey(sequence: number) {
  if (!Number.isSafeInteger(sequence) || sequence < 0)
    throw new Error('Import stage sequence is invalid.')
  return sequence.toString().padStart(6, '0')
}

export const importPlanStageKey = 'P/000000'
export const importCharacterHeadStageKey = (sequence: number) => 'H/' + sequenceKey(sequence)
export const importAuthoredHeadStageKey = (sequence: number) => 'A/' + sequenceKey(sequence)
export const importCustomStageKey = (sequence: number, customSequence: number) =>
  'C/' + sequenceKey(sequence) + '/' + sequenceKey(customSequence)
export const importResultStageKey = (sequence: number) => 'R/' + sequenceKey(sequence)

function storedStage(row: Doc<'importJobStages'>) {
  const { _id, _creationTime, ...stored } = row
  return importStoredStageSchema.parse(stored)
}

export async function requireRunningImportJob(ctx: QueryCtx | MutationCtx, jobId: string) {
  const row = await ctx.db
    .query('importJobs')
    .withIndex('by_publicId', (query) => query.eq('id', jobId))
    .unique()
  if (!row) throw new Error('Import job is unavailable.')
  const job = parseImportJob(row)
  if (job.status !== 'RUNNING' || job.expiresAt <= Date.now())
    throw new Error('Import job is unavailable.')
  await requireCurrentImportOwner(ctx, job.ownerUserId)
  return { row, job }
}

function canonical(value: unknown) {
  return JSON.stringify(value)
}

function requireMatchingStage(
  row: Doc<'importJobStages'>,
  expected: {
    jobId: string
    stageKey: string
    entryId: string
    sequence: number
    kind: Doc<'importJobStages'>['kind']
    targetJson: string
    outputJson: string
    expectedStateJson: string
  }
) {
  const stage = storedStage(row)
  if (
    stage.jobId !== expected.jobId ||
    stage.stageKey !== expected.stageKey ||
    stage.entryId !== expected.entryId ||
    stage.sequence !== expected.sequence ||
    stage.kind !== expected.kind ||
    stage.status !== 'STAGED' ||
    stage.targetJson !== expected.targetJson ||
    stage.outputJson !== expected.outputJson ||
    stage.expectedStateJson !== expected.expectedStateJson ||
    stage.expectedStateChecksum !== checksumCanonicalJson(JSON.parse(expected.expectedStateJson))
  )
    throw new Error('Stored import stage does not match this replay.')
  return stage
}

export async function readStagedReplay(
  ctx: QueryCtx | MutationCtx,
  args: {
    jobId: string
    stageKey: string
    entryId: string
    sequence: number
    kind: Doc<'importJobStages'>['kind']
    target: unknown
  }
) {
  const row = await ctx.db
    .query('importJobStages')
    .withIndex('by_jobId_stageKey', (query) =>
      query.eq('jobId', args.jobId).eq('stageKey', args.stageKey)
    )
    .unique()
  if (!row) return null
  const stage = storedStage(row)
  if (
    stage.jobId !== args.jobId ||
    stage.stageKey !== args.stageKey ||
    stage.entryId !== args.entryId ||
    stage.sequence !== args.sequence ||
    stage.kind !== args.kind ||
    stage.status !== 'STAGED' ||
    stage.targetJson !== canonical(args.target) ||
    stage.expectedStateChecksum !== checksumCanonicalJson(JSON.parse(stage.expectedStateJson))
  )
    throw new Error('Stored import stage does not match this replay.')
  return stage
}
export async function insertStagedStage(
  ctx: MutationCtx,
  args: {
    jobId: string
    stageKey: string
    entryId: string
    sequence: number
    kind: Doc<'importJobStages'>['kind']
    target: unknown
    output: unknown
    expectedState: unknown
  }
) {
  const targetJson = canonical(args.target)
  const outputJson = canonical(args.output)
  const expectedStateJson = canonical(args.expectedState)
  const existing = await ctx.db
    .query('importJobStages')
    .withIndex('by_jobId_stageKey', (query) =>
      query.eq('jobId', args.jobId).eq('stageKey', args.stageKey)
    )
    .unique()
  if (existing)
    return requireMatchingStage(existing, {
      ...args,
      targetJson,
      outputJson,
      expectedStateJson
    })

  const found = await requireRunningImportJob(ctx, args.jobId)
  if (found.job.phase !== 'STAGING') throw new Error('Import job is not accepting staged output.')
  if (found.job.stagedStageCount >= found.job.expectedStageCount)
    throw new Error('Import staged output exceeds its plan.')
  const now = new Date().toISOString()
  const stage = importStoredStageSchema.parse({
    jobId: args.jobId,
    stageKey: args.stageKey,
    entryId: args.entryId,
    sequence: args.sequence,
    kind: args.kind,
    status: 'STAGED',
    targetJson,
    outputJson,
    expectedStateJson,
    expectedStateChecksum: checksumCanonicalJson(args.expectedState),
    createdAt: now,
    updatedAt: now
  })
  await ctx.db.insert('importJobStages', stage)
  await ctx.db.patch(found.row._id, {
    stagedStageCount: found.job.stagedStageCount + 1,
    updatedAt: now
  })
  return stage
}

export const beginPlan = internalMutation({
  args: {
    jobId: v.string(),
    entryId: v.string(),
    generatedIds: v.array(v.string()),
    expectedStageCount: v.number()
  },
  returns: planOutputValidator,
  handler: async (ctx, args): Promise<ImportRunnerPlan> => {
    const plan = planOutputSchema.parse({
      generatedIds: args.generatedIds,
      expectedStageCount: args.expectedStageCount
    })
    if (new Set(plan.generatedIds).size !== plan.generatedIds.length)
      throw new Error('Import plan contains duplicate generated ids.')
    const targetJson = canonical(plan)
    const found = await requireRunningImportJob(ctx, args.jobId)
    const expectedState = {
      inputFingerprint: found.job.inputFingerprint,
      totalEntries: found.job.totalEntries
    }
    const expectedStateJson = canonical(expectedState)
    const existing = await ctx.db
      .query('importJobStages')
      .withIndex('by_jobId_stageKey', (query) =>
        query.eq('jobId', args.jobId).eq('stageKey', importPlanStageKey)
      )
      .unique()
    if (existing) {
      requireMatchingStage(existing, {
        jobId: args.jobId,
        stageKey: importPlanStageKey,
        entryId: args.entryId,
        sequence: 0,
        kind: 'PLAN',
        targetJson,
        outputJson: targetJson,
        expectedStateJson
      })
      if (
        found.job.phase !== 'STAGING' ||
        found.job.expectedStageCount !== plan.expectedStageCount ||
        found.job.stagedStageCount < 1
      )
        throw new Error('Stored import plan state is invalid.')
      return plan
    }
    if (found.job.phase !== 'PLANNING' || found.job.expectedStageCount !== 0)
      throw new Error('Import job plan is unavailable.')
    const now = new Date().toISOString()
    await ctx.db.insert(
      'importJobStages',
      importStoredStageSchema.parse({
        jobId: args.jobId,
        stageKey: importPlanStageKey,
        entryId: args.entryId,
        sequence: 0,
        kind: 'PLAN',
        status: 'STAGED',
        targetJson,
        outputJson: targetJson,
        expectedStateJson,
        expectedStateChecksum: checksumCanonicalJson(expectedState),
        createdAt: now,
        updatedAt: now
      })
    )
    await ctx.db.patch(found.row._id, {
      phase: 'STAGING',
      expectedStageCount: plan.expectedStageCount,
      stagedStageCount: 1,
      updatedAt: now
    })
    return plan
  }
})

export const readPlan = internalQuery({
  args: { jobId: v.string() },
  returns: v.union(v.null(), planOutputValidator),
  handler: async (ctx, args): Promise<ImportRunnerPlan | null> => {
    await requireRunningImportJob(ctx, args.jobId)
    const row = await ctx.db
      .query('importJobStages')
      .withIndex('by_jobId_stageKey', (query) =>
        query.eq('jobId', args.jobId).eq('stageKey', importPlanStageKey)
      )
      .unique()
    if (!row) return null
    const stage = storedStage(row)
    if (stage.kind !== 'PLAN' || stage.status !== 'STAGED')
      throw new Error('Stored import plan is invalid.')
    const plan = planOutputSchema.parse(JSON.parse(stage.outputJson))
    requireMatchingStage(row, {
      jobId: args.jobId,
      stageKey: importPlanStageKey,
      entryId: stage.entryId,
      sequence: 0,
      kind: 'PLAN',
      targetJson: stage.targetJson,
      outputJson: stage.outputJson,
      expectedStateJson: stage.expectedStateJson
    })
    return plan
  }
})

export const stageResult = internalMutation({
  args: {
    jobId: v.string(),
    sequence: v.number(),
    entryId: v.string(),
    resultJson: v.string()
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const found = await requireRunningImportJob(ctx, args.jobId)
    if (found.job.phase !== 'STAGING') throw new Error('Import job is not accepting result output.')
    const result = importResultItemDtoSchema.parse(JSON.parse(args.resultJson))
    if (
      args.sequence < 0 ||
      args.sequence >= found.job.totalEntries ||
      result.entryId !== args.entryId
    )
      throw new Error('Import result identity is invalid.')
    const previewRow = await ctx.db
      .query('importPreviewSessions')
      .withIndex('by_publicId', (query) => query.eq('id', found.job.previewId))
      .unique()
    if (!previewRow) throw new Error('Import job source is unavailable.')
    const { _id, _creationTime, ...storedPreview } = previewRow
    const preview = importStoredPreviewSessionSchema.parse(storedPreview)
    const descriptorEntry = preview.descriptor?.entries[args.sequence]
    if (
      preview.jobId !== found.job.id ||
      descriptorEntry?.entryId !== args.entryId ||
      result.name !== preview.entries[args.sequence]?.name
    )
      throw new Error('Import result does not match its source entry.')

    const resultJson = canonical(result)
    const stageKey = importResultStageKey(args.sequence)
    const existingResult = await ctx.db
      .query('importJobResults')
      .withIndex('by_jobId_sequence', (query) =>
        query.eq('jobId', args.jobId).eq('sequence', args.sequence)
      )
      .unique()
    const existingStage = await ctx.db
      .query('importJobStages')
      .withIndex('by_jobId_stageKey', (query) =>
        query.eq('jobId', args.jobId).eq('stageKey', stageKey)
      )
      .unique()
    if (existingResult || existingStage) {
      if (
        !existingResult ||
        existingResult.entryId !== args.entryId ||
        existingResult.resultJson !== resultJson ||
        !existingStage
      )
        throw new Error('Stored import result does not match this replay.')
      requireMatchingStage(existingStage, {
        jobId: args.jobId,
        stageKey,
        entryId: args.entryId,
        sequence: args.sequence,
        kind: 'RESULT',
        targetJson: resultJson,
        outputJson: resultJson,
        expectedStateJson: canonical({ entryId: args.entryId, sequence: args.sequence })
      })
      return null
    }

    await ctx.db.insert('importJobResults', {
      jobId: args.jobId,
      entryId: args.entryId,
      sequence: args.sequence,
      resultJson
    })
    await insertStagedStage(ctx, {
      jobId: args.jobId,
      stageKey,
      entryId: args.entryId,
      sequence: args.sequence,
      kind: 'RESULT',
      target: result,
      output: result,
      expectedState: { entryId: args.entryId, sequence: args.sequence }
    })
    await ctx.db.patch(found.row._id, {
      processedEntries: found.job.processedEntries + 1,
      updatedAt: new Date().toISOString()
    })
    return null
  }
})

export const readPlanRef = makeFunctionReference<
  'query',
  { jobId: string },
  ImportRunnerPlan | null
>('imports/stages:readPlan')

export const beginPlanRef = makeFunctionReference<
  'mutation',
  { jobId: string; entryId: string; generatedIds: string[]; expectedStageCount: number },
  ImportRunnerPlan
>('imports/stages:beginPlan')

export const stageResultRef = makeFunctionReference<
  'mutation',
  { jobId: string; sequence: number; entryId: string; resultJson: string },
  null
>('imports/stages:stageResult')

export function encodeImportResult(result: ImportResultItemDto) {
  return canonical(importResultItemDtoSchema.parse(result))
}
