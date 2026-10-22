import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounterData'
import type {
  LiveSessionEncounterContestCommitInput,
  LiveSessionEncounterContestPendingInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterContest'
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
import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import {
  actionEndedEffects,
  actsAgainstEnemy
} from '@artificer-toolkit/rules-runtime/encounterEndedEffectRelease'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { effectiveHitPointMaximum } from '@artificer-toolkit/rules-runtime/character/activeEffectGrantTotals'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { contestDefenderPicksCheck } from '@artificer-toolkit/rules-runtime/encounterOptionalContestActionExecution'
import { deleteGrants } from './consumedGrantPersistence.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import { readLiveCharacterMaximumHitPoints } from './liveMovementTargetState.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import { writePendingSnapshot } from './pendingSnapshots.js'
import { insertActionEvidenceReceipt } from './actionEvidenceReceipt.js'
import { readNativeContestPending } from './actionContestPending.js'
import { settleContest } from './contestSettlement.js'
import { nativeActionPendingResult } from './actionPendingResult.js'
import { readContestAdmission } from './contestAdmission.js'
import { changedFields, readRunActors } from './documents.js'
import { projectNativeGm } from './nativeProjection.js'
import { presentEncounterResultForMember } from './resultPresentation.js'
import { insertRunCommand } from './timelineEntries.js'
import type { ApplyEncounterForcedMovements } from './actionCommitRecords.js'
import { encounterReplayReceipt } from './replayReceipts.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import type { EncounterDocument } from './store.js'

type ContestCallbacks = {
  applyMechanics(
    batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
  ): Promise<EncounterMechanicsBatchResult>
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
  applyForcedMovements: ApplyEncounterForcedMovements
}

type ReadyContest = Extract<Awaited<ReturnType<typeof readContestAdmission>>, { kind: 'READY' }>

/** The fences every contest write shares: current Character revisions and the action's Scene. */
async function requireCurrentContestInputs(
  ctx: EncounterCharacterWriteTransaction,
  admission: ReadyContest,
  revisions: LiveSessionRulesRevisions,
  callbacks: ContestCallbacks
) {
  const { state, root, membership } = admission
  const actors = await readRunActors(ctx, state)
  // An escape has no Scene target; an action's Scene must still hold.
  if (root.type === 'RESOLVE_ACTION')
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

/** Stores a sealed paused contest in the caller's transaction. */
export async function persistEncounterContestPending(
  ctx: EncounterCharacterWriteTransaction,
  input: LiveSessionEncounterContestPendingInput,
  callbacks: ContestCallbacks
): Promise<EncounterCommandResultDto> {
  const admission = await readContestAdmission(ctx, input)
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
    throw new Error('Live Session pending contest mismatch.')
  await requireCurrentContestInputs(ctx, admission, input.revisions, callbacks)
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
  if (!stored) throw new Error('The pending contest was not stored.')
  // The sealed contest must name its root and the participant it now waits on.
  const { policy, participant, contest } = await readNativeContestPending(ctx, stored)
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
        // A defender that picks its check is asked for no single d20 (D152).
        pending:
          participant === 'DEFENDER' && contestDefenderPicksCheck(contest)
            ? null
            : { kind: 'D20_EVIDENCE', rollMode: policy.rollMode, keep: policy.keep }
      })
    })
  return result
}

/** Re-applies a settled contest's changes and ACTION use and records their receipts atomically. */
export async function persistEncounterContestCommit(
  ctx: EncounterCharacterWriteTransaction,
  input: LiveSessionEncounterContestCommitInput,
  callbacks: ContestCallbacks
): Promise<EncounterCommandResultDto> {
  const admission = await readContestAdmission(ctx, input)
  if (admission.kind === 'REPLAY') return admission.result
  const { run, state, campaign, membership, root, response, fingerprint, occurrence, prior } =
    admission
  const { execution, contest, occurredAt } = input
  // An escape's target is its holder, which the settlement checks against the held effect.
  const targetActorId =
    root.type === 'ESCAPE' ? contest.targetActorId : actionTargetActorId(root.target)
  const outputs =
    execution.status === 'COMPLETE' && execution.applicationOutputs.kind === 'CONTESTED_ACTION'
      ? execution.applicationOutputs
      : null
  const occurrenceVersion = occurrence ? occurrence.version + 1 : 0
  // A won basic action contest holds its target (Grapple) or runs its picked outcome (Shove, D105).
  const pickedOutcome = input.conditionApplications.length > 0 || input.forcedMovements.length > 0
  const settlesWin = input.createdEffect !== null || pickedOutcome
  if (
    execution.status !== 'COMPLETE' ||
    !outputs ||
    execution.occurrenceVersion !== occurrenceVersion ||
    (occurrence && execution.occurrenceId !== occurrence.id) ||
    // A Disarm seals its optional combat pin; a basic action contest is the action itself, and a
    // contested escape names the held effect and the escaper's check (D152). Only a won basic
    // action contest creates its hold effect.
    (root.type === 'ESCAPE'
      ? contest.origin.kind !== 'ESCAPE' ||
        contest.origin.activeEffectId !== root.activeEffectId ||
        contest.origin.initiatorCheckDefinitionId !== root.checkDefinitionId ||
        settlesWin
      : (contest.origin.kind === 'OPTIONAL_COMBAT'
          ? contest.origin.actionKind !== 'DISARM' ||
            contest.origin.pin.definitionId !== root.optionalCombatIntent?.definitionId ||
            contest.origin.pin.snapshotChecksum !== state.optionalCombatSnapshotChecksum ||
            settlesWin
          : contest.origin.kind !== 'BASIC_ACTION' ||
            root.optionalCombatIntent != null ||
            settlesWin !== (outputs.outcome === 'SOURCE_WIN') ||
            (input.createdEffect !== null && pickedOutcome)) ||
        contest.actionId !== root.actionId) ||
    contest.sourceActorId !== root.actorId ||
    contest.targetActorId !== targetActorId ||
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
    throw new Error('Live Session contest result scope mismatch.')
  const actors = await requireCurrentContestInputs(ctx, admission, input.revisions, callbacks)
  const source = actors.find((actor) => actor.id === root.actorId)
  const target = actors.find((actor) => actor.id === targetActorId)
  const ruleActors = actors.filter((actor) => actor.kind !== 'CHARACTER')
  if (
    !source ||
    !target ||
    input.rules.actors.length !== ruleActors.length ||
    input.rules.actors.some((actor) => !ruleActors.some((current) => current.id === actor.actorId))
  )
    throw new Error('Live Session contest actor scope mismatch.')
  if (!occurrence) await requireUnusedOccurrenceId(ctx, execution.occurrenceId)
  // The initiator's attack roll ends effects it held (Invisibility); the conditions only they held
  // are released in the initiator's own batch, which the receipt must match.
  const sourceEffects = await createActiveRuleEffectStore(ctx).list(
    turnEffectOwner(source, state.id)
  )
  const { consumedGrants: endedGrants, sourceReleases } = actionEndedEffects({
    holderActorId: source.id,
    held: sourceEffects,
    makesAttackRoll: contest.origin.kind === 'OPTIONAL_COMBAT',
    againstEnemy: actsAgainstEnemy({
      actorId: source.id,
      targetActorIds: [target.id],
      dispositions: new Map(actors.map(({ id, disposition }) => [id, disposition]))
    })
  })
  if (endedGrants.some((grant) => !input.consumedGrants.some(({ id }) => id === grant.id)))
    throw new Error('Live Session contest initiator grants changed before settlement.')
  const sourceMechanics = sourceReleases.length
    ? await callbacks.applyMechanics({
        encounterId: state.id,
        targetActorId: source.id,
        expectedEncounterVersion: state.version,
        occurrenceId: execution.occurrenceId,
        sourceCommandId: root.commandId,
        commandId: deriveEncounterCharacterMechanicsEventCommandId({
          occurrenceId: execution.occurrenceId,
          sourceCommandId: root.commandId,
          phase: 'DIRECT_ACTION_RESOURCE',
          ordinal: 0,
          targetCharacterId: source.kind === 'CHARACTER' ? source.sourceId : source.id
        }),
        occurredAt,
        applications: sourceReleases,
        effectiveMaximumHitPoints:
          source.kind === 'CHARACTER'
            ? await readLiveCharacterMaximumHitPoints(ctx, state, source.sourceId)
            : effectiveHitPointMaximum(source.maxHitPoints, sourceEffects),
        forceVersionAdvance: false
      })
    : null
  const settled = await settleContest(ctx, {
    state,
    actors,
    actor: sourceMechanics?.updatedActor ?? source,
    target,
    sourceApplications: sourceMechanics?.receiptApplications ?? [],
    contest,
    rolls: { initiator: outputs.sourceRoll, defender: outputs.targetRoll },
    actionEconomy: outputs.actionEconomyTransition,
    attackAction: outputs.attackActionTransition ?? null,
    createdEffect: input.createdEffect,
    conditionApplications: input.conditionApplications,
    forcedMovements: input.forcedMovements,
    campaign,
    applyMechanics: callbacks.applyMechanics,
    occurrenceId: execution.occurrenceId,
    commandId: response?.commandId ?? root.commandId,
    sourceCommandId: root.commandId,
    userId: input.expectedUserId,
    occurredAt
  })
  if (checksumRuleDocument(settled.applicationOutputs) !== checksumRuleDocument(outputs))
    throw new Error('Live Session contest settlement mismatch.')
  const nextActors = settled.actors
  await deleteGrants(ctx, input.consumedGrants)
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
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
  // A won Shove's push moves its target's token on the Scene in this commit (D157), settling the
  // zones it passes through (D170).
  const settledMovements = input.forcedMovements.length
    ? await callbacks.applyForcedMovements({
        state,
        sourceActorId: source.id,
        commandId: root.commandId,
        movements: input.forcedMovements,
        occurrenceId: execution.occurrenceId,
        occurredAt,
        authorizedCharacterIds: new Set(
          actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [actor.sourceId] : []))
        ),
        actors: nextActors,
        rules: input.rules
      })
    : { moves: [], landings: [], actors: nextActors, rules: input.rules }
  const projection = await projectNativeGm(
    ctx,
    nextState,
    settledMovements.actors,
    settledMovements.rules
  )
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
  await ctx.db.insert(
    'encounterRuleReceipts',
    encounterStoredRuleReceiptSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      occurrenceId: execution.occurrenceId,
      commandId: root.commandId,
      commandType: root.type,
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
  const label = contest.origin.kind === 'OPTIONAL_COMBAT' ? 'Disarm' : contest.origin.actionLabel
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      commandId: root.commandId,
      // An escape keeps its own record, whose check is the contest; an action is rooted in it.
      ...(root.type === 'ESCAPE'
        ? {
            commandType: 'ESCAPE',
            label,
            // A contest has no "Do it anyway"; its checks stay hard.
            ruleOverrides: [],
            receipt: {
              actorId: root.actorId,
              actionEconomy: outputs.actionEconomyTransition,
              consumedGrants: input.consumedGrants,
              checkOccurrenceId: execution.occurrenceId
            }
          }
        : {
            commandType: 'RESOLVE_ACTION',
            root: {
              kind: 'RULE_OCCURRENCE',
              ruleOccurrenceId: execution.occurrenceId,
              ruleResultChecksum,
              optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
            },
            label,
            ruleOverrides: [],
            consumedGrants: input.consumedGrants,
            endedMaintainedStates: [],
            addedConcentrationCasterId: null,
            speedBonusTurn: null,
            teleportAllowanceTurn: null,
            forcedMovements: settledMovements.moves,
            forcedMovementLandings: settledMovements.landings,
            turnUses: null
          }),
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
  if (!completedOccurrence) throw new Error('The completed contest was not stored.')
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
