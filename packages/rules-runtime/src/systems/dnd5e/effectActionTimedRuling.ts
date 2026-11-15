import type { CharacterRuleActionActiveEffectPlan } from '../../characterRuleActionSystemAdapter.js'
import {
  DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
  UUID,
  type Dnd5eCompiledEffectActionSource
} from './effectActionContracts.js'
import { conditionDurationTurns } from './effectActionFollowUp.js'
import { maintenancePlan } from './effectActionLifetime.js'
import { entryResultGate } from './effectActionTest.js'

/**
 * A GM ruling that lasts (D187a; Suggestion, "8 hours"): its one target holds an Encounter active
 * effect that freezes the ruling's text for the GM, counts the holder's turns and ends with the
 * duration or the Concentration that maintains it. Until dispelled (Arcane Lock), it lasts until the
 * GM ends it. The ruling itself stays the action's manual-adjudication proposal; the effect adds no
 * rule beyond holding it. Any lifecycle stays manual.
 */
export function timedRulingPlan(
  action: Dnd5eCompiledEffectActionSource
): Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> | null {
  const { entries } = action.compiledEffect
  // A sibling that lasts no longer than its use (Destroy Undead's kill beside "Turned") resolves as
  // a normal outcome; one with a duration, lifecycle or maintenance of its own has no plan here.
  const lasting = entries.filter(
    (candidate) =>
      // A rolled table row is not an instant result: it has no plan here.
      !('outcome' in candidate) ||
      candidate.duration !== undefined ||
      candidate.maintenanceDefinitionId !== undefined ||
      Object.values(candidate.lifecycle ?? {}).some((value) => value !== undefined)
  )
  const [entry] = lasting
  if (lasting.length !== 1 || !entry || !('outcome' in entry)) return null
  const { outcome, duration } = entry
  if (outcome.effectKind !== 'MANUAL_ADJUDICATION' || !duration) return null
  const indefinite = duration.durationKind === 'UNTIL_DISPELLED'
  const initialRemaining = indefinite ? null : conditionDurationTurns(duration)
  const resultGate = entryResultGate(action, entry.pathCode)
  if (
    (!indefinite && initialRemaining === null) ||
    resultGate === undefined ||
    Object.values(entry.lifecycle ?? {}).some((value) => value !== undefined) ||
    !UUID.test(entry.entryId) ||
    !UUID.test(outcome.id)
  )
    return null
  return {
    authoredEffectId: action.effectId,
    compiledEntryId: entry.entryId,
    frozenGraphNodeId: 'gm-ruling',
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    recurrenceStage: indefinite ? 'NONE' : 'END_OF_TURN',
    initialRemaining,
    rulingContribution: {
      rulingOutcomeId: outcome.id,
      label: outcome.label,
      instructions: outcome.instructions
    },
    ...(resultGate && { resultGate }),
    adapterFacts: {},
    perceptionContributions: [],
    maintenance: maintenancePlan(action, entry),
    marginRiders: []
  }
}
