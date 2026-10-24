import type { LiveSessionEncounterActionPendingInput } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import {
  actionAreaSceneRequestDtoSchema,
  type ActionAreaSceneRequestDto,
  type ActionSceneRequestDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterRulesResponse } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { requireServerKernelRuleExecutionPendingSnapshot } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { encounterAreaCaughtSettled } from '@artificer-toolkit/rules-runtime/encounterAreaPending'
import { rollModeCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformPolicyModules'
import {
  requireAreaActionAnswer,
  requireAreaActionForcedMovement,
  requireAreaActionLegendaryResistance,
  requireAreaActionPendingRoot
} from './actionAreaPending.js'
import { writePendingSnapshot } from './pendingSnapshots.js'
import { readLiveEncounterActionAdmission } from './liveActionAdmission.js'
import { insertActionEvidenceReceipt } from './actionEvidenceReceipt.js'
import { castPendingContinues } from './actionPending.js'
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
  if (target.kind !== 'ACTOR') {
    if (input.command.optionalCombatIntent != null)
      throw new Error('Live Session pending action root mismatch.')
    if (resume?.area) {
      // An area answer stores the same area with that one save answered, that one choice decided, or
      // that one push landed.
      const resolution = input.response?.resolution
      if (resolution?.kind === 'FORCED_MOVEMENT')
        requireAreaActionForcedMovement({
          stored: resume.area.snapshot,
          next: snapshot,
          requestId: resolution.requestId,
          position: resolution.position
        })
      else if (resolution?.kind === 'AREA_LEGENDARY_RESISTANCE')
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
    } else if (resume && resume.pending.context.pause?.kind !== 'CAST_REACTION')
      throw new Error('Live Session pending area answer mismatch.')
    else if (snapshot.snapshotKind === 'KERNEL_EVIDENCE') {
      // Before a multi-creature cast does anything, another Character may counter it. The pause is
      // the cast's own root, held with only the counter on offer.
      const context = snapshot.applicationContext
      if (
        context.kind !== 'ENCOUNTER_ACTION' ||
        context.pause?.kind !== 'CAST_REACTION' ||
        context.initiatorUserId !== initiatorUserId ||
        context.commandFingerprint !== fingerprint ||
        checksumCanonicalJson(JSON.parse(context.commandJson)) !== fingerprint ||
        snapshot.optionalCombatSnapshotChecksum !== state.optionalCombatSnapshotChecksum ||
        snapshot.graph.source.gameSystemId !== state.gameSystemId ||
        snapshot.deferredCleaving !== undefined ||
        context.contest !== undefined ||
        (resume &&
          (snapshot.occurrenceId !== resume.occurrence.id ||
            (context.currentnessChecksum !== resume.pending.context.currentnessChecksum &&
              resume.pending.context.pause?.kind !== 'ATTACK_RETARGET') ||
            !castPendingContinues(resume.pending.context, input.response, context)))
      )
        throw new Error('Live Session pending action root mismatch.')
      evidence = context
      const aimed = target.kind === 'ACTORS' ? target.scene : target
      if (aimed)
        await callbacks.readAreaSceneInputs(
          state,
          actionAreaSceneRequestDtoSchema.parse({
            actorId: admission.input.actorId,
            sceneId: aimed.sceneId,
            expectedSceneVersion: aimed.expectedSceneVersion
          })
        )
    } else {
      // The cast went through its pause; the area it opens continues the same occurrence, carrying
      // the counters that failed against it.
      const area = await requireAreaActionPendingRoot(
        {
          snapshot,
          command: { ...admission.input, target },
          fingerprint,
          initiatorUserId,
          state
        },
        callbacks.readAreaSceneInputs
      )
      const failedCounters = area.failedCounters ?? []
      // An area whose saves all settled as it opened may hold its first push pick or the saves of the
      // creatures its movers struck, nothing picked.
      const opened = area.forcedMovement
      if (
        (opened &&
          (opened.landed.length > 0 ||
            snapshot.snapshotKind !== 'AGGREGATE_CHOICE' ||
            !encounterAreaCaughtSettled(snapshot))) ||
        (resume
          ? snapshot.occurrenceId !== resume.occurrence.id ||
            !castPendingContinues(resume.pending.context, input.response, { failedCounters })
          : failedCounters.length > 0)
      )
        throw new Error('Live Session pending area action root mismatch.')
    }
  } else {
    const pause =
      snapshot.snapshotKind === 'KERNEL_EVIDENCE' &&
      snapshot.applicationContext.kind === 'ENCOUNTER_ACTION'
        ? snapshot.applicationContext.pause
        : null
    if (
      snapshot.snapshotKind !== 'KERNEL_EVIDENCE' ||
      snapshot.applicationContext.kind !== 'ENCOUNTER_ACTION' ||
      snapshot.applicationContext.initiatorUserId !== initiatorUserId ||
      (snapshot.applicationContext.rollerActorId !== admission.input.actorId &&
        snapshot.applicationContext.rollerActorId !== target.actorId &&
        // A creature offered the chance to counter the cast is the roller of that decision.
        pause?.kind !== 'CAST_REACTION') ||
      // The save a ward owes is asked of the one who attacks it.
      (pause?.kind === 'INCOMING_GATE' &&
        (pause.payload.holderActorId !== target.actorId ||
          snapshot.applicationContext.rollerActorId !== admission.input.actorId)) ||
      snapshot.applicationContext.commandFingerprint !== fingerprint ||
      checksumCanonicalJson(JSON.parse(snapshot.applicationContext.commandJson)) !== fingerprint ||
      snapshot.optionalCombatSnapshotChecksum !== state.optionalCombatSnapshotChecksum ||
      snapshot.graph.source.gameSystemId !== state.gameSystemId ||
      snapshot.deferredCleaving !== undefined ||
      snapshot.applicationContext.contest !== undefined ||
      (pause?.kind === 'LEGENDARY_RESISTANCE' &&
        pause.payload.resistance.targetActorId !== target.actorId) ||
      (pause?.kind === 'REACTION' &&
        pause.payload.reactions.some(({ reactorActorId }) => reactorActorId !== target.actorId)) ||
      ((pause?.kind === 'ON_HIT' || pause?.kind === 'FORCED_MOVEMENT') &&
        snapshot.applicationContext.rollerActorId !== admission.input.actorId) ||
      (resume &&
        (snapshot.occurrenceId !== resume.occurrence.id ||
          // A retarget answer turns the action on another creature, so its facts are the new creature's.
          (snapshot.applicationContext.currentnessChecksum !==
            resume.pending.context.currentnessChecksum &&
            resume.pending.context.pause?.kind !== 'ATTACK_RETARGET') ||
          !castPendingContinues(
            resume.pending.context,
            input.response,
            snapshot.applicationContext
          ))) ||
      input.command.optionalCombatIntent != null
    )
      throw new Error('Live Session pending action root mismatch.')
    evidence = snapshot.applicationContext
    if (!actors.some((actor) => actor.id === target.actorId))
      throw new Error('Encounter action target was not found.')
    await callbacks.readActionSceneInputs(
      state,
      {
        actorId: admission.input.actorId,
        targetActorId: target.actorId,
        sceneContext: admission.input.sceneContext,
        actionId: admission.input.actionId
      },
      membership.role === 'OWNER' ? 'OWNER' : 'MEMBER'
    )
  }
  const castReaction = evidence?.pause?.kind === 'CAST_REACTION' ? evidence.pause.payload : null
  if (
    castReaction &&
    !castReaction.reactions.every((reaction) =>
      actors.some(
        (actor) =>
          actor.id === reaction.reactorActorId &&
          // The caster may counter a counter to its spell, never its own cast (D127).
          (actor.id !== admission.input.actorId || castReaction.chain !== undefined) &&
          actor.kind === 'CHARACTER' &&
          actor.sourceId === reaction.characterId
      )
    )
  )
    throw new Error('Live Session pending cast reaction mismatch.')
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
  // A counter's check pause rolls the reactor's own d20, and a ward's the attacker's save: neither is the
  // action's own policy.
  const d20Policy =
    evidence?.d20Policy ??
    castReaction?.check?.d20 ??
    (evidence?.pause?.kind === 'INCOMING_GATE' ? evidence.pause.payload.d20 : undefined)
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
        request: evidence
          ? requireServerKernelRuleExecutionPendingSnapshot(snapshot).request
          : resume.pending.snapshot.request,
        ...(d20Policy
          ? {
              pending: {
                kind: 'D20_EVIDENCE',
                // The receipt is a recipient-visible record, so it keeps what the roller was shown.
                ...(evidence?.heldD20
                  ? {
                      rollMode: 'NORMAL',
                      keep: rollModeCapabilityRegistry.rollModeKeep({
                        gameSystemId: state.gameSystemId,
                        rollMode: 'NORMAL'
                      })
                    }
                  : {
                      rollMode: (evidence?.d20Belief ?? d20Policy).rollMode,
                      keep: (evidence?.d20Belief ?? d20Policy).keep
                    })
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
