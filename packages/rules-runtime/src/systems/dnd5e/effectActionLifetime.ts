import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import type { CharacterRuleActionActiveEffectPlan } from '../../characterRuleActionSystemAdapter.js'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from './concentrationIdentity.js'
import {
  uuid,
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_CONDITION_DURATION_OPERATION_KEY
} from './effectActionContracts.js'
import type {
  GrantConsumeEvent,
  GrantEndEvent
} from '@artificer-toolkit/schema/shared/activeRuleEffects'
import {
  pathLifecycleGrantConsumeEventSchema,
  pathLifecycleGrantEndEventSchema
} from '@artificer-toolkit/schema/shared/enums'
import type { ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import type { RuleGraphDefinition } from '@artificer-toolkit/shared/rules'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import type { Dnd5eCompiledEffectActionSource } from './effectActionContracts.js'
import { publishedGraph } from './effectActionPublishedGraph.js'

/**
 * The source actor's maintained effect (Concentration) an action starts: the one its result block
 * names, else Concentration when the spell it belongs to requires it.
 */
export function maintenancePlan(
  action: Dnd5eCompiledEffectActionSource,
  entry: CompiledEffectGroup['entries'][number]
): CharacterRuleActionActiveEffectPlan['maintenance'] {
  const definitionId =
    ('maintenanceDefinitionId' in entry ? entry.maintenanceDefinitionId : undefined) ??
    (action.compiledEffect.requiresConcentration
      ? DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
      : undefined)
  if (!definitionId) return null
  uuid(definitionId, 'D&D maintenance definition identity')
  return {
    definitionId,
    definitionChecksum: null,
    owner: 'SOURCE_ACTOR',
    replacementPolicy: 'REPLACE_SAME_DEFINITION',
    emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
  }
}

/** The end triggers a timed modifier grant carries: its source's incapacitation, its holder's separation from the source (Warding Bond), or its holder attacking or casting at an enemy (Sanctuary). */
export const GRANT_END_TRIGGER_EVENTS: ReadonlySet<string> = new Set([
  'INCAPACITATED',
  'SEPARATED',
  'ATTACK_ROLL',
  'SPELL_CAST'
])

export function isGrantConsumeEvent(event: string): event is GrantConsumeEvent {
  return pathLifecycleGrantConsumeEventSchema.safeParse(event).success
}

export function isGrantEndEvent(event: string): event is GrantEndEvent {
  return pathLifecycleGrantEndEventSchema.safeParse(event).success
}

/**
 * The frozen graph of a timed condition or grant: one pure node. A condition's holder turn ends
 * tick it through the turn-effect kernel; a grant is counted by the grant tick planner instead.
 */
export function durationPublishedGraph(input: {
  effectId: string
  plan: Pick<
    CharacterRuleActionActiveEffectPlan,
    | 'compiledEntryId'
    | 'frozenGraphNodeId'
    | 'conditionContributions'
    | 'modifierGrantContribution'
    | 'actorLinkContribution'
    | 'creatureFormContribution'
    | 'marginRiders'
    | 'repeatCarrier'
  >
}): ServerPublishedRuleDefinitionDto {
  const {
    conditionContributions,
    modifierGrantContribution,
    actorLinkContribution,
    creatureFormContribution
  } = input.plan
  const definition: RuleGraphDefinition = {
    schemaVersion: 1,
    id: input.effectId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      input.plan.frozenGraphNodeId,
      ...input.plan.marginRiders.map(({ frozenGraphNodeId }) => frozenGraphNodeId),
      input.plan.repeatCarrier?.frozenGraphNodeId
    ].flatMap((id) =>
      id
        ? [
            {
              id,
              operation: { key: DND5E_CONDITION_DURATION_OPERATION_KEY, contractVersion: 1 },
              inputs: {}
            }
          ]
        : []
    ),
    outputs: conditionContributions?.length
      ? Object.fromEntries(
          conditionContributions.map(({ conditionId }, index) => [
            index === 0 ? 'conditionId' : `conditionId${index + 1}`,
            { kind: 'LITERAL', value: conditionId }
          ])
        )
      : modifierGrantContribution
        ? {
            applyGrantOutcomeId: {
              kind: 'LITERAL',
              value: modifierGrantContribution.applyGrantOutcomeId
            }
          }
        : actorLinkContribution
          ? { linkOutcomeId: { kind: 'LITERAL', value: actorLinkContribution.linkOutcomeId } }
          : creatureFormContribution
            ? { formOutcomeId: { kind: 'LITERAL', value: creatureFormContribution.formOutcomeId } }
            : // A lasting entry with no contribution, such as a zone lending a bonus (D155), names itself.
              { compiledEntryId: { kind: 'LITERAL', value: input.plan.compiledEntryId } },
    sourceEntryBindings: [
      { sourceEntryId: input.plan.compiledEntryId, nodeId: input.plan.frozenGraphNodeId },
      ...input.plan.marginRiders.map(({ compiledEntryId, frozenGraphNodeId }) => ({
        sourceEntryId: compiledEntryId,
        nodeId: frozenGraphNodeId
      })),
      ...(input.plan.repeatCarrier
        ? [
            {
              sourceEntryId: input.plan.repeatCarrier.compiledEntryId,
              nodeId: input.plan.repeatCarrier.frozenGraphNodeId
            }
          ]
        : [])
    ]
  }
  return publishedGraph(definition)
}
