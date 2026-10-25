import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import {
  authoredDraftDtoSchema,
  authoredStoredDraftSchema
} from '@artificer-toolkit/schema/api/authoredDrafts'
import {
  authoredStoredImportReferenceSchema,
  importDestinationDtoSchema,
  importSourceDtoSchema,
  IMPORT_MAX_CUSTOM_CONTENT_CHOICES,
  type ImportDestinationDto,
  type ImportSourceDto
} from '@artificer-toolkit/schema/api/imports'
import {
  authoredPublishDraftInputSchema,
  type AuthoredPublishDraftInput
} from '@artificer-toolkit/schema/api/authoredPublication'
import { authoredContentSourceDtoSchema } from '@artificer-toolkit/schema/api/sourceImport'
import {
  authoredNodeRuntimeSourceFactsSchema,
  type AuthoredNodeRuntimeSourceFacts,
  type NodeRuntimeSourceTable
} from '@artificer-toolkit/schema/api/nodeRuntimeSources'
import { jsonValueSchema, type JsonValue } from '@artificer-toolkit/schema/projections/identity'
import {
  authoredSourceFacts,
  normalizeNodeRuntimeValues
} from '@artificer-toolkit/authoring/nodeRuntime'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  canonicalizeRuleDocument,
  checksumCanonicalRuleDocument,
  checksumRuleDocument
} from '@artificer-toolkit/shared/rules'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { internalMutation } from '../lib/mutations'
import { createSystemSourceReader } from '../authoring/systemSources'
import { insertDraftPayload, insertAuthoredVersion } from '../content/documents'
import {
  assertEquipmentRelationshipsIndexed,
  compileCurrentEquipment
} from '../content/equipmentRelationships'
import { equipmentOptionFacts } from '@artificer-toolkit/rules-runtime/character/equipmentOptionFacts'
import { requireAuthoredSizes } from '@artificer-toolkit/rules-runtime/systemSizes'
import { requireAuthoredAbilities } from '@artificer-toolkit/rules-runtime/systemAbilities'
import { ensureDraftImageSlot, promoteDraftImageSlot } from '../content/imageSlots'
import {
  assertActivePublicationNameAvailable,
  activePublicationNameKey
} from '../content/publicationPersistence'
import {
  compilePublicationDocument,
  parsePublicationDocument
} from '../content/publicationDocument'
import { assertClassRelationshipsIndexed, requireClassParent } from '../content/classRelationships'
import { assertRaceRelationshipsIndexed, compileCurrentRace } from '../content/raceRelationships'
import { ensureAuthoredRouteId } from '../content/routeIds'
import { catalogueMetadata } from '../content/catalogueMetadata'
import { requireSystem } from '../content/systemDocuments'
import { isImportRowVisible } from './visibility'
import {
  importCustomStageKey,
  insertStagedStage,
  readStagedReplay,
  requireRunningImportJob
} from './stages'

type SubjectKind = AuthoredPublishDraftInput['subjectKind']

interface StageCustomAuthoredArgs {
  jobId: string
  sequence: number
  customSequence: number
  entryId: string
  source: ImportSourceDto
  externalId: string
  subjectKind: SubjectKind
  targetId: string
  systemId: string
  label: string
  payloadJson: string
  activate: boolean
}

function storedFields<T extends { _id: unknown; _creationTime: unknown }>({
  _id: _storedId,
  _creationTime: _createdAt,
  ...stored
}: T) {
  return stored
}

async function readTargetState(
  ctx: MutationCtx,
  args: StageCustomAuthoredArgs,
  ownerUserId: string
) {
  const [root, draft, route, reference, usage, source] = await Promise.all([
    ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (query) => query.eq('id', args.targetId))
      .unique(),
    ctx.db
      .query('authoredDrafts')
      .withIndex('by_subjectId', (query) => query.eq('subjectId', args.targetId))
      .unique(),
    ctx.db
      .query('authoredRouteIds')
      .withIndex('by_subjectId', (query) => query.eq('subjectId', args.targetId))
      .unique(),
    ctx.db
      .query('authoredImportRefs')
      .withIndex('by_userId_source_subjectKind_externalId', (query) =>
        query
          .eq('userId', ownerUserId)
          .eq('source', args.source)
          .eq('subjectKind', args.subjectKind)
          .eq('externalId', args.externalId)
      )
      .unique(),
    ctx.db
      .query('accountUsageEntries')
      .withIndex('by_resource_sourceId', (query) =>
        query.eq('resource', 'homebrewRoots').eq('sourceId', args.targetId)
      )
      .unique(),
    ctx.db
      .query('contentSources')
      .withIndex('by_gameSystemId_kind_ownerUserId_code', (query) =>
        query
          .eq('gameSystemId', args.systemId)
          .eq('kind', 'USER')
          .eq('ownerUserId', ownerUserId)
          .eq('code', 'default')
      )
      .unique()
  ])
  return { root, draft, route, reference, usage, source }
}

function assertNewTarget(state: Awaited<ReturnType<typeof readTargetState>>) {
  if (state.root || state.draft || state.route || state.reference || state.usage)
    throw new Error('Imported custom authored content must use a new destination.')
}

async function insertImportReference(
  ctx: MutationCtx,
  args: StageCustomAuthoredArgs,
  ownerUserId: string
) {
  const now = new Date().toISOString()
  await ctx.db.insert(
    'authoredImportRefs',
    authoredStoredImportReferenceSchema.parse({
      userId: ownerUserId,
      importJobId: args.jobId,
      source: args.source,
      subjectKind: args.subjectKind,
      externalId: args.externalId,
      subjectId: args.targetId,
      createdAt: now,
      updatedAt: now
    })
  )
}

async function insertUsage(
  ctx: MutationCtx,
  args: Pick<StageCustomAuthoredArgs, 'jobId' | 'targetId'>,
  ownerUserId: string
) {
  await ctx.db.insert('accountUsageEntries', {
    resource: 'homebrewRoots',
    sourceId: args.targetId,
    ownerUserId,
    importJobId: args.jobId
  })
}

function destination(args: StageCustomAuthoredArgs): ImportDestinationDto {
  return importDestinationDtoSchema.parse({
    kind: args.activate ? 'ACTIVE_AUTHORED_CONTENT' : 'AUTHORED_DRAFT',
    subjectKind: args.subjectKind,
    subjectId: args.targetId
  })
}

async function combinedSourceFacts(
  ctx: MutationCtx,
  args: StageCustomAuthoredArgs,
  current: AuthoredNodeRuntimeSourceFacts,
  ownerUserId: string
) {
  const roots = await ctx.db
    .query('authoredRoots')
    .withIndex('by_importJobId_id', (query) => query.eq('importJobId', args.jobId))
    .take(IMPORT_MAX_CUSTOM_CONTENT_CHOICES + 1)
  if (roots.length > IMPORT_MAX_CUSTOM_CONTENT_CHOICES)
    throw new Error('Import custom content limit exceeded.')
  const rows: Partial<
    Record<NodeRuntimeSourceTable, Record<string, string | number | boolean | null>[]>
  > = Object.fromEntries(
    Object.entries(current.rows).map(([table, tableRows]) => [table, [...tableRows]])
  )
  for (const root of roots) {
    if (root.ownerUserId !== ownerUserId)
      throw new Error('Staged authored source facts are invalid.')
    if (root.systemId !== args.systemId) continue
    if (!root.authoringSources || root.authoringSources.checksum !== root.checksum)
      throw new Error('Staged authored source facts are invalid.')
    const facts = authoredNodeRuntimeSourceFactsSchema.parse(root.authoringSources)
    for (const [table, tableRows] of Object.entries(facts.rows)) {
      const target = rows[table as NodeRuntimeSourceTable] ?? []
      target.push(...tableRows)
      rows[table as NodeRuntimeSourceTable] = target
    }
  }
  return authoredNodeRuntimeSourceFactsSchema.parse({ checksum: current.checksum, rows })
}

async function contentSource(
  ctx: MutationCtx,
  args: StageCustomAuthoredArgs,
  ownerUserId: string,
  existing: Doc<'contentSources'> | null
) {
  if (existing) {
    return {
      contentSource: authoredContentSourceDtoSchema.parse(storedFields(existing)),
      createContentSource: false
    }
  }
  const roots = await ctx.db
    .query('authoredRoots')
    .withIndex('by_importJobId_id', (query) => query.eq('importJobId', args.jobId))
    .take(IMPORT_MAX_CUSTOM_CONTENT_CHOICES + 1)
  if (roots.length > IMPORT_MAX_CUSTOM_CONTENT_CHOICES)
    throw new Error('Import custom content limit exceeded.')
  const sourceIds = new Set(
    roots
      .filter(
        (root) =>
          root.ownerUserId === ownerUserId &&
          root.systemId === args.systemId &&
          root.importJobId === args.jobId
      )
      .map((root) => root.contentSourceId)
  )
  if (sourceIds.size > 1) throw new Error('Staged default content source identity mismatch.')
  return {
    contentSource: authoredContentSourceDtoSchema.parse({
      id: sourceIds.values().next().value ?? crypto.randomUUID(),
      gameSystemId: args.systemId,
      kind: 'USER',
      ownerUserId,
      code: 'default',
      label: 'Default homebrew source',
      description: ''
    }),
    createContentSource: true
  }
}

async function countVisibleChildren(
  ctx: MutationCtx,
  args: StageCustomAuthoredArgs,
  parentField: 'parentClassId' | 'parentRaceId',
  parentId: string
) {
  const rows =
    parentField === 'parentClassId'
      ? await ctx.db
          .query('authoredRoots')
          .withIndex('by_system_kind_parentClassId', (query) =>
            query
              .eq('systemId', args.systemId)
              .eq('subjectKind', 'CLASS')
              .eq('parentClassId', parentId)
          )
          .take(500)
      : await ctx.db
          .query('authoredRoots')
          .withIndex('by_system_kind_parentRaceId', (query) =>
            query
              .eq('systemId', args.systemId)
              .eq('subjectKind', 'RACE')
              .eq('parentRaceId', parentId)
          )
          .take(500)
  let visible = 0
  for (const row of rows)
    if (await isImportRowVisible(ctx, row.importJobId, args.jobId)) visible += 1
  return visible
}

async function prepareActive(
  ctx: MutationCtx,
  args: StageCustomAuthoredArgs,
  payload: Record<string, JsonValue>,
  ownerUserId: string,
  sourceId: string
) {
  const authored = parsePublicationDocument(args.subjectKind, {
    ...payload,
    id: args.targetId,
    label: args.label,
    systemId: args.systemId,
    userId: ownerUserId,
    status: 'ACTIVE'
  })
  requireAuthoredSizes(authored)
  requireAuthoredAbilities(authored)
  const initialChecksum = checksumRuleDocument(authored.document)
  const reader = await createSystemSourceReader(
    ctx,
    args.systemId,
    ownerUserId,
    await combinedSourceFacts(
      ctx,
      args,
      authoredSourceFacts({ ...authored, checksum: initialChecksum }),
      ownerUserId
    )
  )
  const normalized = await normalizeNodeRuntimeValues(reader, {
    mapId: args.subjectKind.toLowerCase(),
    systemId: args.systemId,
    values: authored.document
  })
  const subject = parsePublicationDocument(args.subjectKind, normalized.values)
  if (
    subject.document.id !== args.targetId ||
    subject.document.systemId !== args.systemId ||
    subject.document.label !== args.label ||
    subject.document.userId !== ownerUserId ||
    subject.document.status !== 'ACTIVE'
  )
    throw new Error('Imported active authored content identity mismatch.')

  const canReadStagedRoot = async (root: Doc<'authoredRoots'>) =>
    root.importJobId === args.jobId &&
    root.ownerUserId === ownerUserId &&
    root.systemId === args.systemId &&
    root.contentSourceId === sourceId

  let parent: { id: string; label: string } | undefined
  if (subject.subjectKind === 'CLASS') {
    await assertClassRelationshipsIndexed(ctx, args.systemId)
    if (subject.document.category === 'SUBCLASS') {
      parent = await requireClassParent(
        ctx,
        subject.document,
        ownerUserId,
        undefined,
        canReadStagedRoot,
        args.jobId
      )
      if (
        (await countVisibleChildren(ctx, args, 'parentClassId', subject.document.parentClassId)) >=
        499
      )
        throw new Error('Class family exceeds the 500-record authoring limit.')
    }
  }
  if (subject.subjectKind === 'RACE') {
    await assertRaceRelationshipsIndexed(ctx, args.systemId)
    if (
      subject.document.category === 'SUBRACE' &&
      (await countVisibleChildren(ctx, args, 'parentRaceId', subject.document.parentRaceId)) >= 499
    )
      throw new Error('Race inheritance exceeds the authoring limit.')
  }
  if (subject.subjectKind === 'EQUIPMENT')
    await assertEquipmentRelationshipsIndexed(ctx, args.systemId)

  const equipment =
    subject.subjectKind === 'EQUIPMENT'
      ? await compileCurrentEquipment(
          ctx,
          subject.document,
          ownerUserId,
          undefined,
          canReadStagedRoot,
          args.jobId
        )
      : null
  const race =
    subject.subjectKind === 'RACE'
      ? await compileCurrentRace(
          ctx,
          subject.document,
          ownerUserId,
          undefined,
          canReadStagedRoot,
          args.jobId
        )
      : null
  if (subject.subjectKind === 'RACE' && subject.document.category === 'SUBRACE')
    parent = race?.parent
  const compilation =
    equipment?.compilation ?? race?.compilation ?? compilePublicationDocument(subject)
  const checksum = checksumRuleDocument(subject.document)
  if (compilation.authoredChecksum !== checksum)
    throw new Error('Prepared publication checksum mismatch.')
  await assertActivePublicationNameAvailable(ctx, subject, ownerUserId, args.targetId, args.jobId)
  return {
    subject,
    compilation,
    checksum,
    authoringSources: authoredSourceFacts({ ...subject, checksum }),
    effectiveEquipment: equipment?.effective,
    catalogueFamily:
      subject.subjectKind === 'CLASS' || subject.subjectKind === 'RACE'
        ? {
            id: parent?.id ?? args.targetId,
            nameKey: (parent?.label ?? args.label).toLowerCase()
          }
        : null
  }
}

async function stageDraft(
  ctx: MutationCtx,
  args: StageCustomAuthoredArgs,
  payload: Record<string, JsonValue>,
  ownerUserId: string,
  publicId: string,
  expectedState: unknown
) {
  await ensureDraftImageSlot(
    ctx,
    { subjectId: args.targetId, subjectKind: args.subjectKind },
    args.jobId
  )
  const payloadJson = canonicalizeRuleDocument({ ...payload, status: 'DRAFT' })
  const payloadId = await insertDraftPayload(
    ctx,
    args.targetId,
    args.systemId,
    payloadJson,
    args.jobId
  )
  const now = new Date().toISOString()
  const dto = authoredDraftDtoSchema.parse({
    subjectKind: args.subjectKind,
    subjectId: args.targetId,
    systemId: args.systemId,
    label: args.label,
    userId: ownerUserId,
    publicId,
    status: 'DRAFT',
    draftState: 'DRAFT_ONLY',
    baseActiveUpdatedAt: null,
    createdAt: now,
    updatedAt: now,
    payload: JSON.parse(payloadJson)
  })
  const { payload: _payload, ...metadata } = dto
  const draft = authoredStoredDraftSchema.parse({
    ...metadata,
    payloadId,
    basePublishedChecksum: null,
    importJobId: args.jobId
  })
  const output = {
    activation: 'DRAFT' as const,
    destination: destination(args),
    publicId,
    draft,
    stagedPayloadId: payloadId,
    incrementsUsage: true
  }
  await insertStagedStage(ctx, {
    jobId: args.jobId,
    stageKey: importCustomStageKey(args.sequence, args.customSequence),
    entryId: args.entryId,
    sequence: args.sequence,
    kind: 'CUSTOM_AUTHORED',
    target: {
      source: args.source,
      externalId: args.externalId,
      subjectKind: args.subjectKind,
      targetId: args.targetId,
      systemId: args.systemId,
      label: args.label,
      activate: args.activate,
      payloadChecksum: checksumCanonicalRuleDocument(args.payloadJson)
    },
    output,
    expectedState
  })
  return JSON.stringify(output)
}

async function stageActive(
  ctx: MutationCtx,
  args: StageCustomAuthoredArgs,
  payload: Record<string, JsonValue>,
  ownerUserId: string,
  publicId: string,
  expectedState: unknown,
  source: Awaited<ReturnType<typeof contentSource>>
) {
  const prepared = await prepareActive(ctx, args, payload, ownerUserId, source.contentSource.id)
  await promoteDraftImageSlot(
    ctx,
    { subjectId: args.targetId, subjectKind: args.subjectKind },
    args.jobId
  )
  const storedVersionId = await insertAuthoredVersion(
    ctx,
    {
      subjectKind: args.subjectKind,
      id: args.targetId,
      systemId: args.systemId,
      label: args.label,
      checksum: prepared.checksum,
      contentSourceId: source.contentSource.id,
      importJobId: args.jobId,
      versionId: crypto.randomUUID(),
      version: 1,
      documentSchemaVersion: 1
    },
    canonicalizeRuleDocument(prepared.subject.document),
    prepared.compilation
  )
  const version = await ctx.db.get(storedVersionId)
  if (!version) throw new Error('Staged authored version is missing.')
  const catalogue = await catalogueMetadata(ctx, prepared.subject, {
    checksum: prepared.checksum,
    publicId,
    createdAt: version._creationTime
  })
  const rootId = await ctx.db.insert('authoredRoots', {
    id: args.targetId,
    subjectKind: args.subjectKind,
    systemId: args.systemId,
    ownerUserId,
    label: args.label,
    checksum: prepared.checksum,
    contentSourceId: source.contentSource.id,
    importJobId: args.jobId,
    currentVersionId: storedVersionId,
    currentVersionPublicId: version.versionId,
    authoringSources: prepared.authoringSources,
    activeNameKey: activePublicationNameKey(args.label),
    ...(prepared.subject.subjectKind === 'CLASS'
      ? {
          parentClassId:
            prepared.subject.document.category === 'SUBCLASS'
              ? prepared.subject.document.parentClassId
              : null
        }
      : {}),
    ...(prepared.subject.subjectKind === 'EQUIPMENT'
      ? {
          parentEquipmentId:
            prepared.subject.document.category === 'VARIANT'
              ? prepared.subject.document.parentEquipmentId
              : null,
          equipmentOptions: equipmentOptionFacts(
            prepared.subject.document,
            prepared.checksum,
            prepared.effectiveEquipment
          )
        }
      : {}),
    ...(prepared.subject.subjectKind === 'RACE'
      ? {
          parentRaceId:
            prepared.subject.document.category === 'SUBRACE'
              ? prepared.subject.document.parentRaceId
              : null
        }
      : {}),
    ...(prepared.catalogueFamily ? { catalogueFamily: prepared.catalogueFamily } : {})
  })
  const root = await ctx.db.get(rootId)
  if (!root) throw new Error('Staged authored root is missing.')
  const output = {
    activation: 'ACTIVE' as const,
    destination: destination(args),
    publicId,
    stagedRootId: root._id,
    stagedRootChecksum: checksumCanonicalJson(storedFields(root)),
    stagedVersionId: version._id,
    stagedVersionChecksum: checksumCanonicalJson(storedFields(version)),
    checksum: prepared.checksum,
    contentSource: source.contentSource,
    createContentSource: source.createContentSource,
    catalogue,
    catalogueFamily: prepared.catalogueFamily,
    spellClassIds: catalogue.spell?.classIds ?? [],
    incrementsUsage: true
  }
  await insertStagedStage(ctx, {
    jobId: args.jobId,
    stageKey: importCustomStageKey(args.sequence, args.customSequence),
    entryId: args.entryId,
    sequence: args.sequence,
    kind: 'CUSTOM_AUTHORED',
    target: {
      source: args.source,
      externalId: args.externalId,
      subjectKind: args.subjectKind,
      targetId: args.targetId,
      systemId: args.systemId,
      label: args.label,
      activate: args.activate,
      payloadChecksum: checksumCanonicalRuleDocument(args.payloadJson)
    },
    output,
    expectedState
  })
  return JSON.stringify(output)
}

export const stageCustomAuthored = internalMutation({
  args: {
    jobId: v.string(),
    sequence: v.number(),
    customSequence: v.number(),
    entryId: v.string(),
    source: v.string(),
    externalId: v.string(),
    subjectKind: v.string(),
    targetId: v.string(),
    systemId: v.string(),
    label: v.string(),
    payloadJson: v.string(),
    activate: v.boolean()
  },
  returns: v.string(),
  handler: async (ctx, rawArgs): Promise<string> => {
    const args: StageCustomAuthoredArgs = {
      ...rawArgs,
      source: importSourceDtoSchema.parse(rawArgs.source),
      subjectKind: authoredPublishDraftInputSchema.shape.subjectKind.parse(rawArgs.subjectKind)
    }
    const stageKey = importCustomStageKey(args.sequence, args.customSequence)
    const payload = jsonValueSchema.parse(JSON.parse(args.payloadJson))
    if (
      !payload ||
      typeof payload !== 'object' ||
      Array.isArray(payload) ||
      payload.id !== args.targetId ||
      payload.systemId !== args.systemId ||
      payload.label !== args.label
    )
      throw new Error('Imported custom authored content identity mismatch.')
    const target = {
      source: args.source,
      externalId: args.externalId,
      subjectKind: args.subjectKind,
      targetId: args.targetId,
      systemId: args.systemId,
      label: args.label,
      activate: args.activate,
      payloadChecksum: checksumCanonicalRuleDocument(args.payloadJson)
    }
    const replay = await readStagedReplay(ctx, {
      jobId: args.jobId,
      stageKey,
      entryId: args.entryId,
      sequence: args.sequence,
      kind: 'CUSTOM_AUTHORED',
      target
    })
    if (replay) return replay.outputJson

    const found = await requireRunningImportJob(ctx, args.jobId)
    if (payload.userId !== found.job.ownerUserId)
      throw new Error('Imported custom authored content owner mismatch.')
    await requireSystem(ctx, args.systemId)
    const state = await readTargetState(ctx, args, found.job.ownerUserId)
    assertNewTarget(state)
    const expectedState = {
      target: {
        root: null,
        draft: null,
        version: null,
        route: null,
        reference: null,
        usage: null
      },
      contentSource: state.source ? storedFields(state.source) : null
    }
    const source = args.activate
      ? await contentSource(ctx, args, found.job.ownerUserId, state.source)
      : null
    const publicId = await ensureAuthoredRouteId(
      ctx,
      args.subjectKind,
      args.targetId,
      false,
      undefined,
      args.jobId
    )
    await insertImportReference(ctx, args, found.job.ownerUserId)
    await insertUsage(ctx, args, found.job.ownerUserId)
    return source
      ? stageActive(ctx, args, payload, found.job.ownerUserId, publicId, expectedState, source)
      : stageDraft(ctx, args, payload, found.job.ownerUserId, publicId, expectedState)
  }
})

export const stageCustomAuthoredRef = makeFunctionReference<
  'mutation',
  {
    jobId: string
    sequence: number
    customSequence: number
    entryId: string
    source: string
    externalId: string
    subjectKind: string
    targetId: string
    systemId: string
    label: string
    payloadJson: string
    activate: boolean
  },
  string
>('imports/stageCustomAuthored:stageCustomAuthored')
