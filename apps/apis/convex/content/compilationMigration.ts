import { Migrations } from '@convex-dev/migrations'
import { SUBJECT_COMPILER_VERSION } from '@artificer-toolkit/schema/api/authoredPublication'
import { components, internal } from '../_generated/api'
import schema from '../schema'
import { internalMutation } from '../lib/mutations'
import { readStoredAuthoredVersionDocument } from './documents'
import { compileCurrentEquipment } from './equipmentRelationships'
import { compilePublicationDocument, parsePublicationDocument } from './publicationDocument'
import { compileCurrentRace } from './raceRelationships'

/**
 * PLATFORM-21.T1a: a stored compilation from a superseded compiler is recompiled from its version's
 * stored document, so evaluation can read every row at `SUBJECT_COMPILER_VERSION`. Equipment and
 * Race compile against their current parents, as publication does. Idempotent: current rows are
 * left alone.
 */
const migrations = new Migrations(components.migrations, { schema, internalMutation })

// A compilation can approach the document size limit.
export const recompileStaleCompilations = migrations.define({
  table: 'authoredVersionCompilations',
  batchSize: 1,
  migrateOne: async (ctx, row) => {
    if (row.compilation.compilerVersion === SUBJECT_COMPILER_VERSION) return undefined
    const version = await ctx.db
      .query('authoredVersions')
      .withIndex('by_versionId', (query) => query.eq('versionId', row.versionId))
      .unique()
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (query) => query.eq('id', row.subjectId))
      .unique()
    if (!version || !root) throw new Error('Stored compilation has no authored version.')
    const subject = parsePublicationDocument(
      version.subjectKind,
      await readStoredAuthoredVersionDocument(ctx, version)
    )
    const userId = root.ownerUserId ?? null
    const compilation =
      subject.subjectKind === 'EQUIPMENT'
        ? (await compileCurrentEquipment(ctx, subject.document, userId)).compilation
        : subject.subjectKind === 'RACE'
          ? (await compileCurrentRace(ctx, subject.document, userId)).compilation
          : compilePublicationDocument(subject)
    return { compilation }
  }
})

export const run = migrations.runner([
  internal.content.compilationMigration.recompileStaleCompilations
])
