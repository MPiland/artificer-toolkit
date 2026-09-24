import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import {
  authoredDraftDtoSchema,
  authoredStoredDraftSchema
} from '@artificer-toolkit/schema/api/authoredDrafts'
import { characterBuilderDraftPayloadDtoSchema } from '@artificer-toolkit/schema/api/characterBuilder'
import { importSourceDtoSchema, type ImportSourceDto } from '@artificer-toolkit/schema/api/imports'
import { characterStoredDraftSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import {
  checksumCanonicalRuleDocument,
  checksumRuleDocument
} from '@artificer-toolkit/shared/rules'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { internalMutation } from '../lib/mutations'
import {
  insertCharacterDraftPayload,
  loadCharacterState,
  readCharacterRecord
} from '../characters/documents'
import { insertDraftPayload, readAuthoredVersion } from '../content/documents'
import { requireRulesCatalogueBinding } from '../content/catalogueBinding'
import { ensureDraftImageSlot } from '../content/imageSlots'
import { ensureAuthoredRouteId } from '../content/routeIds'
import { requireSystem } from '../content/systemDocuments'
import { isImportRowVisible } from './visibility'
import {
  importAuthoredHeadStageKey,
  importCharacterHeadStageKey,
  insertStagedStage,
  readStagedReplay,
  requireRunningImportJob
} from './stages'

interface StageDraftArgs {
  jobId: string
  sequence: number
  entryId: string
  source: ImportSourceDto
  externalId?: string
  targetId: string
  systemId: string
  label: string
  payloadJson: string
}

interface StoredImportReferenceInput {
  source: ImportSourceDto
  subjectKind: Doc<'authoredImportRefs'>['subjectKind']
  externalId: string
  subjectId: string
}

export function importRowIdentity(
  row:
    | Doc<'characters'>
    | Doc<'characterDrafts'>
    | Doc<'authoredRoots'>
    | Doc<'authoredDrafts'>
    | null
) {
  if (!row) return null
  return {
    _id: row._id,
    _creationTime: row._creationTime,
    ...('id' in row ? { id: row.id } : {}),
    ...('characterId' in row ? { characterId: row.characterId } : {}),
    ...('subjectId' in row ? { subjectId: row.subjectId } : {}),
    ...('userId' in row ? { userId: row.userId } : {}),
    ...('ownerUserId' in row ? { ownerUserId: row.ownerUserId } : {}),
    systemId: row.systemId,
    label: row.label,
    ...('status' in row ? { status: row.status } : {}),
    ...('subjectKind' in row ? { subjectKind: row.subjectKind } : {}),
    ...('updatedAt' in row ? { updatedAt: row.updatedAt } : {}),
    ...('checksum' in row ? { checksum: row.checksum } : {}),
    ...('payloadId' in row ? { payloadId: row.payloadId } : {}),
    ...('currentVersionId' in row ? { currentVersionId: row.currentVersionId } : {}),
    ...('contentSourceId' in row ? { contentSourceId: row.contentSourceId } : {}),
    ...('importJobId' in row ? { importJobId: row.importJobId } : {})
  }
}

async function ensureImportReference(
  ctx: MutationCtx,
  jobId: string,
  ownerUserId: string,
  input: StoredImportReferenceInput
) {
  const existing = await ctx.db
    .query('authoredImportRefs')
    .withIndex('by_userId_source_subjectKind_externalId', (query) =>
      query
        .eq('userId', ownerUserId)
        .eq('source', input.source)
        .eq('subjectKind', input.subjectKind)
        .eq('externalId', input.externalId)
    )
    .unique()
  if (existing) {
    if (
      existing.subjectId !== input.subjectId ||
      !(await isImportRowVisible(ctx, existing.importJobId, jobId))
    )
      throw new Error('Import reference identity conflict.')
    return existing
  }
  const now = new Date().toISOString()
  const id = await ctx.db.insert('authoredImportRefs', {
    userId: ownerUserId,
    importJobId: jobId,
    ...input,
    createdAt: now,
    updatedAt: now
  })
  const inserted = await ctx.db.get(id)
  if (!inserted) throw new Error('Staged import reference is missing.')
  return inserted
}

async function ensureUsage(
  ctx: MutationCtx,
  jobId: string,
  ownerUserId: string,
  resource: Doc<'accountUsageEntries'>['resource'],
  sourceId: string
) {
  const existing = await ctx.db
    .query('accountUsageEntries')
    .withIndex('by_resource_sourceId', (query) =>
      query.eq('resource', resource).eq('sourceId', sourceId)
    )
    .unique()
  if (existing) {
    if (
      existing.ownerUserId !== ownerUserId ||
      !(await isImportRowVisible(ctx, existing.importJobId, jobId))
    )
      throw new Error('Import usage identity conflict.')
    return { row: existing, inserted: false }
  }
  const id = await ctx.db.insert('accountUsageEntries', {
    resource,
    sourceId,
    ownerUserId,
    importJobId: jobId
  })
  const inserted = await ctx.db.get(id)
  if (!inserted) throw new Error('Staged import usage is missing.')
  return { row: inserted, inserted: true }
}

async function readOldCharacterPayloadHead(ctx: MutationCtx, draft: Doc<'characterDrafts'> | null) {
  if (!draft?.payloadId) return null
  return await ctx.db
    .query('characterDraftPayloads')
    .withIndex('by_characterId_id', (query) =>
      query.eq('characterId', draft.characterId).eq('id', draft.payloadId!)
    )
    .unique()
}

async function readOldAuthoredPayloadHead(ctx: MutationCtx, draft: Doc<'authoredDrafts'> | null) {
  if (!draft || !('payloadId' in draft)) return null
  return await ctx.db
    .query('authoredDraftPayloads')
    .withIndex('by_publicId', (query) => query.eq('id', draft.payloadId))
    .unique()
}

export const stageCharacterHead = internalMutation({
  args: {
    jobId: v.string(),
    sequence: v.number(),
    entryId: v.string(),
    source: v.string(),
    externalId: v.string(),
    targetId: v.string(),
    systemId: v.string(),
    primaryRulesCatalogueId: v.string(),
    label: v.string(),
    payloadJson: v.string()
  },
  returns: v.string(),
  handler: async (ctx, rawArgs): Promise<string> => {
    const args = {
      ...rawArgs,
      source: importSourceDtoSchema.parse(rawArgs.source)
    }
    const stageKey = importCharacterHeadStageKey(args.sequence)
    const rawPayload: unknown = JSON.parse(args.payloadJson)
    const payload = characterBuilderDraftPayloadDtoSchema.parse(rawPayload)
    const target = {
      source: args.source,
      externalId: args.externalId,
      targetId: args.targetId,
      systemId: args.systemId,
      primaryRulesCatalogueId: args.primaryRulesCatalogueId,
      label: args.label,
      payloadChecksum: checksumRuleDocument(rawPayload)
    }
    const replay = await readStagedReplay(ctx, {
      jobId: args.jobId,
      stageKey,
      entryId: args.entryId,
      sequence: args.sequence,
      kind: 'CHARACTER_HEAD',
      target
    })
    if (replay) return replay.outputJson

    const found = await requireRunningImportJob(ctx, args.jobId)
    if (
      payload.character.id !== args.targetId ||
      payload.character.userId !== found.job.ownerUserId ||
      payload.character.systemId !== args.systemId ||
      payload.character.status !== 'DRAFT' ||
      (payload.character.label || 'Untitled Character') !== args.label
    )
      throw new Error('Imported Character draft identity mismatch.')
    await requireRulesCatalogueBinding(ctx, {
      systemId: args.systemId,
      primaryRulesCatalogueId: args.primaryRulesCatalogueId
    })
    const { active, draft } = await loadCharacterState(ctx, args.targetId)
    if (
      (active && active.userId !== found.job.ownerUserId) ||
      (draft && draft.userId !== found.job.ownerUserId)
    )
      throw new Error('Imported Character cannot be edited by this owner.')
    if (active) {
      const current = readCharacterRecord(active)
      if (current.systemId !== args.systemId)
        throw new Error('Imported Character Game System does not match the active Character.')
    }
    const expectedState = {
      active: importRowIdentity(active),
      draft: importRowIdentity(draft)
    }
    const oldPayloadHead = await readOldCharacterPayloadHead(ctx, draft)
    if (draft?.payloadId && !oldPayloadHead)
      throw new Error('Stored Character draft payload is missing.')
    const publicId = await ensureAuthoredRouteId(
      ctx,
      'CHARACTER',
      args.targetId,
      false,
      found.job.ownerUserId,
      args.jobId
    )
    await ensureImportReference(ctx, args.jobId, found.job.ownerUserId, {
      source: args.source,
      subjectKind: 'CHARACTER',
      externalId: args.externalId,
      subjectId: args.targetId
    })
    const usage = await ensureUsage(
      ctx,
      args.jobId,
      found.job.ownerUserId,
      'personalCharacters',
      args.targetId
    )
    const now = new Date(
      Math.max(Date.now(), draft?.updatedAt ? Date.parse(draft.updatedAt) + 1 : 0)
    ).toISOString()
    const storedPayload = await insertCharacterDraftPayload(
      ctx,
      args.targetId,
      payload,
      now,
      args.jobId
    )
    const storedDraft = characterStoredDraftSchema.parse({
      id: draft?.id ?? crypto.randomUUID(),
      characterId: args.targetId,
      userId: found.job.ownerUserId,
      systemId: args.systemId,
      publicId,
      label: args.label,
      status: 'DRAFT',
      mode: active ? 'edit' : 'create',
      baseActiveUpdatedAt: draft ? draft.baseActiveUpdatedAt : (active?.updatedAt ?? null),
      createdAt: draft?.createdAt ?? now,
      updatedAt: now,
      payloadId: storedPayload.payloadId,
      checksum: storedPayload.checksum
    })
    const output = {
      draft: storedDraft,
      oldPayloadHead,
      stagedPayloadId: storedPayload.payloadId,
      incrementsUsage: usage.inserted
    }
    await insertStagedStage(ctx, {
      jobId: args.jobId,
      stageKey,
      entryId: args.entryId,
      sequence: args.sequence,
      kind: 'CHARACTER_HEAD',
      target,
      output,
      expectedState
    })
    return JSON.stringify(output)
  }
})

export const stageAuthoredHead = internalMutation({
  args: {
    jobId: v.string(),
    sequence: v.number(),
    entryId: v.string(),
    source: v.string(),
    externalId: v.optional(v.string()),
    subjectKind: v.string(),
    targetId: v.string(),
    systemId: v.string(),
    label: v.string(),
    payloadJson: v.string()
  },
  returns: v.string(),
  handler: async (ctx, rawArgs): Promise<string> => {
    const args: StageDraftArgs & { subjectKind: Doc<'authoredDrafts'>['subjectKind'] } = {
      ...rawArgs,
      source: importSourceDtoSchema.parse(rawArgs.source),
      subjectKind: rawArgs.subjectKind as Doc<'authoredDrafts'>['subjectKind']
    }
    const payload = jsonValueSchema.parse(JSON.parse(args.payloadJson))
    if (
      !payload ||
      typeof payload !== 'object' ||
      Array.isArray(payload) ||
      payload.id !== args.targetId ||
      payload.systemId !== args.systemId ||
      payload.label !== args.label ||
      payload.status !== 'DRAFT'
    )
      throw new Error('Imported authored draft identity mismatch.')
    const stageKey = importAuthoredHeadStageKey(args.sequence)
    const target = {
      source: args.source,
      ...(args.externalId ? { externalId: args.externalId } : {}),
      subjectKind: args.subjectKind,
      targetId: args.targetId,
      systemId: args.systemId,
      label: args.label,
      payloadChecksum: checksumCanonicalRuleDocument(args.payloadJson)
    }
    const replay = await readStagedReplay(ctx, {
      jobId: args.jobId,
      stageKey,
      entryId: args.entryId,
      sequence: args.sequence,
      kind: 'AUTHORED_HEAD',
      target
    })
    if (replay) return replay.outputJson

    const found = await requireRunningImportJob(ctx, args.jobId)
    if (payload.userId !== found.job.ownerUserId)
      throw new Error('Imported authored draft owner mismatch.')
    await requireSystem(ctx, args.systemId)
    const [root, draft] = await Promise.all([
      ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (query) => query.eq('id', args.targetId))
        .unique(),
      ctx.db
        .query('authoredDrafts')
        .withIndex('by_subjectId', (query) => query.eq('subjectId', args.targetId))
        .unique()
    ])
    if (
      (root &&
        (root.ownerUserId !== found.job.ownerUserId ||
          root.subjectKind !== args.subjectKind ||
          root.systemId !== args.systemId ||
          !(await isImportRowVisible(ctx, root.importJobId, args.jobId)))) ||
      (draft &&
        (draft.userId !== found.job.ownerUserId ||
          draft.subjectKind !== args.subjectKind ||
          draft.systemId !== args.systemId ||
          !(await isImportRowVisible(ctx, draft.importJobId, args.jobId))))
    )
      throw new Error('Imported authored content cannot be edited by this owner.')
    const version = root ? await readAuthoredVersion(ctx, root, args.jobId) : null
    const expectedState = {
      root: importRowIdentity(root),
      draft: importRowIdentity(draft),
      version: version
        ? {
            _id: version._id,
            _creationTime: version._creationTime,
            versionId: version.versionId,
            checksum: version.checksum
          }
        : null
    }
    const oldPayloadHead = await readOldAuthoredPayloadHead(ctx, draft)
    if (draft && 'payloadId' in draft && !oldPayloadHead)
      throw new Error('Stored authored draft payload is missing.')
    const publicId = await ensureAuthoredRouteId(
      ctx,
      args.subjectKind,
      args.targetId,
      false,
      undefined,
      args.jobId
    )
    if (args.externalId)
      await ensureImportReference(ctx, args.jobId, found.job.ownerUserId, {
        source: args.source,
        subjectKind: args.subjectKind,
        externalId: args.externalId,
        subjectId: args.targetId
      })
    const usage = await ensureUsage(
      ctx,
      args.jobId,
      found.job.ownerUserId,
      'homebrewRoots',
      args.targetId
    )
    await ensureDraftImageSlot(
      ctx,
      {
        subjectId: args.targetId,
        subjectKind: args.subjectKind
      },
      args.jobId
    )
    const now = new Date(
      Math.max(Date.now(), draft?.updatedAt ? Date.parse(draft.updatedAt) + 1 : 0)
    ).toISOString()
    const payloadId = await insertDraftPayload(
      ctx,
      args.targetId,
      args.systemId,
      args.payloadJson,
      args.jobId
    )
    const dto = authoredDraftDtoSchema.parse({
      subjectKind: args.subjectKind,
      subjectId: args.targetId,
      systemId: args.systemId,
      label: args.label,
      userId: found.job.ownerUserId,
      publicId,
      status: 'DRAFT',
      draftState: root ? 'ACTIVE_WITH_DRAFT' : 'DRAFT_ONLY',
      baseActiveUpdatedAt: draft
        ? draft.baseActiveUpdatedAt
        : version
          ? new Date(version._creationTime).toISOString()
          : null,
      createdAt: draft?.createdAt ?? now,
      updatedAt: now,
      payload
    })
    const { payload: _payload, ...metadata } = dto
    const storedDraft = authoredStoredDraftSchema.parse({
      ...metadata,
      payloadId,
      basePublishedChecksum: draft ? draft.basePublishedChecksum : (root?.checksum ?? null)
    })
    const output = {
      draft: storedDraft,
      oldPayloadHead,
      stagedPayloadId: payloadId,
      incrementsUsage: usage.inserted
    }
    await insertStagedStage(ctx, {
      jobId: args.jobId,
      stageKey,
      entryId: args.entryId,
      sequence: args.sequence,
      kind: 'AUTHORED_HEAD',
      target,
      output,
      expectedState
    })
    return JSON.stringify(output)
  }
})

export const stageCharacterHeadRef = makeFunctionReference<
  'mutation',
  {
    jobId: string
    sequence: number
    entryId: string
    source: string
    externalId: string
    targetId: string
    systemId: string
    primaryRulesCatalogueId: string
    label: string
    payloadJson: string
  },
  string
>('imports/stageDrafts:stageCharacterHead')

export const stageAuthoredHeadRef = makeFunctionReference<
  'mutation',
  {
    jobId: string
    sequence: number
    entryId: string
    source: string
    externalId?: string
    subjectKind: string
    targetId: string
    systemId: string
    label: string
    payloadJson: string
  },
  string
>('imports/stageDrafts:stageAuthoredHead')
