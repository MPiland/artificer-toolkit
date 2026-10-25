import type { GameSystemCharacterTier } from '../../platformCharacterPolicy.js'
import { dnd5eCharacterPolicyRegistration } from '../dnd5e/characterPolicy.js'

/** The installed Systems' Character preparation tier (D195), loaded by the Sheet and Builder. */
export const installedCharacterSystems: readonly GameSystemCharacterTier[] = [
  dnd5eCharacterPolicyRegistration
]
