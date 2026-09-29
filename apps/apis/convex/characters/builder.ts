import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { v, type Validator } from 'convex/values'
import {
  characterDraftLookupInputSchema,
  type CharacterDraftLookupInput
} from '@artificer-toolkit/schema/api/characterDrafts'
import {
  characterAuthoredDtoSchema,
  type CharacterAuthoredDto
} from '@artificer-toolkit/schema/subjects/character'
import type { QueryCtx } from '../_generated/server'
import { query } from '../lib/queries'
import { requireIdentity } from '../lib/identity'
import { readVisibleAuthoredRouteId } from '../content/routeIds'
import { readCharacterRecord, resolveCharacterId } from './documents'
import { readCharacterRow } from './stateDocuments'

/**
 * The caller's active Character: the Builder route's first payload beside `drafts.get`, and the
 * previous Character the browser Builder evaluates an edit draft against (ADR 0036 S6, S9). Null for
 * a draft-only or foreign Character. It never reads the draft, so an autosave does not re-run this
 * subscription (S8).
 */
export const activeCharacter = query({
  args: zodToConvexFields(characterDraftLookupInputSchema.shape),
  get returns(): Validator<CharacterAuthoredDto | null, 'required', string> {
    return v.union(v.null(), zodToConvex(characterAuthoredDtoSchema))
  },
  handler: (ctx, args) => readActiveCharacter(ctx, characterDraftLookupInputSchema.parse(args))
})

export async function readActiveCharacter(
  ctx: QueryCtx,
  input: CharacterDraftLookupInput
): Promise<CharacterAuthoredDto | null> {
  const { userId } = await requireIdentity(ctx)
  const id = await resolveCharacterId(ctx, input.id)
  if (!id) return null
  const active = await readCharacterRow(ctx, id)
  if (!active || active.userId !== userId) return null
  const route = await readVisibleAuthoredRouteId(ctx, { subjectId: id })
  if (!route || route.subjectKind !== 'CHARACTER' || route.ownerUserId !== userId)
    throw new Error('Stored Character route identity mismatch.')
  return readCharacterRecord(active)
}
