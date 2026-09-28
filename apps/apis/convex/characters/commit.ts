import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  characterBuilderCommitInputSchema,
  characterBuilderCommitOutputSchema,
  type CharacterBuilderCommitInput,
  type CharacterBuilderCommitOutput
} from '@artificer-toolkit/schema/api/characterBuilderQueries'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { MutationCtx } from '../_generated/server'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { syncAccountUsage } from '../lib/accountUsage'
import { ensureAuthoredRouteId } from '../content/routeIds'
import { deleteCharacterDraftPayload, loadCharacterDraftCandidate } from './documents'
import { retainCharacterEquipmentRules } from './acquiredEquipment'
import { prepareCharacterBuilder } from './builderPreparation'
import { writeCharacterRecord } from './characterWrites'
import type { CharacterReferencedReads } from './context'

export const commit = mutation({
  args: zodToConvexFields(characterBuilderCommitInputSchema.shape),
  returns: zodToConvex(characterBuilderCommitOutputSchema),
  handler: (ctx, args) => commitCharacter(ctx, characterBuilderCommitInputSchema.parse(args))
})

/** Validates the draft against referenced content only (ADR 0036 S7) and activates it. */
export async function commitCharacter(
  ctx: MutationCtx,
  input: CharacterBuilderCommitInput
): Promise<CharacterBuilderCommitOutput> {
  const { userId } = await requireIdentity(ctx)
  const featureSourceHints = new Map(
    (input.featureSourceHints ?? []).map((hint) => [hint.featureId, hint.rootId])
  )
  if (featureSourceHints.size !== (input.featureSourceHints?.length ?? 0))
    throw new Error('Feature source hints must name each feature once.')
  const { character, current, draftRecord, activeRecord } = await loadCharacterDraftCandidate(
    ctx,
    userId,
    input
  )
  if (draftRecord.baseActiveUpdatedAt !== (activeRecord?.updatedAt ?? null)) {
    throw new Error('Character changed since this draft opened; reopen it before committing.')
  }
  const reads: CharacterReferencedReads = {
    featureSourceHints,
    publications: new Map(),
    unreadableRootIds: new Set(),
    roots: new Map()
  }
  const prepared = await prepareCharacterBuilder(ctx, {
    character: character as CharacterAuthored,
    current: current as CharacterAuthored | null,
    mode: input.mode,
    finalize: true,
    referenced: reads
  })
  if (!prepared.resolution.readiness.ready) {
    throw new Error(
      'Character is not ready to activate. Resolve the Builder blockers before committing.'
    )
  }
  const committed = characterAuthoredDtoSchema.parse({
    ...prepared.character,
    state: await retainCharacterEquipmentRules(ctx, prepared.character, undefined, reads),
    status: 'ACTIVE'
  })
  const encoded: unknown = JSON.parse(JSON.stringify(committed))
  const now = new Date(
    Math.max(Date.now(), activeRecord ? Date.parse(activeRecord.updatedAt) + 1 : 0)
  ).toISOString()
  const publicId = await ensureAuthoredRouteId(ctx, 'CHARACTER', committed.id, false, userId)
  if (publicId !== draftRecord.publicId)
    throw new Error('Stored Character route identity mismatch.')
  const streamVersion = (activeRecord?.streamVersion ?? 0) + 1
  await writeCharacterRecord(ctx, {
    current: activeRecord,
    fields: {
      id: committed.id,
      userId,
      systemId: committed.systemId,
      label: committed.label,
      status: 'ACTIVE',
      streamVersion,
      createdAt: activeRecord?.createdAt ?? now,
      updatedAt: now
    },
    document: encoded,
    // The stored stats evaluate the committed Character over the context commit just read.
    sourceContext: { characterId: committed.id, ownerUserId: userId, context: prepared.context }
  })
  await deleteCharacterDraftPayload(ctx, draftRecord)
  await ctx.db.delete(draftRecord._id)
  // This mutation verified the owner and just wrote the row.
  await syncAccountUsage(ctx, 'personalCharacters', committed.id, userId)
  return characterBuilderCommitOutputSchema.parse({
    character: encoded,
    publicId,
    streamVersion
  })
}
