import {
  damageRerollOptionId,
  type DamageRerollCostDto,
  type DamageRollWindowPayloadDto,
  type RolledDamageDieDto
} from '@artificer-toolkit/schema/shared/ruleExecutionDamageRollWindow'
import type {
  ServerCompletedRuleExecutionDto,
  ServerPublishedRuleDefinitionDto,
  ServerRuleExecutionContinuationDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument, type RuleValue } from '@artificer-toolkit/shared/rules'

import {
  ENCOUNTER_D20_WINDOW_CHOICE_DEFINITION_ID,
  type EncounterD20WindowSelection
} from './encounterD20Window.js'
import { EncounterValidationError } from './encounterErrors.js'
import {
  encounterSealedChoiceIndex,
  openEncounterSealedChoice,
  settleEncounterSealedChoice
} from './encounterSealedChoice.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'

/**
 * A settled damage window (D208): the cost its caster paid and the dice rolled again with their new
 * rolls, or no cost and no dice for a decline. It replays the phase the window froze.
 */
export type EncounterDamageRerollAnswer = {
  kind: 'DAMAGE_REROLL'
  option: DamageRollWindowPayloadDto['offer']['options'][number] | null
  rerolled: { requestId: string; value: number }[]
}

/**
 * Holds a completed phase's damage roll for its caster to pay a cost and reroll some of its dice: the
 * sealed choice they answer (index 0 keeps the roll) and the pause that freezes the roll and the costs.
 * `dice` and `costs` must not be empty.
 */
export async function openEncounterDamageRollWindow(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  gameSystemId: string
  execution: ServerCompletedRuleExecutionDto
  dice: readonly RolledDamageDieDto[]
  costs: readonly DamageRerollCostDto[]
}) {
  const executionChecksum = checksumRuleDocument(input.execution)
  const continuation = await openEncounterSealedChoice({
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    graph: {
      definitionId: ENCOUNTER_D20_WINDOW_CHOICE_DEFINITION_ID,
      gameSystemId: input.gameSystemId
    },
    optionCount: input.costs.length,
    declinable: true
  })
  const payload: DamageRollWindowPayloadDto = {
    damage: { execution: input.execution, dice: [...input.dice] },
    offer: {
      executionChecksum,
      options: input.costs.map((cost) => ({
        ...cost,
        optionId: damageRerollOptionId({ executionChecksum, modifierId: cost.modifierId })
      }))
    }
  }
  return { continuation, pause: { kind: 'ROLL_WINDOW' as const, payload } }
}

/**
 * Settles a damage window: the chosen cost names from one to its most dice the roll rolled, each
 * once, and each is rolled again (or the entered faces checked against its size). Declining keeps
 * the roll. The caller's commit pays the cost.
 */
export async function settleEncounterDamageRollWindow(input: {
  runtime: RulesRuntimeService
  window: DamageRollWindowPayloadDto
  continuation: ServerRuleExecutionContinuationDto
  selection: EncounterD20WindowSelection
  random: (maxExclusive: number) => number
}): Promise<EncounterDamageRerollAnswer> {
  const { window, selection } = input
  if (checksumRuleDocument(window.damage.execution) !== window.offer.executionChecksum)
    throw new EncounterValidationError('The damage roll window evidence is stale.')
  const option =
    selection.kind === 'DECLINE'
      ? null
      : window.offer.options.find(({ optionId }) => optionId === selection.optionId)
  if (option === undefined)
    throw new EncounterValidationError('The damage roll window option was not offered.')
  const requestIds = selection.kind === 'USE' ? (selection.dice ?? []) : []
  const faces = selection.kind === 'USE' ? selection.faces : undefined
  if (
    option &&
    (requestIds.length === 0 ||
      requestIds.length > option.maxDice ||
      new Set(requestIds).size !== requestIds.length ||
      (faces !== undefined && faces.length !== requestIds.length))
  )
    throw new EncounterValidationError(
      'A damage reroll names from one to its most rolled dice, each once, with a face for each entered.'
    )
  const rerolled = requestIds.map((requestId, index) => {
    const die = window.damage.dice.find((rolled) => rolled.requestId === requestId)
    if (!die)
      throw new EncounterValidationError('A damage reroll names a die the roll did not roll.')
    const value = faces?.[index] ?? input.random(die.faces) + 1
    if (value > die.faces) throw new EncounterValidationError('A rerolled face exceeds its die.')
    return { requestId, value }
  })
  await settleEncounterSealedChoice({
    runtime: input.runtime,
    continuation: input.continuation,
    selectedIndex: encounterSealedChoiceIndex(window.offer.options, option),
    label: 'The damage roll window'
  })
  return { kind: 'DAMAGE_REROLL', option, rerolled }
}

/**
 * Replays the phase a damage window froze: each request is answered as the frozen roll answered it,
 * a rerolled die with its new roll. A replay that asks anything else, or runs on other facts or another
 * graph, is stale.
 */
export async function replayEncounterDamageRollWindow(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  published: ServerPublishedRuleDefinitionDto
  facts: Readonly<Record<string, RuleValue>>
  window: DamageRollWindowPayloadDto
  rerolled: EncounterDamageRerollAnswer['rerolled']
}): Promise<ServerCompletedRuleExecutionDto> {
  const frozen = input.window.damage.execution
  const values = new Map(
    frozen.evidence.trace.flatMap(({ evidence }) =>
      evidence ? [[evidence.requestId, evidence.value] as const] : []
    )
  )
  for (const { requestId, value } of input.rerolled) values.set(requestId, value)
  let result = await input.runtime.executeResolved({
    command: {
      definitionId: input.published.id,
      occurrenceId: input.occurrenceId,
      facts: input.facts
    },
    published: input.published
  })
  while (result.status === 'PAUSED') {
    const { requestId } = result.continuation.request
    const value = values.get(requestId)
    if (value === undefined) throw new Error('The damage roll window evidence is stale.')
    result = await input.runtime.resume({
      continuation: result.continuation,
      response: { requestId, value }
    })
  }
  if (
    result.status !== 'COMPLETE' ||
    checksumRuleDocument(result.evidence.source) !== checksumRuleDocument(frozen.evidence.source) ||
    checksumRuleDocument(result.evidence.facts) !== checksumRuleDocument(frozen.evidence.facts)
  )
    throw new Error('The damage roll window evidence is stale.')
  return result
}
