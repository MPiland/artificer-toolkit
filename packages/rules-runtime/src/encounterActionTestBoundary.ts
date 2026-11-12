import type {
  ServerCompletedRuleExecutionDto,
  ServerPublishedRuleDefinitionDto,
  ServerRuleExecutionContinuationDto,
  ServerRuleExecutionD20EvidenceDto,
  ServerRuleExecutionD20PolicyDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type {
  CharacterRuleActionExecutionPlan,
  CharacterRuleActionSystemAdapter
} from './characterRuleActionSystemAdapter.js'
import type { NativePhaseReceipts } from './encounterActionCompletion.js'
import {
  requireActionContinuation,
  type EncounterActionAutoRoll,
  type NativeTwoPhase
} from './encounterActionRequest.js'
import {
  buildEncounterActionD20Evidence,
  deriveEncounterActionD20Policy,
  settleEncounterD20Test
} from './encounterD20Settlement.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'

/**
 * A two-phase action's sealed TEST, held across a server-owned interstitial, and the proof that it
 * still matches the action it was sealed for before its OUTCOME runs.
 */

export type NativeActionTestBoundary = {
  kind: 'TEST_BOUNDARY'
  /** Original sealed TEST request, retained for the server-owned interstitial context. */
  continuation: ServerRuleExecutionContinuationDto
  execution: ServerCompletedRuleExecutionDto
  published: ServerPublishedRuleDefinitionDto
  initialPublished: ServerPublishedRuleDefinitionDto
  initialFactsChecksum: string
  phaseReceipts: NativePhaseReceipts
  d20: ServerRuleExecutionD20EvidenceDto
  d20Policy: ServerRuleExecutionD20PolicyDto
  twoPhase: Extract<NativeTwoPhase, { phase: 'TEST' }>
}

export type NativeActionBaseInput = {
  runtime: RulesRuntimeService
  adapter: CharacterRuleActionSystemAdapter
  plan: CharacterRuleActionExecutionPlan
  occurrenceId: string
  autoRoll: EncounterActionAutoRoll
  binding: Omit<Parameters<CharacterRuleActionSystemAdapter['bindFacts']>[0], 'published'>
  afterTest(
    execution: ServerCompletedRuleExecutionDto,
    d20: ServerRuleExecutionD20EvidenceDto
  ): Promise<void>
  random?: (maximum: number) => number
}

function requireTestPlan(input: NativeActionBaseInput) {
  if (input.plan.kind !== 'TEST_OUTCOME')
    throw new Error('Native action TEST boundaries require a TEST_OUTCOME plan.')
  return input.plan
}

export function nativeTestIdentity(input: NativeActionBaseInput) {
  const plan = requireTestPlan(input)
  const published = plan.test.published
  const bound = input.adapter.bindFacts({ ...input.binding, published })
  return {
    plan,
    published,
    bound,
    factsChecksum: checksumRuleDocument(bound.facts)
  }
}

/**
 * The dice a sealed TEST rolled after its d20 (a roll table's die and its repeats). A later rebuild
 * of the TEST reads them back by request instead of rolling.
 */
export function sealedTestDice(sealed: {
  execution: ServerCompletedRuleExecutionDto
  d20: { requestId: string }
}) {
  return sealed.execution.evidence.trace.flatMap(({ evidence }) =>
    evidence && evidence.requestId !== sealed.d20.requestId
      ? [{ requestId: evidence.requestId, value: evidence.value }]
      : []
  )
}

export async function requireNativeTestBoundary(input: {
  source: NativeActionBaseInput
  boundary: NativeActionTestBoundary
}) {
  const current = nativeTestIdentity(input.source)
  const { boundary } = input
  const receipt = boundary.phaseReceipts[0]
  if (
    boundary.phaseReceipts.length !== 1 ||
    !receipt ||
    receipt.phase !== 'TEST' ||
    boundary.published.id !== current.published.id ||
    boundary.published.checksum !== current.published.checksum ||
    boundary.initialPublished.id !== current.published.id ||
    boundary.initialPublished.checksum !== current.published.checksum ||
    boundary.initialFactsChecksum !== current.factsChecksum ||
    boundary.twoPhase.compilerSourceChecksum !==
      current.plan.compilerSource.compilerSourceChecksum ||
    boundary.twoPhase.testTemplateChecksum !== current.plan.test.template.checksum ||
    boundary.twoPhase.boundFactsChecksum !== current.factsChecksum ||
    checksumRuleDocument(receipt.template) !== checksumRuleDocument(current.plan.test.template) ||
    receipt.specializedChecksum !== current.published.checksum ||
    receipt.boundFactsChecksum !== current.factsChecksum ||
    checksumRuleDocument(receipt.execution) !== checksumRuleDocument(boundary.execution) ||
    boundary.execution.status !== 'COMPLETE'
  )
    throw new Error('The native action TEST boundary is stale.')
  requireActionContinuation({
    continuation: boundary.continuation,
    occurrenceId: input.source.occurrenceId,
    published: current.published,
    facts: current.bound.facts
  })
  const policy = deriveEncounterActionD20Policy({
    continuation: boundary.continuation,
    bound: current.bound
  })
  if (checksumRuleDocument(policy) !== checksumRuleDocument(boundary.d20Policy))
    throw new Error('The native action TEST policy is stale.')
  const evidence = buildEncounterActionD20Evidence({
    execution: boundary.execution,
    policy: boundary.d20Policy,
    requestId: boundary.d20.requestId,
    faces: boundary.d20.rawFaces,
    rollMode: boundary.d20.rollMode,
    keep: boundary.d20.keep,
    modeAdjustment: boundary.d20.modeAdjustment,
    addedDice: boundary.d20.addedDice ?? []
  })
  if (checksumRuleDocument(evidence) !== checksumRuleDocument(boundary.d20))
    throw new Error('The native action TEST evidence is stale.')
  let replayed = await settleEncounterD20Test({
    continuation: boundary.continuation,
    roll: { natural: boundary.d20.selectedNatural, addedDice: boundary.d20.addedDice ?? [] },
    // A holder's window may have added no die; the retained execution below proves what was asked.
    mayAddDice: true,
    resume: (step) => input.source.runtime.resume(step)
  })
  // The dice the TEST rolled after its d20 are read back from the execution that sealed them.
  while (replayed.status === 'PAUSED') {
    const { request } = replayed.continuation
    const sealed = boundary.execution.evidence.trace.find(
      (entry) => entry.nodeId === request.nodeId
    )?.evidence
    if (sealed?.kind !== 'INTEGER_RANGE' || sealed.requestId !== request.requestId)
      throw new Error('The native action TEST execution is stale.')
    replayed = await input.source.runtime.resume({
      continuation: replayed.continuation,
      response: { requestId: request.requestId, value: sealed.value }
    })
  }
  if (checksumRuleDocument(replayed) !== checksumRuleDocument(boundary.execution))
    throw new Error('The native action TEST execution is stale.')
  return current
}
