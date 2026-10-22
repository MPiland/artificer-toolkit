import type { LiveSessionEncounterTurnPendingInput } from '@artificer-toolkit/schema/api/liveSessionEncounterTurn'
import type {
  EncounterRunState,
  EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounterData'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { projectEncounterInitiativePendingSummary } from '@artificer-toolkit/rules-runtime/encounterInitiativeOccurrence'
import { projectNativeTurnPending } from '@artificer-toolkit/rules-runtime/encounterTurnPending'
import { validateInitiativeCursor } from '@artificer-toolkit/rules-runtime/encounterInitiativeCursor'
import { isSettledEncounterInitiativeAdvance } from '@artificer-toolkit/rules-runtime/encounterInitiativeStateSettlement'
import { skippedEncounterActorIds } from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { changedFields, readRunActors } from './documents.js'
import { readDeadCharacterIds } from './characterStates.js'
import { readEncounterGmProjection } from './nativeProjection.js'
import { readEncounterInitiativeRound } from './initiativeStore.js'
import { writePendingSnapshot } from './pendingSnapshots.js'
import { readNativeTurnSettlement } from './turnSettlement.js'
import { presentEncounterResultForMember } from './resultPresentation.js'
import { readLiveEncounterTurnAdmission } from './turnCommandAdmission.js'
import type { EncounterPersistenceTransaction } from './ports.js'

/** Stores one DO-prepared pending turn without advancing the Run or Character state. */
export async function persistEncounterTurnPending(
  ctx: EncounterPersistenceTransaction,
  input: LiveSessionEncounterTurnPendingInput,
  validateReadFence: (
    state: EncounterRunState,
    actors: readonly EncounterRunActorState[],
    input: LiveSessionEncounterTurnPendingInput
  ) => Promise<void>
): Promise<EncounterCommandResultDto> {
  const admission = await readLiveEncounterTurnAdmission(ctx, input, input.command)
  if (admission.kind !== 'READY')
    return presentEncounterResultForMember(ctx, {
      campaign: admission.campaign,
      membership: admission.membership,
      result: admission.result
    })
  const { state, row, campaign, membership, fingerprint, resume } = admission
  const occurrenceVersion = admission.pending ? admission.pending.occurrence.version + 1 : 0
  const { snapshot } = input
  const context = snapshot.applicationContext
  if (
    context.kind !== 'ENCOUNTER_INITIATIVE' &&
    context.kind !== 'ENCOUNTER_INITIATIVE_DECLARATION' &&
    context.kind !== 'ENCOUNTER_TURN_RECHARGE' &&
    context.kind !== 'ENCOUNTER_TURN_DEATH_SAVE' &&
    context.kind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS' &&
    context.kind !== 'ENCOUNTER_TURN_ZONE_EFFECTS' &&
    context.kind !== 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE' &&
    context.kind !== 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE'
  )
    throw new Error('Live Session pending turn kind is unavailable.')
  const root = context.root
  if (
    root.commandType !== (resume?.root.commandType ?? admission.input.type) ||
    root.rootCommandId !== (resume?.root.rootCommandId ?? admission.input.commandId) ||
    root.commandFingerprint !== (resume?.root.commandFingerprint ?? fingerprint) ||
    root.initiatorUserId !== campaign.ownerUserId ||
    root.requestedByUserId !== (resume?.root.requestedByUserId ?? input.expectedUserId) ||
    root.expectedEncounterVersion !== state.version ||
    root.startSystemId !==
      (resume?.root.startSystemId ??
        (admission.input.type === 'START' ? (admission.input.systemId ?? null) : null)) ||
    checksumCanonicalJson(root.resolutionCommands) !==
      checksumCanonicalJson(resume?.root.resolutionCommands ?? []) ||
    (admission.pending !== null && snapshot.occurrenceId !== admission.pending.occurrence.id) ||
    (snapshot.snapshotKind === 'KERNEL_EVIDENCE' &&
      (snapshot.graph.source.gameSystemId !== state.gameSystemId ||
        (snapshot.optionalCombatSnapshotChecksum !== undefined &&
          snapshot.optionalCombatSnapshotChecksum !== state.optionalCombatSnapshotChecksum)))
  )
    throw new Error('Live Session pending turn root mismatch.')
  const actors = await readRunActors(ctx, state)
  if (root.commandType === 'START') {
    if (
      context.kind === 'ENCOUNTER_INITIATIVE' ||
      context.kind === 'ENCOUNTER_INITIATIVE_DECLARATION'
    ) {
      const initial = context.root
      if (
        initial.round !== 1 ||
        initial.policySnapshotChecksum !== state.initiativePolicySnapshotChecksum ||
        initial.initiativeBeforePin.kind !== 'INITIAL_START' ||
        checksumCanonicalJson([...initial.initiativeBeforePin.actorIds].sort()) !==
          checksumCanonicalJson([...state.actorIds].sort()) ||
        initial.initiativeAdvance ||
        initial.outgoingTurn ||
        initial.completedLegendaryActions?.length ||
        initial.stagedInitiativeRoundState.round.encounterId !== state.id ||
        initial.stagedInitiativeRoundState.round.round !== 1 ||
        initial.stagedInitiativeRoundState.round.policySnapshotChecksum !==
          initial.policySnapshotChecksum ||
        checksumCanonicalJson(
          initial.stagedInitiativeRoundState.participants.map((actor) => actor.actorId).sort()
        ) !== checksumCanonicalJson([...state.actorIds].sort()) ||
        initial.stagedInitiativeRoundState.participants.some(
          (participant) =>
            actors.find((actor) => actor.id === participant.actorId)?.sideId !== participant.sideId
        )
      )
        throw new Error('Live Session initial initiative root is stale.')
    } else {
      await readNativeTurnSettlement({
        ctx,
        encounter: row,
        state,
        campaign,
        root: context.root
      })
    }
  } else {
    const normalized = await readEncounterInitiativeRound(ctx, {
      encounterId: state.id,
      round: state.round
    })
    if (
      !normalized ||
      state.currentActorId === null ||
      normalized.round.policySnapshotChecksum !==
        (state.automationMode === 'MANUAL' ? null : state.initiativePolicySnapshotChecksum)
    )
      throw new Error('Live Session pending initiative is stale.')
    validateInitiativeCursor({
      state: normalized,
      currentActorId: state.currentActorId,
      actorIds: state.actorIds,
      allowedSideIds: state.sides.map((side) => side.id)
    })
    const advance = root.initiativeAdvance
    // The room may also skip actors its turn transition defeats; the commit checks them (D63).
    if (
      !advance ||
      !isSettledEncounterInitiativeAdvance({
        state: normalized,
        currentActorId: state.currentActorId,
        defeatedActorIds: skippedEncounterActorIds(actors, await readDeadCharacterIds(ctx, actors)),
        plan: advance
      })
    )
      throw new Error('Live Session pending initiative advance is stale.')
    if (
      context.kind === 'ENCOUNTER_INITIATIVE' ||
      context.kind === 'ENCOUNTER_INITIATIVE_DECLARATION'
    ) {
      if (
        advance.kind !== 'ROUND_WRAP' ||
        advance.cadence !== 'EACH_ROUND' ||
        context.root.round !== advance.nextRound ||
        context.root.policySnapshotChecksum !== state.initiativePolicySnapshotChecksum
      )
        throw new Error('Live Session pending initiative root is stale.')
    } else {
      const expectedActor =
        advance.kind === 'SAME_ROUND'
          ? advance.nextActorId
          : advance.cadence === 'EACH_ROUND' && context.root.initiative
            ? context.root.stagedInitiative?.stagedRoundState.participants.find(
                (participant) => participant.status === 'ACTIVE'
              )?.actorId
            : advance.firstActorId
      if (
        context.root.proposedTerminalTransition.status !== 'ACTIVE' ||
        context.root.proposedTerminalTransition.currentActorId !== expectedActor ||
        context.root.proposedTerminalTransition.round !==
          (advance.kind === 'SAME_ROUND' ? state.round : advance.nextRound)
      )
        throw new Error('Live Session pending turn transition is stale.')
    }
  }
  await validateReadFence(state, actors, input)
  const collision = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', snapshot.occurrenceId))
    .unique()
  if (collision && collision._id !== admission.pending?.occurrence._id)
    throw new Error('Encounter rule occurrence ID was already used.')
  const updatedAt = new Date().toISOString()
  const record = encounterStoredRuleOccurrenceSchema.parse({
    id: snapshot.occurrenceId,
    campaignId: campaign.id,
    encounterId: row.id,
    rootCommandId: root.rootCommandId,
    state: 'PENDING',
    version: occurrenceVersion,
    expectedEncounterVersion: state.version,
    pendingSnapshotChecksum: await writePendingSnapshot(
      ctx,
      { id: snapshot.occurrenceId, encounterId: row.id },
      snapshot
    ),
    completedAt: null,
    createdAt: admission.pending?.occurrence.createdAt ?? updatedAt,
    updatedAt
  })
  if (admission.pending)
    await ctx.db.patch(
      admission.pending.occurrence._id,
      changedFields(admission.pending.occurrence, record)
    )
  else await ctx.db.insert('encounterRuleOccurrences', record)
  const turnPending =
    context.kind === 'ENCOUNTER_TURN_RECHARGE' ||
    context.kind === 'ENCOUNTER_TURN_DEATH_SAVE' ||
    context.kind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS' ||
    context.kind === 'ENCOUNTER_TURN_ZONE_EFFECTS' ||
    context.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE' ||
    context.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE'
  const result = encounterCommandResultDtoSchema.parse({
    projection: await readEncounterGmProjection(ctx, state),
    roll: null,
    occurrence: {
      occurrenceId: snapshot.occurrenceId,
      occurrenceVersion,
      status: 'PENDING',
      pending: turnPending
        ? projectNativeTurnPending({
            gameSystemId: state.gameSystemId,
            snapshot,
            occurrenceId: snapshot.occurrenceId,
            occurrenceVersion,
            encounterVersion: state.version
          })
        : projectEncounterInitiativePendingSummary({
            pendingSnapshot: snapshot,
            occurrenceVersion,
            encounterVersion: state.version
          })
    }
  })
  return presentEncounterResultForMember(ctx, {
    campaign,
    membership,
    result
  })
}
