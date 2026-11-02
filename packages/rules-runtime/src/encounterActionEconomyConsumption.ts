import {
  encounterRunActorStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterSpellCastingTransitionDto } from '@artificer-toolkit/schema/projections/encounterSpellCasting'
import { encounterRuleUsageUsed, withEncounterRuleUsageUsed } from './encounterActorState.js'
import { applyEncounterSpellCastingTransition } from './encounterSpellCasting.js'

export type EncounterActionEconomyConsumption = {
  definitionId: string
  definitionVersion: number
  definitionChecksum: string
  maximum: number
  beforeUsed: number
  afterUsed: number
  /** The spell-casting record a spell cast with this allowance changes. */
  spellCasting?: EncounterSpellCastingTransitionDto
}

export function consumeEncounterActionEconomy(input: {
  actor: EncounterRunActorState
  consumption: EncounterActionEconomyConsumption
  /** An Assisted "Do it anyway" may use an allowance past its maximum; nothing else may. */
  overridden: boolean
}): EncounterRunActorState {
  if (
    encounterRuleUsageUsed(input.actor, input.consumption.definitionId) !==
      input.consumption.beforeUsed ||
    input.consumption.afterUsed !== input.consumption.beforeUsed + 1 ||
    (!input.overridden && input.consumption.afterUsed > input.consumption.maximum)
  )
    throw new Error('The selected action allowance changed before settlement.')
  const spent = encounterRunActorStateSchema.parse({
    ...input.actor,
    resources: withEncounterRuleUsageUsed(
      input.actor,
      input.consumption.definitionId,
      input.consumption.afterUsed
    )
  })
  return input.consumption.spellCasting
    ? applyEncounterSpellCastingTransition(spent, input.consumption.spellCasting)
    : spent
}
