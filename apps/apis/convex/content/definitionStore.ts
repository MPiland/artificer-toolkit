import {
  reusableDefinitionCurrentDtoSchema,
  reusableDefinitionDocumentDtoSchema,
  reusableDefinitionDraftDtoSchema,
  reusableDefinitionDocumentFamilyKey,
  type ReusableDefinitionCurrentDto,
  type ReusableDefinitionRootRecord
} from '@artificer-toolkit/schema/shared/reusableDefinitions'
import type { ReusableDefinitionStore } from '@artificer-toolkit/authoring/reusableDefinitions'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'
import { decodeDefinitionDocument, encodeDefinitionDocument } from './definitionDocumentJson'
import { readSystem } from './systemDocuments'

type Context = MutationCtx | QueryCtx

export async function readCurrentSourceDefinitions(
  ctx: QueryCtx,
  sources: readonly Doc<'contentSources'>[],
  actorUserId: string
): Promise<ReusableDefinitionCurrentDto[]> {
  const current: ReusableDefinitionCurrentDto[] = []
  for (const [definition, source] of await readPublishedSourceDefinitions(ctx, sources)) {
    const root = readStoredDefinitionRoot(definition, source, actorUserId)
    if (!root.current) throw new Error('Definition is not published.')
    current.push(root.current)
  }
  return current.sort(
    (left, right) =>
      left.definitionFamilyKey.localeCompare(right.definitionFamilyKey) ||
      left.label.localeCompare(right.label) ||
      left.id.localeCompare(right.id)
  )
}

/**
 * The published definitions an author may choose, as the stored identity and label only. Each row
 * passes the same source, ownership and publication checks as a full read, but its document is
 * not decoded: a choice never reads it, and decoding every document overran resolve's 1 s budget.
 */
export async function readCurrentSourceDefinitionChoices(
  ctx: QueryCtx,
  sources: readonly Doc<'contentSources'>[],
  actorUserId: string
): Promise<{ id: string; label: string }[]> {
  return (await readPublishedSourceDefinitions(ctx, sources)).map(([definition, source]) => {
    assertStoredDefinitionRecord(definition, source, actorUserId)
    return { id: definition.id, label: definition.label }
  })
}

async function readPublishedSourceDefinitions(
  ctx: QueryCtx,
  sources: readonly Doc<'contentSources'>[]
): Promise<[Doc<'reusableDefinitions'>, Doc<'contentSources'>][]> {
  const published: [Doc<'reusableDefinitions'>, Doc<'contentSources'>][] = []
  for (const source of sources) {
    const definitions = await ctx.db
      .query('reusableDefinitions')
      .withIndex('by_contentSourceId_version', (q) =>
        q.eq('contentSourceId', source.id).gt('version', 0)
      )
      .take(501 - published.length)
    // ponytail: complete inline options retain the existing 500-definition ceiling;
    // larger catalogues need paginated search, never silently truncated choices.
    if (published.length + definitions.length > 500)
      throw new Error('Definition options require paginated search.')
    for (const definition of definitions) published.push([definition, source])
  }
  return published
}

export async function readDefinitionRoot(
  ctx: Context,
  definitionId: string,
  actorUserId: string | null
): Promise<(ReusableDefinitionRootRecord & { _id: Id<'reusableDefinitions'> }) | null> {
  const record = await ctx.db
    .query('reusableDefinitions')
    .withIndex('by_publicId', (q) => q.eq('id', definitionId))
    .unique()
  if (!record) return null
  const source = await ctx.db
    .query('contentSources')
    .withIndex('by_publicId', (q) => q.eq('id', record.contentSourceId))
    .unique()
  if (!source) throw new Error('Reusable definition unavailable.')
  return readStoredDefinitionRoot(record, source, actorUserId)
}

// Option readers already hold the source and validated System. Decode their rows
// here too, without repeating source/System queries for every option candidate.
export function readStoredDefinitionRoot(
  record: Doc<'reusableDefinitions'>,
  source: Doc<'contentSources'>,
  actorUserId: string | null
): ReusableDefinitionRootRecord & { _id: Id<'reusableDefinitions'> } {
  const owner = assertStoredDefinitionRecord(record, source, actorUserId)
  const current =
    record.version === 0
      ? null
      : reusableDefinitionCurrentDtoSchema.parse({
          id: record.id,
          gameSystemId: record.gameSystemId,
          contentSourceId: record.contentSourceId,
          definitionFamilyKey: record.definitionFamilyKey,
          label: record.label,
          description: record.description,
          document: decodeDefinitionDocument(record.documentJson),
          checksum: record.checksum,
          contractVersion: record.contractVersion,
          version: record.version,
          publishedAt: record.publishedAt,
          publishedBy: record.publishedBy
        })
  if (
    current &&
    reusableDefinitionDocumentFamilyKey(current.document) !== record.definitionFamilyKey
  )
    throw new Error('Reusable definition integrity mismatch.')
  if (current && checksumRuleDocument(current.document) !== current.checksum)
    throw new Error('Reusable definition integrity mismatch.')
  return {
    _id: record._id,
    id: record.id,
    gameSystemId: record.gameSystemId,
    contentSourceId: record.contentSourceId,
    definitionFamilyKey: record.definitionFamilyKey,
    label: record.label,
    description: record.description,
    version: record.version,
    draftVersion: record.draftVersion ?? null,
    sourceKind: source.kind,
    sourceOwnerUserId: owner,
    current
  }
}

/** The stored row's source, ownership and version metadata checks; returns the source owner. */
function assertStoredDefinitionRecord(
  record: Doc<'reusableDefinitions'>,
  source: Doc<'contentSources'>,
  actorUserId: string | null
): string | null {
  if (source.id !== record.contentSourceId || source.gameSystemId !== record.gameSystemId)
    throw new Error('Reusable definition unavailable.')
  const owner = source.kind === 'USER' ? source.ownerUserId : null
  if (
    (source.kind === 'PLATFORM' &&
      (record.ownerUserId !== undefined || source.ownerUserId !== null)) ||
    (source.kind === 'USER' && (!owner || record.ownerUserId !== owner || owner !== actorUserId))
  )
    throw new Error('Reusable definition unavailable.')
  const metadataAbsent =
    record.contractVersion === undefined &&
    record.publishedAt === undefined &&
    record.publishedBy === undefined
  if (
    !Number.isInteger(record.version) ||
    record.version < 0 ||
    (record.draftVersion !== undefined &&
      (!Number.isInteger(record.draftVersion) || record.draftVersion < 0)) ||
    (record.version === 0 &&
      (record.documentJson !== undefined || record.checksum !== undefined || !metadataAbsent))
  )
    throw new Error('Reusable definition integrity mismatch.')
  if (
    record.version > 0 &&
    (record.contractVersion === undefined ||
      record.publishedAt === undefined ||
      record.publishedBy === undefined)
  )
    throw new Error('Reusable definition integrity mismatch.')
  return owner
}

export async function readSystemOwner(ctx: Context, gameSystemId: string) {
  const system = await ctx.db
    .query('systems')
    .withIndex('by_publicId', (q) => q.eq('id', gameSystemId))
    .unique()
  if (!system) throw new Error('Reusable definition integrity mismatch.')
  return readSystem(system).userId
}

export async function readDefinitionDraft(ctx: Context, root: ReusableDefinitionRootRecord) {
  const stored = await ctx.db
    .query('reusableDefinitionDrafts')
    .withIndex('by_definitionId', (q) => q.eq('definitionId', root.id))
    .unique()
  if (!stored) {
    if (root.draftVersion !== null) throw new Error('Reusable definition draft integrity mismatch.')
    return null
  }
  const { _id, _creationTime, documentJson, ...storedDraft } = stored
  const draft = reusableDefinitionDraftDtoSchema.parse({
    ...storedDraft,
    document: decodeDefinitionDocument(documentJson)
  })
  if (
    root.sourceKind === 'PLATFORM' ||
    root.draftVersion !== draft.version ||
    draft.definitionId !== root.id ||
    draft.gameSystemId !== root.gameSystemId ||
    draft.authorUserId !== root.sourceOwnerUserId ||
    draft.baseDefinitionVersion !== root.version ||
    reusableDefinitionDocumentFamilyKey(draft.document) !== root.definitionFamilyKey ||
    checksumRuleDocument(draft.document) !== draft.checksum
  )
    throw new Error('Reusable definition draft integrity mismatch.')
  return { draft, _id }
}

export function createConvexReusableDefinitionStore(
  ctx: MutationCtx,
  actorUserId: string
): ReusableDefinitionStore {
  return {
    async requireCurrent(definitionId) {
      const root = await readDefinitionRoot(ctx, definitionId, actorUserId)
      if (!root?.current) throw new Error('Reusable definition is not currently published.')
      return root.current
    },
    async saveDraft(input) {
      const root = await readDefinitionRoot(ctx, input.definitionId, actorUserId)
      if (!root) throw new Error('Reusable definition unavailable.')
      await input.authorize(root)
      if (root.version !== input.expectedDefinitionVersion)
        throw new Error('Reusable definition version is stale.')
      const document = reusableDefinitionDocumentDtoSchema.parse(input.document)
      if (
        document.id !== root.id ||
        document.gameSystemId !== root.gameSystemId ||
        reusableDefinitionDocumentFamilyKey(document) !== root.definitionFamilyKey
      )
        throw new Error('Reusable definition document does not match its root.')
      const stored = await readDefinitionDraft(ctx, root)
      const existing = stored?.draft
      const now = new Date().toISOString()
      if (existing) {
        if (input.expectedDraftVersion !== existing.version)
          throw new Error('Reusable definition draft is stale.')
        const next = {
          ...existing,
          authorUserId: input.actorUserId,
          document,
          checksum: input.checksum,
          baseDefinitionVersion: root.version,
          version: existing.version + 1,
          updatedAt: now
        }
        const { document: nextDocument, ...nextFields } = next
        await ctx.db.replace(stored._id, {
          ...nextFields,
          documentJson: encodeDefinitionDocument(nextDocument)
        })
        await ctx.db.patch(root._id, { draftVersion: next.version })
        return reusableDefinitionDraftDtoSchema.parse(next)
      }
      if (input.expectedDraftVersion !== null)
        throw new Error('Reusable definition draft does not exist.')
      const next = {
        definitionId: root.id,
        gameSystemId: root.gameSystemId,
        authorUserId: input.actorUserId,
        document,
        checksum: input.checksum,
        baseDefinitionVersion: root.version,
        version: 0,
        createdAt: now,
        updatedAt: now
      }
      const { document: nextDocument, ...nextFields } = next
      await ctx.db.insert('reusableDefinitionDrafts', {
        ...nextFields,
        documentJson: encodeDefinitionDocument(nextDocument)
      })
      await ctx.db.patch(root._id, { draftVersion: 0 })
      return reusableDefinitionDraftDtoSchema.parse(next)
    },
    async publishDraft(input) {
      const root = await readDefinitionRoot(ctx, input.definitionId, actorUserId)
      if (!root) throw new Error('Reusable definition unavailable.')
      input.authorize(root)
      const storedDraft = await readDefinitionDraft(ctx, root)
      const draft = storedDraft?.draft
      if (
        !draft ||
        root.version !== input.expectedDefinitionVersion ||
        draft.version !== input.expectedDraftVersion ||
        draft.baseDefinitionVersion !== root.version
      )
        throw new Error('Reusable definition draft is stale.')
      const dependencyIds = [...new Set(input.dependencyDefinitionIds(draft))]
        .filter((id) => id !== root.id)
        .sort()
      const dependencies: ReusableDefinitionCurrentDto[] = []
      for (const id of dependencyIds) dependencies.push(await this.requireCurrent(id))
      await input.validate(root, draft, dependencies)
      const version = root.version + 1
      const publishedAt = new Date().toISOString()
      await ctx.db.patch(root._id, {
        version,
        draftVersion: undefined,
        documentJson: encodeDefinitionDocument(draft.document),
        checksum: draft.checksum,
        contractVersion: 1,
        publishedAt,
        publishedBy: input.actorUserId
      })
      await ctx.db.delete(storedDraft._id)
      return reusableDefinitionCurrentDtoSchema.parse({
        id: root.id,
        gameSystemId: root.gameSystemId,
        contentSourceId: root.contentSourceId,
        definitionFamilyKey: root.definitionFamilyKey,
        label: root.label,
        description: root.description,
        document: draft.document,
        checksum: draft.checksum,
        contractVersion: 1,
        version,
        publishedAt,
        publishedBy: input.actorUserId
      })
    }
  }
}
