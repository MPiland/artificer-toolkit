import {
  basicActionReusableDefinitionDocumentDtoSchema,
  type BasicActionReusableDefinitionDocumentDto
} from '@artificer-toolkit/schema/shared/basicActions'
import { BASIC_ACTION_DEFINITION_FAMILY_KEY } from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { actionEconomyCapabilityRegistry } from './platformPolicyModules.js'
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
  const capabilityDefinitionId = actionEconomyCapabilityRegistry
    .require(input.gameSystemId)
    .actorActionCapabilityDefinitionId()
  const state = await resolveRuleCapabilityState({
    definitions: input.definitions,
    gameSystemId: input.gameSystemId,
    activeConditionDefinitionIds: input.conditionIds,
    capabilityDefinitionIds: [capabilityDefinitionId],
    activeEffectSuppressions: activeEffectCapabilitySuppressions(
      input.gameSystemId,
      input.activeEffects
    )
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
