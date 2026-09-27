import {
  DND5E_SYSTEM_ID,
  DND5E_UNCONSCIOUS_CONDITION_DEFINITION_ID
} from './systems/dnd5e/identity.js'

const zeroHitPointsConditionIdBySystemId: ReadonlyMap<string, string> = new Map([
  [DND5E_SYSTEM_ID, DND5E_UNCONSCIOUS_CONDITION_DEFINITION_ID]
])

/**
 * The System-owned condition a Character gains on dropping to 0 hit points and loses on regaining
 * any (D63; D&D: Unconscious, while dying). A System without one adds no condition.
 */
export function characterZeroHitPointsConditionId(gameSystemId: string): string | undefined {
  return zeroHitPointsConditionIdBySystemId.get(gameSystemId)
}
