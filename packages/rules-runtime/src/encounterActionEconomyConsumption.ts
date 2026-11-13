import {
  encounterRunActorStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterSpellCastingTransitionDto } from '@artificer-toolkit/schema/projections/encounterSpellCasting'
import { encounterAllowanceUsed, withEncounterAllowanceUsed } from './encounterActorState.js'
import { applyEncounterSpellCastingTransition } from './encounterSpellCasting.js'

export type EncounterActionEconomyConsumption = {
  definitionId: string
  definitionVersion: number
  definitionChecksum: string
  maximum: number
  beforeUsed: number
  afterUsed: number
  /**
   * The turn an `EACH_TURN` allowance is spent on, whose usage is kept with that turn; absent for an
   * allowance refreshed at its holder's turn start.
   */
  turnSequence?: number
  /** The spell-casting record a spell cast with this allowance changes. */
  spellCasting?: EncounterSpellCastingTransitionDto
}

type AllowanceUse = Pick<EncounterActionEconomyConsumption, 'definitionId' | 'turnSequence'>

/** The usage record a spent allowance is kept on, by its refresh boundary. */
function consumedAllowance(use: AllowanceUse) {
  return {
    definitionId: use.definitionId,
    refreshBoundary:
      use.turnSequence === undefined ? ('START_OF_TURN' as const) : ('EACH_TURN' as const)
  }
}

/**
 * How much of a spent allowance its actor has used now. An `EACH_TURN` use reads as nothing once
 * another turn has started.
 */
export function encounterActionEconomyUsed(
  actor: Pick<EncounterRunActorState, 'resources'>,
  use: AllowanceUse
) {
  return encounterAllowanceUsed(actor, consumedAllowance(use), use.turnSequence ?? 0)
}

/** Writes a spent allowance's usage to the record its refresh boundary keeps. */
export function withEncounterActionEconomyUsed(
  actor: Pick<EncounterRunActorState, 'resources'>,
  use: AllowanceUse,
  used: number
) {
  return withEncounterAllowanceUsed(actor, consumedAllowance(use), use.turnSequence ?? 0, used)
}

export function consumeEncounterActionEconomy(input: {
  actor: EncounterRunActorState
  consumption: EncounterActionEconomyConsumption
  /** An Assisted "Do it anyway" may use an allowance past its maximum; nothing else may. */
  overridden: boolean
}): EncounterRunActorState {
  if (
    encounterActionEconomyUsed(input.actor, input.consumption) !== input.consumption.beforeUsed ||
    input.consumption.afterUsed !== input.consumption.beforeUsed + 1 ||
    (!input.overridden && input.consumption.afterUsed > input.consumption.maximum)
  )
    throw new Error('The selected action allowance changed before settlement.')
  const spent = encounterRunActorStateSchema.parse({
    ...input.actor,
    resources: withEncounterActionEconomyUsed(
      input.actor,
      input.consumption,
      input.consumption.afterUsed
    )
  })
  return input.consumption.spellCasting
    ? applyEncounterSpellCastingTransition(spent, input.consumption.spellCasting)
    : spent
}
