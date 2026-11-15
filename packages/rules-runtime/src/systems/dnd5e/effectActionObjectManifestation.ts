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
 * An object manifestation that lasts (Light, Continual Flame): its one target holds an Encounter
 * active effect that freezes the object's label, light, properties and attachment, counts the
 * holder's turns and ends with the duration or the Concentration that maintains it. Until
 * dispelled, it lasts until the GM ends it. The effect adds no rule beyond holding the object
 * (the scene reads its light from the contribution); any lifecycle stays manual.
 */
export function objectManifestationPlan(
  action: Dnd5eCompiledEffectActionSource
): Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> | null {
  const [entry, ...otherEntries] = action.compiledEffect.entries
  if (otherEntries.length > 0 || !entry || !('outcome' in entry)) return null
  const { outcome, duration } = entry
  if (outcome.effectKind !== 'MANIFEST' || outcome.manifestKind !== 'OBJECT' || !duration)
    return null
  const indefinite = duration.durationKind === 'UNTIL_DISPELLED'
  const initialRemaining = indefinite ? null : conditionDurationTurns(duration)
  const resultGate = entryResultGate(action, entry.pathCode)
  if (
    (!indefinite && initialRemaining === null) ||
    resultGate === undefined ||
    Object.values(entry.lifecycle ?? {}).some((value) => value !== undefined) ||
    !UUID.test(entry.entryId) ||
    !UUID.test(outcome.id) ||
    !outcome.label ||
    // A shaped light (a cone, a line) is not a light around its holder's token.
    outcome.shape
  )
    return null
  return {
    authoredEffectId: action.effectId,
    compiledEntryId: entry.entryId,
    frozenGraphNodeId: 'object-manifestation',
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    recurrenceStage: indefinite ? 'NONE' : 'END_OF_TURN',
    initialRemaining,
    objectManifestationContribution: {
      manifestationOutcomeId: outcome.id,
      label: outcome.label,
      attachmentKind: outcome.attachmentKind ?? null,
      light: outcome.light ?? null,
      properties: [...(outcome.properties ?? [])].sort()
    },
    ...(resultGate && { resultGate }),
    adapterFacts: {},
    perceptionContributions: [],
    maintenance: maintenancePlan(action, entry),
    marginRiders: []
  }
}
