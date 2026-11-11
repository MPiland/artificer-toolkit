import {
  d20AddedDiceTotal,
  type D20AddedDieDto,
  type D20RolledAddedDieDto
} from '@artificer-toolkit/schema/shared/d20AddedDice'
import type { D20FoldedBonusDto } from '@artificer-toolkit/schema/shared/d20FoldedBonuses'
import type { D20MinimumRollDto } from '@artificer-toolkit/schema/shared/d20MinimumRoll'
import {
  rollModeKeptFace,
  type RollModeKeep
} from '@artificer-toolkit/schema/shared/systemCoreCode'
import type { ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import {
  serverRuleExecutionD20EvidenceDtoSchema,
  serverRuleExecutionD20PolicyDtoSchema,
  serverRuleExecutionNestedD20EvidenceDtoSchema,
  type ServerRuleExecutionD20EvidenceDto,
  type ServerRuleExecutionD20PolicyDto,
  type ServerRuleExecutionNestedD20EvidenceDto
} from '@artificer-toolkit/schema/shared/ruleExecutionEvidence'
import type {
  ServerCompletedRuleExecutionDto,
  ServerRuleExecutionContinuationDto,
  ServerRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/ruleExecutionProtocol'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type { CharacterRuleActionSystemAdapter } from './characterRuleActionSystemAdapter.js'
import { resolveEncounterAddedDice, resumeEncounterD20 } from './encounterD20AddedDice.js'
import { EncounterValidationError } from './encounterErrors.js'
import { rollModeCapabilityRegistry } from './platformPolicyModules.js'
import { settleSightGovernedD20, type SightGovernedD20 } from './encounterSightGovernedD20.js'
import {
  autoFailConditions,
  resolveEncounterD20Answer,
  resolveEncounterIntegerAnswer,
  savingThrowAbility,
  type EncounterD20RollMode,
  type EncounterEvidenceAnswer,
  type EncounterResponseAnswer
} from './encounterEvidenceAnswer.js'

// The one d20 test settlement (ADR 0039 decision 2): a test freezes its d20 context when it is
// prepared, an answer settles against that context (faces, kept mode and added dice), and the test
// graph resumes with the kept natural and the added dice's total, then is checked against them.

/**
 * A d20 test's frozen context: the roller's mode and the keep its System derives from it,
 * contributors (with their checksum) and modifier, plus the dice its effects add (D156) and the floor they put on the d20, named only when present.
 */
export function freezeD20Context<TContributor>(facts: {
  gameSystemId: string
  rollMode: EncounterD20RollMode
  contributors: readonly TContributor[]
  modifier: number
  addedDice?: readonly D20AddedDieDto[]
  minimumRoll?: D20MinimumRollDto | null
}) {
  return {
    rollMode: facts.rollMode,
    keep: rollModeCapabilityRegistry.rollModeKeep(facts),
    contributors: [...facts.contributors],
    contributorChecksum: checksumRuleDocument(facts.contributors),
    modifier: facts.modifier,
    ...(facts.addedDice?.length ? { addedDice: [...facts.addedDice] } : {}),
    ...(facts.minimumRoll ? { minimumRoll: facts.minimumRoll } : {})
  }
}

/** One settled d20 test roll: every face, the mode that kept one, the kept natural and added dice. */
export type EncounterD20Roll = {
  rawFaces: number[]
  rollMode: EncounterD20RollMode
  keep: RollModeKeep
  natural: number
  addedDice: D20RolledAddedDieDto[]
}

/**
 * Settles an answer against a frozen d20 test: its faces and mode (the frozen mode for an
 * auto-roll), then its added dice from the same answer. The d20 rolls before the added dice. A
 * test that freezes no added dice refuses an answer that carries added faces.
 */
export function settleEncounterD20Answer(input: {
  gameSystemId: string
  d20: { rollMode: EncounterD20RollMode; keep: RollModeKeep; addedDice?: readonly D20AddedDieDto[] }
  answer: EncounterEvidenceAnswer | EncounterResponseAnswer
  rollD20: () => number
  random: (maxExclusive: number) => number
}): EncounterD20Roll {
  const { faces, rollMode, keep, natural } = resolveEncounterD20Answer({
    gameSystemId: input.gameSystemId,
    derived: input.d20,
    answer: input.answer,
    rollD20: input.rollD20
  })
  const addedDice = resolveEncounterAddedDice({
    dice: input.d20.addedDice ?? [],
    answer: input.answer,
    random: input.random
  })
  return { rawFaces: faces, rollMode, keep, natural, addedDice }
}

/**
 * The natural a recorded d20 kept: the face its keep selects from its faces. A settled roll is
 * stored as its faces and keep, so a later stage that resumes a graph with it, rebuilds its
 * evidence or checks a stored natural reads it here.
 */
export function recordedD20Natural(roll: {
  keep: RollModeKeep
  rawFaces: readonly number[]
}): number {
  return rollModeKeptFace(roll.keep, roll.rawFaces)
}

type D20TestResume = {
  continuation: ServerRuleExecutionContinuationDto
  roll: Pick<EncounterD20Roll, 'natural' | 'addedDice'>
  mayAddDice?: boolean
  resume: (step: {
    continuation: ServerRuleExecutionContinuationDto
    response: { requestId: string; value: number }
  }) => Promise<ServerRuleExecutionResultDto>
}

type D20TestOutputs = {
  outputs: { rawDie: string; addedTotal?: string; total?: { port: string; modifier: number } }
  refusal: () => Error
}

/**
 * Resumes a d20 test graph with a settled roll: the kept natural, then the added dice's total. A
 * test that names `outputs` must complete, and each named output port must carry its value:
 * `rawDie` the kept natural, `addedTotal` the added dice's signed total, and `total` the natural
 * plus `modifier` plus that total. A graph that does not complete or reports other values throws
 * `refusal`. A test whose graph can pause again, or whose completion is checked through its trace
 * (an action phase, a contest, a target-bound effect), names none and takes the result as resumed.
 */
export function settleEncounterD20Test(
  input: D20TestResume & D20TestOutputs
): Promise<ServerCompletedRuleExecutionDto>
export function settleEncounterD20Test(input: D20TestResume): Promise<ServerRuleExecutionResultDto>
export async function settleEncounterD20Test(
  input: D20TestResume & Partial<D20TestOutputs>
): Promise<ServerRuleExecutionResultDto> {
  const { roll, outputs, refusal } = input
  const execution = await resumeEncounterD20({
    continuation: input.continuation,
    natural: roll.natural,
    addedDice: roll.addedDice,
    mayAddDice: input.mayAddDice,
    resume: input.resume
  })
  if (!outputs || !refusal) return execution
  const addedTotal = d20AddedDiceTotal(roll.addedDice)
  if (
    execution.status !== 'COMPLETE' ||
    execution.outputs[outputs.rawDie] !== roll.natural ||
    (outputs.addedTotal !== undefined && execution.outputs[outputs.addedTotal] !== addedTotal) ||
    (outputs.total !== undefined &&
      execution.outputs[outputs.total.port] !== roll.natural + outputs.total.modifier + addedTotal)
  )
    throw refusal()
  return execution
}

export type SettledActionResponse = {
  kind: 'SETTLED'
  value: number
  faces: number[] | null
  rollMode: EncounterD20RollMode | null
  keep: RollModeKeep | null
  modeAdjustment?: ServerRuleExecutionD20EvidenceDto['modeAdjustment']
  /** The d20 policy's added dice with their faces; none for an integer request. */
  addedDice: D20RolledAddedDieDto[]
}

export type ActionResponse = SettledActionResponse | { kind: 'NEEDS_EXTRA_D20'; heldFace: number }

export type ActionResponseInput = {
  gameSystemId: string
  continuation: ServerRuleExecutionContinuationDto
  policy: ServerRuleExecutionD20PolicyDto | null
  resolution: EncounterEvidenceAnswer
  random: (maximum: number) => number
}

export function actionResponse(
  input: ActionResponseInput & { sightGoverned?: null }
): SettledActionResponse
export function actionResponse(
  input: ActionResponseInput & { sightGoverned: SightGovernedD20 | null }
): ActionResponse
export function actionResponse(
  input: ActionResponseInput & { sightGoverned?: SightGovernedD20 | null }
): ActionResponse {
  if (input.resolution.requestId !== input.continuation.request.requestId)
    throw new Error('The action evidence request is stale.')
  const rollD20 = () => input.random(20) + 1
  const { policy, resolution, sightGoverned } = input
  // The answer that settles the d20 carries its added dice; a held d20 waits for the next answer.
  const addedDice = () =>
    resolveEncounterAddedDice({
      dice: policy?.addedDice ?? [],
      answer: resolution,
      random: input.random
    })
  if (policy !== null && sightGoverned) {
    const settled = settleSightGovernedD20({
      gameSystemId: input.gameSystemId,
      appliedMode: policy.rollMode,
      sightGoverned,
      resolution,
      rollD20
    })
    return settled.kind === 'SETTLED' ? { ...settled, addedDice: addedDice() } : settled
  }
  if (policy !== null) {
    const d20 = settleEncounterD20Answer({
      gameSystemId: input.gameSystemId,
      d20: policy,
      answer: resolution,
      rollD20,
      random: input.random
    })
    return {
      kind: 'SETTLED',
      value: d20.natural,
      faces: d20.rawFaces,
      rollMode: d20.rollMode,
      keep: d20.keep,
      addedDice: d20.addedDice
    }
  }
  const { request } = input.continuation
  return {
    kind: 'SETTLED',
    value: resolveEncounterIntegerAnswer({
      min: request.min,
      max: request.max,
      answer: resolution,
      random: input.random
    }),
    faces: null,
    rollMode: null,
    keep: null,
    addedDice: addedDice()
  }
}

function requireD20Request(continuation: ServerRuleExecutionContinuationDto): void {
  if (
    continuation.request.kind !== 'INTEGER_RANGE' ||
    continuation.request.min !== 1 ||
    continuation.request.max !== 20
  ) {
    throw new EncounterValidationError(
      'The selected reaction action requested unsupported evidence.'
    )
  }
}

/** Shared single-stage d20 policy derivation for an exact prepared Encounter action. */
export function deriveEncounterActionD20Policy(input: {
  continuation: ServerRuleExecutionContinuationDto
  bound: ReturnType<CharacterRuleActionSystemAdapter['bindFacts']>
}): ServerRuleExecutionD20PolicyDto {
  requireD20Request(input.continuation)
  if (!input.bound.d20RollMode || !input.bound.d20Keep || !input.bound.d20Audit) {
    throw new EncounterValidationError('The selected reaction action has no exact d20 policy.')
  }
  return serverRuleExecutionD20PolicyDtoSchema.parse({
    requestNodeId: input.continuation.request.nodeId,
    rollMode: input.bound.d20RollMode,
    keep: input.bound.d20Keep,
    contributors: input.bound.d20Audit.contributors,
    contributorChecksum: input.bound.d20Audit.contributorChecksum,
    modifier: input.bound.d20Audit.modifier,
    dc: input.bound.d20Audit.defenseOrDc,
    ...savingThrowAbility(input.bound.d20Audit),
    ...policyAuditDice(input.bound.d20Audit)
  })
}

/** A policy names its added dice (D156) and folded bonuses (cover) only when the test has some. */
export function policyAuditDice(audit: {
  addedDice: readonly D20AddedDieDto[]
  foldedBonuses?: readonly D20FoldedBonusDto[]
  autoFailConditionIds?: readonly string[]
}) {
  return {
    ...autoFailConditions(audit),
    ...(audit.addedDice.length > 0 ? { addedDice: [...audit.addedDice] } : {}),
    ...policyFoldedBonuses(audit.foldedBonuses)
  }
}

function policyFoldedBonuses(foldedBonuses: readonly D20FoldedBonusDto[] | undefined) {
  return foldedBonuses && foldedBonuses.length > 0 ? { foldedBonuses: [...foldedBonuses] } : {}
}

export function nestedOutcomeD20Policy(input: {
  published: ServerPublishedRuleDefinitionDto
  bound: Pick<
    ReturnType<CharacterRuleActionSystemAdapter['bindFacts']>,
    'd20RollMode' | 'd20Keep' | 'd20Audit'
  >
}): ServerRuleExecutionD20PolicyDto | null {
  const requestNode = input.published.definition.nodes?.find(
    (node) => node.id === 'nested-save-d20'
  )
  if (!requestNode) return null
  const minimum = requestNode.inputs.min
  const maximum = requestNode.inputs.max
  if (
    requestNode.operation.key !== 'evidence.integer-range' ||
    requestNode.operation.contractVersion !== 1 ||
    minimum?.kind !== 'LITERAL' ||
    minimum.value !== 1 ||
    maximum?.kind !== 'LITERAL' ||
    maximum.value !== 20
  ) {
    throw new EncounterValidationError('The nested save request is invalid.')
  }
  const { d20RollMode: rollMode, d20Keep: keep, d20Audit: audit } = input.bound
  if (!rollMode || !keep || !audit)
    throw new EncounterValidationError('The nested save policy is unavailable.')
  return serverRuleExecutionD20PolicyDtoSchema.parse({
    requestNodeId: requestNode.id,
    rollMode,
    keep,
    contributors: [...audit.contributors],
    contributorChecksum: audit.contributorChecksum,
    modifier: audit.modifier,
    dc: audit.defenseOrDc,
    ...savingThrowAbility(audit),
    ...policyAuditDice(audit)
  })
}

/**
 * Binds raw d20 faces to the completed kernel trace without exposing client arithmetic. `rollMode`
 * is the mode the faces were settled with (the applied mode when `modeAdjustment` is set); the
 * policy keeps the rules-derived one.
 */
export function buildEncounterActionD20Evidence(input: {
  execution: ServerCompletedRuleExecutionDto
  policy: ServerRuleExecutionD20PolicyDto
  requestId: string
  faces: readonly number[]
  rollMode: EncounterD20RollMode
  keep: RollModeKeep
  modeAdjustment?: ServerRuleExecutionD20EvidenceDto['modeAdjustment']
  /** The policy's added dice with the faces they rolled, in the policy's order. */
  addedDice: readonly D20RolledAddedDieDto[]
}): ServerRuleExecutionD20EvidenceDto {
  const natural = recordedD20Natural({ keep: input.keep, rawFaces: input.faces })
  const trace = input.execution.evidence.trace.find(
    (entry) => entry.evidence?.requestId === input.requestId && entry.evidence.value === natural
  )
  const resultPath = input.execution.outputs.resultPath
  if (!trace || typeof resultPath !== 'string') {
    throw new EncounterValidationError('The selected reaction action d20 trace is invalid.')
  }
  return serverRuleExecutionD20EvidenceDtoSchema.parse({
    requestId: input.requestId,
    rollMode: input.rollMode,
    keep: input.keep,
    derivedRollMode: input.policy.rollMode,
    rawFaces: input.faces,
    selectedNatural: natural,
    contributors: input.policy.contributors,
    contributorChecksum: input.policy.contributorChecksum,
    modifier: input.policy.modifier,
    total: natural + input.policy.modifier + d20AddedDiceTotal(input.addedDice),
    defenseOrDc: input.policy.dc,
    resultPath,
    ...savingThrowAbility(input.policy),
    ...autoFailConditions(input.policy),
    ...(input.modeAdjustment ? { modeAdjustment: input.modeAdjustment } : {}),
    ...(input.addedDice.length > 0 ? { addedDice: [...input.addedDice] } : {}),
    ...policyFoldedBonuses(input.policy.foldedBonuses)
  })
}

/** Seals one nested saving-throw roll before later OUTCOME evidence is collected. */
export function buildEncounterSaveD20Evidence(input: {
  policy: ServerRuleExecutionD20PolicyDto
  requestId: string
  faces: readonly number[]
  rollMode: EncounterD20RollMode
  keep: RollModeKeep
  addedDice: readonly D20RolledAddedDieDto[]
}): ServerRuleExecutionNestedD20EvidenceDto {
  const natural = recordedD20Natural({ keep: input.keep, rawFaces: input.faces })
  const total = natural + input.policy.modifier + d20AddedDiceTotal(input.addedDice)
  return serverRuleExecutionNestedD20EvidenceDtoSchema.parse({
    requestNodeId: input.policy.requestNodeId,
    requestId: input.requestId,
    rollMode: input.rollMode,
    keep: input.keep,
    derivedRollMode: input.policy.rollMode,
    rawFaces: input.faces,
    selectedNatural: natural,
    contributors: input.policy.contributors,
    contributorChecksum: input.policy.contributorChecksum,
    modifier: input.policy.modifier,
    total,
    defenseOrDc: input.policy.dc,
    resultPath:
      !input.policy.autoFailConditionIds?.length && total >= input.policy.dc
        ? 'ON_SAVE_SUCCESS'
        : 'ON_SAVE_FAIL',
    ...savingThrowAbility(input.policy),
    ...autoFailConditions(input.policy),
    ...(input.addedDice.length > 0 ? { addedDice: [...input.addedDice] } : {})
  })
}

/**
 * Whether settled d20 evidence carries the pins its test froze: the rules-derived roll mode, the
 * contributor checksum and the modifier. Every check of settled evidence against a frozen test
 * reads the three here.
 */
export function d20EvidenceMatchesPins(
  evidence: { derivedRollMode: string; contributorChecksum: string; modifier: number },
  frozen: { rollMode: string; contributorChecksum: string; modifier: number }
): boolean {
  return (
    evidence.derivedRollMode === frozen.rollMode &&
    evidence.contributorChecksum === frozen.contributorChecksum &&
    evidence.modifier === frozen.modifier
  )
}

/** Rejects terminal receipts whose nested save evidence is detached from the OUTCOME trace. */
export function requireEncounterSaveD20EvidenceTrace(input: {
  execution: ServerCompletedRuleExecutionDto
  policy: ServerRuleExecutionD20PolicyDto
  evidence: ServerRuleExecutionNestedD20EvidenceDto
}): void {
  if (
    input.evidence.requestNodeId !== input.policy.requestNodeId ||
    !d20EvidenceMatchesPins(input.evidence, input.policy) ||
    checksumRuleDocument(input.evidence.contributors) !== input.policy.contributorChecksum ||
    input.evidence.defenseOrDc !== input.policy.dc ||
    checksumRuleDocument(autoFailConditions(input.evidence)) !==
      checksumRuleDocument(autoFailConditions(input.policy)) ||
    // A die spent from the d20 window rides on the evidence only; the policy holds the authored dice.
    checksumRuleDocument(
      (input.evidence.addedDice ?? [])
        .filter((die) => die.spentEffectId === undefined)
        .map(({ rolledFaces: _rolledFaces, ...die }) => die)
    ) !== checksumRuleDocument(input.policy.addedDice ?? [])
  )
    throw new EncounterValidationError('The nested save d20 policy is invalid.')
  const rollTrace = input.execution.evidence.trace.find(
    (entry) =>
      entry.nodeId === input.evidence.requestNodeId &&
      entry.evidence?.requestId === input.evidence.requestId &&
      entry.evidence.value === input.evidence.selectedNatural
  )
  const saveTrace = input.execution.evidence.trace.find(
    (entry) =>
      entry.inputs.naturalD20 === input.evidence.selectedNatural &&
      entry.inputs.modifier === input.evidence.modifier &&
      entry.inputs.addedTotal === d20AddedDiceTotal(input.evidence.addedDice) &&
      entry.inputs.threshold === input.evidence.defenseOrDc &&
      entry.outputs.resultPath === input.evidence.resultPath
  )
  if (!rollTrace || !saveTrace)
    throw new EncounterValidationError('The nested save d20 trace is invalid.')
}
