import { serverUuidIdentityDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'

import { createMovementReactionEligibilityService } from './movementReactionEligibilityService.js'
import { dnd5eMovementReactionEligibilityAdapter } from './systems/dnd5e/reactionEligibilityPolicy.js'

const adapters = [dnd5eMovementReactionEligibilityAdapter] as const

export const evaluateMovementReactionEligibility =
  createMovementReactionEligibilityService(adapters)

export function requireMovementReactionCapabilityDefinitionIds(
  gameSystemId: string
): readonly string[] {
  const normalizedSystemId = serverUuidIdentityDtoSchema.parse(gameSystemId)
  const adapter = adapters.find((candidate) => candidate.gameSystemId === normalizedSystemId)
  if (!adapter) throw new Error('The Game System does not provide movement reaction policy.')
  return [...adapter.requiredCapabilityDefinitionIds]
}
