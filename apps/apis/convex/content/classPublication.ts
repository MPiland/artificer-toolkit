import * as zMini from 'zod/mini'
import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { z } from 'zod'
import {
  authoredNodeRuntimeSourceFactsSchema,
  isNodeRuntimeSourceTable,
  nodeRuntimeSourceManifest,
  nodeRuntimeSourceChecksumsSchema
} from '@artificer-toolkit/schema/api/nodeRuntimeSources'
import {
  authoredPublishDraftInputSchema,
  authoredPublicationResultSchema,
  authoredStoredCompilationSchema,
  type AuthoredPublicationResult
} from '@artificer-toolkit/schema/api/authoredPublication'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { internalQuery } from '../lib/queries'
import { internalMutation } from '../lib/mutations'
import { createSystemSourceReader } from '../authoring/systemSources'
import { requireIdentity } from '../lib/identity'
import {
  assertPreparedClassDocument,
  commitPublication,
  readPublicationState
} from './publicationPersistence'
import { readDraftPayloadJson } from './documents'

const classPublishDraftInputSchema = zMini.extend(authoredPublishDraftInputSchema, {
  subjectKind: z.literal('CLASS')
})

export const prepareDraft = internalQuery({
  args: zodToConvexFields(classPublishDraftInputSchema.shape),
  returns: v.object({
    documentJson: v.string(),
    label: v.string(),
    systemId: v.string(),
    userId: v.string()
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    documentJson: string
    label: string
    systemId: string
    userId: string
  }> => {
    const input = classPublishDraftInputSchema.parse(args)
    const state = await readPublicationState(ctx, input)
    return {
      documentJson: await readDraftPayloadJson(ctx, state.draft),
      label: state.draft.label,
      systemId: state.draft.systemId,
      userId: state.userId
    }
  }
})

export const readSourceRows = internalQuery({
  args: { systemId: v.string(), table: v.string() },
  returns: v.string(),
  handler: async (ctx, { systemId, table }): Promise<string> => {
    const { userId } = await requireIdentity(ctx)
    if (!isNodeRuntimeSourceTable(table)) throw new Error('Unknown authoring source table.')
    const reader = await createSystemSourceReader(ctx, systemId, userId)
    return canonicalizeRuleDocument(
      await reader(table, nodeRuntimeSourceManifest[table], undefined, systemId)
    )
  }
})

export const commitDraft = internalMutation({
  args: {
    ...zodToConvexFields(classPublishDraftInputSchema.shape),
    documentJson: v.string(),
    compilation: zodToConvex(authoredStoredCompilationSchema),
    authoringSources: zodToConvex(authoredNodeRuntimeSourceFactsSchema),
    sourceChecksums: zodToConvex(nodeRuntimeSourceChecksumsSchema)
  },
  returns: zodToConvex(authoredPublicationResultSchema),
  handler: async (ctx, args): Promise<AuthoredPublicationResult> => {
    const input = classPublishDraftInputSchema.parse({
      subjectKind: args.subjectKind,
      subjectId: args.subjectId,
      expectedDraftUpdatedAt: args.expectedDraftUpdatedAt
    })
    const state = await readPublicationState(ctx, input)
    const reader = await createSystemSourceReader(ctx, state.draft.systemId, state.userId)
    for (const [table, expectedChecksum] of Object.entries(args.sourceChecksums)) {
      if (!isNodeRuntimeSourceTable(table)) throw new Error('Unknown authoring source table.')
      const rows = await reader(
        table,
        nodeRuntimeSourceManifest[table],
        undefined,
        state.draft.systemId
      )
      if (checksumRuleDocument(rows) !== expectedChecksum)
        throw new Error('Authoring sources changed. Reload before publishing.')
    }
    const subject = await assertPreparedClassDocument(ctx, state, JSON.parse(args.documentJson))
    if (canonicalizeRuleDocument(subject.document) !== args.documentJson)
      throw new Error('Prepared Class publication is not canonical.')
    return commitPublication(ctx, state, subject, args.compilation, args.authoringSources)
  }
})
