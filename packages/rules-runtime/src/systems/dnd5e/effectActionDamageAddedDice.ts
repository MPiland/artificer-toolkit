import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import type { RuleGraphDefinition, RuleInputBinding } from '@artificer-toolkit/shared/rules'
import type { IncomingDamageReductionsDto } from '@artificer-toolkit/schema/grants/modifier'
import {
  damageAddedDieNodePrefix,
  type DamageAddedDieDto
} from '@artificer-toolkit/schema/shared/d20AddedDice'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import {
  DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
  DND5E_DAMAGE_REDUCTION_OPERATION_KEY,
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
  type Dnd5eCompiledEffectActionSource,
  type SpecializedPath,
  unsupported
} from './effectActionContracts.js'
import {
  damageMultiplier,
  damageTypeIdentity,
  multipliedDamage,
  rolledDiceNodes
} from './effectActionOutcomeNodes.js'
import { boundedDiceTerm, type BoundedDiceTerm } from './effectActionScalingFacts.js'

/**
 * A critical hit rolls every damage die of the attack's hit damage twice and adds the modifier
 * once (SRD 5.1). Every attack OUTCOME applies it here; authored ON_CRIT riders and the damage of
 * a save the hit forces are not the attack's damage and keep their dice.
 */
export function isCriticalHitDamage(
  selectedPath: SpecializedPath,
  entry: CompiledEffectGroup['entries'][number]
): boolean {
  return (
    selectedPath === 'ON_CRIT' &&
    entry.pathCode === 'ON_HIT' &&
    'outcome' in entry &&
    entry.outcome.effectKind === 'DAMAGE'
  )
}

/** One added die's own damage (D156): its dice, the multiplier of the damage it joins, its proposal. */
function addedDamageDieGraphDefinition(input: {
  action: Dnd5eCompiledEffectActionSource
  term: BoundedDiceTerm
  prefix: string
  damageTypeId: string
  multiplier: number
}): RuleGraphDefinition {
  const { nodes: rolledNodes, subtotal } = rolledDiceNodes(input.term, input.prefix)
  const multiplied = multipliedDamage(
    `${input.prefix}damage-multiplied`,
    subtotal,
    input.multiplier
  )
  const proposalId = `${input.prefix}proposal`
  return {
    schemaVersion: 1,
    id: input.action.effectId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      ...rolledNodes,
      ...multiplied.nodes,
      {
        id: proposalId,
        operation: { key: DND5E_DAMAGE_PROPOSAL_OPERATION_KEY, contractVersion: 1 },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          targetStateChecksum: { kind: 'FACT', factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY },
          amount: multiplied.amount,
          damageTypeId: { kind: 'LITERAL', value: input.damageTypeId }
        }
      }
    ],
    outputs: {
      targetActorId: { kind: 'NODE_OUTPUT', nodeId: proposalId, port: 'targetActorId' },
      amount: { kind: 'NODE_OUTPUT', nodeId: proposalId, port: 'amount' },
      damageTypeId: { kind: 'NODE_OUTPUT', nodeId: proposalId, port: 'damageTypeId' }
    }
  }
}

/**
 * The selected result with the dice active grants add to or take from its first damage (D156).
 * Each added die deals its own damage of its type (the joined damage's when it names none), rolled
 * twice on a critical hit and multiplied like the joined damage. Each subtracted die is rolled the
 * same way and taken off the joined damage, floored at 0. On a hit, each of the target's incoming
 * reductions then takes its die (never doubled on a critical hit) and its flat amount off that damage,
 * floored at 0, before the target's halving and defenses apply to it. A miss, or a result with no
 * damage, takes none of them.
 */
export function withDamageAddedDice(input: {
  action: Dnd5eCompiledEffectActionSource
  selectedPath: SpecializedPath
  groups: readonly (readonly CompiledEffectGroup['entries'][number][])[]
  definitions: readonly RuleGraphDefinition[]
  dice: readonly DamageAddedDieDto[]
  incomingReductions: IncomingDamageReductionsDto
}): readonly RuleGraphDefinition[] {
  const incomingReductions =
    input.selectedPath === 'ON_HIT' || input.selectedPath === 'ON_CRIT'
      ? input.incomingReductions
      : []
  const primaryIndex = input.groups.findIndex(
    ([entry]) => entry !== undefined && 'outcome' in entry && entry.outcome.effectKind === 'DAMAGE'
  )
  const primaryEntry = input.groups[primaryIndex]?.[0]
  const primary = input.definitions[primaryIndex]
  if (
    (input.dice.length === 0 && incomingReductions.length === 0) ||
    input.selectedPath === 'ON_MISS' ||
    !primary ||
    !primaryEntry ||
    !('outcome' in primaryEntry) ||
    primaryEntry.outcome.effectKind !== 'DAMAGE'
  )
    return input.definitions
  const joined = primaryEntry.outcome
  const critical = isCriticalHitDamage(input.selectedPath, primaryEntry)
    ? { extraDice: 0 }
    : undefined
  const term = (die: DamageAddedDieDto) =>
    boundedDiceTerm(`${die.count}d${die.faces}`, critical).term
  const added = input.dice.flatMap((die, index) =>
    die.sign === 'ADD'
      ? [
          addedDamageDieGraphDefinition({
            action: input.action,
            term: term(die),
            prefix: damageAddedDieNodePrefix(index),
            damageTypeId: die.damageTypeId ?? damageTypeIdentity(joined.damageTypeId),
            multiplier: damageMultiplier(joined)
          })
        ]
      : []
  )
  const proposalIndex = primary.nodes.findIndex(
    (node) => node.operation.key === DND5E_DAMAGE_PROPOSAL_OPERATION_KEY
  )
  const proposal = primary.nodes[proposalIndex]
  const joinedAmount = proposal?.inputs.amount
  if (!proposal || !joinedAmount) unsupported('D&D added damage dice need the damage they join.')
  let amount = joinedAmount
  // Each reduction takes from the amount the one before it left.
  const reduce = (id: string, reduction: RuleInputBinding) => {
    const reduced = {
      id,
      operation: { key: DND5E_DAMAGE_REDUCTION_OPERATION_KEY, contractVersion: 1 },
      inputs: { amount, reduction }
    }
    amount = { kind: 'NODE_OUTPUT', nodeId: reduced.id, port: 'value' }
    return reduced
  }
  const reductionNodes = input.dice.flatMap((die, index) => {
    if (die.sign !== 'SUBTRACT') return []
    const prefix = damageAddedDieNodePrefix(index)
    const { nodes, subtotal } = rolledDiceNodes(term(die), prefix)
    return [...nodes, reduce(`${prefix}damage-reduced`, subtotal)]
  })
  const incomingReductionNodes = incomingReductions.flatMap(({ die, flat }, index) => {
    const prefix = `incoming-reduction-${index + 1}-`
    const rolled = die && rolledDiceNodes(boundedDiceTerm(`${die.count}d${die.faces}`).term, prefix)
    return [
      ...(rolled ? [...rolled.nodes, reduce(`${prefix}rolled`, rolled.subtotal)] : []),
      ...(flat > 0 ? [reduce(`${prefix}flat`, { kind: 'LITERAL', value: flat })] : [])
    ]
  })
  const reducedPrimary: RuleGraphDefinition = {
    ...primary,
    nodes: [
      ...primary.nodes.slice(0, proposalIndex),
      ...reductionNodes,
      ...incomingReductionNodes,
      { ...proposal, inputs: { ...proposal.inputs, amount } },
      ...primary.nodes.slice(proposalIndex + 1)
    ]
  }
  return [
    ...input.definitions.slice(0, primaryIndex),
    reducedPrimary,
    ...input.definitions.slice(primaryIndex + 1),
    ...added
  ]
}
