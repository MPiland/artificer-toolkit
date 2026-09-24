import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  fetchFrozenDndBeyondPayload,
  normalizeReferenceLabel,
  prepareImportBatch,
  referenceLabelVariants,
  toImportPreviewResponse,
  type ImportPreparationDependencies,
  type PreparedBatch
} from '@artificer-toolkit/authoring/imports'
import { authIdentityDtoSchema, type AuthIdentityDto } from '@artificer-toolkit/schema/api/auth'
import {
  importClaimRefDtoSchema,
  importPreviewInputSchema,
  importPreviewResultSchema,
  importPreviewSessionRefDtoSchema,
  type ImportClaimRefDto,
  type ImportPreviewInput,
  type ImportPreviewResult,
  type ImportPreviewSessionRefDto
} from '@artificer-toolkit/schema/api/importJobs'
import {
  IMPORT_MAX_BATCH_BYTES,
  IMPORT_MAX_ENTRIES,
  IMPORT_MAX_ENTRY_BYTES,
  importBatchInputDtoSchema,
  type ImportBatchInputDto
} from '@artificer-toolkit/schema/api/imports'
import {
  importStoredPreviewDescriptorSchema,
  type ImportStoredPreviewDescriptor
} from '@artificer-toolkit/schema/projections/importJobPersistence'
import type { ActionCtx } from '../_generated/server'
import { action, internalQuery } from '../_generated/server'
import type { Id } from '../_generated/dataModel'
import { requireIdentity } from '../lib/identity'
import {
  chunkImportPreviewLookupRequests,
  createImportPreviewLookupRecorder,
  createImportPreviewMapLookup,
  loadExactForJobRef,
  loadExactRef,
  loadMasterPageForJobRef,
  loadMasterPageRef,
  mergeImportPreviewLookupSnapshots,
  type ImportPreviewExactLookupRequest,
  type ImportPreviewExactLookupSnapshot,
  type ImportPreviewMasterCandidates,
  type ImportPreviewMasterPage
} from './previewLookup'
import type { ImportRunnerSource, ImportRunnerSourceClaim } from './runnerState'

const identityRef = makeFunctionReference<'query', Record<string, never>, AuthIdentityDto>(
  'account:identity'
)
const loadClaimsRef = makeFunctionReference<
  'query',
  { claims: ImportClaimRefDto[] },
  StoredClaim[]
>('imports/preview:loadClaims')
const registerFetchedRef = makeFunctionReference<
  'mutation',
  { entryId: string; name: string; storageId: Id<'_storage'> },
  ImportClaimRefDto
>('imports/uploads:registerFetched')
const createPreviewRef = makeFunctionReference<
  'mutation',
  { descriptor: ImportStoredPreviewDescriptor },
  ImportPreviewSessionRefDto
>('imports/uploads:createPreview')

const storedClaimValidator = v.object({
  claimId: v.string(),
  entryId: v.string(),
  name: v.string(),
  actualBytes: v.number(),
  storageId: v.id('_storage')
})

interface StoredClaim {
  claimId: string
  entryId: string
  name: string
  actualBytes: number
  storageId: Id<'_storage'>
}

type UploadedPreviewInput = Extract<
  ImportPreviewInput,
  { source: 'FOUNDRY_DND5E' | 'ARTIFICER_JSON' }
>
type DndPreviewInput = Extract<ImportPreviewInput, { source: 'DND_BEYOND' }>
type FrozenDndPayload = Awaited<ReturnType<typeof fetchFrozenDndBeyondPayload>>
type FrozenDndLoader = NonNullable<ImportPreparationDependencies['loadFrozenDndBeyondPayload']>
type ImportResolutionByEntryId = Parameters<typeof prepareImportBatch>[3]
type ImportCustomContentChoiceByKey = Parameters<typeof prepareImportBatch>[4]
type ImportStorageReader = Pick<ActionCtx['storage'], 'get'>

export const loadClaims = internalQuery({
  args: { claims: v.array(zodToConvex(importClaimRefDtoSchema)) },
  returns: v.array(storedClaimValidator),
  handler: async (ctx, args): Promise<StoredClaim[]> => {
    const { userId } = await requireIdentity(ctx)
    if (args.claims.length === 0 || args.claims.length > IMPORT_MAX_ENTRIES)
      throw new Error('Import upload claims are invalid.')
    if (
      new Set(args.claims.map((claim) => claim.claimId)).size !== args.claims.length ||
      new Set(args.claims.map((claim) => claim.entryId)).size !== args.claims.length
    )
      throw new Error('Import upload claims are invalid.')

    let totalBytes = 0
    const claims: StoredClaim[] = []
    for (const expected of args.claims) {
      const claim = await ctx.db
        .query('importUploadClaims')
        .withIndex('by_claimId', (query) => query.eq('claimId', expected.claimId))
        .unique()
      if (
        !claim ||
        claim.ownerUserId !== userId ||
        claim.status !== 'READY' ||
        claim.previewId ||
        claim.jobId ||
        claim.expiresAt <= Date.now() ||
        claim.entryId !== expected.entryId ||
        claim.name !== expected.name ||
        !claim.storageId ||
        !claim.actualBytes ||
        !Number.isSafeInteger(claim.actualBytes) ||
        claim.actualBytes > IMPORT_MAX_ENTRY_BYTES
      )
        throw new Error('Import upload claim is unavailable.')
      totalBytes += claim.actualBytes
      if (totalBytes > IMPORT_MAX_BATCH_BYTES) throw new Error('Import batch is too large.')
      claims.push({
        claimId: claim.claimId,
        entryId: claim.entryId,
        name: claim.name,
        actualBytes: claim.actualBytes,
        storageId: claim.storageId
      })
    }
    return claims
  }
})

export async function readStoredText(
  storage: ImportStorageReader,
  claim: Pick<ImportRunnerSourceClaim, 'actualBytes' | 'storageId'>
): Promise<string> {
  if (
    !Number.isSafeInteger(claim.actualBytes) ||
    claim.actualBytes <= 0 ||
    claim.actualBytes > IMPORT_MAX_ENTRY_BYTES
  )
    throw new Error('Import upload claim is unavailable.')
  const blob = await storage.get(claim.storageId)
  if (!blob || blob.size !== claim.actualBytes)
    throw new Error('Import upload claim is unavailable.')
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(await blob.arrayBuffer())
  } catch {
    throw new Error('Import files must use UTF-8 text.')
  }
}

async function materializeUploadedBatch(
  ctx: ActionCtx,
  input: UploadedPreviewInput
): Promise<ImportBatchInputDto> {
  const claims = await ctx.runQuery(loadClaimsRef, { claims: input.entries })
  const entries = await Promise.all(
    claims.map(async (claim) => ({
      entryId: claim.entryId,
      name: claim.name,
      text: await readStoredText(ctx.storage, claim)
    }))
  )
  return importBatchInputDtoSchema.parse(
    input.source === 'FOUNDRY_DND5E'
      ? {
          source: input.source,
          systemId: input.systemId,
          primaryRulesCatalogueId: input.primaryRulesCatalogueId,
          entries
        }
      : { source: input.source, entries }
  )
}

export async function materializeRunnerSource(
  storage: ImportStorageReader,
  source: ImportRunnerSource
): Promise<{ batch: ImportBatchInputDto; dependencies: ImportPreparationDependencies }> {
  const { descriptor, claims } = source
  if (descriptor.entries.length !== claims.length)
    throw new Error('Import job source is unavailable.')

  let totalBytes = 0
  for (const [index, entry] of descriptor.entries.entries()) {
    const claim = claims[index]
    if (
      !claim ||
      claim.claimId !== entry.claimId ||
      claim.entryId !== entry.entryId ||
      ('name' in entry && claim.name !== entry.name) ||
      !Number.isSafeInteger(claim.actualBytes) ||
      claim.actualBytes <= 0 ||
      claim.actualBytes > IMPORT_MAX_ENTRY_BYTES
    )
      throw new Error('Import job source is unavailable.')
    totalBytes += claim.actualBytes
    if (totalBytes > IMPORT_MAX_BATCH_BYTES) throw new Error('Import job source is unavailable.')
  }

  const texts = await Promise.all(claims.map((claim) => readStoredText(storage, claim)))
  if (descriptor.source === 'DND_BEYOND') {
    const frozenByEntryId = new Map<string, { payload: unknown; utf8ByteLength: number }>()
    for (const [index, entry] of descriptor.entries.entries()) {
      try {
        const payload: unknown = JSON.parse(texts[index]!)
        frozenByEntryId.set(entry.entryId, {
          payload,
          utf8ByteLength: claims[index]!.actualBytes
        })
      } catch {
        throw new Error('Import job source is unavailable.')
      }
    }
    const loadFrozenDndBeyondPayload: FrozenDndLoader = async (entryId) => {
      const frozen = frozenByEntryId.get(entryId)
      if (!frozen) throw new Error('Import job source is unavailable.')
      return frozen
    }
    return {
      batch: importBatchInputDtoSchema.parse({
        source: descriptor.source,
        systemId: descriptor.systemId,
        primaryRulesCatalogueId: descriptor.primaryRulesCatalogueId,
        entries: descriptor.entries.map(({ entryId, url }) => ({ entryId, url }))
      }),
      dependencies: { loadFrozenDndBeyondPayload }
    }
  }

  const entries = descriptor.entries.map(({ entryId, name }, index) => ({
    entryId,
    name,
    text: texts[index]!
  }))
  return {
    batch: importBatchInputDtoSchema.parse(
      descriptor.source === 'FOUNDRY_DND5E'
        ? {
            source: descriptor.source,
            systemId: descriptor.systemId,
            primaryRulesCatalogueId: descriptor.primaryRulesCatalogueId,
            entries
          }
        : { source: descriptor.source, entries }
    ),
    dependencies: {}
  }
}

function neededMasterLabelVariants(
  prepared: PreparedBatch,
  subjectKind: ImportPreviewMasterCandidates['subjectKind']
) {
  const variants = new Set<string>()
  for (const item of prepared.items) {
    if (item.kind !== 'CHARACTER') continue
    for (const reference of item.references) {
      if (reference.subjectKind !== subjectKind) continue
      for (const variant of referenceLabelVariants(reference.label, subjectKind))
        variants.add(variant)
    }
  }
  return variants
}

export interface NativeImportLookupLoaders {
  loadExact(requests: ImportPreviewExactLookupRequest[]): Promise<ImportPreviewExactLookupSnapshot>
  loadMasterPage(
    subjectKind: ImportPreviewMasterCandidates['subjectKind'],
    cursor: string | null
  ): Promise<ImportPreviewMasterPage>
}

async function loadMasterCandidates(
  loaders: NativeImportLookupLoaders,
  prepared: PreparedBatch,
  subjectKind: ImportPreviewMasterCandidates['subjectKind']
): Promise<ImportPreviewMasterCandidates> {
  const needed = neededMasterLabelVariants(prepared, subjectKind)
  if (needed.size === 0) return { subjectKind, candidates: [] }
  const matches = new Map<string, Array<{ subjectId: string; label: string }>>()
  let cursor: string | null = null
  while (true) {
    const page = await loaders.loadMasterPage(subjectKind, cursor)
    for (const candidate of page.page) {
      const key = normalizeReferenceLabel(candidate.label)
      if (!needed.has(key)) continue
      const retained = matches.get(key) ?? []
      if (retained.length < 2) {
        retained.push(candidate)
        matches.set(key, retained)
      }
    }
    if (page.isDone) break
    if (!page.continueCursor || page.continueCursor === cursor)
      throw new Error('Import master-content pagination did not advance.')
    cursor = page.continueCursor
  }
  return { subjectKind, candidates: [...matches.values()].flat() }
}

export async function prepareWithNativeLookup(
  loaders: NativeImportLookupLoaders,
  batch: ImportBatchInputDto,
  userId: string,
  dependencies: ImportPreparationDependencies = {},
  resolutionByEntryId: ImportResolutionByEntryId = new Map(),
  customContentChoiceByKey: ImportCustomContentChoiceByKey = new Map()
): Promise<PreparedBatch> {
  const recorder = createImportPreviewLookupRecorder(userId)
  const recorded = await prepareImportBatch(
    recorder,
    batch,
    userId,
    resolutionByEntryId,
    customContentChoiceByKey,
    dependencies
  )
  const exactParts = await Promise.all(
    chunkImportPreviewLookupRequests(recorder.exactRequests()).map((requests) =>
      loaders.loadExact(requests)
    )
  )
  const masters = await Promise.all(
    recorder
      .masterSubjectKinds()
      .map((subjectKind) => loadMasterCandidates(loaders, recorded, subjectKind))
  )
  const snapshot = mergeImportPreviewLookupSnapshots(userId, exactParts, masters)
  return prepareImportBatch(
    createImportPreviewMapLookup(snapshot),
    batch,
    userId,
    resolutionByEntryId,
    customContentChoiceByKey,
    dependencies
  )
}

export function runnerLookupLoaders(
  ctx: Pick<ActionCtx, 'runQuery'>,
  jobId: string
): NativeImportLookupLoaders {
  return {
    loadExact: (requests) => ctx.runQuery(loadExactForJobRef, { jobId, requests }),
    loadMasterPage: (subjectKind, cursor) =>
      ctx.runQuery(loadMasterPageForJobRef, {
        jobId,
        subjectKind,
        paginationOpts: { cursor, numItems: 96 }
      })
  }
}

function previewLookupLoaders(ctx: ActionCtx): NativeImportLookupLoaders {
  return {
    loadExact: (requests) => ctx.runQuery(loadExactRef, { requests }),
    loadMasterPage: (subjectKind, cursor) =>
      ctx.runQuery(loadMasterPageRef, {
        subjectKind,
        paginationOpts: { cursor, numItems: 96 }
      })
  }
}

function dndPlaceholder(entryId: string, error?: unknown) {
  return JSON.stringify({
    entryId,
    unavailable: error instanceof Error ? error.message : 'No D&D Beyond response was available.'
  })
}

async function registerDndClaims(
  ctx: ActionCtx,
  input: DndPreviewInput,
  frozenByEntryId: ReadonlyMap<string, Promise<FrozenDndPayload>>
): Promise<ImportStoredPreviewDescriptor> {
  const entries: Array<{ claimId: string; entryId: string; url: string }> = []
  for (const [index, entry] of input.entries.entries()) {
    const frozen = frozenByEntryId.get(entry.entryId)
    let text: string
    try {
      text = frozen ? (await frozen).text : dndPlaceholder(entry.entryId)
    } catch (error) {
      text = dndPlaceholder(entry.entryId, error)
    }
    const storageId = await ctx.storage.store(new Blob([text], { type: 'application/json' }))
    let claim: ImportClaimRefDto
    try {
      claim = await ctx.runMutation(registerFetchedRef, {
        entryId: entry.entryId,
        name: 'dnd-beyond-' + (index + 1) + '.json',
        storageId
      })
    } catch (error) {
      await ctx.storage.delete(storageId)
      throw error
    }
    entries.push({
      claimId: claim.claimId,
      entryId: entry.entryId,
      url: entry.url
    })
  }
  return importStoredPreviewDescriptorSchema.parse({
    source: input.source,
    systemId: input.systemId,
    primaryRulesCatalogueId: input.primaryRulesCatalogueId,
    entries
  })
}

export const create = action({
  args: { input: zodToConvex(importPreviewInputSchema) },
  returns: zodToConvex(importPreviewResultSchema),
  handler: async (ctx, args): Promise<ImportPreviewResult> => {
    const input = importPreviewInputSchema.parse(args.input)
    const identity = authIdentityDtoSchema.parse(await ctx.runQuery(identityRef, {}))
    let batch: ImportBatchInputDto
    let dependencies: ImportPreparationDependencies = {}
    let frozenByEntryId: Map<string, Promise<FrozenDndPayload>> | undefined

    if (input.source === 'DND_BEYOND') {
      batch = importBatchInputDtoSchema.parse(input)
      const budget = { remainingBytes: IMPORT_MAX_BATCH_BYTES }
      frozenByEntryId = new Map()
      const loadFrozenDndBeyondPayload: FrozenDndLoader = (entryId, characterId) => {
        let pending = frozenByEntryId!.get(entryId)
        if (!pending) {
          pending = fetchFrozenDndBeyondPayload(characterId, globalThis.fetch, budget)
          frozenByEntryId!.set(entryId, pending)
        }
        return pending
      }
      dependencies = { loadFrozenDndBeyondPayload }
    } else {
      batch = await materializeUploadedBatch(ctx, input)
    }

    const prepared = await prepareWithNativeLookup(
      previewLookupLoaders(ctx),
      batch,
      identity.userId,
      dependencies
    )
    const descriptor =
      input.source === 'DND_BEYOND'
        ? await registerDndClaims(ctx, input, frozenByEntryId!)
        : importStoredPreviewDescriptorSchema.parse(input)
    const preview = await ctx.runMutation(createPreviewRef, { descriptor })
    return importPreviewResultSchema.parse({
      ...toImportPreviewResponse(prepared),
      ...importPreviewSessionRefDtoSchema.parse(preview)
    })
  }
})
