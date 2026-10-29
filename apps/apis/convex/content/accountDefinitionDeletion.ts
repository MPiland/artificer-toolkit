import { authoredContentSourceDtoSchema } from '@artificer-toolkit/schema/api/sourceImport'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import { v } from 'convex/values'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import {
  accountDeletionStepArgs,
  continueAccountDeletion,
  readAccountDeletionStep
} from '../accountDeletionJobs'
import { internalMutation } from '../lib/mutations'
import { deleteAuthoredVersion } from './documents'
import { readDefinitionDraft, readStoredDefinitionRoot } from './definitionStore'

async function removeAccountContentSource(
  ctx: MutationCtx,
  userId: string,
  source: Doc<'contentSources'>
) {
  const { _id: _sourceId, _creationTime: _sourceCreationTime, ...stored } = source
  const parsed = authoredContentSourceDtoSchema.parse(stored)
  if (parsed.kind !== 'USER' || parsed.ownerUserId !== userId)
    throw new Error('Account content source ownership mismatch.')
  if (
    await ctx.db
      .query('authoredRoots')
      .withIndex('by_contentSourceId', (query) => query.eq('contentSourceId', source.id))
      .first()
  )
    throw new Error('Account content source still contains authored roots.')

  // Shared history/custody carries immutable JSON snapshots, not version-table pins.
  const versions = await ctx.db
    .query('authoredVersions')
    .withIndex('by_contentSourceId', (query) => query.eq('contentSourceId', source.id))
    .collect()
  for (const version of versions) {
    const document = await deleteAuthoredVersion(ctx, version)
    if (
      version.systemId !== parsed.gameSystemId ||
      !document ||
      typeof document !== 'object' ||
      Array.isArray(document) ||
      document.id !== version.id ||
      document.systemId !== version.systemId ||
      document.label !== version.label ||
      document.userId !== userId ||
      (document.kind !== undefined && document.kind !== version.subjectKind) ||
      checksumRuleDocument(document) !== version.checksum
    )
      throw new Error('Account authored version ownership or checksum mismatch.')
  }

  const definitions = await ctx.db
    .query('reusableDefinitions')
    .withIndex('by_contentSourceId', (query) => query.eq('contentSourceId', source.id))
    .collect()
  for (const definition of definitions.sort((left, right) => left.id.localeCompare(right.id))) {
    const root = readStoredDefinitionRoot(definition, source, userId)
    const draft = await readDefinitionDraft(ctx, root)
    if (draft) await ctx.db.delete(draft._id)
    await ctx.db.delete(definition._id)
  }

  const [catalogues, counts] = await Promise.all([
    ctx.db
      .query('rulesCatalogues')
      .withIndex('by_gameSystemId', (query) => query.eq('gameSystemId', source.gameSystemId))
      .collect(),
    ctx.db
      .query('authoredCatalogueCounts')
      .withIndex('by_source_kind', (query) => query.eq('contentSourceId', source.id))
      .collect()
  ])
  if (catalogues.some((catalogue) => catalogue.contentSourceIds.includes(source.id)))
    throw new Error('Account content source is retained by a rules catalogue.')
  if (counts.some((count) => count.count !== 0))
    throw new Error('Account content source has nonzero catalogue counts.')
  for (const count of counts) await ctx.db.delete(count._id)
  await ctx.db.delete(source._id)
}

/** The SOURCES step (ADR 0040): one owned content source per invocation. */
export const step = internalMutation({
  args: accountDeletionStepArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await readAccountDeletionStep(ctx, args, 'SOURCES')
    if (!job) return null
    const source = await ctx.db
      .query('contentSources')
      .withIndex('by_ownerUserId', (query) => query.eq('ownerUserId', job.userId))
      .first()
    if (source) await removeAccountContentSource(ctx, job.userId, source)
    await continueAccountDeletion(ctx, job, source !== null)
    return null
  }
})
