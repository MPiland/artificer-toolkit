import type { directActionTwoPhaseDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionDirectActionPendingContexts'
import type { serverRuleExecutionApplicationOutputsDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionApplicationOutputs'
import type {
  ruleExecutionPhaseReceiptsDtoSchema,
  ServerCompletedRuleExecutionDto,
  ServerKernelRuleExecutionPendingSnapshotDto,
  ServerRuleExecutionD20EvidenceDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { isD20RolledCheck } from '@artificer-toolkit/schema/shared/ruleExecutionD20WindowOffer'
import { isDamageRollWindow } from '@artificer-toolkit/schema/shared/ruleExecutionDamageRollWindow'
import type { z } from 'zod'

import type { PendingNativeActionGraphs } from './encounterActionExecution.js'
import { requireDerivedD20Mode } from './encounterD20ModeValidation.js'
import { recordedD20Natural } from './encounterD20Settlement.js'
import { isEncounterSightGovernedD20 } from './encounterAttackBelief.js'
import { spendEncounterD20WindowDie } from './encounterD20Window.js'
import { type EncounterEvidenceAnswer } from './encounterEvidenceAnswer.js'
import type { EncounterActionWindowAnswer } from './encounterActionSaveWindow.js'

/** A settled action's retained evidence: its phases, terminal execution and application dice. */
type RetainedActionReceipt = {
  execution: ServerCompletedRuleExecutionDto
  phaseReceipts?: z.infer<typeof ruleExecutionPhaseReceiptsDtoSchema>
  application: z.infer<typeof serverRuleExecutionApplicationOutputsDtoSchema>
}

type RetainedD20Evidence = Pick<
  ServerRuleExecutionD20EvidenceDto,
  | 'requestId'
  | 'rollMode'
  | 'keep'
  | 'derivedRollMode'
  | 'rawFaces'
  | 'selectedNatural'
  | 'modeAdjustment'
  | 'addedDice'
>

function same(left: unknown, right: unknown) {
  return checksumRuleDocument(left) === checksumRuleDocument(right)
}

/** Every integer die an action already rolled, by request, from its paused and settled traces. */
export function retainedIntegerEvidence(input: {
  snapshot?: ServerKernelRuleExecutionPendingSnapshotDto
  receipt?: RetainedActionReceipt
}) {
  const traces = [
    ...(input.snapshot?.phaseReceipts?.map((receipt) => receipt.execution.evidence.trace) ?? []),
    ...(input.snapshot ? [input.snapshot.trace] : []),
    ...(input.receipt?.phaseReceipts?.map((receipt) => receipt.execution.evidence.trace) ?? []),
    ...(input.receipt ? [input.receipt.execution.evidence.trace] : [])
  ]
  const values = new Map<string, number>()
  for (const trace of traces.flat()) {
    const evidence = trace.evidence
    if (!evidence || !Number.isSafeInteger(evidence.value)) continue
    const prior = values.get(evidence.requestId)
    if (prior !== undefined && prior !== evidence.value)
      throw new Error('The retained action evidence is inconsistent.')
    values.set(evidence.requestId, evidence.value)
  }
  return values
}

/** A settled action's d20 and nested save d20, when its application records them. */
export function retainedReceiptD20(receipt: RetainedActionReceipt | undefined) {
  const application = receipt?.application
  if (
    !application ||
    (application.kind !== 'CHARACTER_MECHANICS_BATCH' &&
      application.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
  )
    return { d20: null, nestedD20: null }
  return { d20: application.d20, nestedD20: application.nestedD20 }
}

/** Every d20 an action already rolled, by request, from its paused OUTCOME phase and its receipt. */
export function retainedD20Evidence(input: {
  twoPhase?: z.infer<typeof directActionTwoPhaseDtoSchema> | null
  /** The pause the action waits on; a d20 window holds the save it follows as rolled. */
  pause?: PendingNativeActionGraphs['pause']
  receipt?: RetainedActionReceipt
}) {
  const pending = input.twoPhase
  const window =
    input.pause?.kind === 'ROLL_WINDOW' && !isDamageRollWindow(input.pause.payload)
      ? input.pause.payload
      : null
  const windowed = window && !isD20RolledCheck(window.rolled) ? window.rolled.d20 : null
  const retained = retainedReceiptD20(input.receipt)
  const evidence = [
    ...(pending?.phase === 'OUTCOME'
      ? [
          {
            requestId: pending.testRollEvidence.requestId,
            rawFaces: pending.testRollEvidence.rawFaces,
            rollMode: pending.testRollEvidence.rollMode,
            keep: pending.testRollEvidence.keep,
            derivedRollMode: pending.testRollEvidence.derivedRollMode,
            selectedNatural: pending.testRollEvidence.selectedNatural,
            ...(pending.testRollEvidence.modeAdjustment
              ? { modeAdjustment: pending.testRollEvidence.modeAdjustment }
              : {}),
            ...(pending.testRollEvidence.addedDice
              ? { addedDice: pending.testRollEvidence.addedDice }
              : {})
          }
        ]
      : []),
    ...(pending?.phase === 'OUTCOME' && pending.nestedOutcomeD20Evidence
      ? [pending.nestedOutcomeD20Evidence]
      : []),
    ...(windowed ? [windowed] : []),
    ...(retained.d20 ? [retained.d20] : []),
    ...(retained.nestedD20 ? [retained.nestedD20] : [])
  ]
  const values = new Map<string, RetainedD20Evidence>()
  for (const entry of evidence) {
    const prior = values.get(entry.requestId)
    if (prior && !same(prior, entry))
      throw new Error('The retained action d20 evidence is inconsistent.')
    values.set(entry.requestId, entry)
  }
  return values
}

/** Answers one paused request with the dice it already rolled; nothing rolls again. */
export function resolutionForRetainedEvidence(input: {
  gameSystemId: string
  pending: PendingNativeActionGraphs
  integers: ReadonlyMap<string, number>
  d20: ReadonlyMap<string, RetainedD20Evidence>
  used: Set<string>
}): EncounterEvidenceAnswer {
  const { request } = input.pending.continuation
  if (request.kind !== 'INTEGER_RANGE')
    throw new Error('The action requested unsupported evidence.')
  if (input.pending.d20Policy) {
    requireDerivedD20Mode({ gameSystemId: input.gameSystemId, ...input.pending.d20Policy })
    if (input.pending.d20Belief)
      requireDerivedD20Mode({ gameSystemId: input.gameSystemId, ...input.pending.d20Belief })
    const evidence = input.d20.get(request.requestId)
    if (
      !evidence ||
      evidence.derivedRollMode !== input.pending.d20Policy.rollMode ||
      recordedD20Natural(evidence) !== evidence.selectedNatural ||
      // A roll sight decides is settled in the rules-derived mode; a chosen mode never replaces it.
      (isEncounterSightGovernedD20({
        policy: input.pending.d20Policy,
        belief: input.pending.d20Belief ?? null
      }) &&
        evidence.rollMode !== input.pending.d20Policy.rollMode)
    )
      throw new Error('The retained action d20 evidence is stale.')
    input.used.add(request.requestId)
    const adjustment = evidence.modeAdjustment
    if (adjustment) {
      // The settled dice cannot be entered as they are: replay the roller's own entries, the dice
      // as rolled and then the one die a held roll still needed.
      if (input.pending.heldD20 && adjustment.addedFaces.length !== 1)
        throw new Error('The retained action d20 evidence is stale.')
      return input.pending.heldD20
        ? {
            kind: 'ENTER_DICE',
            requestId: request.requestId,
            rawFaces: [...adjustment.addedFaces],
            rollMode: 'NORMAL'
          }
        : {
            kind: 'ENTER_DICE',
            requestId: request.requestId,
            rawFaces: [...adjustment.rolledFaces],
            rollMode: adjustment.rolledMode
          }
    }
    return {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: evidence.rawFaces,
      rollMode: evidence.rollMode
    }
  }
  const value = input.integers.get(request.requestId)
  if (value === undefined || value < request.min || value > request.max)
    throw new Error('The retained action integer evidence is stale.')
  input.used.add(request.requestId)
  return { kind: 'ENTER_INTEGER', requestId: request.requestId, value }
}

/**
 * Answers a paused d20 window with the die its save already spent: the retained save evidence holds
 * the added die and its faces, so a window that offered none of the dice spent after it was declined
 * (a later reactor's window spent it, D207). Nothing rolls again.
 */
export function windowAnswerForRetainedEvidence(input: {
  pending: PendingNativeActionGraphs
  d20: ReadonlyMap<string, RetainedD20Evidence>
  used: Set<string>
}): EncounterActionWindowAnswer {
  // Only a Character's own action opens a damage roll's window, and no retained replay runs one.
  const window =
    input.pending.pause?.kind === 'ROLL_WINDOW' && !isDamageRollWindow(input.pending.pause.payload)
      ? input.pending.pause.payload
      : null
  if (!window || isD20RolledCheck(window.rolled))
    throw new Error('The retained action window evidence is stale.')
  const { d20 } = window.rolled
  const retained = input.d20.get(d20.requestId)
  const dice = retained?.addedDice ?? []
  const held = d20.addedDice ?? []
  const spent = dice.at(held.length)
  if (!retained || !same(dice.slice(0, held.length), held))
    throw new Error('The retained action window evidence is stale.')
  input.used.add(d20.requestId)
  const option =
    spent && window.offer.options.find((offered) => offered.effectId === spent.spentEffectId)
  if (!spent || !option) return { kind: 'ROLL_WINDOW', d20 }
  const answered = spendEncounterD20WindowDie(d20, option, spent.rolledFaces)
  if (!same(answered.addedDice, dice.slice(0, held.length + 1)))
    throw new Error('The retained action window evidence is stale.')
  return { kind: 'ROLL_WINDOW', d20: answered }
}
