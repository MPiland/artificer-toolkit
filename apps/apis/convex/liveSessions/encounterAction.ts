import { v } from 'convex/values'
import { liveSessionEncounterActionPendingInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import { type EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { internalMutation } from '../lib/mutations'
import { readLiveEncounterActionAdmission } from './encounterActionAdmission'
import { insertActionEvidenceReceipt } from '../encounters/actionEvidenceReceipt'
import { nativeActionPendingResult } from '../encounters/actionPending'
import { readNativeActionSceneInputs } from '../encounters/actionSceneInputs'
import { readRunActors } from '@artificer-toolkit/encounter-persistence/documents'
import { readEncounterMaintenanceCapture } from './encounterMaintenanceCapture'
import { presentEncounterResultForMember } from '../encounters/resultPresentation'
import { assertLiveSessionRulesRevisions } from './rulesRevisions'

/** Stores only the Worker-computed pending root; terminal mechanics remain a separate transaction. */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const commitPending = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<EncounterCommandResultDto> => {
    const input = liveSessionEncounterActionPendingInputSchema.parse(args)
    const admission = await readLiveEncounterActionAdmission(ctx, input)
    const userId = input.expectedUserId
    const { state, run, fingerprint, campaign, membership } = admission
    if (state.campaignId !== input.campaignId)
      throw new Error('Live Session Encounter scope mismatch.')
    // A lost response must return the stored outcome before checking inputs consumed by that write.
    if (admission.kind === 'REPLAY')
      return presentEncounterResultForMember(ctx, {
        campaign,
        membership,
        result: admission.result
      })
    const { resume, initiatorUserId } = admission
    const { snapshot } = input
    if (
      snapshot.snapshotKind !== 'KERNEL_EVIDENCE' ||
      snapshot.applicationContext.kind !== 'ENCOUNTER_ACTION' ||
      snapshot.applicationContext.initiatorUserId !== initiatorUserId ||
      (snapshot.applicationContext.rollerActorId !== admission.input.actorId &&
        snapshot.applicationContext.rollerActorId !== admission.input.targetActorId) ||
      snapshot.applicationContext.commandFingerprint !== fingerprint ||
      checksumCanonicalJson(JSON.parse(snapshot.applicationContext.commandJson)) !== fingerprint ||
      snapshot.optionalCombatSnapshotChecksum !== state.optionalCombatSnapshotChecksum ||
      snapshot.graph.source.gameSystemId !== state.gameSystemId ||
      snapshot.deferredCleaving !== undefined ||
      snapshot.applicationContext.contest !== undefined ||
      (resume &&
        (snapshot.occurrenceId !== resume.occurrence.id ||
          snapshot.applicationContext.currentnessChecksum !==
            resume.pending.context.currentnessChecksum)) ||
      input.command.optionalCombatIntent != null
    )
      throw new Error('Live Session pending action root mismatch.')
    const actors = await readRunActors(ctx, state)
    if (!actors.some((actor) => actor.id === admission.input.targetActorId))
      throw new Error('Encounter action target was not found.')
    const characterIds = new Set(
      actors.flatMap((actor) => {
        if (actor.kind !== 'CHARACTER') return []
        return [actor.sourceId]
      })
    )
    const owners = new Set<string>()
    for (const request of input.maintenanceOwners) {
      const ownerKey = checksumCanonicalJson(request.owner)
      if (request.actorId !== admission.input.actorId || owners.has(ownerKey))
        throw new Error('Live Session maintenance owner scope mismatch.')
      owners.add(ownerKey)
      await readEncounterMaintenanceCapture(ctx, state, request)
      if (request.owner.kind === 'CHARACTER') characterIds.add(request.owner.characterId)
    }
    await readNativeActionSceneInputs(
      ctx,
      state,
      admission.input,
      membership.role === 'OWNER' ? 'OWNER' : 'MEMBER'
    )
    await assertLiveSessionRulesRevisions(ctx, input.revisions, {
      systemId: state.gameSystemId,
      campaignId: state.campaignId,
      characterIds: [...characterIds]
    })
    const collision = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_publicId', (query) => query.eq('id', snapshot.occurrenceId))
      .unique()
    if (collision && collision._id !== resume?.occurrence._id)
      throw new Error('Encounter rule occurrence ID was already used.')
    const updatedAt = new Date().toISOString()
    const value = encounterStoredRuleOccurrenceSchema.parse({
      id: snapshot.occurrenceId,
      campaignId: campaign.id,
      encounterId: run.id,
      rootCommandId: admission.input.commandId,
      state: 'PENDING',
      version: resume ? resume.occurrence.version + 1 : 0,
      expectedEncounterVersion: state.version,
      pendingSnapshotJson: JSON.stringify(snapshot),
      pendingSnapshotChecksum: checksumCanonicalJson(snapshot),
      completedAt: null,
      createdAt: resume?.occurrence.createdAt ?? updatedAt,
      updatedAt
    })
    const id = resume?.occurrence._id ?? (await ctx.db.insert('encounterRuleOccurrences', value))
    if (resume) await ctx.db.patch(id, value)
    const occurrence = await ctx.db.get(id)
    if (!occurrence) throw new Error('The pending action was not stored.')
    if (resume && input.response)
      await insertActionEvidenceReceipt(ctx, {
        occurrence,
        response: input.response,
        rootCommand: admission.input,
        rootFingerprint: fingerprint,
        userId,
        rootInitiatorUserId: initiatorUserId,
        result: {
          status: 'PAUSED',
          occurrenceId: occurrence.id,
          occurrenceVersion: occurrence.version,
          request: snapshot.request,
          ...(snapshot.applicationContext.d20Policy
            ? {
                pending: {
                  kind: 'D20_EVIDENCE',
                  rollMode: snapshot.applicationContext.d20Policy.rollMode
                }
              }
            : {})
        }
      })
    return presentEncounterResultForMember(ctx, {
      campaign,
      membership,
      result: nativeActionPendingResult(run, occurrence)
    })
  }
})
