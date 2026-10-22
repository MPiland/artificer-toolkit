import {
  d20AddedDiceTotal,
  type D20AddedDieDto,
  type D20RolledAddedDieDto
} from '@artificer-toolkit/schema/shared/d20AddedDice'
import type { D20MinimumRollDto } from '@artificer-toolkit/schema/shared/d20MinimumRoll'
import type { RollModeKeep } from '@artificer-toolkit/schema/shared/systemVocabularyCode'
import type {
  ServerCompletedRuleExecutionDto,
  ServerRuleExecutionContinuationDto,
  ServerRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/ruleExecutionProtocol'
import type {
  ServerRuleExecutionD20EvidenceDto,
  ServerRuleExecutionD20PolicyDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { resolveEncounterAddedDice, resumeEncounterD20 } from './encounterD20AddedDice.js'
import { rollModeCapabilityRegistry } from './platformPolicyModules.js'
import { settleSightGovernedD20, type SightGovernedD20 } from './encounterSightGovernedD20.js'
import {
  resolveEncounterD20Answer,
  resolveEncounterIntegerAnswer,
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
 * Resumes a d20 test graph with a settled roll and verifies the completed graph against it. Each
 * named output port must carry its value: `rawDie` the kept natural, `addedTotal` the added dice's
 * signed total, and `total` the natural plus `modifier` plus that total. A graph that does not
 * complete or reports other values throws `refusal`.
 */
export async function settleEncounterD20Test(input: {
  continuation: ServerRuleExecutionContinuationDto
  roll: Pick<EncounterD20Roll, 'natural' | 'addedDice'>
  resume: (step: {
    continuation: ServerRuleExecutionContinuationDto
    response: { requestId: string; value: number }
  }) => Promise<ServerRuleExecutionResultDto>
  outputs: { rawDie: string; addedTotal?: string; total?: { port: string; modifier: number } }
  refusal: () => Error
}): Promise<ServerCompletedRuleExecutionDto> {
  const { roll, outputs } = input
  const execution = await resumeEncounterD20({
    continuation: input.continuation,
    natural: roll.natural,
    addedDice: roll.addedDice,
    resume: input.resume
  })
  const addedTotal = d20AddedDiceTotal(roll.addedDice)
  if (
    execution.status !== 'COMPLETE' ||
    execution.outputs[outputs.rawDie] !== roll.natural ||
    (outputs.addedTotal !== undefined && execution.outputs[outputs.addedTotal] !== addedTotal) ||
    (outputs.total !== undefined &&
      execution.outputs[outputs.total.port] !== roll.natural + outputs.total.modifier + addedTotal)
  )
    throw input.refusal()
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
