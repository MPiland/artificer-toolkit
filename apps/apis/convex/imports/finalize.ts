import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { z } from 'zod'
import {
  authoredCatalogueFamilySchema,
  authoredCatalogueMetadataSchema
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import { authoredStoredDraftSchema } from '@artificer-toolkit/schema/api/authoredDrafts'
import { authoredPublishDraftInputSchema } from '@artificer-toolkit/schema/api/authoredPublication'
import {
  authoredStoredImportReferenceSchema,
  importDestinationDtoSchema,
  importResultItemDtoSchema,
  importSourceDtoSchema
} from '@artificer-toolkit/schema/api/imports'
import { authoredContentSourceDtoSchema } from '@artificer-toolkit/schema/api/sourceImport'
import {
  accountUsageSchema,
  zeroAccountUsage
} from '@artificer-toolkit/schema/projections/accountUsage'
import { characterStoredDraftSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import { importStoredStageSchema } from '@artificer-toolkit/schema/projections/importJobPersistence'
import { ENTITLEMENT_LIMITS } from '@artificer-toolkit/shared/account/entitlements'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { readCharacterDraftPayload } from '../characters/documents'
import { syncCatalogueMetadata } from '../content/catalogueMetadata'
import { readDraftPayloadJson, readStoredAuthoredVersionDocument } from '../content/documents'
import { requireSystem } from '../content/systemDocuments'
import { internalMutation } from '../lib/mutations'
import { importRowIdentity } from './stageDrafts'
import { requireRunningImportJob } from './stages'

const cleanupJob = makeFunctionReference<'mutation', { jobId: string }, null>(
  'imports/jobCleanup:cleanup'
)

const characterHeadOutputSchema = z.strictObject({
  draft: characterStoredDraftSchema,
  oldPayloadHead: z.unknown().nullable(),
  stagedPayloadId: z.string(),
  incrementsUsage: z.boolean()
})

const authoredHeadOutputSchema = z.strictObject({
  draft: authoredStoredDraftSchema,
  oldPayloadHead: z.unknown().nullable(),
  stagedPayloadId: z.string(),
  incrementsUsage: z.boolean()
})

const characterExpectedStateSchema = z.strictObject({
  active: z.unknown().nullable(),
  draft: z.unknown().nullable()
})

const authoredExpectedStateSchema = z.strictObject({
  root: z.unknown().nullable(),
  draft: z.unknown().nullable(),
  version: z.unknown().nullable()
})

const customTargetSchema = z.strictObject({
  source: importSourceDtoSchema,
  externalId: z.string().min(1),
  subjectKind: authoredPublishDraftInputSchema.shape.subjectKind,
  targetId: z.string().min(1),
  systemId: z.string().min(1),
  label: z.string().min(1),
  activate: z.boolean(),
  payloadChecksum: z.string().min(1)
})

const customExpectedStateSchema = z.strictObject({
  target: z.strictObject({
    root: z.null(),
    draft: z.null(),
    version: z.null(),
    route: z.null(),
    reference: z.null(),
    usage: z.null()
  }),
  contentSource: z.nullable(authoredContentSourceDtoSchema)
})

const customDraftOutputSchema = z.strictObject({
  activation: z.literal('DRAFT'),
  destination: importDestinationDtoSchema,
  publicId: z.string().min(1),
  draft: authoredStoredDraftSchema,
  stagedPayloadId: z.string().min(1),
  incrementsUsage: z.literal(true)
})

const customActiveOutputSchema = z.strictObject({
  activation: z.literal('ACTIVE'),
  destination: importDestinationDtoSchema,
  publicId: z.string().min(1),
  stagedRootId: z.string().min(1),
  stagedRootChecksum: z.string().min(1),
  stagedVersionId: z.string().min(1),
  stagedVersionChecksum: z.string().min(1),
  checksum: z.string().min(1),
  contentSource: authoredContentSourceDtoSchema,
  createContentSource: z.boolean(),
  catalogue: authoredCatalogueMetadataSchema,
  catalogueFamily: z.nullable(authoredCatalogueFamilySchema),
  spellClassIds: z.array(z.string()),
  incrementsUsage: z.literal(true)
})

const customOutputSchema = z.discriminatedUnion('activation', [
  customDraftOutputSchema,
  customActiveOutputSchema
])

type CharacterHead = {
  existing: Doc<'characterDrafts'> | null
  output: z.infer<typeof characterHeadOutputSchema>
}

type AuthoredHead = {
  existing: Doc<'authoredDrafts'> | null
  output: z.infer<typeof authoredHeadOutputSchema>
}

type CustomPublication = {
  target: z.infer<typeof customTargetSchema>
  output: z.infer<typeof customOutputSchema>
  draft: Doc<'authoredDrafts'> | null
  root: Doc<'authoredRoots'> | null
}

function storedFields<T extends { _id: unknown; _creationTime: unknown }>({
  _id: _storedId,
  _creationTime: _createdAt,
  ...stored
}: T) {
  return stored
}

function parseStage(row: Doc<'importJobStages'>) {
  const { _id, _creationTime, ...stored } = row
  const stage = importStoredStageSchema.parse(stored)
  const expectedState = JSON.parse(stage.expectedStateJson) as unknown
  if (stage.expectedStateChecksum !== checksumCanonicalJson(expectedState))
    throw new Error('Stored import stage state is invalid.')
  return { row, stage, expectedState }
}

function exactState(actual: unknown, expected: unknown) {
  if (checksumCanonicalJson(actual) !== checksumCanonicalJson(expected))
    throw new Error('Import destination changed before publication.')
}

async function validateCharacterHead(
  ctx: MutationCtx,
  jobId: string,
  stored: ReturnType<typeof parseStage>
): Promise<CharacterHead> {
  const expected = characterExpectedStateSchema.parse(stored.expectedState)
  const output = characterHeadOutputSchema.parse(JSON.parse(stored.stage.outputJson))
  if (!('payloadId' in output.draft) || output.draft.payloadId !== output.stagedPayloadId)
    throw new Error('Staged Character draft payload is invalid.')
  const [active, draft, payload] = await Promise.all([
    ctx.db
      .query('characters')
      .withIndex('by_publicId', (query) => query.eq('id', output.draft.characterId))
      .unique(),
    ctx.db
      .query('characterDrafts')
      .withIndex('by_characterId', (query) => query.eq('characterId', output.draft.characterId))
      .unique(),
    ctx.db
      .query('characterDraftPayloads')
      .withIndex('by_characterId_id', (query) =>
        query.eq('characterId', output.draft.characterId).eq('id', output.stagedPayloadId)
      )
      .unique()
  ])
  exactState(importRowIdentity(active), expected.active)
  exactState(importRowIdentity(draft), expected.draft)
  if (
    !payload ||
    payload.importJobId !== jobId ||
    payload.characterId !== output.draft.characterId ||
    payload.checksum !== output.draft.checksum
  )
    throw new Error('Staged Character draft payload is unavailable.')
  await readCharacterDraftPayload(ctx, output.draft)
  return { existing: draft, output }
}

async function validateAuthoredHead(
  ctx: MutationCtx,
  jobId: string,
  stored: ReturnType<typeof parseStage>
): Promise<AuthoredHead> {
  const expected = authoredExpectedStateSchema.parse(stored.expectedState)
  const output = authoredHeadOutputSchema.parse(JSON.parse(stored.stage.outputJson))
  if (!('payloadId' in output.draft) || output.draft.payloadId !== output.stagedPayloadId)
    throw new Error('Staged authored draft payload is invalid.')
  const [root, draft, payload] = await Promise.all([
    ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (query) => query.eq('id', output.draft.subjectId))
      .unique(),
    ctx.db
      .query('authoredDrafts')
      .withIndex('by_subjectId', (query) => query.eq('subjectId', output.draft.subjectId))
      .unique(),
    ctx.db
      .query('authoredDraftPayloads')
      .withIndex('by_publicId', (query) => query.eq('id', output.stagedPayloadId))
      .unique()
  ])
  const version = root ? await ctx.db.get(root.currentVersionId) : null
  exactState(importRowIdentity(root), expected.root)
  exactState(importRowIdentity(draft), expected.draft)
  exactState(
    version
      ? {
          _id: version._id,
          _creationTime: version._creationTime,
          versionId: version.versionId,
          checksum: version.checksum
        }
      : null,
    expected.version
  )
  if (
    !payload ||
    payload.importJobId !== jobId ||
    payload.subjectId !== output.draft.subjectId ||
    payload.systemId !== output.draft.systemId
  )
    throw new Error('Staged authored draft payload is unavailable.')
  return { existing: draft, output }
}

async function validateCustomPublication(
  ctx: MutationCtx,
  jobId: string,
  ownerUserId: string,
  stored: ReturnType<typeof parseStage>
): Promise<CustomPublication> {
  const target = customTargetSchema.parse(JSON.parse(stored.stage.targetJson))
  const expected = customExpectedStateSchema.parse(stored.expectedState)
  const output = customOutputSchema.parse(JSON.parse(stored.stage.outputJson))
  if (stored.stage.jobId !== jobId || stored.stage.status !== 'STAGED')
    throw new Error('Stored custom authored stage is invalid.')
  if ((output.activation === 'ACTIVE') !== target.activate)
    throw new Error('Staged custom authored activation is invalid.')
  exactState(output.destination, {
    kind: target.activate ? 'ACTIVE_AUTHORED_CONTENT' : 'AUTHORED_DRAFT',
    subjectKind: target.subjectKind,
    subjectId: target.targetId
  })

  const scope = output.activation === 'ACTIVE' ? 'ACTIVE' : 'DRAFT'
  const [root, draft, route, routeByPublicId, reference, usage, image, otherImage, currentSource] =
    await Promise.all([
      ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (query) => query.eq('id', target.targetId))
        .unique(),
      ctx.db
        .query('authoredDrafts')
        .withIndex('by_subjectId', (query) => query.eq('subjectId', target.targetId))
        .unique(),
      ctx.db
        .query('authoredRouteIds')
        .withIndex('by_subjectId', (query) => query.eq('subjectId', target.targetId))
        .unique(),
      ctx.db
        .query('authoredRouteIds')
        .withIndex('by_publicId', (query) => query.eq('publicId', output.publicId))
        .unique(),
      ctx.db
        .query('authoredImportRefs')
        .withIndex('by_userId_source_subjectKind_externalId', (query) =>
          query
            .eq('userId', ownerUserId)
            .eq('source', target.source)
            .eq('subjectKind', target.subjectKind)
            .eq('externalId', target.externalId)
        )
        .unique(),
      ctx.db
        .query('accountUsageEntries')
        .withIndex('by_resource_sourceId', (query) =>
          query.eq('resource', 'homebrewRoots').eq('sourceId', target.targetId)
        )
        .unique(),
      ctx.db
        .query('authoredImageSlots')
        .withIndex('by_subjectId_scope', (query) =>
          query.eq('subjectId', target.targetId).eq('scope', scope)
        )
        .unique(),
      ctx.db
        .query('authoredImageSlots')
        .withIndex('by_subjectId_scope', (query) =>
          query
            .eq('subjectId', target.targetId)
            .eq('scope', scope === 'ACTIVE' ? 'DRAFT' : 'ACTIVE')
        )
        .unique(),
      ctx.db
        .query('contentSources')
        .withIndex('by_gameSystemId_kind_ownerUserId_code', (query) =>
          query
            .eq('gameSystemId', target.systemId)
            .eq('kind', 'USER')
            .eq('ownerUserId', ownerUserId)
            .eq('code', 'default')
        )
        .unique(),
      requireSystem(ctx, target.systemId)
    ])
  if (
    !route ||
    route._id !== routeByPublicId?._id ||
    route.importJobId !== jobId ||
    route.subjectId !== target.targetId ||
    route.subjectKind !== target.subjectKind ||
    route.publicId !== output.publicId ||
    route.ownerUserId !== undefined
  )
    throw new Error('Staged custom authored route is unavailable.')
  if (
    !reference ||
    reference.importJobId !== jobId ||
    reference.userId !== ownerUserId ||
    reference.source !== target.source ||
    reference.subjectKind !== target.subjectKind ||
    reference.externalId !== target.externalId ||
    reference.subjectId !== target.targetId
  )
    throw new Error('Staged custom authored import reference is unavailable.')
  authoredStoredImportReferenceSchema.parse(storedFields(reference))
  if (
    !usage ||
    usage.importJobId !== jobId ||
    usage.resource !== 'homebrewRoots' ||
    usage.sourceId !== target.targetId ||
    usage.ownerUserId !== ownerUserId
  )
    throw new Error('Staged custom authored usage row is unavailable.')
  if (
    !image ||
    image.importJobId !== jobId ||
    image.subjectId !== target.targetId ||
    image.subjectKind !== target.subjectKind ||
    image.scope !== scope ||
    image.assetId !== null ||
    image.revision !== (scope === 'ACTIVE' ? 1 : 0) ||
    otherImage
  )
    throw new Error('Staged custom authored image slot is unavailable.')
  exactState(currentSource ? storedFields(currentSource) : null, expected.contentSource)

  if (output.activation === 'DRAFT') {
    if (root || draft) throw new Error('Staged custom authored draft destination is invalid.')
    if (
      !('payloadId' in output.draft) ||
      output.draft.payloadId !== output.stagedPayloadId ||
      output.draft.importJobId !== jobId ||
      output.draft.subjectId !== target.targetId ||
      output.draft.subjectKind !== target.subjectKind ||
      output.draft.systemId !== target.systemId ||
      output.draft.userId !== ownerUserId ||
      output.draft.label !== target.label ||
      output.draft.publicId !== output.publicId ||
      output.draft.status !== 'DRAFT'
    )
      throw new Error('Staged custom authored draft is invalid.')
    const payload = await ctx.db
      .query('authoredDraftPayloads')
      .withIndex('by_publicId', (query) => query.eq('id', output.stagedPayloadId))
      .unique()
    if (
      !payload ||
      payload.importJobId !== jobId ||
      payload.id !== output.stagedPayloadId ||
      payload.subjectId !== target.targetId ||
      payload.systemId !== target.systemId ||
      payload.checksum !== target.payloadChecksum
    )
      throw new Error('Staged custom authored draft payload is unavailable.')
    return { target, output, draft, root }
  }

  if (draft || !root) throw new Error('Staged active authored destination is invalid.')
  const version = await ctx.db.get(root.currentVersionId)
  if (
    root._id !== output.stagedRootId ||
    root.importJobId !== jobId ||
    root.id !== target.targetId ||
    root.subjectKind !== target.subjectKind ||
    root.systemId !== target.systemId ||
    root.ownerUserId !== ownerUserId ||
    root.label !== target.label ||
    root.checksum !== output.checksum ||
    root.contentSourceId !== output.contentSource.id ||
    root.catalogue !== undefined ||
    root.spellClassesIndexed !== undefined ||
    root.currentVersionId !== output.stagedVersionId ||
    checksumCanonicalJson(storedFields(root)) !== output.stagedRootChecksum ||
    checksumCanonicalJson(root.catalogueFamily ?? null) !==
      checksumCanonicalJson(output.catalogueFamily)
  )
    throw new Error('Staged active authored root is unavailable.')
  if (
    !version ||
    version._id !== output.stagedVersionId ||
    version.importJobId !== jobId ||
    version.id !== target.targetId ||
    version.subjectKind !== target.subjectKind ||
    version.systemId !== target.systemId ||
    version.label !== target.label ||
    version.checksum !== output.checksum ||
    version.contentSourceId !== output.contentSource.id ||
    version.version !== 1 ||
    checksumCanonicalJson(storedFields(version)) !== output.stagedVersionChecksum
  )
    throw new Error('Staged active authored version is unavailable.')
  const document = await readStoredAuthoredVersionDocument(ctx, version)
  if (
    document.id !== target.targetId ||
    document.systemId !== target.systemId ||
    document.userId !== ownerUserId ||
    document.label !== target.label ||
    document.status !== 'ACTIVE'
  )
    throw new Error('Staged active authored document is invalid.')
  if (
    output.catalogue.checksum !== output.checksum ||
    output.catalogue.publicId !== output.publicId ||
    checksumCanonicalJson(output.catalogue.spell?.classIds ?? []) !==
      checksumCanonicalJson(output.spellClassIds)
  )
    throw new Error('Staged active authored catalogue is invalid.')

  const sourceById = await ctx.db
    .query('contentSources')
    .withIndex('by_publicId', (query) => query.eq('id', output.contentSource.id))
    .unique()
  if (
    output.contentSource.kind !== 'USER' ||
    output.contentSource.ownerUserId !== ownerUserId ||
    output.contentSource.gameSystemId !== target.systemId ||
    output.contentSource.code !== 'default'
  )
    throw new Error('Staged default content source identity mismatch.')
  if (output.createContentSource) {
    if (expected.contentSource || currentSource || sourceById)
      throw new Error('Staged default content source identity mismatch.')
  } else if (
    !currentSource ||
    currentSource._id !== sourceById?._id ||
    checksumCanonicalJson(storedFields(currentSource)) !==
      checksumCanonicalJson(output.contentSource)
  )
    throw new Error('Staged default content source identity mismatch.')

  return { target, output, draft, root }
}

async function publishCustomDraft(ctx: MutationCtx, publication: CustomPublication): Promise<void> {
  if (publication.output.activation !== 'DRAFT') return
  const draftId = await ctx.db.insert('authoredDrafts', publication.output.draft)
  const draft = await ctx.db.get(draftId)
  if (!draft) throw new Error('Finalized custom authored draft is unavailable.')
  const payload = JSON.parse(await readDraftPayloadJson(ctx, draft)) as unknown
  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    !('id' in payload) ||
    payload.id !== publication.target.targetId ||
    !('systemId' in payload) ||
    payload.systemId !== publication.target.systemId ||
    !('userId' in payload) ||
    payload.userId !== publication.output.draft.userId ||
    !('label' in payload) ||
    payload.label !== publication.target.label ||
    !('status' in payload) ||
    payload.status !== 'DRAFT'
  )
    throw new Error('Staged custom authored draft payload is invalid.')
}
async function applyUsage(
  ctx: MutationCtx,
  ownerUserId: string,
  personalCharacters: number,
  homebrewRoots: number
) {
  const [profile, entitlement] = await Promise.all([
    ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (query) => query.eq('userId', ownerUserId))
      .unique(),
    ctx.db
      .query('accountEntitlements')
      .withIndex('by_userId', (query) => query.eq('userId', ownerUserId))
      .unique()
  ])
  if (!profile) throw new Error('Import owner account is unavailable.')
  const usage = accountUsageSchema.parse(profile.entitlementUsage ?? zeroAccountUsage)
  const limits = ENTITLEMENT_LIMITS[entitlement?.tier ?? 'FREE']
  const nextPersonalCharacters = usage.personalCharacters + personalCharacters
  const nextHomebrewRoots = usage.homebrewRoots + homebrewRoots
  if (limits.personalCharacters !== null && nextPersonalCharacters > limits.personalCharacters)
    throw new Error('Your account has reached its personalCharacters limit.')
  if (limits.homebrewRoots !== null && nextHomebrewRoots > limits.homebrewRoots)
    throw new Error('Your account has reached its homebrewRoots limit.')
  if (!personalCharacters && !homebrewRoots) return
  await ctx.db.patch(profile._id, {
    entitlementUsage: {
      ...usage,
      personalCharacters: nextPersonalCharacters,
      homebrewRoots: nextHomebrewRoots
    }
  })
}

export const complete = internalMutation({
  args: { jobId: v.string() },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    const found = await requireRunningImportJob(ctx, jobId)
    if (
      found.job.phase !== 'STAGING' ||
      found.job.expectedStageCount === 0 ||
      found.job.stagedStageCount !== found.job.expectedStageCount ||
      found.job.processedEntries !== found.job.totalEntries
    )
      throw new Error('Import job is not ready for publication.')

    const [stageRows, resultRows] = await Promise.all([
      ctx.db
        .query('importJobStages')
        .withIndex('by_jobId_stageKey', (query) => query.eq('jobId', jobId))
        .collect(),
      ctx.db
        .query('importJobResults')
        .withIndex('by_jobId_sequence', (query) => query.eq('jobId', jobId))
        .collect()
    ])
    if (
      stageRows.length !== found.job.expectedStageCount ||
      resultRows.length !== found.job.totalEntries
    )
      throw new Error('Import staged output is incomplete.')

    const parsedStages = stageRows.map(parseStage)
    if (parsedStages.filter(({ stage }) => stage.kind === 'PLAN').length !== 1)
      throw new Error('Import plan is invalid.')
    const characterStages = parsedStages.filter(({ stage }) => stage.kind === 'CHARACTER_HEAD')
    const authoredStages = parsedStages.filter(({ stage }) => stage.kind === 'AUTHORED_HEAD')
    const customStages = parsedStages.filter(({ stage }) => stage.kind === 'CUSTOM_AUTHORED')

    const characterHeads = await Promise.all(
      characterStages.map((stage) => validateCharacterHead(ctx, jobId, stage))
    )
    const authoredHeads = await Promise.all(
      authoredStages.map((stage) => validateAuthoredHead(ctx, jobId, stage))
    )
    const customPublications = await Promise.all(
      customStages.map((stage) =>
        validateCustomPublication(ctx, jobId, found.job.ownerUserId, stage)
      )
    )
    const targetKeys = [
      ...characterHeads.map(({ output }) => `CHARACTER:${output.draft.characterId}`),
      ...authoredHeads.map(({ output }) => `${output.draft.subjectKind}:${output.draft.subjectId}`),
      ...customPublications.map(({ target }) => `${target.subjectKind}:${target.targetId}`)
    ]
    if (new Set(targetKeys).size !== targetKeys.length)
      throw new Error('Import contains duplicate destinations.')

    const results = resultRows
      .sort((left, right) => left.sequence - right.sequence)
      .map((row, sequence) => {
        if (row.jobId !== jobId || row.sequence !== sequence)
          throw new Error('Import result sequence is invalid.')
        return importResultItemDtoSchema.parse(JSON.parse(row.resultJson))
      })
    const summary = {
      created: results.filter((result) => result.outcome === 'CREATED').length,
      updated: results.filter((result) => result.outcome === 'UPDATED').length,
      skipped: results.filter((result) => result.outcome === 'SKIPPED').length,
      failed: results.filter((result) => result.outcome === 'FAILED').length
    }

    await applyUsage(
      ctx,
      found.job.ownerUserId,
      characterHeads.filter(({ output }) => output.incrementsUsage).length,
      authoredHeads.filter(({ output }) => output.incrementsUsage).length +
        customPublications.filter(({ output }) => output.incrementsUsage).length
    )

    const sourcesById = new Map<string, z.infer<typeof authoredContentSourceDtoSchema>>()
    const defaultSourceIds = new Map<string, string>()
    for (const { output } of customPublications) {
      if (output.activation !== 'ACTIVE' || !output.createContentSource) continue
      const sourceKey = `${output.contentSource.gameSystemId}:${output.contentSource.ownerUserId}`
      const source = sourcesById.get(output.contentSource.id)
      const sourceId = defaultSourceIds.get(sourceKey)
      if (
        (source && checksumCanonicalJson(source) !== checksumCanonicalJson(output.contentSource)) ||
        (sourceId && sourceId !== output.contentSource.id)
      )
        throw new Error('Staged default content source identity mismatch.')
      sourcesById.set(output.contentSource.id, output.contentSource)
      defaultSourceIds.set(sourceKey, output.contentSource.id)
    }
    for (const source of sourcesById.values()) await ctx.db.insert('contentSources', source)

    for (const { existing, output } of characterHeads) {
      if (existing) await ctx.db.replace(existing._id, output.draft)
      else await ctx.db.insert('characterDrafts', output.draft)
    }
    for (const { existing, output } of authoredHeads) {
      if (existing) await ctx.db.replace(existing._id, output.draft)
      else await ctx.db.insert('authoredDrafts', output.draft)
    }
    for (const publication of customPublications) await publishCustomDraft(ctx, publication)
    for (const publication of customPublications) {
      if (publication.output.activation !== 'ACTIVE') continue
      if (!publication.root) throw new Error('Staged active authored root is unavailable.')
      await syncCatalogueMetadata(ctx, publication.root._id, publication.output.catalogue)
    }

    await ctx.db.patch(found.row._id, {
      status: 'COMPLETED',
      phase: 'PUBLISHING',
      summary,
      failureReason: null,
      updatedAt: new Date().toISOString()
    })
    await ctx.scheduler.runAfter(0, cleanupJob, { jobId })
    return null
  }
})

export const completeRef = makeFunctionReference<'mutation', { jobId: string }, null>(
  'imports/finalize:complete'
)
