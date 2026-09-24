import { createFunctionHandle } from 'convex/server'
import { convexTest } from 'convex-test'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import type { SourceImportSubjectDto } from '@artificer-toolkit/schema/api/sourceImport'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { components, internal } from '../../convex/_generated/api'
import type { MutationCtx } from '../../convex/_generated/server'
import authSchema from '../../convex/betterAuth/schema'
import { deleteAuthoredVersion, insertAuthoredVersion } from '../../convex/content/documents'
import schema from '../../convex/schema'

process.env.SITE_URL = 'http://localhost:3000'
process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough'

export function importedSubject(subject: {
  subjectKind: SourceImportSubjectDto['subjectKind']
  id: string
  systemId: string
  label: string
  document: unknown
}): SourceImportSubjectDto {
  const document = jsonValueSchema.parse(JSON.parse(JSON.stringify(subject.document)))
  return {
    subjectKind: subject.subjectKind,
    id: subject.id,
    systemId: subject.systemId,
    label: subject.label,
    checksum: checksumRuleDocument(document),
    document
  }
}

export async function corruptPublishedVersionPayload(ctx: MutationCtx, subjectId: string) {
  const root = await ctx.db
    .query('authoredRoots')
    .withIndex('by_publicId', (query) => query.eq('id', subjectId))
    .unique()
  if (!root) throw new Error('Missing authored corruption fixture.')
  const version = await ctx.db.get(root.currentVersionId)
  if (!version) throw new Error('Missing authored corruption version fixture.')
  const chunks = await ctx.db
    .query('authoredVersionPayloadChunks')
    .withIndex('by_versionId_chunkIndex', (query) => query.eq('versionId', version.versionId))
    .collect()
  if (!chunks[0]) throw new Error('Missing authored corruption chunk fixture.')
  await ctx.db.patch(chunks[0]._id, { bytes: new Uint8Array([0x7b, 0x7d]).buffer })
  for (const chunk of chunks.slice(1)) await ctx.db.delete(chunk._id)
  await ctx.db.patch(version._id, { documentChunkCount: 1, documentByteLength: 2 })
}

export async function makePublishedRootOwned(
  ctx: MutationCtx,
  subjectId: string,
  ownerUserId: string
) {
  const root = await ctx.db
    .query('authoredRoots')
    .withIndex('by_publicId', (query) => query.eq('id', subjectId))
    .unique()
  if (!root) throw new Error('Missing authored fixture.')
  const version = await ctx.db.get(root.currentVersionId)
  if (!version) throw new Error('Missing authored version fixture.')
  const contentSourceId = crypto.randomUUID()
  await ctx.db.insert('contentSources', {
    ...SRD_CONTENT_SOURCE,
    id: contentSourceId,
    code: contentSourceId,
    kind: 'USER',
    ownerUserId
  })
  const document = {
    ...(await deleteAuthoredVersion(ctx, version)),
    userId: ownerUserId,
    status: 'ACTIVE' as const
  }
  const checksum = checksumRuleDocument(document)
  const currentVersionId = await insertAuthoredVersion(
    ctx,
    {
      subjectKind: version.subjectKind,
      id: version.id,
      systemId: version.systemId,
      label: version.label,
      checksum,
      contentSourceId,
      versionId: version.versionId,
      version: version.version,
      documentSchemaVersion: version.documentSchemaVersion,
      compilation: version.compilation
    },
    canonicalizeRuleDocument(document)
  )
  await ctx.db.patch(root._id, {
    ownerUserId,
    contentSourceId,
    checksum,
    currentVersionId
  })
}

export async function publicationFixture(
  modules: Record<string, () => Promise<unknown>>,
  authModules: Record<string, () => Promise<unknown>>,
  subjectBatches: SourceImportSubjectDto[][]
) {
  const t = convexTest(schema, modules)
  t.registerComponent('betterAuth', authSchema, authModules)
  await t.mutation(internal.content.import.bootstrap, {
    systems: [
      {
        id: srdSystemRecord.id,
        document: jsonValueSchema.parse(JSON.parse(JSON.stringify(srdSystemRecord))),
        checksum: checksumRuleDocument(srdSystemRecord)
      }
    ],
    contentSource: SRD_CONTENT_SOURCE,
    catalogue: SRD_RULES_CATALOGUE
  })
  for (const subjects of subjectBatches)
    await t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects
    })
  const actors = []
  for (const index of [0, 1]) {
    const user = await t.run(async (ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'user',
          data: {
            name: 'Author',
            email: `publication-${index}@example.invalid`,
            emailVerified: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        },
        onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
      })
    )
    const session = await t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'session',
          data: {
            userId: user._id,
            token: crypto.randomUUID(),
            expiresAt: Date.now() + 60_000,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }
      })
    )
    const profile = await t.run((ctx) =>
      ctx.db
        .query('userProfiles')
        .withIndex('by_authUserId', (q) => q.eq('authUserId', user._id))
        .unique()
    )
    if (!profile) throw new Error('Missing profile fixture')
    actors.push({
      caller: t.withIdentity({ subject: user._id, sessionId: session._id }),
      userId: profile.userId
    })
  }
  return { t, first: actors[0]!, second: actors[1]! }
}
