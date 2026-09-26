import { DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/reactionEligibilityPolicy'

// Pure fixture data: the real-backend drivers import it, so it must not reach convex-test.
export const reactionBinding = {
  kind: 'MOVEMENT' as const,
  stage: 'BEFORE_LEAVE_REACH' as const,
  perceptionRequirement: null,
  eligibilityDefinitionId: DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID,
  movementInterruption: null
}
