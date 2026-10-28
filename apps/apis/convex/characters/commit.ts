import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  characterBuilderCommitInputSchema,
  characterBuilderCommitOutputSchema,
  type CharacterBuilderCommitInput,
  type CharacterBuilderCommitOutput
} from '@artificer-toolkit/schema/api/characterBuilderQueries'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { splitCharacterStatePlay } from '@artificer-toolkit/schema/projections/characterPlayState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
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
import { readCharacterRecord } from './stateDocuments'

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
    rulePublications: new Map(),
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
  const now = new Date(
    Math.max(Date.now(), activeRecord ? Date.parse(activeRecord.updatedAt) + 1 : 0)
  ).toISOString()
  const publicId = await ensureAuthoredRouteId(ctx, 'CHARACTER', committed.id, false, userId)
  if (publicId !== draftRecord.publicId)
    throw new Error('Stored Character route identity mismatch.')
  // The play stream advances only when the commit changes play state (a new Character, or hit dice
  // reconciled to a class change), so a Builder save does not invalidate Sheet commands in flight.
  const playChanged =
    !current ||
    checksumCanonicalJson(splitCharacterStatePlay(committed.state).play) !==
      checksumCanonicalJson(splitCharacterStatePlay(current.state).play)
  const streamVersion = (activeRecord?.play.streamVersion ?? 0) + (playChanged ? 1 : 0)
  // The committed Character has no draft, and the Sheet sections its write stores say so.
  await deleteCharacterDraftPayload(ctx, draftRecord)
  await ctx.db.delete(draftRecord._id)
  const written = await writeCharacterRecord(ctx, {
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
    document: committed,
    // The stored stats evaluate the committed Character over the context commit just read.
    sourceContext: { characterId: committed.id, ownerUserId: userId, context: prepared.context }
  })
  const { maximumHitPoints } = written.row.play
  // A lower maximum takes current hit points down with it. Readers clamp anyway, but a stored value
  // above the maximum would swallow the next damage or healing. Only the play record is rewritten.
  const clampsHitPoints =
    activeRecord !== null &&
    maximumHitPoints < activeRecord.play.maximumHitPoints &&
    committed.state.hitpoints.current > maximumHitPoints
  const stored = clampsHitPoints
    ? {
        ...committed,
        state: {
          ...committed.state,
          hitpoints: { ...committed.state.hitpoints, current: maximumHitPoints }
        }
      }
    : committed
  const persisted = clampsHitPoints
    ? await writeCharacterRecord(ctx, {
        current: written.row,
        fields: { streamVersion: streamVersion + (playChanged ? 0 : 1), updatedAt: now },
        document: stored,
        // Re-evaluated over the same sources so the stored Sheet sections show the clamped value.
        sourceContext: written.facts?.sourceContext
      })
    : written
  // This mutation verified the owner and just wrote the row.
  await syncAccountUsage(ctx, 'personalCharacters', committed.id, userId)
  return characterBuilderCommitOutputSchema.parse({
    character: JSON.parse(JSON.stringify(readCharacterRecord(persisted.row))),
    publicId,
    streamVersion: persisted.row.play.streamVersion
  })
}
