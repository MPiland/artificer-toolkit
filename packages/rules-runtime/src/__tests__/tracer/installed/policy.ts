import type { GameSystemPolicyTier } from '../../../platformPolicyModules.js'
import { dnd5ePolicyTier } from '../../../systems/dnd5e/policyTier.js'
import { tracerPolicyTier } from '../policyTier.js'

export const installedPolicySystems: readonly GameSystemPolicyTier[] = [
  dnd5ePolicyTier,
  tracerPolicyTier
]
