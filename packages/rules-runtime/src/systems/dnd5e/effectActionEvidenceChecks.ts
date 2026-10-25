import { type CompiledRuleGraph } from '@artificer-toolkit/shared/rules'
import type { CharacterRuleActionSystemAdapter } from '../../characterRuleActionSystemAdapter.js'
import {
  DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY,
  DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY,
  isPathConditionImmuneFactKey,
  DND5E_ACTIVE_EFFECT_REPEAT_SAVE_CONDITION_FACT_KEY,
  DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY,
  UUID,
  Dnd5eEffectActionCompilerError,
  proposalNodePathCode
} from './effectActionContracts.js'

export function hitPointStateIsValid(input: {
  currentHitPoints: number
  maximumHitPoints: number
  temporaryHitPoints: number
}): boolean {
  return (
    Number.isSafeInteger(input.currentHitPoints) &&
    Number.isSafeInteger(input.maximumHitPoints) &&
    Number.isSafeInteger(input.temporaryHitPoints) &&
    input.currentHitPoints >= 0 &&
    input.maximumHitPoints >= 0 &&
    input.temporaryHitPoints >= 0 &&
    input.currentHitPoints <= input.maximumHitPoints
  )
}

/** The conditions a repeat save holds, or null for one that holds modifier grants. */
export function repeatSaveConditionIds(
  adapterFacts: Readonly<Record<string, string | number | boolean>>
): string[] | null {
  const fact = adapterFacts[DND5E_ACTIVE_EFFECT_REPEAT_SAVE_CONDITION_FACT_KEY]
  if (fact === undefined) return null
  const ids = typeof fact === 'string' ? fact.split(',') : []
  if (ids.length === 0 || !ids.every((id) => UUID.test(id))) {
    throw new Dnd5eEffectActionCompilerError('D&D repeated save condition identity is invalid.')
  }
  return ids
}
export type DirectInterpretationInput = Pick<
  Parameters<CharacterRuleActionSystemAdapter['interpret']>[0],
  | 'execution'
  | 'occurrenceId'
  | 'targetActorId'
  | 'currentHitPoints'
  | 'temporaryHitPoints'
  | 'maximumHitPoints'
  | 'defenses'
  | 'conditionImmunityIds'
  | 'incomingHalved'
> & {
  /** Set by a graph's loop once an earlier proposal has moved `currentHitPoints`; the facts keep the starting value. */
  startingHitPoints?: number
}
export function conditionImmunityFacts(
  graph: Pick<CompiledRuleGraph, 'nodes'>,
  conditionImmunityIds: readonly string[] | undefined
): Record<string, boolean> {
  const facts: Record<string, boolean> = {}
  const identitiesByFactKey = new Map<string, string>()
  const conditionNodes = graph.nodes.filter(
    (node) =>
      node.operation.key === DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY ||
      node.operation.key === DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY
  )
  const legacySingleCondition =
    conditionNodes.length === 1 &&
    conditionNodes[0]?.inputs.authoredPath === undefined &&
    conditionNodes[0]?.inputs.conditionImmune?.kind === 'FACT' &&
    conditionNodes[0].inputs.conditionImmune.factKey === DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY
  let conditionCount = 0
  for (const node of graph.nodes) {
    if (
      node.operation.key !== DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY &&
      node.operation.key !== DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY
    )
      continue
    conditionCount += 1
    const conditionId = node.inputs.conditionId
    if (
      !conditionId ||
      conditionId.kind !== 'LITERAL' ||
      typeof conditionId.value !== 'string' ||
      !UUID.test(conditionId.value)
    )
      throw new Dnd5eEffectActionCompilerError(
        'The D&D condition action does not bind one exact condition identity.'
      )
    const binding = node.inputs.conditionImmune
    const path = node.inputs.authoredPath
    const pathCode =
      path?.kind === 'LITERAL' && typeof path.value === 'string'
        ? path.value
        : proposalNodePathCode(node.id)
    if (
      !binding ||
      binding.kind !== 'FACT' ||
      (legacySingleCondition
        ? binding.factKey !== DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY
        : !pathCode || !isPathConditionImmuneFactKey(binding.factKey, pathCode))
    )
      throw new Dnd5eEffectActionCompilerError(
        'The D&D condition action immunity binding is invalid.'
      )
    const factKey = binding.factKey
    const previous = identitiesByFactKey.get(factKey)
    if (previous !== undefined && previous !== conditionId.value)
      throw new Dnd5eEffectActionCompilerError(
        'The D&D condition action reuses one immunity fact for different conditions.'
      )
    identitiesByFactKey.set(factKey, conditionId.value)
    facts[factKey] = (conditionImmunityIds ?? []).includes(conditionId.value)
  }
  if (conditionCount === 1 && legacySingleCondition) {
    const conditionId = [...identitiesByFactKey.values()][0]
    if (conditionId !== undefined)
      facts[DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY] = (conditionImmunityIds ?? []).includes(
        conditionId
      )
  }
  return facts
}
