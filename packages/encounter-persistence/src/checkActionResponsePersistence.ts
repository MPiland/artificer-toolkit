import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import type {
  CheckActionSettlement,
  LiveSessionEncounterBasicActionResponseCommitInput,
  LiveSessionEncounterCheckPauseCommitInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import type { ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterCheckActionPendingContextDto } from '@artificer-toolkit/schema/shared/ruleExecutionCheckAction'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import {
  resolveEncounterIntegerAnswer,
  withEncounterAppRoll
} from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import type { ApplyEncounterForcedMovements } from './actionCommitRecords.js'
import { readCheckActionResponseAdmission } from './basicActionCheckAdmission.js'
import {
  isCheckWindowPayload,
  openedD20Window,
  pausedOnAnsweredD20,
  readCheckScope,
  readD20Answer,
  recordCheckResponse,
  requireD20WindowAnswer
} from './basicActionCheckResponsePersistence.js'
import { isCheckActionSettlement, settleEncounterCheckAction } from './checkActionSettlement.js'
import { deleteGrants } from './consumedGrantPersistence.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import type { EncounterWriteTransaction } from './ports.js'

type CheckActionAdmission = Exclude<
  Awaited<ReturnType<typeof readCheckActionResponseAdmission>>,
  { kind: 'REPLAY' }
>
type ValidateReadFence = Parameters<typeof readCheckScope>[3]

const mismatch = () => new Error('Live Session check result does not match its pending evidence.')

/** The check action an occurrence waits on, and the d20 window its d20 paused on, if any. */
function pausedCheckAction({ context }: CheckActionAdmission['pending']) {
  if (context.kind !== 'ENCOUNTER_D20_WINDOW') return { context, window: null }
  if (context.source.kind !== 'CHECK_ACTION' || !isCheckWindowPayload(context.pause.payload))
    throw mismatch()
  return { context: context.source.context, window: context.pause.payload }
}

/** A check action's context as its settlement carries it: without the command and phase it resumes from. */
const settledContext = ({
  commandJson: _commandJson,
  phase: _phase,
  ...context
}: EncounterCheckActionPendingContextDto) => context

const sameCheckAction = (
  next: EncounterCheckActionPendingContextDto,
  paused: EncounterCheckActionPendingContextDto
) =>
  next.commandJson === paused.commandJson &&
  checksumCanonicalJson(settledContext(next)) === checksumCanonicalJson(settledContext(paused))

/**
 * Pauses a check action on its roller's next answer (D173): its d20 opened a d20 window, or reached
 * the DC (directly or through the window) and the outcome waits on its dice, or the outcome waits on
 * more dice. A window's spent die ends here; nothing else settles, so no receipt is written.
 */
export async function persistEncounterCheckActionPause(
  ctx: EncounterWriteTransaction,
  input: LiveSessionEncounterCheckPauseCommitInput,
  callbacks: { validateReadFence: ValidateReadFence }
): Promise<EncounterCommandResultDto> {
  const admission = await readCheckActionResponseAdmission(ctx, {
    ...input,
    response: input.command
  })
  if (admission.kind === 'REPLAY') return admission.result
  const { state, occurrence, pending, response } = admission
  const paused = pausedCheckAction(pending)
  const { snapshot } = input
  const next = snapshot.applicationContext
  const spentEffect = input.window?.spentEffect ?? null
  const { actors, rulesMatch } = await readCheckScope(
    ctx,
    state,
    input,
    callbacks.validateReadFence
  )
  if (snapshot.occurrenceId !== occurrence.id || !rulesMatch) throw mismatch()
  const nextCheckAction = next.kind === 'ENCOUNTER_CHECK_ACTION' ? next : null
  const outcome = nextCheckAction?.phase.kind === 'OUTCOME' ? nextCheckAction.phase : null
  if (paused.window) {
    // The window's answer reached the DC: the outcome's dice follow on the d20 it settled.
    if (
      !nextCheckAction ||
      !outcome ||
      !input.window ||
      !sameCheckAction(nextCheckAction, paused.context)
    )
      throw mismatch()
    const { windowDice } = requireD20WindowAnswer({
      offered: paused.window,
      resolution: response.resolution,
      spentEffect,
      settled: {
        execution: outcome.rolled.execution,
        initialFactsChecksum: outcome.rolled.initialFactsChecksum,
        d20: outcome.rolled.d20,
        appRollId: outcome.appRollId
      }
    })
    if (checksumCanonicalJson(outcome.windowDice) !== checksumCanonicalJson(windowDice))
      throw mismatch()
  } else if (paused.context.phase.kind === 'CHECK') {
    // The d20's answer opens its window, or reached the DC and the outcome's dice follow.
    const rolled =
      next.kind === 'ENCOUNTER_D20_WINDOW'
        ? openedD20Window(next, paused.context)
        : nextCheckAction &&
            outcome?.windowDice.length === 0 &&
            sameCheckAction(nextCheckAction, paused.context)
          ? outcome
          : null
    if (!rolled || input.window || !pausedOnAnsweredD20(admission, rolled)) throw mismatch()
  } else if (
    // The outcome waits on more of its dice, under the same rolled check.
    input.window ||
    !nextCheckAction ||
    checksumCanonicalJson(nextCheckAction) !== checksumCanonicalJson(paused.context)
  )
    throw mismatch()
  const rolled =
    next.kind === 'ENCOUNTER_D20_WINDOW' && isCheckWindowPayload(next.pause.payload)
      ? next.pause.payload.rolled
      : outcome?.rolled
  if (!rolled) throw mismatch()
  if (spentEffect) await deleteGrants(ctx, [spentEffect])
  return recordCheckResponse(ctx, {
    admission,
    input,
    actors,
    endedEffects: spentEffect ? [spentEffect] : [],
    ruleResult: rolled.execution,
    receipt: null,
    next: { kind: 'PENDING', snapshot }
  })
}

/**
 * Commits the answer that settles a check action (D173): its d20, a window's held die or the
 * outcome's last dice. The outcome lands on the target with its forced movements, the spent die
 * ends, and the occurrence completes with its receipt, atomically; the root's undo takes them all.
 */
export async function persistEncounterCheckActionResponse(
  ctx: EncounterWriteTransaction,
  input: LiveSessionEncounterBasicActionResponseCommitInput,
  callbacks: {
    validateReadFence: ValidateReadFence
    applyMechanics(
      batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
    ): Promise<EncounterMechanicsBatchResult>
    applyForcedMovements: ApplyEncounterForcedMovements
  }
): Promise<EncounterCommandResultDto> {
  const admission = await readCheckActionResponseAdmission(ctx, {
    ...input,
    response: input.command
  })
  if (admission.kind === 'REPLAY') return admission.result
  const { state, campaign, occurrence, pending } = admission
  const paused = pausedCheckAction(pending)
  const { settlement } = input
  if (!isCheckActionSettlement(settlement)) throw mismatch()
  const { execution } = settlement
  const { actors, rulesMatch } = await readCheckScope(
    ctx,
    state,
    input,
    callbacks.validateReadFence
  )
  if (
    execution.status !== 'COMPLETE' ||
    execution.applicationOutputs.kind !== 'CHECK_ACTION' ||
    execution.occurrenceId !== occurrence.id ||
    execution.evidence.source.gameSystemId !== state.gameSystemId ||
    !rulesMatch ||
    checksumCanonicalJson(settlement.context) !==
      checksumCanonicalJson(settledContext(paused.context))
  )
    throw mismatch()
  const answered = readCheckActionAnswer({
    admission,
    paused,
    settlement,
    execution,
    d20: execution.applicationOutputs.d20
  })
  const step = readCandidateStep(
    settlement.candidate,
    paused.context,
    occurrence.id,
    execution.applicationOutputs
  )
  const spentEffect = settlement.window?.spentEffect ?? null
  const endedEffects = [...(spentEffect ? [spentEffect] : []), ...(step?.endedEffects ?? [])]
  await deleteGrants(ctx, endedEffects)
  const { context } = paused
  const settled = await settleEncounterCheckAction(ctx, {
    campaign,
    state,
    actors,
    settlement,
    // The root's commit checked this context against the command and the action's authored check;
    // the admission bound it to that root, so the check settles against what it froze.
    admitted: {
      commandFingerprint: context.commandFingerprint,
      actorId: context.actorId,
      targetActorId: context.targetActorId,
      source: context.source,
      checkDefinitionIds: [context.check.checkDefinitionId],
      dc: context.check.dc
    },
    windowDice: answered.windowDice,
    rootCommandId: context.commandId,
    initiatorUserId: admission.initiatorUserId,
    occurredAt: input.occurredAt,
    occurrenceVersion: answered.occurrenceVersion,
    applyMechanics: callbacks.applyMechanics
  })
  // A won check's push moves its target's token on the Scene in this commit (D157).
  const moved = settlement.forcedMovements.length
    ? await callbacks.applyForcedMovements({
        state,
        sourceActorId: context.actorId,
        commandId: context.commandId,
        movements: settlement.forcedMovements,
        occurrenceId: occurrence.id,
        occurredAt: input.occurredAt,
        authorizedCharacterIds: new Set(
          actors.flatMap((entry) => (entry.kind === 'CHARACTER' ? [entry.sourceId] : []))
        ),
        actors: settled.actors,
        rules: input.rules
      })
    : { moves: [], landings: [], actors: settled.actors, rules: input.rules }
  return recordCheckResponse(ctx, {
    admission,
    input: { ...input, rules: moved.rules },
    actors: moved.actors,
    endedEffects,
    forcedMovements: moved,
    ruleResult: execution,
    receipt: { requestId: pending.continuation.request.requestId, value: answered.value },
    next: step?.next ?? { kind: 'COMPLETE' }
  })
}

/** A check action's context without the command and candidates a spell's next step changes. */
function frozenCheckAction({
  commandJson,
  phase: _phase,
  candidates: _candidates,
  check,
  ...context
}: EncounterCheckActionPendingContextDto) {
  return checksumCanonicalJson({ commandJson, ...context, check: { ...check, dc: 0 } })
}

/**
 * A spell's per-effect check step (D182), checked against the candidate its context waits on: a
 * success ends that effect (and what is linked to it) in this commit, a failure ends nothing, and
 * the next step asks for the following candidate's d20 on the same frozen check, or the check ends.
 * It returns null for a one-check action.
 */
export function readCandidateStep<
  TNext extends {
    occurrenceId: string
    applicationContext: ServerRuleExecutionPendingSnapshotDto['applicationContext']
  }
>(
  candidate: { endedEffects: ActiveRuleEffectRecord[]; next: TNext | null } | undefined,
  context: EncounterCheckActionPendingContextDto,
  occurrenceId: string,
  output: { outcome: 'SUCCESS' | 'FAILURE'; candidateEffectId?: string }
) {
  const { candidates } = context
  if (!candidates || !candidate) {
    if (candidates || candidate) throw mismatch()
    return null
  }
  const entry = candidates.entries[candidates.cursor]
  const success = output.outcome === 'SUCCESS'
  if (
    !entry ||
    entry.dc !== context.check.dc ||
    output.candidateEffectId !== entry.effectId ||
    success !== candidate.endedEffects.length > 0 ||
    (success && !candidate.endedEffects.some(({ id }) => id === entry.effectId))
  )
    throw mismatch()
  if (candidate.next === null)
    return { endedEffects: candidate.endedEffects, next: { kind: 'COMPLETE' as const } }
  const { applicationContext: next } = candidate.next
  const nextCandidates = next.kind === 'ENCOUNTER_CHECK_ACTION' ? next.candidates : undefined
  if (
    next.kind !== 'ENCOUNTER_CHECK_ACTION' ||
    next.phase.kind !== 'CHECK' ||
    !nextCandidates ||
    candidate.next.occurrenceId !== occurrenceId ||
    nextCandidates.cursor <= candidates.cursor ||
    nextCandidates.entries[nextCandidates.cursor]?.dc !== next.check.dc ||
    checksumCanonicalJson(nextCandidates.entries) !== checksumCanonicalJson(candidates.entries) ||
    frozenCheckAction(next) !== frozenCheckAction(context)
  )
    throw mismatch()
  return {
    endedEffects: candidate.endedEffects,
    next: { kind: 'PENDING' as const, snapshot: candidate.next }
  }
}

/**
 * What the settling answer adds to the check its phase froze: the d20 or a window's held die
 * (`readD20Answer`), or the outcome's dice on the d20 it already rolled (the version the d20 was
 * evidenced at). It returns the window's dice and the receipt's value.
 */
function readCheckActionAnswer(input: {
  admission: CheckActionAdmission
  paused: ReturnType<typeof pausedCheckAction>
  settlement: CheckActionSettlement
  execution: { evidence: Parameters<typeof checksumRuleDocument>[0]; initialFactsChecksum?: string }
  d20: { selectedNatural: number; addedDice?: readonly { rolledFaces: readonly number[] }[] }
}) {
  const { admission, paused, settlement, execution } = input
  const { occurrence, pending, response } = admission
  const { phase } = paused.context
  if (paused.window || phase.kind === 'CHECK')
    return readD20Answer({
      admission,
      window: paused.window,
      settlement,
      execution,
      d20: input.d20
    })
  if (settlement.window) throw mismatch()
  const { request } = pending.snapshot
  if (
    request.kind !== 'INTEGER_RANGE' ||
    execution.initialFactsChecksum !== phase.rolled.initialFactsChecksum ||
    checksumRuleDocument(execution.evidence) !==
      checksumRuleDocument(phase.rolled.execution.evidence) ||
    settlement.appRollId !== phase.appRollId
  )
    throw mismatch()
  return {
    windowDice: phase.windowDice,
    occurrenceVersion: occurrence.version,
    value: resolveEncounterIntegerAnswer({
      min: request.min,
      max: request.max,
      // An app roll settles with the faces Convex recorded for it, so nothing is rolled here.
      answer: withEncounterAppRoll(response.resolution, admission.appRoll),
      random: () => {
        throw mismatch()
      }
    })
  }
}
