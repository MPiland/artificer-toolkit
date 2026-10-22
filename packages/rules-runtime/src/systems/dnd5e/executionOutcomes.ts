import type { ExecutionOutcomeCapabilityAdapter } from '../../executionOutcomeCapability.js'
import { executionAddsSpeedToMovement } from './addSpeedToMovement.js'
import { executionCancelsTriggeringEvent } from './cancelTriggeringEvent.js'
import { executionEndsEffects } from './endEffects.js'
import { DND5E_SYSTEM_ID } from './identity.js'
import { executionTeleportAllowance } from './teleportAllowance.js'

export const dnd5eExecutionOutcomeCapabilityAdapter: ExecutionOutcomeCapabilityAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  cancelsTriggeringEvent: executionCancelsTriggeringEvent,
  addsSpeedToMovement: executionAddsSpeedToMovement,
  endsEffects: executionEndsEffects,
  teleportAllowance: executionTeleportAllowance
}
