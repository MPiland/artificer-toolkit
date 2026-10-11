import type { FunctionArgs } from 'convex/server'
import type { AuthoredDraftResult } from '@artificer-toolkit/schema/api/authoredDrafts'
import type { api } from '../../convex/_generated/api'

/** The publish request the web editor sends for a saved Creature draft. */
export function creaturePublicationInput(
  draft: AuthoredDraftResult
): FunctionArgs<typeof api.content.publication.publishDraft> {
  if (!draft.updatedAt) throw new Error('Missing Creature draft revision')
  return {
    subjectKind: 'CREATURE',
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: draft.updatedAt
  }
}
