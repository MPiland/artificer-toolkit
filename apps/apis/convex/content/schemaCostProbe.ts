import { v } from 'convex/values'
import { zodToConvex } from 'convex-helpers/server/zod4'
import { authoredSubjectKindSchema } from '@artificer-toolkit/schema/projections/identity'
import { internalQuery } from '../lib/queries'
import { parsePublicationDocument } from './publicationDocumentRead'

// Live-backend probe only (scripts/liveBackendSchemaProbe.ts): the first parse of each authored
// subject schema on a freshly deployed backend runs inside a query's 1 s limit, so its cost is
// measured against the real runtime instead of met by accident (PLATFORM-13.T27).
export const parseDocument = internalQuery({
  args: { subjectKind: zodToConvex(authoredSubjectKindSchema), documentJson: v.string() },
  returns: v.object({ subjectKind: v.string(), parsedBytes: v.number() }),
  handler: (_ctx, { subjectKind, documentJson }) => {
    const parsed = parsePublicationDocument(subjectKind, JSON.parse(documentJson))
    return Promise.resolve({ subjectKind, parsedBytes: JSON.stringify(parsed.document).length })
  }
})
