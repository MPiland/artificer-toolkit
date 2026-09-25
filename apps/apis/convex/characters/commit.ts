import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  characterBuilderResolveInputSchema,
  characterBuilderCommitOutputSchema,
  type CharacterBuilderCommitOutput
} from '@artificer-toolkit/schema/api/characterBuilderQueries'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { syncAccountUsage } from '../lib/accountUsage'
import { ensureAuthoredRouteId } from '../content/routeIds'
import { deleteCharacterDraftPayload, loadCharacterDraftCandidate } from './documents'
import { retainCharacterEquipmentRules } from './acquiredEquipment'
import { prepareCharacterBuilder } from './builderPreparation'
import { writeCharacterRecord } from './characterWrites'

export const commit = mutation({
  args: zodToConvexFields(characterBuilderResolveInputSchema.shape),
  returns: zodToConvex(characterBuilderCommitOutputSchema),
  handler: async (ctx, args): Promise<CharacterBuilderCommitOutput> => {
    const { userId } = await requireIdentity(ctx)
    const input = characterBuilderResolveInputSchema.parse(args)
    const { character, current, draftRecord, activeRecord } = await loadCharacterDraftCandidate(
      ctx,
      userId,
      input
    )
    if (draftRecord.baseActiveUpdatedAt !== (activeRecord?.updatedAt ?? null)) {
      throw new Error('Character changed since this draft opened; reopen it before committing.')
    }
    const prepared = await prepareCharacterBuilder(ctx, {
      character: character as CharacterAuthored,
      current: current as CharacterAuthored | null,
      mode: input.mode,
      finalize: true
    })
    if (!prepared.resolution.readiness.ready) {
      throw new Error(
        'Character is not ready to activate. Resolve the Builder blockers before committing.'
      )
    }
    const committed = characterAuthoredDtoSchema.parse({
      ...prepared.character,
      state: await retainCharacterEquipmentRules(ctx, prepared.character),
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
      document: encoded
    })
    await deleteCharacterDraftPayload(ctx, draftRecord)
    await ctx.db.delete(draftRecord._id)
    await syncAccountUsage(ctx, 'personalCharacters', committed.id)
    return characterBuilderCommitOutputSchema.parse({
      character: encoded,
      publicId,
      streamVersion
    })
  }
})
