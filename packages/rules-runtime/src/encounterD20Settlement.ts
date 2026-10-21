import {
  d20AddedDiceTotal,
  type D20AddedDieDto,
  type D20RolledAddedDieDto
} from '@artificer-toolkit/schema/shared/d20AddedDice'
import type { D20MinimumRollDto } from '@artificer-toolkit/schema/shared/d20MinimumRoll'
import type {
  ServerCompletedRuleExecutionDto,
  ServerRuleExecutionContinuationDto,
  ServerRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/ruleExecutionProtocol'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { resolveEncounterAddedDice, resumeEncounterD20 } from './encounterD20AddedDice.js'
import {
  resolveEncounterD20Answer,
  type EncounterD20RollMode,
  type EncounterEvidenceAnswer,
  type EncounterResponseAnswer
} from './encounterEvidenceAnswer.js'

// The one d20 test settlement (ADR 0039 decision 2): a test freezes its d20 context when it is
// prepared, an answer settles against that context (faces, kept mode and added dice), and the test
// graph resumes with the kept natural and the added dice's total, then is checked against them.

/**
 * A d20 test's frozen context: the roller's mode, contributors (with their checksum) and modifier,
 * plus the dice its effects add (D156) and the floor they put on the d20, named only when present.
 */
export function freezeD20Context<TContributor>(facts: {
  rollMode: EncounterD20RollMode
  contributors: readonly TContributor[]
  modifier: number
  addedDice?: readonly D20AddedDieDto[]
  minimumRoll?: D20MinimumRollDto | null
}) {
  return {
    rollMode: facts.rollMode,
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
  natural: number
  addedDice: D20RolledAddedDieDto[]
}

/**
 * Settles an answer against a frozen d20 test: its faces and mode (the frozen mode for an
 * auto-roll), then its added dice from the same answer. The d20 rolls before the added dice. A
 * test that freezes no added dice refuses an answer that carries added faces.
 */
export function settleEncounterD20Answer(input: {
  d20: { rollMode: EncounterD20RollMode; addedDice?: readonly D20AddedDieDto[] }
  answer: EncounterEvidenceAnswer | EncounterResponseAnswer
  rollD20: () => number
  random: (maxExclusive: number) => number
}): EncounterD20Roll {
  const { faces, rollMode, natural } = resolveEncounterD20Answer({
    derivedRollMode: input.d20.rollMode,
    answer: input.answer,
    rollD20: input.rollD20
  })
  const addedDice = resolveEncounterAddedDice({
    dice: input.d20.addedDice ?? [],
    answer: input.answer,
    random: input.random
  })
  return { rawFaces: faces, rollMode, natural, addedDice }
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
