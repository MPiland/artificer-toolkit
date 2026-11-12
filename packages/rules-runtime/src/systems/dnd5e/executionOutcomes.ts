import type { ExecutionOutcomeCapabilityAdapter } from '../../executionOutcomeCapability.js'
import { executionAddsSpeedToMovement } from './addSpeedToMovement.js'
import { executionCancelsTriggeringEvent } from './cancelTriggeringEvent.js'
import { executionEndsEffects } from './endEffects.js'
import { DND5E_SYSTEM_ID } from './identity.js'
import { executionImposesRollModeOnTriggeringRoll } from './imposeRollModeOnTriggeringRoll.js'
import { executionSubtractsFromTriggeringRoll } from './subtractFromTriggeringRoll.js'
import { executionTeleportAllowance } from './teleportAllowance.js'

export const dnd5eExecutionOutcomeCapabilityAdapter: ExecutionOutcomeCapabilityAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  cancelsTriggeringEvent: executionCancelsTriggeringEvent,
  imposesRollModeOnTriggeringRoll: executionImposesRollModeOnTriggeringRoll,
  subtractsFromTriggeringRoll: executionSubtractsFromTriggeringRoll,
  addsSpeedToMovement: executionAddsSpeedToMovement,
  endsEffects: executionEndsEffects,
  teleportAllowance: executionTeleportAllowance
}
