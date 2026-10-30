import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounterData'
import type {
  LiveSessionEncounterBasicActionResponseCommitInput,
  LiveSessionEncounterCheckPauseCommitInput,
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
import type { D20RolledCheckDto } from '@artificer-toolkit/schema/shared/ruleExecutionD20WindowOffer'
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
  readEscapeCheckResponseAdmission
} from './basicActionCheckAdmission.js'
import {
  projectNativeBasicActionCheckPending,
  projectNativeD20WindowPending
} from './basicActionCheckPending.js'
import { isCheckActionSettlement } from './checkActionSettlement.js'
import { addResponseChangesToRoot, deleteGrants } from './consumedGrantPersistence.js'
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
  CheckResponseAdmission | Awaited<ReturnType<typeof readCheckActionResponseAdmission>>,
  { kind: 'REPLAY' }
>
type WindowPayload = EncounterD20WindowPendingContextDto['pause']['payload']
/** A window on a completed check's d20, as opposed to one on a save awaiting its graph. */
export type CheckWindowPayload = WindowPayload & { rolled: D20RolledCheckDto }
export const isCheckWindowPayload = (payload: WindowPayload): payload is CheckWindowPayload =>
  'execution' in payload.rolled

const mismatch = () => new Error('Live Session check result does not match its pending evidence.')

/** What differs between the checks a root command can pend: its admission, its die and its effects. */
type CheckPersistenceSpec<TInput extends CheckResponseCommitInput> = {
  admit(ctx: EncounterWriteTransaction, input: TInput): Promise<CheckResponseAdmission>
  settledD20(
    execution: TInput['settlement']['execution']
  ): Parameters<typeof requireD20WindowAnswer>[0]['settled']['d20'] | null
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
      windowDice: WindowPayload['offer']['options']
    }
  ): Promise<{ actors: EncounterRunActorState[]; endedEffects?: ActiveRuleEffectRecord[] }>
  validateReadFence(
    state: EncounterRunState,
    characterIds: readonly string[],
    revisions: LiveSessionRulesRevisions
  ): Promise<void>
}

/**
 * Commits the answer that settles a pending concealment check (Hide, Search), its d20 or a d20
 * window's decision: its concealment change, the spent held die, the occurrence's completion and
 * the receipts, atomically. The root command already spent the Action, so a failed check changes
 * only the occurrence.
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
    settledD20: (execution) =>
      execution.status === 'COMPLETE' && execution.applicationOutputs.kind === 'CONCEALMENT_CHECK'
        ? execution.applicationOutputs.d20
        : null,
    settle: (transaction, settleInput) => {
      const { settlement } = settleInput
      // A check action's answer commits through persistEncounterCheckActionResponse.
      if (isCheckActionSettlement(settlement)) throw mismatch()
      return settleEncounterConcealmentCheck(transaction, { ...settleInput, settlement })
    },
    validateReadFence: callbacks.validateReadFence
  })
}

/**
 * Commits the answer that settles a pending Escape check (D105), its d20 or a d20 window's
 * decision: the release it earned, the spent held die, the occurrence's completion and the
 * receipts, atomically. The root command already spent the activation, so a failed check changes
 * only the occurrence.
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
    settledD20: (execution) =>
      execution.status === 'COMPLETE' && execution.applicationOutputs.kind === 'ESCAPE_CHECK'
        ? execution.applicationOutputs.d20
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
  offered: CheckWindowPayload
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
    throw mismatch()
  return {
    windowDice: option ? [option] : [],
    selectedIndex: encounterD20WindowSelectedIndex(offered, selection)
  }
}

/**
 * What the answer that settles a check adds to the d20 it froze: the d20 itself, rolled from the
 * paused facts with the app roll the answer settled (the occurrence's next version, the natural as
 * the receipt's value), or a d20 window's decision on that d20 (the version the d20 was evidenced
 * at, the chosen offer's index). It returns the dice the window added.
 */
export function readD20Answer(input: {
  admission: AdmittedCheck
  window: CheckWindowPayload | null
  settlement: { appRollId: string | null; window?: { spentEffect: ActiveRuleEffectRecord | null } }
  execution: { evidence: Parameters<typeof checksumRuleDocument>[0]; initialFactsChecksum?: string }
  d20: Parameters<typeof requireD20WindowAnswer>[0]['settled']['d20']
}) {
  const { admission, window, settlement, execution, d20 } = input
  const { occurrence } = admission
  if (window) {
    if (!settlement.window) throw mismatch()
    const answer = requireD20WindowAnswer({
      offered: window,
      resolution: admission.response.resolution,
      spentEffect: settlement.window.spentEffect,
      settled: {
        execution,
        initialFactsChecksum: execution.initialFactsChecksum,
        d20,
        appRollId: settlement.appRollId
      }
    })
    return {
      windowDice: answer.windowDice,
      occurrenceVersion: occurrence.version,
      value: answer.selectedIndex
    }
  }
  if (
    settlement.window ||
    !rolledFromPendingD20(admission, {
      initialFactsChecksum: execution.initialFactsChecksum,
      appRollId: settlement.appRollId
    })
  )
    throw mismatch()
  return { windowDice: [], occurrenceVersion: occurrence.version + 1, value: d20.selectedNatural }
}

/**
 * Whether a d20 was rolled from the facts its check paused on, with the app roll its answer
 * settled.
 */
function rolledFromPendingD20(
  admission: AdmittedCheck,
  rolled: { initialFactsChecksum: string | undefined; appRollId: string | null }
) {
  return (
    rolled.initialFactsChecksum === checksumRuleDocument(admission.pending.continuation.facts) &&
    rolled.appRollId === (admission.appRoll?.rollId ?? null)
  )
}

/**
 * The d20 a pause opens a window on (D168), or null when the pause is not the window of this
 * paused check, which it freezes as it paused.
 */
export function openedD20Window(
  next: ServerRuleExecutionPendingSnapshotDto['applicationContext'],
  paused: EncounterD20WindowPendingContextDto['source']['context']
) {
  return next.kind === 'ENCOUNTER_D20_WINDOW' &&
    checksumCanonicalJson(next.source.context) === checksumCanonicalJson(paused) &&
    isCheckWindowPayload(next.pause.payload)
    ? next.pause.payload
    : null
}

/** Whether a rolled d20 a pause carries follows from the check's own answer under the Run's System. */
export function pausedOnAnsweredD20(
  admission: AdmittedCheck,
  rolled: Pick<CheckWindowPayload, 'rolled' | 'appRollId'>
) {
  return (
    rolled.rolled.execution.evidence.source.gameSystemId === admission.state.gameSystemId &&
    rolledFromPendingD20(admission, {
      initialFactsChecksum: rolled.rolled.initialFactsChecksum,
      appRollId: rolled.appRollId
    })
  )
}

/**
 * Pauses a concealment or Escape check on the d20 window its roller's d20 opened (D168), when the
 * roller holds an after-roll die. Nothing settles, so no receipt is written; the window's answer
 * settles the check.
 */
export async function persistEncounterCheckD20WindowOpen(
  ctx: EncounterWriteTransaction,
  input: LiveSessionEncounterCheckPauseCommitInput,
  callbacks: {
    check: 'CONCEALMENT_CHECK' | 'ESCAPE_CHECK'
    validateReadFence: CheckPersistenceSpec<LiveSessionEncounterBasicActionResponseCommitInput>['validateReadFence']
  }
): Promise<EncounterCommandResultDto> {
  const admission = await (
    callbacks.check === 'ESCAPE_CHECK'
      ? readEscapeCheckResponseAdmission
      : readBasicActionCheckResponseAdmission
  )(ctx, { ...input, response: input.command })
  if (admission.kind === 'REPLAY') return admission.result
  const { state, occurrence, pending } = admission
  const { snapshot } = input
  const { actors, rulesMatch } = await readCheckScope(
    ctx,
    state,
    input,
    callbacks.validateReadFence
  )
  const opened =
    pending.context.kind === 'ENCOUNTER_D20_WINDOW'
      ? null
      : openedD20Window(snapshot.applicationContext, pending.context)
  if (
    !opened ||
    !pausedOnAnsweredD20(admission, opened) ||
    input.window ||
    snapshot.occurrenceId !== occurrence.id ||
    !rulesMatch
  )
    throw mismatch()
  return recordCheckResponse(ctx, {
    admission,
    input,
    actors,
    endedEffects: [],
    ruleResult: opened.rolled.execution,
    receipt: null,
    next: { kind: 'PENDING', snapshot }
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
  const { state, campaign, occurrence, pending } = admission
  // A d20 window settles the check whose d20 opened it.
  const window = pending.context.kind === 'ENCOUNTER_D20_WINDOW' ? pending.context : null
  if (
    window &&
    (window.source.kind === 'DAMAGE_SAVE_CHECK' || !isCheckWindowPayload(window.pause.payload))
  )
    throw mismatch()
  const context = window ? window.source.context : pending.context
  const { settlement } = input
  const { execution } = settlement
  const d20 = spec.settledD20(execution)
  const { actors, rulesMatch } = await readCheckScope(ctx, state, input, spec.validateReadFence)
  if (
    checksumCanonicalJson(settlement.context) !== checksumCanonicalJson(context) ||
    execution.status !== 'COMPLETE' ||
    d20 === null ||
    execution.occurrenceId !== occurrence.id ||
    execution.evidence.source.gameSystemId !== state.gameSystemId ||
    !rulesMatch
  )
    throw mismatch()
  const answered = readD20Answer({
    admission,
    window: window ? window.pause.payload : null,
    settlement,
    execution,
    d20
  })
  const spentEffect = settlement.window?.spentEffect ?? null
  const settled = await spec.settle(ctx, {
    campaign,
    state,
    actors,
    settlement,
    rootCommandId: context.commandId,
    initiatorUserId: admission.initiatorUserId,
    occurredAt: input.occurredAt,
    occurrenceVersion: answered.occurrenceVersion,
    windowDice: answered.windowDice
  })
  // The room planned the settlement's new effects beside the held die, so it ends after them.
  if (spentEffect) await deleteGrants(ctx, [spentEffect])
  return recordCheckResponse(ctx, {
    admission,
    input,
    actors: settled.actors,
    endedEffects: [...(spentEffect ? [spentEffect] : []), ...(settled.endedEffects ?? [])],
    ruleResult: execution,
    receipt: { requestId: pending.continuation.request.requestId, value: answered.value },
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
