import {
  basicActionReusableDefinitionDocumentDtoSchema,
  type BasicActionReusableDefinitionDocumentDto
} from '@artificer-toolkit/schema/shared/basicActions'
import { BASIC_ACTION_DEFINITION_FAMILY_KEY } from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { actionEconomyCapabilityRegistry } from './actionEconomyCapabilityRegistry.default.js'
import { activeEffectCapabilitySuppressions } from './encounterActionEconomy.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import {
  resolveRuleCapabilityState,
  type CurrentReusableDefinitionSource
} from './ruleCapabilityStateService.js'

/** Whether the System's actor-action capability is suppressed for the target (Speed is ignored). */
export async function encounterActorCannotAct(input: {
  conditionIds: readonly string[]
  activeEffects: MovementTarget['activeEffects']
  gameSystemId: string
  definitions: CurrentReusableDefinitionSource
}) {
  const capabilityDefinitionId =
    actionEconomyCapabilityRegistry.requireActorActionCapabilityDefinitionId(input.gameSystemId)
  const state = await resolveRuleCapabilityState({
    definitions: input.definitions,
    gameSystemId: input.gameSystemId,
    activeConditionDefinitionIds: input.conditionIds,
    capabilityDefinitionIds: [capabilityDefinitionId],
    activeEffectSuppressions: activeEffectCapabilitySuppressions(input.activeEffects)
  })
  return state.capabilities[0]?.available === false
}

/** A published basic-action catalogue entry of the Run's System. */
export function requireEncounterBasicActionDefinition(
  state: Pick<EncounterRunState, 'gameSystemId'>,
  definition: ReusableDefinitionCurrentDto | null
): {
  definition: ReusableDefinitionCurrentDto
  document: BasicActionReusableDefinitionDocumentDto
} {
  const document = basicActionReusableDefinitionDocumentDtoSchema.safeParse(definition?.document)
  if (
    !definition ||
    !document.success ||
    definition.definitionFamilyKey !== BASIC_ACTION_DEFINITION_FAMILY_KEY ||
    definition.gameSystemId !== state.gameSystemId ||
    document.data.id !== definition.id
  )
    throw new Error("The basic action is not in this Encounter's System.")
  return { definition, document: document.data }
}

/** Checks that a mechanic-driven basic action got the target it needs (First Aid's dying Character). */
export function requireEncounterBasicActionTarget(input: {
  actor: EncounterRunActorState
  target: EncounterRunActorState | null
  document: BasicActionReusableDefinitionDocumentDto
}) {
  const { actor, target, document } = input
  if (document.effects.length > 0)
    throw new Error('This basic action is authored and resolves as an action.')
  const stabilizes = document.mechanics.includes('STABILIZE_TARGET')
  if (stabilizes !== (target !== null) || target?.id === actor.id)
    throw new Error(
      stabilizes ? 'Choose a creature to stabilize.' : 'This basic action has no target.'
    )
}
