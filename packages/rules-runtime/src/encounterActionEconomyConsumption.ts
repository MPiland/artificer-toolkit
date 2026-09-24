import {
  encounterRunActorStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterRuleUsageUsed, withEncounterRuleUsageUsed } from './encounterActorState.js'

export type EncounterActionEconomyConsumption = {
  definitionId: string
  definitionVersion: number
  definitionChecksum: string
  maximum: number
  beforeUsed: number
  afterUsed: number
}

export function consumeEncounterActionEconomy(input: {
  actor: EncounterRunActorState
  consumption: EncounterActionEconomyConsumption
}): EncounterRunActorState {
  if (
    encounterRuleUsageUsed(input.actor, input.consumption.definitionId) !==
      input.consumption.beforeUsed ||
    input.consumption.afterUsed !== input.consumption.beforeUsed + 1 ||
    input.consumption.afterUsed > input.consumption.maximum
  )
    throw new Error('The selected action allowance changed before settlement.')
  return encounterRunActorStateSchema.parse({
    ...input.actor,
    resources: withEncounterRuleUsageUsed(
      input.actor,
      input.consumption.definitionId,
      input.consumption.afterUsed
    )
  })
}
