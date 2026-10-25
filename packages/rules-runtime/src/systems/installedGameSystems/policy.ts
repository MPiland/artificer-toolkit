import type { GameSystemPolicyTier } from '../../platformPolicyModules.js'
import { dnd5ePolicyTier } from '../dnd5e/policyTier.js'

/** The installed Systems' Sheet-reachable policy tier (D195). */
export const installedPolicySystems: readonly GameSystemPolicyTier[] = [dnd5ePolicyTier]
