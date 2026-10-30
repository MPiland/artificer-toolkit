import {
  d20AddedDiceDtoSchema,
  type D20AddedDieDto
} from '@artificer-toolkit/schema/shared/d20AddedDice'
import {
  RULE_VALUE_KIND,
  addedDiceTotalEvidenceRuleOperation,
  type RuleGraphDefinition
} from '@artificer-toolkit/shared/rules'

// The dice a D&D d20 test rolls beside its d20 and adds to its total after advantage or
// disadvantage keeps one d20 (D156). Every test graph carries one added-dice node right after its
// d20; a test with no dice settles it at 0 without a request.

const DND5E_ADDED_DICE_MIN_FACT_KEY = 'dnd5e.added-dice-min'
const DND5E_ADDED_DICE_MAX_FACT_KEY = 'dnd5e.added-dice-max'
/** Whether the test rolls added dice; false settles the node at its minimum, 0, unrequested. */
const DND5E_ADDED_DICE_ENABLED_FACT_KEY = 'dnd5e.added-dice-enabled'

export const dnd5eAddedDiceFactContracts = [
  { key: DND5E_ADDED_DICE_MIN_FACT_KEY, valueKind: RULE_VALUE_KIND.NUMBER },
  { key: DND5E_ADDED_DICE_MAX_FACT_KEY, valueKind: RULE_VALUE_KIND.NUMBER },
  { key: DND5E_ADDED_DICE_ENABLED_FACT_KEY, valueKind: RULE_VALUE_KIND.BOOLEAN }
] as const

/**
 * The added dice an Encounter derived for one d20 test (D156): a source's attack dice keyed by
 * attack domain, or a target's saving-throw dice keyed by ability definition. None when absent.
 */
export function derivedAddedDice(diceByKey: unknown, key: string): D20AddedDieDto[] {
  const dice =
    typeof diceByKey === 'object' && diceByKey !== null
      ? (diceByKey as Record<string, unknown>)[key]
      : undefined
  return dice === undefined ? [] : d20AddedDiceDtoSchema.parse(dice)
}

/** A target's saving-throw dice for one ability: those added at the roll, and those held until the d20 is seen. */
export function derivedSaveDice(
  derivedFacts: Record<string, unknown>,
  abilityDefinitionId: string
) {
  return {
    addedDice: derivedAddedDice(derivedFacts.savingThrowAddedDice, abilityDefinitionId),
    heldDice: derivedAddedDice(derivedFacts.savingThrowAfterRollDice, abilityDefinitionId)
  }
}

/** The added-dice node that follows a test's d20 node, whose total the test op adds. */
export function dnd5eAddedDiceNode(d20NodeId: string): RuleGraphDefinition['nodes'][number] {
  return {
    id: `${d20NodeId}-added-dice`,
    operation: {
      key: addedDiceTotalEvidenceRuleOperation.key,
      contractVersion: addedDiceTotalEvidenceRuleOperation.contractVersion
    },
    inputs: {
      min: { kind: 'FACT', factKey: DND5E_ADDED_DICE_MIN_FACT_KEY },
      max: { kind: 'FACT', factKey: DND5E_ADDED_DICE_MAX_FACT_KEY },
      enabled: { kind: 'FACT', factKey: DND5E_ADDED_DICE_ENABLED_FACT_KEY }
    }
  }
}

/**
 * The added-dice node's facts: the signed range the dice can total, requested only when the test
 * rolls dice and is attempted (a gated repeat save that is not attempted rolls none). A die the
 * holder keeps for after its d20 (`heldDice`) may or may not be spent, so it widens the range
 * toward its extreme and leaves the other end at 0.
 */
export function dnd5eAddedDiceFacts(
  dice: readonly D20AddedDieDto[],
  attempted = true,
  heldDice: readonly D20AddedDieDto[] = []
): Record<string, number | boolean> {
  let min = 0
  let max = 0
  if (attempted) {
    for (const { count, faces, sign } of dice) {
      min += sign === 'ADD' ? count : -count * faces
      max += sign === 'ADD' ? count * faces : -count
    }
    for (const { count, faces, sign } of heldDice) {
      if (sign === 'ADD') max += count * faces
      else min -= count * faces
    }
  }
  return {
    [DND5E_ADDED_DICE_MIN_FACT_KEY]: min,
    [DND5E_ADDED_DICE_MAX_FACT_KEY]: max,
    [DND5E_ADDED_DICE_ENABLED_FACT_KEY]: attempted && dice.length + heldDice.length > 0
  }
}

/**
 * The added total a committed test's added-dice trace settled at, after proving the trace is the
 * node that follows `d20NodeId` at `nodeIndex`, read the bound facts, and was answered exactly when
 * its facts enabled it. Throws `invalid()` otherwise.
 */
export function requireDnd5eAddedDiceTotal(input: {
  trace:
    | {
        nodeId: string
        operation: { key: string; contractVersion: number }
        inputs: Readonly<Record<string, unknown>>
        outputs: Readonly<Record<string, unknown>>
        evidence?: { requestId: string; kind: string; value: number }
      }
    | undefined
  facts: Readonly<Record<string, unknown>>
  d20NodeId: string
  nodeIndex: number
  occurrenceId: string
  invalid: () => Error
}): number {
  const { trace, facts } = input
  const nodeId = `${input.d20NodeId}-added-dice`
  const min = facts[DND5E_ADDED_DICE_MIN_FACT_KEY]
  const max = facts[DND5E_ADDED_DICE_MAX_FACT_KEY]
  const enabled = facts[DND5E_ADDED_DICE_ENABLED_FACT_KEY]
  const value = trace?.outputs.value
  if (
    trace?.nodeId !== nodeId ||
    trace.operation.key !== addedDiceTotalEvidenceRuleOperation.key ||
    trace.operation.contractVersion !== addedDiceTotalEvidenceRuleOperation.contractVersion ||
    typeof min !== 'number' ||
    typeof max !== 'number' ||
    typeof enabled !== 'boolean' ||
    typeof value !== 'number' ||
    trace.inputs.min !== min ||
    trace.inputs.max !== max ||
    trace.inputs.enabled !== enabled ||
    (enabled
      ? trace.evidence?.kind !== 'INTEGER_RANGE' ||
        trace.evidence.value !== value ||
        trace.evidence.requestId !== `${input.occurrenceId}:${input.nodeIndex}:${nodeId}` ||
        !Number.isSafeInteger(value) ||
        value < min ||
        value > max
      : trace.evidence !== undefined || min !== 0 || value !== 0)
  )
    throw input.invalid()
  return value
}
