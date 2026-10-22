import type { RollModeKeep } from '@artificer-toolkit/schema/shared/systemCoreCode'
import { EncounterValidationError } from './encounterErrors.js'
import { rollModeCapabilityRegistry } from './platformPolicyModules.js'

/**
 * The wire checks only that a d20's `keep` is well formed (ADR 0039 decision 5); whether a stored or
 * supplied `{ rollMode, keep }` is one the System derives is decided here, where the `gameSystemId` is
 * known.
 */

/**
 * Refuses a stored d20 whose roll mode and keep are not what its System derives from the d20's
 * contributors. Use it where a policy, belief or evidence node is read back from a pending context
 * or receipt.
 */
export function requireDerivedD20Mode(input: {
  gameSystemId: string
  contributors: readonly { influence: string }[]
  rollMode: string
  /** Omitted for a derived mode that carries no keep of its own (`derivedRollMode`). */
  keep?: RollModeKeep
}): void {
  const derived = rollModeCapabilityRegistry.resolveRollMode(input)
  if (
    derived.rollMode !== input.rollMode ||
    (input.keep !== undefined && derived.keep !== input.keep)
  )
    throw new EncounterValidationError('The d20 roll mode does not match its contributors.')
}
