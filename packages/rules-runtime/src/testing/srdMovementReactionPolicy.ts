import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import { SRD_MOVEMENT_REACTION_DEFINITIONS } from '@artificer-toolkit/source-data/srd/movementReaction.js'
import { SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import {
  DND5E_MOVEMENT_REACTION_CHOICE_DEFINITION_ID,
  DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID
} from '../systems/dnd5e/reactionEligibilityPolicy.js'

/** A movement reaction graph the SRD publishes, as the rules runtime receives it. */
function srdPublishedGraph(definitionId: string) {
  const seed = SRD_MOVEMENT_REACTION_DEFINITIONS.find(({ id }) => id === definitionId)
  if (!seed) throw new Error(`SRD movement reaction graph "${definitionId}" is missing.`)
  return serverPublishedRuleDefinitionDtoSchema.parse({
    id: seed.id,
    gameSystemId: SRD_SYSTEM_ID,
    definitionFamilyKey: seed.definitionFamilyKey,
    checksum: seed.checksum,
    definition: seed.document
  })
}

/** The SRD eligibility graph of a reaction to a creature leaving reach. */
export function srdOpportunityReactionEligibilityDefinition() {
  return srdPublishedGraph(DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID)
}

/** The SRD choice graph among a reactor's eligible movement reactions. */
export function srdMovementReactionChoiceDefinition() {
  return srdPublishedGraph(DND5E_MOVEMENT_REACTION_CHOICE_DEFINITION_ID)
}
