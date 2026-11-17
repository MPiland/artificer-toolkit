import type { CharacterRuleActionActiveEffectPlan } from '../../characterRuleActionSystemAdapter.js'
import { castLevelDamageRows, castLevelDiceDamage } from './effectActionCastLevelDamage.js'
import {
  DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
  Dnd5eEffectActionCompilerError,
  UUID,
  type Dnd5eCompiledEffectActionSource
} from './effectActionContracts.js'
import { diceGraphDefinition } from './effectActionDiceGraph.js'
import { conditionDurationTurns, followUpCheckEscape } from './effectActionFollowUp.js'
import { maintenancePlan } from './effectActionLifetime.js'
import { publishedGraph } from './effectActionPublishedGraph.js'
import { entryResultGate } from './effectActionTest.js'

/** The frozen node of an object its holder only holds; an attached object's damage has its own. */
export const HELD_OBJECT_NODE_ID = 'object-manifestation'

/**
 * An object a test's result attaches to its target that deals damage at the target's turn boundary
 * (lingering acid, burning flames): its one component names the boundary, at the start of each of
 * the target's turns until it ends, or at the end of the target's next turn once, and its one
 * behavior rolls one dice damage on use (`attachedObjectDamageGraph` freezes the row the cast level
 * reaches). A repeatable check on the same result that ends it on success is its escape. The test
 * deals the action's other entries, which are damage, as usual. Null for any other action.
 */
export function attachedObjectDamagePlan(action: Dnd5eCompiledEffectActionSource) {
  return attachedObject(action)?.plan ?? null
}

/** The attached object's damage at the row the action's cast level reaches, frozen as its graph. */
export function attachedObjectDamageGraph(
  action: Dnd5eCompiledEffectActionSource,
  plan: Pick<CharacterRuleActionActiveEffectPlan, 'compiledEntryId' | 'frozenGraphNodeId'>
) {
  const held = attachedObject(action)
  if (!held) throw new Dnd5eEffectActionCompilerError('D&D attached object damage has no plan.')
  const damage = castLevelDiceDamage(held.rows, action.spellCastLevel)
  const row = held.rolls.find((roll) => roll.outcome.id === damage.entryId)
  if (!row)
    throw new Dnd5eEffectActionCompilerError('D&D held damage has no row at the cast level.')
  return publishedGraph(
    diceGraphDefinition({ action, entry: row, diceConfig: damage.diceConfig, recurring: plan })
  )
}

function attachedObject(action: Dnd5eCompiledEffectActionSource) {
  const entries = action.compiledEffect.entries.flatMap((entry) =>
    'outcome' in entry ? [entry] : []
  )
  const objects = entries.filter(({ outcome }) => outcome.effectKind === 'MANIFEST')
  const checks = entries.filter(({ outcome }) => outcome.effectKind === 'FOLLOW_UP_CHECK')
  const [entry] = objects
  const [check] = checks
  if (
    !entry ||
    entry.outcome.effectKind !== 'MANIFEST' ||
    entry.outcome.manifestKind !== 'OBJECT' ||
    objects.length !== 1 ||
    checks.length > 1 ||
    entries.length !== action.compiledEffect.entries.length ||
    entries.some(
      ({ outcome }) => !['MANIFEST', 'FOLLOW_UP_CHECK', 'DAMAGE'].includes(outcome.effectKind)
    )
  )
    return null
  const { outcome } = entry
  const [component, ...otherComponents] = outcome.components ?? []
  const [boundary, ...otherBoundaries] = component?.interactionKinds ?? []
  const turns =
    boundary === 'START_OF_ATTACHED_TARGET_TURN'
      ? { recurrenceStage: 'START_OF_TURN' as const, initialRemaining: null }
      : boundary === 'END_OF_ATTACHED_TARGET_NEXT_TURN'
        ? { recurrenceStage: 'END_OF_TURN' as const, initialRemaining: 1 }
        : null
  const [behavior, ...otherBehaviors] = component?.behaviors ?? []
  const rolls = (behavior?.entries ?? []).flatMap((roll) =>
    'outcome' in roll &&
    roll.resolutionKind === 'DIRECT' &&
    roll.pathCode === 'ON_USE' &&
    !roll.rangeOverride &&
    !roll.targetingOverride &&
    !roll.duration &&
    !roll.lifecycle &&
    UUID.test(roll.entryId)
      ? [roll]
      : []
  )
  const rows =
    rolls.length === behavior?.entries.length
      ? castLevelDamageRows(rolls.map((roll) => roll.outcome))
      : null
  const escape =
    check?.outcome.effectKind === 'FOLLOW_UP_CHECK' && check.pathCode === entry.pathCode
      ? followUpCheckEscape(check.outcome)
      : undefined
  const resultGate = entryResultGate(action, entry.pathCode)
  if (
    !turns ||
    !rows ||
    !resultGate ||
    otherComponents.length > 0 ||
    otherBoundaries.length > 0 ||
    otherBehaviors.length > 0 ||
    component?.region ||
    (check && !escape) ||
    entry.duration ||
    entry.maintenanceDefinitionId ||
    Object.values(entry.lifecycle ?? {}).some((value) => value !== undefined) ||
    outcome.attachmentKind !== 'PRIMARY_TARGET' ||
    outcome.light ||
    outcome.shape ||
    !outcome.label ||
    !UUID.test(outcome.id) ||
    !UUID.test(entry.entryId)
  )
    return null
  const plan: Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> = {
    authoredEffectId: action.effectId,
    // The object's entry, one across the cast levels its damage rows scale to.
    compiledEntryId: entry.entryId,
    frozenGraphNodeId: 'attached-object-damage',
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    ...turns,
    objectManifestationContribution: {
      manifestationOutcomeId: outcome.id,
      label: outcome.label,
      attachmentKind: outcome.attachmentKind,
      light: null,
      properties: [...(outcome.properties ?? [])].sort()
    },
    ...(escape && { conditionEscapeContribution: escape }),
    resultGate,
    adapterFacts: {},
    perceptionContributions: [],
    maintenance: null,
    marginRiders: []
  }
  return { plan, rows, rolls }
}

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
    frozenGraphNodeId: HELD_OBJECT_NODE_ID,
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
