import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounterData'
import type {
  LiveSessionEncounterDisarmCommitInput,
  LiveSessionEncounterDisarmPendingInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterDisarm'
import {
  actionTargetActorId,
  type ActionSceneRequestDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterRulesResponse } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import {
  encounterRunStateSchema,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterStoredRuleOccurrenceSchema,
  encounterStoredRuleReceiptSchema,
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { deleteConsumedGrants } from './consumedGrantPersistence.js'
import { writePendingSnapshot } from './pendingSnapshots.js'
import { insertActionEvidenceReceipt } from './actionEvidenceReceipt.js'
import { readNativeDisarmPending } from './actionDisarmPending.js'
import { settleDisarm } from './disarmSettlement.js'
import { nativeActionPendingResult } from './actionPendingResult.js'
import { readDisarmAdmission } from './disarmAdmission.js'
import { changedFields, readRunActors } from './documents.js'
import { projectNativeGm } from './nativeProjection.js'
import { presentEncounterResultForMember } from './resultPresentation.js'
import { insertRunCommand } from './timelineEntries.js'
import { encounterReplayReceipt } from './replayReceipts.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import type { EncounterDocument } from './store.js'

type DisarmCallbacks = {
  readActionSceneInputs(
    state: EncounterRunState,
    command: ActionSceneRequestDto,
    role: 'OWNER' | 'MEMBER'
  ): Promise<Extract<LiveSessionEncounterRulesResponse, { kind: 'ACTION_SCENE' }>['context']>
  validateReadFence(
    state: EncounterRunState,
    characterIds: readonly string[],
    revisions: LiveSessionRulesRevisions
  ): Promise<void>
}

type ReadyDisarm = Extract<Awaited<ReturnType<typeof readDisarmAdmission>>, { kind: 'READY' }>

/** The fences every Disarm write shares: current Character revisions and the action's Scene. */
async function requireCurrentDisarmInputs(
  ctx: EncounterCharacterWriteTransaction,
  admission: ReadyDisarm,
  revisions: LiveSessionRulesRevisions,
  callbacks: DisarmCallbacks
) {
  const { state, root, membership } = admission
  const actors = await readRunActors(ctx, state)
  await callbacks.readActionSceneInputs(
    state,
    {
      actorId: root.actorId,
      targetActorId: actionTargetActorId(root.target),
      sceneContext: root.sceneContext
    },
    membership.role === 'OWNER' ? 'OWNER' : 'MEMBER'
  )
  await callbacks.validateReadFence(
    state,
    actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [actor.sourceId] : [])),
    revisions
  )
  return actors
}

/** Stores a sealed paused Disarm contest in the caller's transaction. */
export async function persistEncounterDisarmPending(
  ctx: EncounterCharacterWriteTransaction,
  input: LiveSessionEncounterDisarmPendingInput,
  callbacks: DisarmCallbacks
): Promise<EncounterCommandResultDto> {
  const admission = await readDisarmAdmission(ctx, input)
  // A lost acknowledgement replays before checking inputs its commit consumed.
  if (admission.kind === 'REPLAY') return admission.result
  const { run, state, campaign, membership, root, response, fingerprint, occurrence } = admission
  const { snapshot } = input
  const context = snapshot.applicationContext
  if (
    context.kind !== 'ENCOUNTER_ACTION' ||
    !context.contest ||
    context.commandFingerprint !== fingerprint ||
    checksumCanonicalJson(JSON.parse(context.commandJson)) !== fingerprint ||
    context.initiatorUserId !== admission.initiatorUserId ||
    snapshot.optionalCombatSnapshotChecksum !== state.optionalCombatSnapshotChecksum ||
    snapshot.graph.source.gameSystemId !== state.gameSystemId ||
    (occurrence && snapshot.occurrenceId !== occurrence.id)
  )
    throw new Error('Live Session pending Disarm mismatch.')
  await requireCurrentDisarmInputs(ctx, admission, input.revisions, callbacks)
  if (!occurrence) await requireUnusedOccurrenceId(ctx, snapshot.occurrenceId)
  const updatedAt = new Date().toISOString()
  const occurrenceVersion = occurrence ? occurrence.version + 1 : 0
  const value = encounterStoredRuleOccurrenceSchema.parse({
    id: snapshot.occurrenceId,
    campaignId: campaign.id,
    encounterId: run.id,
    rootCommandId: root.commandId,
    state: 'PENDING',
    version: occurrenceVersion,
    expectedEncounterVersion: state.version,
    pendingSnapshotChecksum: await writePendingSnapshot(
      ctx,
      { id: snapshot.occurrenceId, encounterId: run.id },
      snapshot
    ),
    completedAt: null,
    createdAt: occurrence?.createdAt ?? updatedAt,
    updatedAt
  })
  const id = occurrence?._id ?? (await ctx.db.insert('encounterRuleOccurrences', value))
  if (occurrence) await ctx.db.patch(id, changedFields(occurrence, value))
  const stored = await ctx.db.get(id)
  if (!stored) throw new Error('The pending Disarm was not stored.')
  // The sealed contest must name its root and the participant it now waits on.
  const { policy } = await readNativeDisarmPending(ctx, stored)
  const result = await presentEncounterResultForMember(ctx, {
    campaign,
    membership,
    result: await nativeActionPendingResult(ctx, run, stored)
  })
  if (response)
    await insertActionEvidenceReceipt(ctx, {
      occurrence: stored,
      response,
      rootCommand: root,
      rootFingerprint: fingerprint,
      rootInitiatorUserId: admission.initiatorUserId,
      userId: input.expectedUserId,
      commandResult: result,
      result: storedRuleExecutionResultDtoSchema.parse({
        status: 'PAUSED',
        occurrenceId: stored.id,
        occurrenceVersion,
        request: snapshot.request,
        pending: { kind: 'D20_EVIDENCE', rollMode: policy.rollMode }
      })
    })
  return result
}

/** Re-applies settled Disarm item and ACTION changes and records their receipts atomically. */
export async function persistEncounterDisarmCommit(
  ctx: EncounterCharacterWriteTransaction,
  input: LiveSessionEncounterDisarmCommitInput,
  callbacks: DisarmCallbacks
): Promise<EncounterCommandResultDto> {
  const admission = await readDisarmAdmission(ctx, input)
  if (admission.kind === 'REPLAY') return admission.result
  const { run, state, campaign, membership, root, response, fingerprint, occurrence, prior } =
    admission
  const { execution, contest, occurredAt } = input
  const targetActorId = actionTargetActorId(root.target)
  const outputs =
    execution.status === 'COMPLETE' && execution.applicationOutputs.kind === 'CONTESTED_ACTION'
      ? execution.applicationOutputs
      : null
  const occurrenceVersion = occurrence ? occurrence.version + 1 : 0
  if (
    execution.status !== 'COMPLETE' ||
    !outputs ||
    execution.occurrenceVersion !== occurrenceVersion ||
    (occurrence && execution.occurrenceId !== occurrence.id) ||
    contest.actionKind !== 'DISARM' ||
    contest.actionId !== root.actionId ||
    contest.sourceActorId !== root.actorId ||
    contest.targetActorId !== targetActorId ||
    contest.optionalCombat.definitionId !== root.optionalCombatIntent?.definitionId ||
    contest.optionalCombat.snapshotChecksum !== state.optionalCombatSnapshotChecksum ||
    outputs.sealedContextChecksum !== checksumRuleDocument(contest) ||
    execution.evidence.source.definitionId !== contest.contestGraph.definitionId ||
    execution.evidence.source.checksum !== contest.contestGraph.checksum ||
    // An answered contest keeps its sealed facts; only this answer's roll is new.
    (prior &&
      (checksumRuleDocument({ ...contest, rollEvidence: prior.contest.rollEvidence }) !==
        checksumRuleDocument(prior.contest) ||
        (prior.contest.rollEvidence.initiator !== null &&
          checksumRuleDocument(prior.contest.rollEvidence.initiator) !==
            checksumRuleDocument(contest.rollEvidence.initiator))))
  )
    throw new Error('Live Session Disarm result scope mismatch.')
  const actors = await requireCurrentDisarmInputs(ctx, admission, input.revisions, callbacks)
  const source = actors.find((actor) => actor.id === root.actorId)
  const target = actors.find((actor) => actor.id === targetActorId)
  const ruleActors = actors.filter((actor) => actor.kind !== 'CHARACTER')
  if (
    !source ||
    !target ||
    input.rules.actors.length !== ruleActors.length ||
    input.rules.actors.some((actor) => !ruleActors.some((current) => current.id === actor.actorId))
  )
    throw new Error('Live Session Disarm actor scope mismatch.')
  if (!occurrence) await requireUnusedOccurrenceId(ctx, execution.occurrenceId)
  const settled = await settleDisarm(ctx, {
    state,
    actor: source,
    target,
    contest,
    rolls: { initiator: outputs.sourceRoll, defender: outputs.targetRoll },
    actionEconomy: outputs.actionEconomyTransition,
    occurrenceId: execution.occurrenceId,
    commandId: response?.commandId ?? root.commandId,
    sourceCommandId: root.commandId,
    userId: input.expectedUserId,
    occurredAt
  })
  if (checksumRuleDocument(settled.applicationOutputs) !== checksumRuleDocument(outputs))
    throw new Error('Live Session Disarm settlement mismatch.')
  const nextActors = actors.map((actor) =>
    actor.id === settled.actor.id
      ? settled.actor
      : actor.id === settled.target.id
        ? settled.target
        : actor
  )
  await deleteConsumedGrants(ctx, input.consumedGrants)
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt: occurredAt
  })
  const projection = await projectNativeGm(ctx, nextState, nextActors, input.rules)
  const result = encounterCommandResultDtoSchema.parse({
    projection,
    roll: null,
    occurrence: {
      occurrenceId: execution.occurrenceId,
      occurrenceVersion,
      status: 'COMPLETE',
      pending: null
    }
  })
  const ruleResultChecksum = checksumRuleDocument(execution)
  await ctx.db.patch(run._id, {
    version: nextState.version,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState),
    updatedAt: occurredAt
  })
  const completed = encounterStoredRuleOccurrenceSchema.parse({
    id: execution.occurrenceId,
    campaignId: campaign.id,
    encounterId: run.id,
    rootCommandId: root.commandId,
    state: 'COMPLETED',
    version: occurrenceVersion,
    expectedEncounterVersion: nextState.version,
    pendingSnapshotChecksum: await writePendingSnapshot(
      ctx,
      { id: execution.occurrenceId, encounterId: run.id },
      null
    ),
    completedAt: occurredAt,
    createdAt: occurrence?.createdAt ?? occurredAt,
    updatedAt: occurredAt
  })
  const completedId =
    occurrence?._id ?? (await ctx.db.insert('encounterRuleOccurrences', completed))
  if (occurrence) await ctx.db.patch(completedId, changedFields(occurrence, completed))
  await ctx.db.insert(
    'encounterRuleReceipts',
    encounterStoredRuleReceiptSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      occurrenceId: execution.occurrenceId,
      commandId: root.commandId,
      commandType: 'RESOLVE_ACTION',
      commandFingerprint: fingerprint,
      encounterVersion: nextState.version,
      commandMetadataJson: JSON.stringify(
        serverRuleExecutionReceiptCommandMetadataDtoSchema.parse({
          schemaVersion: 1,
          transition: 'START',
          definitionId: contest.contestGraph.definitionId,
          expectedAggregateVersion: root.expectedVersion,
          factsChecksum: checksumRuleDocument(execution.evidence.facts),
          optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
        })
      ),
      resultJson: JSON.stringify(execution),
      resultChecksum: ruleResultChecksum,
      actorUserId: admission.initiatorUserId,
      correlationId: null,
      createdAt: occurredAt
    })
  )
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      commandId: root.commandId,
      commandType: 'RESOLVE_ACTION',
      ruleOccurrenceId: execution.occurrenceId,
      ruleResultChecksum,
      optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
      checkReceipt: null,
      label: 'Disarm',
      // Disarm has no "Do it anyway"; its checks stay hard.
      ruleOverrides: [],
      consumedGrants: input.consumedGrants,
      addedConcentrationCasterId: null,
      speedBonusTurn: null,
      commandFingerprint: fingerprint,
      actorUserId: admission.initiatorUserId,
      version: nextState.version,
      commandJson: JSON.stringify(root),
      ...encounterReplayReceipt(result),
      createdAt: occurredAt
    })
  )
  const presented = await presentEncounterResultForMember(ctx, {
    campaign,
    membership,
    result
  })
  const completedOccurrence = await ctx.db.get(completedId)
  if (!completedOccurrence) throw new Error('The completed Disarm was not stored.')
  if (response)
    await insertActionEvidenceReceipt(ctx, {
      occurrence: completedOccurrence,
      response,
      rootCommand: root,
      rootFingerprint: fingerprint,
      rootInitiatorUserId: admission.initiatorUserId,
      userId: input.expectedUserId,
      commandResult: presented,
      result: execution
    })
  return presented
}

async function requireUnusedOccurrenceId(
  ctx: EncounterCharacterWriteTransaction,
  occurrenceId: string
) {
  const collision: EncounterDocument<'encounterRuleOccurrences'> | null = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', occurrenceId))
    .unique()
  if (collision) throw new Error('Encounter rule occurrence ID was already used.')
}
