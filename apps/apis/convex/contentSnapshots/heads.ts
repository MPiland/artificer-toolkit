import { paginationOptsValidator } from 'convex/server'
import { stream } from 'convex-helpers/server/stream'
import { v } from 'convex/values'
import { zodToConvex } from 'convex-helpers/server/zod4'
import { authoredCatalogueMetadataSchema } from '@artificer-toolkit/schema/api/authoredCatalogue'
import { authoredEquipmentOptionFactsSchema } from '@artificer-toolkit/schema/api/authoredOptions'
import {
  contentSnapshotHeadSchema,
  contentSnapshotKindSchema,
  contentSnapshotObjectKey,
  type ContentSnapshotHead,
  type ContentSnapshotKind
} from '@artificer-toolkit/schema/api/contentSnapshots'
import type { EquipmentAuthoredDto } from '@artificer-toolkit/schema/subjects/equipment'
import type { ContentSnapshotListSource } from '@artificer-toolkit/rules-runtime/contentSnapshots'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { internalQuery } from '../lib/queries'
import { internalMutation } from '../lib/mutations'
import schema from '../schema'
import {
  hasCampaignContentParents,
  readCampaignSharedActiveRoot,
  requireCampaignContentParents
} from '../campaigns/contentAccess'
import {
  canReadAuthoredRoot,
  readAuthoredVersion,
  readAuthoredVersionCompilation,
  readPublishedDocument
} from '../content/documents'
import { compileCurrentEquipment } from '../content/equipmentRelationships'
import { requireSystem } from '../content/systemDocuments'
import { equipmentOptionFacts } from '@artificer-toolkit/rules-runtime/character/equipmentOptionFacts'
import { parsePublicationDocument } from '../content/publicationDocumentRead'
import { contentStream } from '../content/streams'
import { isImportRowVisible } from '../imports/visibility'
import {
  CONTENT_SNAPSHOT_BUILD_DELAY_MS,
  readContentSnapshotHead,
  scheduleContentSnapshotBuild,
  vContentSnapshotScopeRef,
  type ContentSnapshotScopeRef
} from './marking'

// ADR 0036 build protocol; `docs/architecture/persistence.md` describes it end to end.

const SUPERSEDED_RETENTION_MS = 7 * 86_400_000
const CLEANUP_BATCH_SIZE = 100
// A claim this old belongs to a cleanup run that failed before deleting its rows.
const CLEANUP_CLAIM_TIMEOUT_MS = 60 * 60_000
const DELETING_KEY_RETRY_MS = 60_000
const MAX_AUTOMATIC_RETRIES = 5
/** A failed build retries after this, doubling per consecutive failure. */
export const CONTENT_SNAPSHOT_FIRST_RETRY_MS = 60_000
// A readScopeKind page stops at 15 roots or once its serialized sources reach 256 KiB. In
// convex-test a root costs about 7-22 ms, so the full SRD's largest page took 282 ms, against
// 1,236 ms for the 100-root pages that ran past the 1 s query limit on CI's self-hosted runtime.
export const CONTENT_SNAPSHOT_PAGE_MAX_ROOTS = 15
const CONTENT_SNAPSHOT_PAGE_BYTE_BUDGET = 256 * 1024

/**
 * The revision a build starts from, or null when nothing is unbuilt. Content read afterwards is at
 * least this new, so committing it as `builtRevision` never skips a change.
 */
export const readBuildStart = internalQuery({
  args: vContentSnapshotScopeRef,
  returns: v.union(
    v.object({ revision: v.number(), scopeExists: v.boolean(), publicAccess: v.boolean() }),
    v.null()
  ),
  handler: async (ctx, { scope, scopeId }) => {
    const head = await ctx.db
      .query('contentSnapshotHeads')
      .withIndex('by_scope_scopeId', (q) => q.eq('scope', scope).eq('scopeId', scopeId))
      .unique()
    if (!head || head.revision <= head.builtRevision) return null
    if (scope === 'CAMPAIGN') {
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', scopeId))
        .unique()
      return { revision: head.revision, scopeExists: campaign !== null, publicAccess: false }
    }
    const source = await ctx.db
      .query('contentSources')
      .withIndex('by_publicId', (q) => q.eq('id', scopeId))
      .unique()
    // Only PLATFORM source objects are public (S3 delivery); a source's kind never changes.
    return {
      revision: head.revision,
      scopeExists: source !== null,
      publicAccess: source?.kind === 'PLATFORM'
    }
  }
})

/**
 * One page of one kind of a scope's readable current publications, by the Builder's source rules,
 * as JSON list sources (the publication plus its public id and, for a Spell, its School label). A
 * missing scope has no roots. A page reads at most `numItems` and the page root budget, and stops
 * once its sources reach the byte budget, so each query's reads and time stay bounded.
 */
export const readScopeKind = internalQuery({
  args: {
    ...vContentSnapshotScopeRef,
    kind: zodToConvex(contentSnapshotKindSchema),
    paginationOpts: paginationOptsValidator
  },
  returns: v.union(
    v.object({
      sources: v.array(v.string()),
      continueCursor: v.string(),
      isDone: v.boolean()
    }),
    v.object({ pendingCompilation: v.literal(true) })
  ),
  handler: async (ctx, { scope, scopeId, kind, paginationOpts }) => {
    const readRoots =
      scope === 'SOURCE'
        ? await sourcePublicationReader(ctx, scopeId, kind)
        : await campaignPublicationReader(ctx, scopeId, kind)
    if (!readRoots) return { sources: [], continueCursor: '', isDone: true }
    const roots = await readRoots(
      paginationOpts.cursor,
      Math.min(paginationOpts.numItems, CONTENT_SNAPSHOT_PAGE_MAX_ROOTS)
    )
    const sources: string[] = []
    const schoolLabels = new Map<string, ReadonlyMap<string, string>>()
    let bytes = 0
    for (const [index, load] of roots.page.entries()) {
      const loaded = await load()
      if (!loaded) continue
      const { root, publication, version } = loaded
      // Fails closed on a root whose catalogue metadata was never written.
      const { publicId } = authoredCatalogueMetadataSchema.parse(root.catalogue)
      let magicSchoolLabel: string | undefined
      if (publication.subjectKind === 'SPELL') {
        if (!schoolLabels.has(root.systemId))
          schoolLabels.set(
            root.systemId,
            new Map(
              (await requireSystem(ctx, root.systemId)).magicSchools.map(({ id, label }) => [
                id,
                label
              ])
            )
          )
        magicSchoolLabel = schoolLabels.get(root.systemId)!.get(publication.document.magicSchoolId)
        if (!magicSchoolLabel) throw new Error('Spell Magic School is not in its System.')
      }
      const publicationVersion = {
        identity: {
          subjectKind: root.subjectKind,
          subjectId: root.id,
          systemId: root.systemId,
          contentSourceId: root.contentSourceId,
          versionId: root.currentVersionPublicId,
          checksum: root.checksum
        },
        version,
        ...(root.subjectKind === 'CLASS' && root.parentClassId !== undefined
          ? { storedParentId: root.parentClassId }
          : root.subjectKind === 'RACE' && root.parentRaceId !== undefined
            ? { storedParentId: root.parentRaceId }
            : root.subjectKind === 'EQUIPMENT' && root.parentEquipmentId !== undefined
              ? { storedParentId: root.parentEquipmentId }
              : {})
      }
      // A snapshot never carries a root its readers would have to recompile; the build waits for
      // the compilation instead (`awaitCompilation`).
      const compilation = await readAuthoredVersionCompilation(ctx, {
        versionId: root.currentVersionPublicId
      })
      if (!compilation || compilation.authoredChecksum !== root.checksum)
        return { pendingCompilation: true as const }
      const source: ContentSnapshotListSource =
        publication.subjectKind === 'EQUIPMENT'
          ? {
              subjectKind: 'EQUIPMENT',
              document: publication.document,
              builder: await readEquipmentBuilderFacts(ctx, root, publication.document),
              publicId,
              publicationVersion,
              compilation
            }
          : {
              ...publication,
              publicId,
              publicationVersion,
              compilation,
              ...(magicSchoolLabel ? { magicSchoolLabel } : {})
            }
      const json = JSON.stringify(source)
      sources.push(json)
      bytes += new TextEncoder().encode(json).byteLength
      if (bytes >= CONTENT_SNAPSHOT_PAGE_BYTE_BUDGET && index < roots.page.length - 1) {
        // The page ends after this root: the same read cut to the roots taken gives its cursor.
        const { continueCursor } = await readRoots(paginationOpts.cursor, index + 1)
        return { sources, continueCursor, isDone: false }
      }
    }
    return { sources, continueCursor: roots.continueCursor, isDone: roots.isDone }
  }
})

type ScopePublication = {
  root: Doc<'authoredRoots'>
  publication: ReturnType<typeof parsePublicationDocument>
  version: number
}

/**
 * Reads pages of the roots `readCharacterSourceRoots` reads for this source, each root's publication
 * loaded on demand, or null for a missing source.
 */
async function sourcePublicationReader(ctx: QueryCtx, sourceId: string, kind: ContentSnapshotKind) {
  const source = await ctx.db
    .query('contentSources')
    .withIndex('by_publicId', (q) => q.eq('id', sourceId))
    .unique()
  if (!source) return null
  return async (cursor: string | null, numItems: number) => {
    const roots = await contentStream(ctx.db)
      .query('authoredRoots')
      .withIndex('by_contentSourceId_subjectKind_ownerUserId', (q) =>
        q
          .eq('contentSourceId', source.id)
          .eq('subjectKind', kind)
          .eq('ownerUserId', source.kind === 'USER' ? source.ownerUserId : undefined)
      )
      .filterWith((root) => isImportRowVisible(ctx, root.importJobId))
      .paginate({ numItems, cursor })
    const page = roots.page.map((root) => async (): Promise<ScopePublication | null> => {
      if (root.systemId !== source.gameSystemId)
        throw new Error('Stored content source System mismatch.')
      if (!(await canReadAuthoredRoot(ctx, root, source.ownerUserId, source))) return null
      const version = await readAuthoredVersion(ctx, root)
      const publication = parsePublicationDocument(
        kind,
        await readPublishedDocument(ctx, root, version)
      )
      return { root, publication, version: version.version }
    })
    return { ...roots, page }
  }
}

/**
 * Reads pages of a Campaign's shared roots of one kind, each root's publication loaded on demand, or
 * null for a missing Campaign.
 */
async function campaignPublicationReader(
  ctx: QueryCtx,
  campaignId: string,
  kind: ContentSnapshotKind
) {
  const campaign = await ctx.db
    .query('campaigns')
    .withIndex('by_publicId', (q) => q.eq('id', campaignId))
    .unique()
  if (!campaign) return null
  return async (cursor: string | null, numItems: number) => {
    // A stream, unlike `ctx.db` pagination, may page twice in one query.
    const shares = await stream(ctx.db, schema)
      .query('campaignContentShares')
      .withIndex('by_campaignId_subjectKind_subjectId', (q) =>
        q.eq('campaignId', campaign.id).eq('subjectKind', kind)
      )
      .paginate({ numItems, cursor })
    const page = shares.page.map((share) => async (): Promise<ScopePublication | null> => {
      const root = await readCampaignSharedActiveRoot(ctx, campaign, kind, share.subjectId)
      // A child whose parent share is gone is excluded; the Builder's parent rule still applies.
      if (!root || !(await hasCampaignContentParents(ctx, campaign, root))) return null
      await requireCampaignContentParents(ctx, campaign, root)
      const version = await readAuthoredVersion(ctx, root)
      const document = await readPublishedDocument(ctx, root, version)
      return {
        root,
        publication: parsePublicationDocument(kind, document),
        version: version.version
      }
    })
    return { ...shares, page }
  }
}

/**
 * The stored effective projection when it is current; otherwise the Builder's projection function
 * over the resolved variant chain, so a missing backfill never drops a root or fails the build.
 */
async function readEquipmentBuilderFacts(
  ctx: QueryCtx,
  root: Doc<'authoredRoots'>,
  document: EquipmentAuthoredDto
): Promise<Extract<ContentSnapshotListSource, { subjectKind: 'EQUIPMENT' }>['builder']> {
  if (root.equipmentOptions?.builder !== undefined) {
    const stored = authoredEquipmentOptionFactsSchema.parse(root.equipmentOptions)
    if (stored.checksum === root.checksum && stored.builder) return stored.builder
  }
  const { effective } = await compileCurrentEquipment(ctx, document, root.ownerUserId ?? null)
  const { builder } = equipmentOptionFacts(document, root.checksum, effective)
  if (!builder) throw new Error('Equipment builder projection requires resolved facts.')
  return builder
}

/** Keys without an object row; only these are uploaded. */
export const readAbsentObjectKeys = internalQuery({
  args: { keys: v.array(v.string()) },
  returns: v.array(v.string()),
  handler: async (ctx, { keys }) => {
    const absent: string[] = []
    for (const key of keys) {
      const row = await ctx.db
        .query('contentSnapshotObjects')
        .withIndex('by_key', (q) => q.eq('key', key))
        .unique()
      if (!row) absent.push(key)
    }
    return absent
  }
})

function referencedKeys(ref: ContentSnapshotScopeRef, kinds: ContentSnapshotHead['kinds']) {
  const keys = new Set<string>()
  for (const kind of contentSnapshotKindSchema.options) {
    const parts = kinds[kind]
    if (!parts) continue
    for (const part of ['index', 'list', 'documents'] as const)
      keys.add(contentSnapshotObjectKey({ format: 3, ...ref, kind, part }, parts[part].sha256))
  }
  return keys
}

/**
 * Compare-and-set on `builtRevision`. Uploaded keys are always recorded, superseded unless the
 * committed head references them, so an object from a rejected build ages out like any other.
 */
export const commitBuild = internalMutation({
  args: {
    ...vContentSnapshotScopeRef,
    revisionBuiltFrom: v.number(),
    kinds: zodToConvex(contentSnapshotHeadSchema.shape.kinds),
    uploadedKeys: v.array(v.string()),
    scopeExists: v.boolean()
  },
  returns: v.union(
    v.literal('COMMITTED'),
    v.literal('STALE'),
    v.literal('RETRY'),
    v.literal('MISSING')
  ),
  handler: async (ctx, args) => {
    const ref: ContentSnapshotScopeRef = { scope: args.scope, scopeId: args.scopeId }
    const now = Date.now()
    const rows = new Map<string, Doc<'contentSnapshotObjects'> | null>()
    const readRow = async (key: string) => {
      const cached = rows.get(key)
      if (cached !== undefined) return cached
      const row = await ctx.db
        .query('contentSnapshotObjects')
        .withIndex('by_key', (q) => q.eq('key', key))
        .unique()
      rows.set(key, row)
      return row
    }
    const recordUploaded = async (live: ReadonlySet<string>) => {
      for (const key of args.uploadedKeys) {
        if (live.has(key) || (await readRow(key))) continue
        await ctx.db.insert('contentSnapshotObjects', {
          key,
          ...ref,
          createdAt: now,
          supersededAt: now
        })
      }
    }
    const head = await readContentSnapshotHead(ctx.db, ref)
    if (!head) {
      await recordUploaded(new Set())
      return 'MISSING'
    }
    if (args.revisionBuiltFrom <= head.builtRevision) {
      await recordUploaded(new Set())
      return 'STALE'
    }
    const uploaded = new Set(args.uploadedKeys)
    const next = referencedKeys(ref, args.kinds)
    for (const key of next) {
      const row = await readRow(key)
      // A key being deleted, or one that vanished after the build saw it, may have no object.
      if (row?.deletingAt !== undefined || (!row && !uploaded.has(key))) {
        await recordUploaded(new Set())
        await ctx.db.patch(head._id, { buildScheduledAt: now })
        await scheduleContentSnapshotBuild(ctx.scheduler, ref, DELETING_KEY_RETRY_MS)
        return 'RETRY'
      }
    }
    for (const key of next) {
      const row = await readRow(key)
      if (!row) await ctx.db.insert('contentSnapshotObjects', { key, ...ref, createdAt: now })
      else if (row.supersededAt !== undefined)
        await ctx.db.patch(row._id, { supersededAt: undefined })
    }
    for (const key of referencedKeys(ref, head.kinds)) {
      if (next.has(key)) continue
      const row = await readRow(key)
      if (row && row.supersededAt === undefined) await ctx.db.patch(row._id, { supersededAt: now })
    }
    await recordUploaded(next)
    if (!args.scopeExists) {
      await ctx.db.delete(head._id)
      return 'COMMITTED'
    }
    const dirty = head.revision > args.revisionBuiltFrom
    await ctx.db.patch(head._id, {
      kinds: args.kinds,
      builtRevision: args.revisionBuiltFrom,
      buildScheduledAt: dirty ? now : undefined,
      failedBuilds: undefined
    })
    if (dirty)
      await scheduleContentSnapshotBuild(ctx.scheduler, ref, CONTENT_SNAPSHOT_BUILD_DELAY_MS)
    return 'COMMITTED'
  }
})

/**
 * A build that found a root without its current compilation is waiting on that compilation, not
 * failing: writing it marks the scope (`lib/mutations.ts`). A mark during this build already bumped
 * `revision`, so it rebuilds now; otherwise the lease is released for that mark to schedule.
 */
export const awaitCompilation = internalMutation({
  args: { ...vContentSnapshotScopeRef, revisionBuiltFrom: v.number() },
  returns: v.null(),
  handler: async (ctx, { revisionBuiltFrom, ...ref }) => {
    const head = await readContentSnapshotHead(ctx.db, ref)
    if (!head) return null
    const marked = head.revision > revisionBuiltFrom
    await ctx.db.patch(head._id, { buildScheduledAt: marked ? Date.now() : undefined })
    if (marked)
      await scheduleContentSnapshotBuild(ctx.scheduler, ref, CONTENT_SNAPSHOT_BUILD_DELAY_MS)
    return null
  }
})

/** Retries a failed build with exponential backoff; later marks retry after that. */
export const failBuild = internalMutation({
  args: vContentSnapshotScopeRef,
  returns: v.null(),
  handler: async (ctx, ref) => {
    const head = await readContentSnapshotHead(ctx.db, ref)
    if (!head) return null
    const failedBuilds = (head.failedBuilds ?? 0) + 1
    if (failedBuilds > MAX_AUTOMATIC_RETRIES) {
      await ctx.db.patch(head._id, { failedBuilds, buildScheduledAt: undefined })
      return null
    }
    await ctx.db.patch(head._id, { failedBuilds, buildScheduledAt: Date.now() })
    await scheduleContentSnapshotBuild(
      ctx.scheduler,
      ref,
      CONTENT_SNAPSHOT_FIRST_RETRY_MS * 2 ** (failedBuilds - 1)
    )
    return null
  }
})

/** Claims objects superseded for longer than the retention; no build may reuse a claimed key. */
export const claimSupersededObjects = internalMutation({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const now = Date.now()
    const rows = await ctx.db
      .query('contentSnapshotObjects')
      .withIndex('by_supersededAt', (q) =>
        q.gte('supersededAt', 0).lt('supersededAt', now - SUPERSEDED_RETENTION_MS)
      )
      .take(CLEANUP_BATCH_SIZE)
    const keys: string[] = []
    for (const row of rows) {
      if (row.deletingAt !== undefined && row.deletingAt >= now - CLEANUP_CLAIM_TIMEOUT_MS) continue
      await ctx.db.patch(row._id, { deletingAt: now })
      keys.push(row.key)
    }
    return keys
  }
})

/** Removes the rows of claimed objects after R2 confirmed their deletion. */
export const finishDeletedObjects = internalMutation({
  args: { keys: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { keys }) => {
    for (const key of keys) {
      const row = await ctx.db
        .query('contentSnapshotObjects')
        .withIndex('by_key', (q) => q.eq('key', key))
        .unique()
      if (row?.deletingAt !== undefined) await ctx.db.delete(row._id)
    }
    return null
  }
})
