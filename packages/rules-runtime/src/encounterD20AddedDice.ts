import {
  d20AddedDiceTotal,
  type D20AddedDieDto,
  type D20RolledAddedDieDto
} from '@artificer-toolkit/schema/shared/d20AddedDice'
import type {
  ServerRuleExecutionContinuationDto,
  ServerRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/ruleExecutionProtocol'
import { addedDiceTotalEvidenceRuleOperation } from '@artificer-toolkit/shared/rules'

import { EncounterValidationError } from './encounterErrors.js'
import type { EncounterEvidenceAnswer, EncounterResponseAnswer } from './encounterEvidenceAnswer.js'

// The dice an Encounter d20 test rolls beside its d20 (D156): settled from the same answer as the
// d20, and fed to the test graph's added-dice node right after the d20 it follows.

/**
 * The faces an answer settles a test's added dice with, die by die in the request's order: rolled
 * now for an auto-roll, read from the app roll's record or the roller's entry otherwise. An answer
 * must carry faces exactly when the test rolls dice, one per die and each within its size.
 */
export function resolveEncounterAddedDice(input: {
  dice: readonly D20AddedDieDto[]
  answer: EncounterEvidenceAnswer | EncounterResponseAnswer
  random: (maxExclusive: number) => number
}): D20RolledAddedDieDto[] {
  const { dice, answer } = input
  if (answer.kind === 'AUTO_ROLL')
    return dice.map((die) => ({
      ...die,
      rolledFaces: Array.from({ length: die.count }, () => input.random(die.faces) + 1)
    }))
  const entered =
    answer.kind === 'ENTER_DICE' || answer.kind === 'SYSTEM_ROLL' ? answer.addedFaces : undefined
  if (dice.length === 0) {
    if (entered !== undefined)
      throw new EncounterValidationError('The roll has no added dice to answer.')
    return []
  }
  if (entered?.length !== dice.reduce((count, die) => count + die.count, 0))
    throw new EncounterValidationError('The roll needs one face for each added die.')
  let next = 0
  return dice.map((die) => {
    const rolledFaces = entered.slice(next, (next += die.count))
    if (rolledFaces.some((face) => !Number.isSafeInteger(face) || face < 1 || face > die.faces))
      throw new EncounterValidationError('An added die face is outside its size.')
    return { ...die, rolledFaces }
  })
}

function pausedOnAddedDice(result: ServerRuleExecutionResultDto): boolean {
  return (
    result.status === 'PAUSED' &&
    result.continuation.graph.nodes[result.continuation.nextNodeIndex]?.operation.key ===
      addedDiceTotalEvidenceRuleOperation.key
  )
}

/**
 * Answers a test graph's paused d20 with the kept natural, then its added-dice node with the dice's
 * signed total. The graph asks for the total exactly when the test rolls dice; a mismatch between
 * the dice and the graph throws.
 */
export async function resumeEncounterD20(input: {
  continuation: ServerRuleExecutionContinuationDto
  natural: number
  addedDice: readonly D20RolledAddedDieDto[]
  resume: (step: {
    continuation: ServerRuleExecutionContinuationDto
    response: { requestId: string; value: number }
  }) => Promise<ServerRuleExecutionResultDto>
}): Promise<ServerRuleExecutionResultDto> {
  const result = await input.resume({
    continuation: input.continuation,
    response: { requestId: input.continuation.request.requestId, value: input.natural }
  })
  if (pausedOnAddedDice(result) !== input.addedDice.length > 0)
    throw new EncounterValidationError("The roll's added dice do not match the test.")
  if (result.status !== 'PAUSED' || input.addedDice.length === 0) return result
  return input.resume({
    continuation: result.continuation,
    response: {
      requestId: result.continuation.request.requestId,
      value: d20AddedDiceTotal(input.addedDice)
    }
  })
}
