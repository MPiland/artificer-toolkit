import {
  makeFunctionReference,
  paginationOptsValidator,
  paginationResultValidator
} from 'convex/server'
import { v } from 'convex/values'
import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  authoredSubjectKindDtoSchema,
  type AuthoredSubjectKindDto
} from '@artificer-toolkit/schema/api/content'
import { importSourceDtoSchema, type ImportSourceDto } from '@artificer-toolkit/schema/api/imports'
import type { ImportPreparationLookup } from '@artificer-toolkit/authoring/imports'
import type { QueryCtx } from '../_generated/server'
import { internalQuery } from '../lib/queries'
import { readCharacterDraftSummary } from '../characters/documents'
import { loadCharacterState, readCharacterRecord } from '../characters/stateDocuments'
import { canReadAuthoredRoot } from '../content/documents'
import { contentStream } from '../content/streams'
import { requireIdentity } from '../lib/identity'
import { parseImportJob, requireCurrentImportOwner } from './jobs'
import { isImportRowVisible } from './visibility'

const EXACT_REQUEST_LIMIT = 128
export const IMPORT_PREVIEW_LOOKUP_ARGUMENT_MAX_BYTES = 1024 * 1024
const MASTER_PAGE_LIMIT = 96
const MASTER_PAGE_MAX_BYTES = 1024 * 1024

const authoredSubjectKindValidator = zodToConvex(authoredSubjectKindDtoSchema)
const importSubjectKindValidator = v.union(authoredSubjectKindValidator, v.literal('CHARACTER'))
const importSourceValidator = zodToConvex(importSourceDtoSchema)

const exactLookupRequestValidator = v.union(
  v.object({
    kind: v.literal('IMPORT_REFERENCE'),
    source: importSourceValidator,
    subjectKind: importSubjectKindValidator,
    externalId: v.string()
  }),
  v.object({
    kind: v.literal('ACTIVE_AUTHORED'),
    subjectKind: authoredSubjectKindValidator,
    subjectId: v.string()
  }),
  v.object({
    kind: v.literal('AUTHORED_DRAFT'),
    subjectKind: authoredSubjectKindValidator,
    subjectId: v.string()
  }),
  v.object({ kind: v.literal('CHARACTER'), characterId: v.string() }),
  v.object({ kind: v.literal('CHARACTER_DRAFT'), characterId: v.string() })
)

const importReferenceValidator = v.object({
  source: importSourceValidator,
  subjectKind: importSubjectKindValidator,
  externalId: v.string(),
  subjectId: v.string()
})
const activeAuthoredValidator = v.object({
  subjectKind: authoredSubjectKindValidator,
  subjectId: v.string(),
  ownerUserId: v.union(v.string(), v.null()),
  label: v.string(),
  isMaster: v.boolean()
})
const authoredDraftValidator = v.object({
  subjectKind: authoredSubjectKindValidator,
  subjectId: v.string(),
  label: v.string()
})
const characterValidator = v.object({
  characterId: v.string(),
  userId: v.string(),
  label: v.string()
})
const characterDraftValidator = v.object({
  characterId: v.string(),
  label: v.string()
})
const masterCandidateValidator = v.object({
  subjectId: v.string(),
  label: v.string()
})

export type ImportPreviewExactLookupRequest =
  | {
      kind: 'IMPORT_REFERENCE'
      source: ImportSourceDto
      subjectKind: AuthoredSubjectKindDto | 'CHARACTER'
      externalId: string
    }
  | {
      kind: 'ACTIVE_AUTHORED'
      subjectKind: AuthoredSubjectKindDto
      subjectId: string
    }
  | {
      kind: 'AUTHORED_DRAFT'
      subjectKind: AuthoredSubjectKindDto
      subjectId: string
    }
  | { kind: 'CHARACTER'; characterId: string }
  | { kind: 'CHARACTER_DRAFT'; characterId: string }

interface ImportReferenceSnapshot {
  source: ImportSourceDto
  subjectKind: AuthoredSubjectKindDto | 'CHARACTER'
  externalId: string
  subjectId: string
}

interface ActiveAuthoredSnapshot {
  subjectKind: AuthoredSubjectKindDto
  subjectId: string
  ownerUserId: string | null
  label: string
  isMaster: boolean
}

interface AuthoredDraftSnapshot {
  subjectKind: AuthoredSubjectKindDto
  subjectId: string
  label: string
}

interface CharacterSnapshot {
  characterId: string
  userId: string
  label: string
}

interface CharacterDraftSnapshot {
  characterId: string
  label: string
}

export interface ImportPreviewExactLookupSnapshot {
  ownerUserId: string
  importReferences: ImportReferenceSnapshot[]
  activeAuthored: ActiveAuthoredSnapshot[]
  authoredDrafts: AuthoredDraftSnapshot[]
  characters: CharacterSnapshot[]
  characterDrafts: CharacterDraftSnapshot[]
}

export interface ImportPreviewMasterCandidates {
  subjectKind: AuthoredSubjectKindDto
  candidates: Array<{ subjectId: string; label: string }>
}

export interface ImportPreviewLookupSnapshot extends ImportPreviewExactLookupSnapshot {
  masterCandidates: ImportPreviewMasterCandidates[]
}

export interface ImportPreviewLookupRecorder extends ImportPreparationLookup {
  exactRequests(): ImportPreviewExactLookupRequest[]
  masterSubjectKinds(): AuthoredSubjectKindDto[]
}

function exactRequestKey(request: ImportPreviewExactLookupRequest) {
  return JSON.stringify(request)
}

function importReferenceKey(input: {
  source: ImportSourceDto
  subjectKind: AuthoredSubjectKindDto | 'CHARACTER'
  externalId: string
}) {
  return JSON.stringify([input.source, input.subjectKind, input.externalId])
}

function authoredKey(subjectKind: AuthoredSubjectKindDto, subjectId: string) {
  return JSON.stringify([subjectKind, subjectId])
}

function argumentBytes(requests: readonly ImportPreviewExactLookupRequest[]) {
  return new TextEncoder().encode(JSON.stringify({ requests })).byteLength
}

export function createImportPreviewLookupRecorder(
  ownerUserId: string
): ImportPreviewLookupRecorder {
  const requests = new Map<string, ImportPreviewExactLookupRequest>()
  const masterKinds = new Set<AuthoredSubjectKindDto>()
  const record = (request: ImportPreviewExactLookupRequest) => {
    requests.set(exactRequestKey(request), request)
  }
  const requireOwner = (userId: string) => {
    if (userId !== ownerUserId) throw new Error('Import preview lookup owner mismatch.')
  }
  return {
    async findImportReference(input) {
      requireOwner(input.userId)
      record({
        kind: 'IMPORT_REFERENCE',
        source: input.source,
        subjectKind: input.subjectKind,
        externalId: input.externalId
      })
      return null
    },
    async findActiveAuthored(input) {
      record({ kind: 'ACTIVE_AUTHORED', ...input })
      return null
    },
    async findAuthoredDraft(input) {
      requireOwner(input.userId)
      record({
        kind: 'AUTHORED_DRAFT',
        subjectKind: input.subjectKind,
        subjectId: input.subjectId
      })
      return null
    },
    async findActiveMasterLabelCandidates(input) {
      masterKinds.add(input.subjectKind)
      return []
    },
    async findCharacter(input) {
      record({ kind: 'CHARACTER', characterId: input.characterId })
      return null
    },
    async findCharacterDraft(input) {
      requireOwner(input.userId)
      record({ kind: 'CHARACTER_DRAFT', characterId: input.characterId })
      return null
    },
    exactRequests: () => [...requests.values()],
    masterSubjectKinds: () => [...masterKinds]
  }
}

export function chunkImportPreviewLookupRequests(
  requests: readonly ImportPreviewExactLookupRequest[]
): ImportPreviewExactLookupRequest[][] {
  const unique = [
    ...new Map(requests.map((request) => [exactRequestKey(request), request])).values()
  ]
  const chunks: ImportPreviewExactLookupRequest[][] = []
  let chunk: ImportPreviewExactLookupRequest[] = []
  for (const request of unique) {
    if (argumentBytes([request]) > IMPORT_PREVIEW_LOOKUP_ARGUMENT_MAX_BYTES)
      throw new Error('One import preview lookup request is too large.')
    const candidate = [...chunk, request]
    if (
      chunk.length > 0 &&
      (candidate.length > EXACT_REQUEST_LIMIT ||
        argumentBytes(candidate) > IMPORT_PREVIEW_LOOKUP_ARGUMENT_MAX_BYTES)
    ) {
      chunks.push(chunk)
      chunk = [request]
    } else {
      chunk = candidate
    }
  }
  if (chunk.length > 0) chunks.push(chunk)
  return chunks
}

function uniqueBy<T>(values: readonly T[], key: (value: T) => string): T[] {
  return [...new Map(values.map((value) => [key(value), value])).values()]
}

export function mergeImportPreviewLookupSnapshots(
  ownerUserId: string,
  parts: readonly ImportPreviewExactLookupSnapshot[],
  masterCandidates: readonly ImportPreviewMasterCandidates[] = []
): ImportPreviewLookupSnapshot {
  if (parts.some((part) => part.ownerUserId !== ownerUserId))
    throw new Error('Import preview lookup snapshot owner mismatch.')
  const mastersByKind = new Map<
    AuthoredSubjectKindDto,
    Map<string, { subjectId: string; label: string }>
  >()
  for (const group of masterCandidates) {
    const candidates = mastersByKind.get(group.subjectKind) ?? new Map()
    for (const candidate of group.candidates) candidates.set(candidate.subjectId, candidate)
    mastersByKind.set(group.subjectKind, candidates)
  }
  return {
    ownerUserId,
    importReferences: uniqueBy(
      parts.flatMap((part) => part.importReferences),
      importReferenceKey
    ),
    activeAuthored: uniqueBy(
      parts.flatMap((part) => part.activeAuthored),
      (value) => authoredKey(value.subjectKind, value.subjectId)
    ),
    authoredDrafts: uniqueBy(
      parts.flatMap((part) => part.authoredDrafts),
      (value) => authoredKey(value.subjectKind, value.subjectId)
    ),
    characters: uniqueBy(
      parts.flatMap((part) => part.characters),
      (value) => value.characterId
    ),
    characterDrafts: uniqueBy(
      parts.flatMap((part) => part.characterDrafts),
      (value) => value.characterId
    ),
    masterCandidates: [...mastersByKind].map(([subjectKind, candidates]) => ({
      subjectKind,
      candidates: [...candidates.values()]
    }))
  }
}

export function createImportPreviewMapLookup(
  snapshot: ImportPreviewLookupSnapshot
): ImportPreparationLookup {
  const importReferences = new Map(
    snapshot.importReferences.map((value) => [importReferenceKey(value), value])
  )
  const activeAuthored = new Map(
    snapshot.activeAuthored.map((value) => [authoredKey(value.subjectKind, value.subjectId), value])
  )
  const authoredDrafts = new Map(
    snapshot.authoredDrafts.map((value) => [authoredKey(value.subjectKind, value.subjectId), value])
  )
  const characters = new Map(snapshot.characters.map((value) => [value.characterId, value]))
  const characterDrafts = new Map(
    snapshot.characterDrafts.map((value) => [value.characterId, value])
  )
  const masters = new Map(
    snapshot.masterCandidates.map((value) => [value.subjectKind, value.candidates])
  )
  const ownerMatches = (userId: string) => userId === snapshot.ownerUserId
  return {
    async findImportReference(input) {
      if (!ownerMatches(input.userId)) return null
      const value = importReferences.get(importReferenceKey(input))
      return value ? { subjectId: value.subjectId } : null
    },
    async findActiveAuthored(input) {
      return activeAuthored.get(authoredKey(input.subjectKind, input.subjectId)) ?? null
    },
    async findAuthoredDraft(input) {
      if (!ownerMatches(input.userId)) return null
      return authoredDrafts.get(authoredKey(input.subjectKind, input.subjectId)) ?? null
    },
    async findActiveMasterLabelCandidates(input) {
      return masters.get(input.subjectKind) ?? []
    },
    async findCharacter(input) {
      return characters.get(input.characterId) ?? null
    },
    async findCharacterDraft(input) {
      if (!ownerMatches(input.userId)) return null
      return characterDrafts.get(input.characterId) ?? null
    }
  }
}

async function loadActiveAuthored(
  ctx: QueryCtx,
  userId: string,
  subjectKind: AuthoredSubjectKindDto,
  subjectId: string,
  currentImportJobId?: string
): Promise<ActiveAuthoredSnapshot | null> {
  const root = await ctx.db
    .query('authoredRoots')
    .withIndex('by_publicId', (query) => query.eq('id', subjectId))
    .unique()
  if (
    !root ||
    root.subjectKind !== subjectKind ||
    !(await canReadAuthoredRoot(ctx, root, userId, undefined, currentImportJobId))
  )
    return null
  return {
    subjectKind,
    subjectId,
    ownerUserId: root.ownerUserId ?? null,
    label: root.label,
    isMaster: root.ownerUserId === undefined
  }
}

async function loadAuthoredDraft(
  ctx: QueryCtx,
  userId: string,
  subjectKind: AuthoredSubjectKindDto,
  subjectId: string,
  currentImportJobId?: string
): Promise<AuthoredDraftSnapshot | null> {
  const draft = await ctx.db
    .query('authoredDrafts')
    .withIndex('by_subjectId', (query) => query.eq('subjectId', subjectId))
    .unique()
  if (
    !draft ||
    draft.userId !== userId ||
    draft.subjectKind !== subjectKind ||
    !(await isImportRowVisible(ctx, draft.importJobId, currentImportJobId))
  )
    return null
  return { subjectKind, subjectId, label: draft.label }
}

async function loadCharacter(
  ctx: QueryCtx,
  userId: string,
  characterId: string
): Promise<{
  character: CharacterSnapshot | null
  draft: CharacterDraftSnapshot | null
}> {
  const state = await loadCharacterState(ctx, characterId)
  const active = state.active?.userId === userId ? state.active : null
  const draft = state.draft?.userId === userId ? state.draft : null
  const character = active ? readCharacterRecord(active) : null
  const draftSummary = draft ? readCharacterDraftSummary(draft, active) : null
  return {
    character: character ? { characterId, userId: character.userId, label: character.label } : null,
    draft: draftSummary ? { characterId, label: draftSummary.label } : null
  }
}

const exactLookupSnapshotValidator = v.object({
  ownerUserId: v.string(),
  importReferences: v.array(importReferenceValidator),
  activeAuthored: v.array(activeAuthoredValidator),
  authoredDrafts: v.array(authoredDraftValidator),
  characters: v.array(characterValidator),
  characterDrafts: v.array(characterDraftValidator)
})

export interface ImportPreviewMasterPage {
  page: Array<{ subjectId: string; label: string }>
  isDone: boolean
  continueCursor: string
  splitCursor?: string | null
  pageStatus?: 'SplitRecommended' | 'SplitRequired' | null
}

type MasterPageInput = {
  subjectKind: AuthoredSubjectKindDto
  paginationOpts: { cursor: string | null; numItems: number }
}

async function requireRunningImportJobOwner(ctx: QueryCtx, jobId: string) {
  const row = await ctx.db
    .query('importJobs')
    .withIndex('by_publicId', (query) => query.eq('id', jobId))
    .unique()
  if (!row) throw new Error('Import job is unavailable.')
  const job = parseImportJob(row)
  if (job.status !== 'RUNNING' || job.expiresAt <= Date.now())
    throw new Error('Import job is unavailable.')
  await requireCurrentImportOwner(ctx, job.ownerUserId)
  return job.ownerUserId
}

async function loadExactForUser(
  ctx: QueryCtx,
  userId: string,
  requests: ImportPreviewExactLookupRequest[],
  currentImportJobId?: string
): Promise<ImportPreviewExactLookupSnapshot> {
  if (
    requests.length === 0 ||
    requests.length > EXACT_REQUEST_LIMIT ||
    argumentBytes(requests) > IMPORT_PREVIEW_LOOKUP_ARGUMENT_MAX_BYTES ||
    new Set(requests.map(exactRequestKey)).size !== requests.length
  )
    throw new Error('Import preview lookup request is invalid.')

  const importReferences = new Map<string, ImportReferenceSnapshot>()
  const activeAuthored = new Map<string, ActiveAuthoredSnapshot>()
  const authoredDrafts = new Map<string, AuthoredDraftSnapshot>()
  const characters = new Map<string, CharacterSnapshot>()
  const characterDrafts = new Map<string, CharacterDraftSnapshot>()
  const loadedAuthored = new Set<string>()
  const loadedDrafts = new Set<string>()
  const loadedCharacters = new Set<string>()

  const addActive = async (subjectKind: AuthoredSubjectKindDto, subjectId: string) => {
    const key = authoredKey(subjectKind, subjectId)
    if (loadedAuthored.has(key)) return
    loadedAuthored.add(key)
    const value = await loadActiveAuthored(ctx, userId, subjectKind, subjectId, currentImportJobId)
    if (value) activeAuthored.set(key, value)
  }
  const addDraft = async (subjectKind: AuthoredSubjectKindDto, subjectId: string) => {
    const key = authoredKey(subjectKind, subjectId)
    if (loadedDrafts.has(key)) return
    loadedDrafts.add(key)
    const value = await loadAuthoredDraft(ctx, userId, subjectKind, subjectId, currentImportJobId)
    if (value) authoredDrafts.set(key, value)
  }
  const addCharacter = async (characterId: string) => {
    if (loadedCharacters.has(characterId)) return
    loadedCharacters.add(characterId)
    const value = await loadCharacter(ctx, userId, characterId)
    if (value.character) characters.set(characterId, value.character)
    if (value.draft) characterDrafts.set(characterId, value.draft)
  }

  for (const request of requests) {
    if (request.kind === 'IMPORT_REFERENCE') {
      const reference = await ctx.db
        .query('authoredImportRefs')
        .withIndex('by_userId_source_subjectKind_externalId', (query) =>
          query
            .eq('userId', userId)
            .eq('source', request.source)
            .eq('subjectKind', request.subjectKind)
            .eq('externalId', request.externalId)
        )
        .unique()
      if (!reference || !(await isImportRowVisible(ctx, reference.importJobId, currentImportJobId)))
        continue
      const value = {
        source: request.source,
        subjectKind: request.subjectKind,
        externalId: request.externalId,
        subjectId: reference.subjectId
      }
      importReferences.set(importReferenceKey(value), value)
      if (request.subjectKind === 'CHARACTER') await addCharacter(reference.subjectId)
      else {
        await addActive(request.subjectKind, reference.subjectId)
        await addDraft(request.subjectKind, reference.subjectId)
      }
      continue
    }
    if (request.kind === 'ACTIVE_AUTHORED') {
      await addActive(request.subjectKind, request.subjectId)
      continue
    }
    if (request.kind === 'AUTHORED_DRAFT') {
      await addDraft(request.subjectKind, request.subjectId)
      continue
    }
    await addCharacter(request.characterId)
  }

  return {
    ownerUserId: userId,
    importReferences: [...importReferences.values()],
    activeAuthored: [...activeAuthored.values()],
    authoredDrafts: [...authoredDrafts.values()],
    characters: [...characters.values()],
    characterDrafts: [...characterDrafts.values()]
  }
}

export const loadExact = internalQuery({
  args: { requests: v.array(exactLookupRequestValidator) },
  returns: exactLookupSnapshotValidator,
  handler: async (ctx, args): Promise<ImportPreviewExactLookupSnapshot> => {
    const { userId } = await requireIdentity(ctx)
    return loadExactForUser(ctx, userId, args.requests)
  }
})

export const loadExactForJob = internalQuery({
  args: { jobId: v.string(), requests: v.array(exactLookupRequestValidator) },
  returns: exactLookupSnapshotValidator,
  handler: async (ctx, args): Promise<ImportPreviewExactLookupSnapshot> => {
    const userId = await requireRunningImportJobOwner(ctx, args.jobId)
    return loadExactForUser(ctx, userId, args.requests, args.jobId)
  }
})

async function loadMasterPageForUser(
  ctx: QueryCtx,
  userId: string,
  args: MasterPageInput,
  currentImportJobId?: string
): Promise<ImportPreviewMasterPage> {
  return contentStream(ctx.db)
    .query('authoredRoots')
    .withIndex('by_kind_owner_name_id', (query) =>
      query.eq('subjectKind', args.subjectKind).eq('ownerUserId', undefined)
    )
    .filterWith(async (root) =>
      canReadAuthoredRoot(ctx, root, userId, undefined, currentImportJobId)
    )
    .map(async (root) => ({ subjectId: root.id, label: root.label }))
    .paginate({
      ...args.paginationOpts,
      numItems: Math.min(args.paginationOpts.numItems, MASTER_PAGE_LIMIT),
      maximumRowsRead: MASTER_PAGE_LIMIT,
      maximumBytesRead: MASTER_PAGE_MAX_BYTES
    })
}

export const loadMasterPage = internalQuery({
  args: {
    subjectKind: authoredSubjectKindValidator,
    paginationOpts: paginationOptsValidator
  },
  returns: paginationResultValidator(masterCandidateValidator),
  handler: async (ctx, args): Promise<ImportPreviewMasterPage> => {
    const { userId } = await requireIdentity(ctx)
    return loadMasterPageForUser(ctx, userId, args)
  }
})

export const loadMasterPageForJob = internalQuery({
  args: {
    jobId: v.string(),
    subjectKind: authoredSubjectKindValidator,
    paginationOpts: paginationOptsValidator
  },
  returns: paginationResultValidator(masterCandidateValidator),
  handler: async (ctx, args): Promise<ImportPreviewMasterPage> => {
    const userId = await requireRunningImportJobOwner(ctx, args.jobId)
    return loadMasterPageForUser(ctx, userId, args, args.jobId)
  }
})

export const loadExactRef = makeFunctionReference<
  'query',
  { requests: ImportPreviewExactLookupRequest[] },
  ImportPreviewExactLookupSnapshot
>('imports/previewLookup:loadExact')

export const loadMasterPageRef = makeFunctionReference<
  'query',
  MasterPageInput,
  ImportPreviewMasterPage
>('imports/previewLookup:loadMasterPage')

export const loadExactForJobRef = makeFunctionReference<
  'query',
  { jobId: string; requests: ImportPreviewExactLookupRequest[] },
  ImportPreviewExactLookupSnapshot
>('imports/previewLookup:loadExactForJob')

export const loadMasterPageForJobRef = makeFunctionReference<
  'query',
  MasterPageInput & { jobId: string },
  ImportPreviewMasterPage
>('imports/previewLookup:loadMasterPageForJob')
