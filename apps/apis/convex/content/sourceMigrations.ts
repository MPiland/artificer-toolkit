import { Migrations } from '@convex-dev/migrations'
import { authoredSourceFacts } from '@artificer-toolkit/authoring/nodeRuntime/authoredSourceFacts'
import { AUTHORED_SOURCE_FACTS_VERSION } from '@artificer-toolkit/schema/api/nodeRuntimeSources'
import { authoredDocumentVersionSchema } from '@artificer-toolkit/schema/projections/authoredContent'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { components } from '../_generated/api'
import schema from '../schema'
import { canReadAuthoredRoot, readAuthoredVersion, readPublishedDocument } from './documents'
import { internalMutation } from '../lib/mutations'
import { readStoredSourceFacts, writeSourceFacts } from './sourceFacts'

const migrations = new Migrations(components.migrations, { schema, internalMutation })

export const backfillAuthoringSources = migrations.define({
  table: 'authoredRoots',
  // One authored document can contain an entire Class progression.
  batchSize: 1,
  customRange: (query) => query.withIndex('by_publicId'),
  migrateOne: async (ctx, root) => {
    if (!(await canReadAuthoredRoot(ctx, root, root.ownerUserId ?? null)))
      throw new Error('Stored authored content ownership mismatch.')
    const version = await readAuthoredVersion(ctx, root)
    const parsed = authoredDocumentVersionSchema.parse({
      subjectKind: version.subjectKind,
      subjectId: version.id,
      versionId: version.versionId,
      version: version.version,
      documentSchemaVersion: version.documentSchemaVersion,
      checksum: version.checksum,
      document: await readPublishedDocument(ctx, root, version)
    })
    if (checksumRuleDocument(parsed.document) !== root.checksum)
      throw new Error('Stored authored content is not schema-normalized.')
    const authoringSources = authoredSourceFacts(parsed)
    // Facts from an older derivation are re-derived; same-version facts that differ conflict.
    const stored = await readStoredSourceFacts(ctx, root)
    if (stored?.factsVersion === AUTHORED_SOURCE_FACTS_VERSION) {
      if (checksumRuleDocument(stored) !== checksumRuleDocument(authoringSources))
        throw new Error('Stored authoring source facts conflict.')
      return
    }
    await writeSourceFacts(ctx, root.id, authoringSources)
  }
})
