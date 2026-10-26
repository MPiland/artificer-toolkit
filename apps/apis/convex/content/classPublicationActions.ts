import * as zMini from 'zod/mini'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { z } from 'zod'
import {
  authoredSourceFacts,
  normalizeIngressValues,
  type NodeRuntimeQueryRow,
  type NodeRuntimeSourceReader,
  type NodeRuntimeSourceTable
} from '@artificer-toolkit/authoring/nodeRuntime'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { nodeRuntimeSourceChecksumsSchema } from '@artificer-toolkit/schema/api/nodeRuntimeSources'
import {
  authoredPublishDraftInputSchema,
  authoredPublicationResultSchema,
  type AuthoredPublicationResult
} from '@artificer-toolkit/schema/api/authoredPublication'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { internal } from '../_generated/api'
import { action } from '../_generated/server'
import { compilePublicationDocument, parsePublicationDocument } from './publicationDocument'

const classPublishDraftInputSchema = zMini.extend(authoredPublishDraftInputSchema, {
  subjectKind: z.literal('CLASS')
})
const sourceRowsSchema = z.array(
  z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
)

export const publishDraft = action({
  args: zodToConvexFields(classPublishDraftInputSchema.shape),
  returns: zodToConvex(authoredPublicationResultSchema),
  handler: async (ctx, args): Promise<AuthoredPublicationResult> => {
    const input = classPublishDraftInputSchema.parse(args)
    const prepared: {
      documentJson: string
      label: string
      systemId: string
      userId: string
    } = await ctx.runQuery(internal.content.classPublication.prepareDraft, input)
    const payload = jsonValueSchema.parse(JSON.parse(prepared.documentJson))
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      throw new Error('Stored Class draft is invalid.')
    const authored = parsePublicationDocument('CLASS', {
      ...payload,
      kind: 'CLASS',
      id: input.subjectId,
      label: prepared.label,
      systemId: prepared.systemId,
      userId: prepared.userId,
      status: 'ACTIVE'
    })
    const draftChecksum = checksumRuleDocument(authored.document)
    const draftFacts = authoredSourceFacts({
      ...authored,
      checksum: draftChecksum
    })
    const rows = new Map<NodeRuntimeSourceTable, Promise<NodeRuntimeQueryRow[]>>()
    const reader: NodeRuntimeSourceReader = async (table, columns, _where, scopeSystemId) => {
      if (scopeSystemId?.toLowerCase() !== prepared.systemId)
        throw new Error('Authoring System mismatch.')
      let pending = rows.get(table)
      if (!pending) {
        pending = ctx
          .runQuery(internal.content.classPublication.readSourceRows, {
            systemId: prepared.systemId,
            table
          })
          .then((value) => sourceRowsSchema.parse(JSON.parse(value)))
        rows.set(table, pending)
      }
      return [...(await pending), ...(draftFacts.rows[table] ?? [])].map((row) =>
        Object.fromEntries(columns.map((column) => [column, row[column] ?? null]))
      )
    }
    const normalized = await normalizeIngressValues(reader, {
      mapId: 'class',
      systemId: prepared.systemId,
      values: authored.document
    })
    const normalizedParentClassId =
      normalized.values &&
      typeof normalized.values === 'object' &&
      !Array.isArray(normalized.values) &&
      'parentClassId' in normalized.values
        ? normalized.values.parentClassId
        : undefined
    if (
      authored.document.category === 'SUBCLASS' &&
      normalizedParentClassId !== authored.document.parentClassId
    )
      throw new Error('A readable base class in the same System is required.')
    const subject = parsePublicationDocument('CLASS', normalized.values)
    const checksum = checksumRuleDocument(subject.document)
    const sourceChecksums = nodeRuntimeSourceChecksumsSchema.parse(
      Object.fromEntries(
        await Promise.all(
          [...rows].map(async ([table, sourceRows]) => [
            table,
            checksumRuleDocument(await sourceRows)
          ])
        )
      )
    )
    return ctx.runMutation(internal.content.classPublication.commitDraft, {
      ...input,
      documentJson: canonicalizeRuleDocument(subject.document),
      compilation: compilePublicationDocument(subject),
      authoringSources: authoredSourceFacts({ ...subject, checksum }),
      sourceChecksums
    })
  }
})
