import { serverUuidIdentityDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'

import { createLegendaryActionEligibilityService } from './legendaryActionEligibilityService.js'
import { dnd5eLegendaryActionEligibilityAdapter } from './systems/dnd5e/encounterLifecyclePolicy.js'

const adapters = [dnd5eLegendaryActionEligibilityAdapter] as const

export const evaluateLegendaryActionEligibility = createLegendaryActionEligibilityService(adapters)

export function requireLegendaryActionCapabilityDefinitionIds(
  gameSystemId: string
): readonly string[] {
  const normalizedSystemId = serverUuidIdentityDtoSchema.parse(gameSystemId)
  const adapter = adapters.find((candidate) => candidate.gameSystemId === normalizedSystemId)
  if (!adapter) {
    throw new Error('The Game System does not provide Legendary Action policy.')
  }
  return [...adapter.requiredCapabilityDefinitionIds]
}
