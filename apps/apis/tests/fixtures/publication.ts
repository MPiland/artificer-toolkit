import { createFunctionHandle } from 'convex/server'
import { convexTest } from '../convexTest'
import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import type { SourceImportSubjectDto } from '@artificer-toolkit/schema/api/sourceImport'
import type { AuthoredStoredCompilation } from '@artificer-toolkit/schema/api/authoredPublication'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { components, internal } from '../../convex/_generated/api'
import type { Doc } from '../../convex/_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../convex/_generated/server'
import authSchema from '../../convex/betterAuth/schema'
import {
  deleteAuthoredVersion,
  insertAuthoredVersion,
  insertAuthoredVersionCompilation,
  readAuthoredVersionCompilation,
  readAuthoredVersionCompilationRow
} from '../../convex/content/documents'
import { compilePublicationDocument, parsePublicationDocument } from '../../convex/content/publicationDocument'
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

/** The seed's derived-data step for an imported Class: parent link and stored compilation. */
export function classDerivedArgs(subject: { id: string; checksum: string; document: unknown }) {
  const parsed = parsePublicationDocument('CLASS', subject.document)
  return {
    id: subject.id,
    checksum: subject.checksum,
    parentClassId: parsed.document.category === 'SUBCLASS' ? parsed.document.parentClassId : null,
    compilation: compilePublicationDocument(parsed)
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
  const compilation = await readAuthoredVersionCompilation(ctx, version)
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
      documentSchemaVersion: version.documentSchemaVersion
    },
    canonicalizeRuleDocument(document),
    compilation
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
  registerRateLimiter(t)
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
            // Long enough that a slow serial suite run never outlives the session mid-test.
            expiresAt: Date.now() + 60 * 60_000,
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

/** A stored version with its separately stored compilation attached, for assertions. */
export async function versionWithCompilation<Version extends Doc<'authoredVersions'> | null>(
  ctx: QueryCtx,
  version: Version
) {
  if (!version) return version as Extract<Version, null>
  return { ...version, compilation: await readAuthoredVersionCompilation(ctx, version) }
}

/** Replaces (or, with undefined, removes) a version's separately stored compilation. */
export async function setVersionCompilation(
  ctx: MutationCtx,
  version: Doc<'authoredVersions'>,
  compilation: AuthoredStoredCompilation | undefined
) {
  const stored = await readAuthoredVersionCompilationRow(ctx, version)
  if (stored) await ctx.db.delete(stored._id)
  if (compilation) await insertAuthoredVersionCompilation(ctx, version, compilation)
}
