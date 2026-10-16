import type { LiveSessionEncounterActionPendingInput } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type {
  ActionAreaSceneRequestDto,
  ActionSceneRequestDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterRulesResponse } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { requireServerKernelRuleExecutionPendingSnapshot } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  requireAreaActionAnswer,
  requireAreaActionLegendaryResistance,
  requireAreaActionPendingRoot
} from './actionAreaPending.js'
import { writePendingSnapshot } from './pendingSnapshots.js'
import { readLiveEncounterActionAdmission } from './liveActionAdmission.js'
import { insertActionEvidenceReceipt } from './actionEvidenceReceipt.js'
import { castReactionAnswerContinues } from './actionPending.js'
import { nativeActionPendingResult } from './actionPendingResult.js'
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
      input: ActionSceneRequestDto,
      role: 'OWNER' | 'MEMBER'
    ): Promise<Extract<LiveSessionEncounterRulesResponse, { kind: 'ACTION_SCENE' }>['context']>
    readAreaSceneInputs(
      state: EncounterRunState,
      input: ActionAreaSceneRequestDto
    ): Promise<Extract<LiveSessionEncounterRulesResponse, { kind: 'ACTION_AREA_SCENE' }>['context']>
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
  const { target } = admission.input
  const actors = await readRunActors(ctx, state)
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
  let evidence:
    | Extract<typeof snapshot, { snapshotKind: 'KERNEL_EVIDENCE' }>['applicationContext']
    | null = null
  // A cast on chosen creatures never waits for anyone: it commits whole or not at all.
  if (target.kind === 'ACTORS') throw new Error('Live Session pending action root mismatch.')
  if (target.kind !== 'ACTOR') {
    if (input.command.optionalCombatIntent != null)
      throw new Error('Live Session pending action root mismatch.')
    if (resume) {
      // An area answer stores the same area with that one save answered, or that one choice decided.
      if (!resume.area) throw new Error('Live Session pending area answer mismatch.')
      if (input.response?.resolution.kind === 'AREA_LEGENDARY_RESISTANCE')
        requireAreaActionLegendaryResistance({
          stored: resume.area.snapshot,
          next: snapshot,
          actorId: resume.area.actorId
        })
      else
        requireAreaActionAnswer({
          stored: resume.area.snapshot,
          next: snapshot,
          requestId: resume.pending.snapshot.request.requestId
        })
    } else
      await requireAreaActionPendingRoot(
        {
          snapshot,
          command: { ...admission.input, target },
          fingerprint,
          initiatorUserId,
          state
        },
        callbacks.readAreaSceneInputs
      )
  } else {
    if (
      snapshot.snapshotKind !== 'KERNEL_EVIDENCE' ||
      snapshot.applicationContext.kind !== 'ENCOUNTER_ACTION' ||
      snapshot.applicationContext.initiatorUserId !== initiatorUserId ||
      (snapshot.applicationContext.rollerActorId !== admission.input.actorId &&
        snapshot.applicationContext.rollerActorId !== target.actorId &&
        // A creature offered the chance to counter the cast is the roller of that decision.
        snapshot.applicationContext.castReaction === undefined) ||
      snapshot.applicationContext.commandFingerprint !== fingerprint ||
      checksumCanonicalJson(JSON.parse(snapshot.applicationContext.commandJson)) !== fingerprint ||
      snapshot.optionalCombatSnapshotChecksum !== state.optionalCombatSnapshotChecksum ||
      snapshot.graph.source.gameSystemId !== state.gameSystemId ||
      snapshot.deferredCleaving !== undefined ||
      snapshot.applicationContext.contest !== undefined ||
      (snapshot.applicationContext.legendaryResistance !== undefined &&
        snapshot.applicationContext.legendaryResistance.resistance.targetActorId !==
          target.actorId) ||
      (snapshot.applicationContext.reactionChoice !== undefined &&
        snapshot.applicationContext.reactionChoice.reactions.some(
          ({ reactorActorId }) => reactorActorId !== target.actorId
        )) ||
      (resume &&
        (snapshot.occurrenceId !== resume.occurrence.id ||
          snapshot.applicationContext.currentnessChecksum !==
            resume.pending.context.currentnessChecksum ||
          !castReactionAnswerContinues(
            resume.pending.context,
            input.response,
            snapshot.applicationContext
          ))) ||
      input.command.optionalCombatIntent != null
    )
      throw new Error('Live Session pending action root mismatch.')
    evidence = snapshot.applicationContext
    const { castReaction } = evidence
    if (
      castReaction &&
      !castReaction.reactions.every((reaction) =>
        actors.some(
          (actor) =>
            actor.id === reaction.reactorActorId &&
            actor.id !== admission.input.actorId &&
            actor.kind === 'CHARACTER' &&
            actor.sourceId === reaction.characterId
        )
      )
    )
      throw new Error('Live Session pending cast reaction mismatch.')
    if (!actors.some((actor) => actor.id === target.actorId))
      throw new Error('Encounter action target was not found.')
    await callbacks.readActionSceneInputs(
      state,
      {
        actorId: admission.input.actorId,
        targetActorId: target.actorId,
        sceneContext: admission.input.sceneContext
      },
      membership.role === 'OWNER' ? 'OWNER' : 'MEMBER'
    )
  }
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
      answeredRequestId: resume.pending.snapshot.request.requestId,
      result: {
        status: 'PAUSED',
        occurrenceId: occurrence.id,
        occurrenceVersion: occurrence.version,
        // An area answer's receipt names the request it answered; the area keeps no single next one.
        request: resume.area
          ? resume.pending.snapshot.request
          : requireServerKernelRuleExecutionPendingSnapshot(snapshot).request,
        ...(evidence?.d20Policy
          ? {
              pending: {
                kind: 'D20_EVIDENCE',
                // The receipt is a recipient-visible record, so it keeps what the roller was shown.
                rollMode: evidence.heldD20
                  ? 'NORMAL'
                  : (evidence.d20Belief ?? evidence.d20Policy).rollMode
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
