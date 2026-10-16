import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounterData'
import type {
  LiveSessionEncounterBasicActionResponseCommitInput,
  LiveSessionEncounterEscapeResponseCommitInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  encounterRunStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterStoredRuleOccurrenceSchema,
  encounterStoredRuleReceiptSchema,
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import {
  readBasicActionCheckResponseAdmission,
  readEscapeCheckResponseAdmission
} from './basicActionCheckAdmission.js'
import { settleEncounterBasicActionCheck } from './basicActionCheckSettlement.js'
import { addResponseChangesToRoot } from './consumedGrantPersistence.js'
import {
  isConcealmentCheckSettlement,
  settleEncounterConcealmentCheck
} from './concealmentCheckSettlement.js'
import { changedFields, readRunActors } from './documents.js'
import { settleEncounterEscapeCheck } from './escapeCheckSettlement.js'
import { projectNativeGm } from './nativeProjection.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import { writePendingSnapshot } from './pendingSnapshots.js'
import { encounterReplayReceipt } from './replayReceipts.js'
import { presentEncounterResultForMember } from './resultPresentation.js'
import { insertRunCommand } from './timelineEntries.js'
import type { EncounterWriteTransaction } from './ports.js'
import type { EncounterDocument } from './store.js'

type CheckResponseCommitInput =
  | LiveSessionEncounterBasicActionResponseCommitInput
  | LiveSessionEncounterEscapeResponseCommitInput
type CheckResponseAdmission =
  | Awaited<ReturnType<typeof readBasicActionCheckResponseAdmission>>
  | Awaited<ReturnType<typeof readEscapeCheckResponseAdmission>>

/** What differs between the checks a root command can pend: its admission, its die and its effects. */
type CheckPersistenceSpec<TInput extends CheckResponseCommitInput> = {
  admit(ctx: EncounterWriteTransaction, input: TInput): Promise<CheckResponseAdmission>
  selectedNatural(execution: TInput['settlement']['execution']): number | null
  settle(
    ctx: EncounterWriteTransaction,
    input: {
      campaign: EncounterDocument<'campaigns'>
      state: EncounterRunState
      actors: readonly EncounterRunActorState[]
      settlement: TInput['settlement']
      rootCommandId: string
      initiatorUserId: string
      occurredAt: string
      occurrenceVersion: number
    }
  ): Promise<{ actors: EncounterRunActorState[]; endedEffects?: ActiveRuleEffectRecord[] }>
  validateReadFence(
    state: EncounterRunState,
    characterIds: readonly string[],
    revisions: LiveSessionRulesRevisions
  ): Promise<void>
}

/**
 * Commits the roller's d20 for a pending basic action check: First Aid's stabilize or Hide's and
 * Search's concealment change, the occurrence's completion and the receipts, atomically. The root
 * command already spent the Action, so a failed check changes only the occurrence.
 */
export function persistEncounterBasicActionResponse(
  ctx: EncounterWriteTransaction,
  input: LiveSessionEncounterBasicActionResponseCommitInput,
  callbacks: {
    validateReadFence: CheckPersistenceSpec<LiveSessionEncounterBasicActionResponseCommitInput>['validateReadFence']
    applyMechanics(
      batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
    ): Promise<EncounterMechanicsBatchResult>
  }
) {
  return persistCheckResponse(ctx, input, {
    admit: (transaction, scope) =>
      readBasicActionCheckResponseAdmission(transaction, { ...scope, response: scope.command }),
    selectedNatural: (execution) =>
      execution.status === 'COMPLETE' &&
      (execution.applicationOutputs.kind === 'BASIC_ACTION_CHECK' ||
        execution.applicationOutputs.kind === 'CONCEALMENT_CHECK')
        ? execution.applicationOutputs.d20.selectedNatural
        : null,
    settle: (transaction, settleInput) =>
      isConcealmentCheckSettlement(settleInput.settlement)
        ? settleEncounterConcealmentCheck(transaction, {
            ...settleInput,
            settlement: settleInput.settlement
          })
        : settleEncounterBasicActionCheck(transaction, {
            ...settleInput,
            settlement: settleInput.settlement,
            applyMechanics: callbacks.applyMechanics
          }),
    validateReadFence: callbacks.validateReadFence
  })
}

/**
 * Commits the holder's d20 for a pending Escape check (D105): the release it earned, the
 * occurrence's completion and the receipts, atomically. The root command already spent the
 * activation, so a failed check changes only the occurrence.
 */
export function persistEncounterEscapeResponse(
  ctx: EncounterWriteTransaction,
  input: LiveSessionEncounterEscapeResponseCommitInput,
  callbacks: {
    validateReadFence: CheckPersistenceSpec<LiveSessionEncounterEscapeResponseCommitInput>['validateReadFence']
  }
) {
  return persistCheckResponse(ctx, input, {
    admit: (transaction, scope) =>
      readEscapeCheckResponseAdmission(transaction, { ...scope, response: scope.command }),
    selectedNatural: (execution) =>
      execution.status === 'COMPLETE' && execution.applicationOutputs.kind === 'ESCAPE_CHECK'
        ? execution.applicationOutputs.d20.selectedNatural
        : null,
    settle: settleEncounterEscapeCheck,
    validateReadFence: callbacks.validateReadFence
  })
}

async function persistCheckResponse<TInput extends CheckResponseCommitInput>(
  ctx: EncounterWriteTransaction,
  input: TInput,
  spec: CheckPersistenceSpec<TInput>
): Promise<EncounterCommandResultDto> {
  const admission = await spec.admit(ctx, input)
  // A lost acknowledgement replays before checking inputs its commit consumed.
  if (admission.kind === 'REPLAY') return admission.result
  const { run, state, campaign, membership, occurrence, pending, fingerprint, response } = admission
  const { context, continuation } = pending
  const { settlement } = input
  const { execution } = settlement
  const natural = spec.selectedNatural(execution)
  const actors = await readRunActors(ctx, state)
  await spec.validateReadFence(
    state,
    actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [actor.sourceId] : [])),
    input.revisions
  )
  const ruleActors = actors.filter((actor) => actor.kind !== 'CHARACTER')
  if (
    checksumCanonicalJson(settlement.context) !== checksumCanonicalJson(context) ||
    execution.status !== 'COMPLETE' ||
    natural === null ||
    execution.occurrenceId !== occurrence.id ||
    execution.initialFactsChecksum !== checksumRuleDocument(continuation.facts) ||
    execution.evidence.source.gameSystemId !== state.gameSystemId ||
    input.rules.actors.length !== ruleActors.length ||
    input.rules.actors.some((entry) => !ruleActors.some((rule) => rule.id === entry.actorId)) ||
    (settlement.appRollId !== null) !== (admission.appRoll !== null) ||
    (admission.appRoll !== null && settlement.appRollId !== admission.appRoll.rollId)
  )
    throw new Error('Live Session check result does not match its pending evidence.')
  const occurrenceVersion = occurrence.version + 1
  const settled = await spec.settle(ctx, {
    campaign,
    state,
    actors,
    settlement,
    rootCommandId: context.commandId,
    initiatorUserId: admission.initiatorUserId,
    occurredAt: input.occurredAt,
    occurrenceVersion
  })
  // The effects the check ended come back with the action's undo.
  await addResponseChangesToRoot(ctx, {
    campaignId: campaign.id,
    actionOccurrenceId: occurrence.id,
    endedGrants: settled.endedEffects ?? []
  })
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt: input.occurredAt
  })
  const projection = await projectNativeGm(ctx, nextState, settled.actors, input.rules)
  const result = encounterCommandResultDtoSchema.parse({
    projection,
    roll: null,
    occurrence: {
      occurrenceId: occurrence.id,
      occurrenceVersion,
      status: 'COMPLETE',
      pending: null
    }
  })
  await ctx.db.patch(run._id, {
    version: nextState.version,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState),
    updatedAt: input.occurredAt
  })
  const completed = encounterStoredRuleOccurrenceSchema.parse({
    id: occurrence.id,
    campaignId: campaign.id,
    encounterId: run.id,
    rootCommandId: occurrence.rootCommandId,
    state: 'COMPLETED',
    version: occurrenceVersion,
    expectedEncounterVersion: nextState.version,
    pendingSnapshotChecksum: await writePendingSnapshot(
      ctx,
      { id: occurrence.id, encounterId: run.id },
      null
    ),
    completedAt: input.occurredAt,
    createdAt: occurrence.createdAt,
    updatedAt: input.occurredAt
  })
  await ctx.db.patch(occurrence._id, changedFields(occurrence, completed))
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      commandId: response.commandId,
      commandType: 'RESOLVE_RULE_OCCURRENCE',
      ruleOccurrenceId: occurrence.id,
      ruleResultChecksum: checksumRuleDocument(execution),
      optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
      commandFingerprint: fingerprint,
      actorUserId: input.expectedUserId,
      version: nextState.version,
      commandJson: JSON.stringify(response),
      ...encounterReplayReceipt(result),
      createdAt: input.occurredAt
    })
  )
  await ctx.db.insert(
    'encounterRuleReceipts',
    encounterStoredRuleReceiptSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      occurrenceId: occurrence.id,
      commandId: response.commandId,
      commandType: 'RESOLVE_RULE_OCCURRENCE',
      commandFingerprint: fingerprint,
      encounterVersion: nextState.version,
      commandMetadataJson: JSON.stringify(
        serverRuleExecutionReceiptCommandMetadataDtoSchema.parse({
          schemaVersion: 1,
          transition: 'RESUME',
          expectedAggregateVersion: response.expectedVersion,
          expectedOccurrenceVersion: response.expectedOccurrenceVersion,
          response: { requestId: continuation.request.requestId, value: natural },
          optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
        })
      ),
      resultJson: JSON.stringify(execution),
      resultChecksum: checksumRuleDocument(execution),
      actorUserId: input.expectedUserId,
      correlationId: response.correlationId ?? null,
      createdAt: input.occurredAt
    })
  )
  return presentEncounterResultForMember(ctx, { campaign, membership, result })
}
