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
import type { EncounterD20WindowPendingContextDto } from '@artificer-toolkit/schema/shared/ruleExecutionD20Window'
import type { ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  chosenEncounterD20WindowOption,
  encounterD20WindowSelectedIndex,
  encounterD20WindowSelection
} from '@artificer-toolkit/rules-runtime/encounterD20Window'
import {
  readBasicActionCheckResponseAdmission,
  readCheckActionResponseAdmission,
  readD20WindowResponseAdmission,
  readEscapeCheckResponseAdmission
} from './basicActionCheckAdmission.js'
import {
  projectNativeBasicActionCheckPending,
  projectNativeD20WindowPending
} from './basicActionCheckPending.js'
import { isCheckActionSettlement } from './checkActionSettlement.js'
import { addResponseChangesToRoot } from './consumedGrantPersistence.js'
import { settleEncounterConcealmentCheck } from './concealmentCheckSettlement.js'
import { changedFields, readRunActors } from './documents.js'
import { settleEncounterEscapeCheck } from './escapeCheckSettlement.js'
import { projectNativeGm } from './nativeProjection.js'
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
type AdmittedCheck = Exclude<
  | CheckResponseAdmission
  | Awaited<ReturnType<typeof readD20WindowResponseAdmission>>
  | Awaited<ReturnType<typeof readCheckActionResponseAdmission>>,
  { kind: 'REPLAY' }
>

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
 * Commits the roller's d20 for a pending concealment check (Hide, Search): its concealment change,
 * the occurrence's completion and the receipts, atomically. The root command already spent the
 * Action, so a failed check changes only the occurrence.
 */
export function persistEncounterBasicActionResponse(
  ctx: EncounterWriteTransaction,
  input: LiveSessionEncounterBasicActionResponseCommitInput,
  callbacks: {
    validateReadFence: CheckPersistenceSpec<LiveSessionEncounterBasicActionResponseCommitInput>['validateReadFence']
  }
) {
  return persistCheckResponse(ctx, input, {
    admit: (transaction, scope) =>
      readBasicActionCheckResponseAdmission(transaction, { ...scope, response: scope.command }),
    selectedNatural: (execution) =>
      execution.status === 'COMPLETE' && execution.applicationOutputs.kind === 'CONCEALMENT_CHECK'
        ? execution.applicationOutputs.d20.selectedNatural
        : null,
    settle: (transaction, settleInput) => {
      const { settlement } = settleInput
      // A check action's answer commits through persistEncounterCheckActionResponse.
      if (isCheckActionSettlement(settlement))
        throw new Error('Live Session check result does not match its pending evidence.')
      return settleEncounterConcealmentCheck(transaction, { ...settleInput, settlement })
    },
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

/** The Run's actors, after the read fence, and whether the room's rules cover exactly its rule actors. */
export async function readCheckScope(
  ctx: EncounterWriteTransaction,
  state: EncounterRunState,
  input: Pick<LiveSessionEncounterBasicActionResponseCommitInput, 'revisions' | 'rules'>,
  validateReadFence: CheckPersistenceSpec<LiveSessionEncounterBasicActionResponseCommitInput>['validateReadFence']
) {
  const actors = await readRunActors(ctx, state)
  await validateReadFence(
    state,
    actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [actor.sourceId] : [])),
    input.revisions
  )
  const ruleActors = actors.filter((actor) => actor.kind !== 'CHARACTER')
  return {
    actors,
    rulesMatch:
      input.rules.actors.length === ruleActors.length &&
      input.rules.actors.every((entry) => ruleActors.some((rule) => rule.id === entry.actorId))
  }
}

/**
 * Checks a d20 window's answer against the d20 the room settled from it: the same frozen roll, the
 * held die the answer chose (and only that) added with faces it can show, and the effect it spent.
 * It returns the dice the window added and the receipt's value, the chosen offer's index.
 */
export function requireD20WindowAnswer(input: {
  offered: EncounterD20WindowPendingContextDto['pause']['payload']
  resolution: AdmittedCheck['response']['resolution']
  spentEffect: ActiveRuleEffectRecord | null
  settled: {
    execution: { evidence: Parameters<typeof checksumRuleDocument>[0] }
    initialFactsChecksum: string | undefined
    d20: { selectedNatural: number; addedDice?: readonly { rolledFaces: readonly number[] }[] }
    appRollId: string | null
  }
}) {
  const { offered, spentEffect, settled } = input
  const selection = encounterD20WindowSelection(input.resolution)
  const option = chosenEncounterD20WindowOption(offered, selection)
  const rolledDice = offered.rolled.d20.addedDice ?? []
  const addedDie = settled.d20.addedDice?.at(rolledDice.length)
  if (
    settled.initialFactsChecksum !== offered.rolled.initialFactsChecksum ||
    checksumRuleDocument(settled.execution.evidence) !==
      checksumRuleDocument(offered.rolled.execution.evidence) ||
    settled.appRollId !== offered.appRollId ||
    (option === null) !== (spentEffect === null) ||
    (spentEffect !== null && spentEffect.id !== option?.effectId) ||
    settled.d20.selectedNatural !== offered.rolled.d20.selectedNatural ||
    (settled.d20.addedDice?.length ?? 0) !== rolledDice.length + (option ? 1 : 0) ||
    (option !== null &&
      (addedDie?.rolledFaces.length !== option.count ||
        addedDie.rolledFaces.some(
          (face) => !Number.isSafeInteger(face) || face < 1 || face > option.faces
        )))
  )
    throw new Error('Live Session check result does not match its pending evidence.')
  return {
    windowDice: option ? [option] : [],
    selectedIndex: encounterD20WindowSelectedIndex(offered, selection)
  }
}

async function persistCheckResponse<TInput extends CheckResponseCommitInput>(
  ctx: EncounterWriteTransaction,
  input: TInput,
  spec: CheckPersistenceSpec<TInput>
): Promise<EncounterCommandResultDto> {
  const admission = await spec.admit(ctx, input)
  // A lost acknowledgement replays before checking inputs its commit consumed.
  if (admission.kind === 'REPLAY') return admission.result
  const { state, campaign, occurrence, pending } = admission
  const { context, continuation } = pending
  const { settlement } = input
  const { execution } = settlement
  const natural = spec.selectedNatural(execution)
  const { actors, rulesMatch } = await readCheckScope(ctx, state, input, spec.validateReadFence)
  if (
    checksumCanonicalJson(settlement.context) !== checksumCanonicalJson(context) ||
    execution.status !== 'COMPLETE' ||
    natural === null ||
    execution.occurrenceId !== occurrence.id ||
    execution.initialFactsChecksum !== checksumRuleDocument(continuation.facts) ||
    execution.evidence.source.gameSystemId !== state.gameSystemId ||
    !rulesMatch ||
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
  return recordCheckResponse(ctx, {
    admission,
    input,
    actors: settled.actors,
    endedEffects: settled.endedEffects ?? [],
    ruleResult: execution,
    receipt: { requestId: continuation.request.requestId, value: natural },
    next: { kind: 'COMPLETE' }
  })
}

/**
 * Writes what every accepted check answer leaves: the effects it ended and the forced movements it
 * landed (with the action's undo), the next Run version, the occurrence completed or kept pending on
 * its next snapshot, the command and, when the answer produced a rule result, its receipt.
 */
export async function recordCheckResponse(
  ctx: EncounterWriteTransaction,
  record: {
    admission: AdmittedCheck
    input: Pick<
      LiveSessionEncounterBasicActionResponseCommitInput,
      'occurredAt' | 'expectedUserId' | 'rules'
    >
    actors: EncounterRunActorState[]
    endedEffects: ActiveRuleEffectRecord[]
    forcedMovements?: Parameters<typeof addResponseChangesToRoot>[1]['forcedMovements']
    ruleResult: Parameters<typeof checksumRuleDocument>[0]
    receipt: { requestId: string; value: number } | null
    next:
      | { kind: 'COMPLETE' }
      | { kind: 'PENDING'; snapshot: ServerRuleExecutionPendingSnapshotDto }
  }
): Promise<EncounterCommandResultDto> {
  const { admission, input, next } = record
  const { run, state, campaign, membership, occurrence, fingerprint, response } = admission
  const occurrenceVersion = occurrence.version + 1
  // The effects the check ended and the tokens it moved come back with the action's undo.
  await addResponseChangesToRoot(ctx, {
    campaignId: campaign.id,
    actionOccurrenceId: occurrence.id,
    endedGrants: record.endedEffects,
    forcedMovements: record.forcedMovements
  })
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt: input.occurredAt
  })
  const nextOccurrence = encounterStoredRuleOccurrenceSchema.parse({
    id: occurrence.id,
    campaignId: campaign.id,
    encounterId: run.id,
    rootCommandId: occurrence.rootCommandId,
    state: next.kind === 'PENDING' ? 'PENDING' : 'COMPLETED',
    version: occurrenceVersion,
    expectedEncounterVersion: nextState.version,
    pendingSnapshotChecksum: await writePendingSnapshot(
      ctx,
      { id: occurrence.id, encounterId: run.id },
      next.kind === 'PENDING' ? next.snapshot : null
    ),
    completedAt: next.kind === 'PENDING' ? null : input.occurredAt,
    createdAt: occurrence.createdAt,
    updatedAt: input.occurredAt
  })
  const projection = await projectNativeGm(ctx, nextState, record.actors, input.rules)
  const result = encounterCommandResultDtoSchema.parse({
    projection,
    roll: null,
    occurrence: {
      occurrenceId: occurrence.id,
      occurrenceVersion,
      ...(next.kind === 'PENDING'
        ? {
            status: 'PENDING',
            pending: (next.snapshot.applicationContext.kind === 'ENCOUNTER_D20_WINDOW'
              ? projectNativeD20WindowPending
              : projectNativeBasicActionCheckPending)(
              { ...occurrence, ...nextOccurrence },
              next.snapshot
            )
          }
        : { status: 'COMPLETE', pending: null })
    }
  })
  await ctx.db.patch(run._id, {
    version: nextState.version,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState),
    updatedAt: input.occurredAt
  })
  await ctx.db.patch(occurrence._id, changedFields(occurrence, nextOccurrence))
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      commandId: response.commandId,
      commandType: 'RESOLVE_RULE_OCCURRENCE',
      ruleOccurrenceId: occurrence.id,
      ruleResultChecksum: checksumRuleDocument(record.ruleResult),
      optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
      commandFingerprint: fingerprint,
      actorUserId: input.expectedUserId,
      version: nextState.version,
      commandJson: JSON.stringify(response),
      ...encounterReplayReceipt(result),
      createdAt: input.occurredAt
    })
  )
  if (record.receipt)
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
            response: record.receipt,
            optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
          })
        ),
        resultJson: JSON.stringify(record.ruleResult),
        resultChecksum: checksumRuleDocument(record.ruleResult),
        actorUserId: input.expectedUserId,
        correlationId: response.correlationId ?? null,
        createdAt: input.occurredAt
      })
    )
  return presentEncounterResultForMember(ctx, { campaign, membership, result })
}
