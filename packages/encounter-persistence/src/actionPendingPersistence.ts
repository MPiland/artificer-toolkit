import type { LiveSessionEncounterActionPendingInput } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { LiveSessionEncounterRulesResponse } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { writePendingSnapshot } from './pendingSnapshots.js'
import { readLiveEncounterActionAdmission } from './liveActionAdmission.js'
import { insertActionEvidenceReceipt } from './actionEvidenceReceipt.js'
import { nativeActionPendingResult } from './actionPending.js'
import { changedFields, readRunActors } from './documents.js'
import { presentEncounterResultForMember } from './resultPresentation.js'
import type { readEncounterMaintenanceCapture } from './maintenanceCapture.js'
import type { EncounterPersistenceTransaction } from './ports.js'

/** Stores the admitted pending root with its native evidence receipt in the owning transaction. */
export async function persistEncounterActionPending(
  ctx: EncounterPersistenceTransaction,
  input: LiveSessionEncounterActionPendingInput,
  callbacks: {
    readMaintenanceCapture(
      state: EncounterRunState,
      request: LiveSessionEncounterActionPendingInput['maintenanceOwners'][number]
    ): ReturnType<typeof readEncounterMaintenanceCapture>
    readActionSceneInputs(
      state: EncounterRunState,
      input: Pick<ResolveEncounterActionInputDto, 'actorId' | 'targetActorId' | 'sceneContext'>,
      role: 'OWNER' | 'MEMBER'
    ): Promise<Extract<LiveSessionEncounterRulesResponse, { kind: 'ACTION_SCENE' }>['context']>
    validateReadFence(
      state: EncounterRunState,
      characterIds: readonly string[],
      revisions: LiveSessionRulesRevisions
    ): Promise<void>
  }
): Promise<EncounterCommandResultDto> {
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
    await callbacks.readMaintenanceCapture(state, request)
    if (request.owner.kind === 'CHARACTER') characterIds.add(request.owner.characterId)
  }
  await callbacks.readActionSceneInputs(
    state,
    admission.input,
    membership.role === 'OWNER' ? 'OWNER' : 'MEMBER'
  )
  await callbacks.validateReadFence(state, [...characterIds], input.revisions)
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
    pendingSnapshotChecksum: await writePendingSnapshot(
      ctx,
      { id: snapshot.occurrenceId, encounterId: run.id },
      snapshot
    ),
    completedAt: null,
    createdAt: resume?.occurrence.createdAt ?? updatedAt,
    updatedAt
  })
  const id = resume?.occurrence._id ?? (await ctx.db.insert('encounterRuleOccurrences', value))
  if (resume) await ctx.db.patch(id, changedFields(resume.occurrence, value))
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
                // The receipt is a recipient-visible record, so it keeps what the roller was shown.
                rollMode: snapshot.applicationContext.heldD20
                  ? 'NORMAL'
                  : (snapshot.applicationContext.d20Belief ?? snapshot.applicationContext.d20Policy)
                      .rollMode
              }
            }
          : {})
      }
    })
  return presentEncounterResultForMember(ctx, {
    campaign,
    membership,
    result: await nativeActionPendingResult(ctx, run, occurrence)
  })
}
