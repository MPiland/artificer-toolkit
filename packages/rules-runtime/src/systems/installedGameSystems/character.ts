import type { GameSystemCharacterTier } from '../../platformCharacterPolicy.js'
import type { SystemTierModule } from '../../systemCapabilityRegistry.js'
import * as dnd5e from '../dnd5e/characterTier.js'

/** The installed Systems' Character preparation tier (D195), one list per capability (ADR 0042). */
type _Dnd5eCharacterTier = SystemTierModule<
  typeof import('../dnd5e/characterTier.js'),
  GameSystemCharacterTier
>

export const installedCharacterPolicies = [
  { gameSystemId: dnd5e.gameSystemId, evaluateCharacterPolicy: dnd5e.evaluateCharacterPolicy }
]
export const installedCharacterRollModes = [
  { gameSystemId: dnd5e.gameSystemId, resolveCharacterRollModes: dnd5e.resolveCharacterRollModes }
]
