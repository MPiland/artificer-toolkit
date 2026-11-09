import type { GameSystemRuntimeTier } from '../../platformRulesRuntime.js'
import type { SystemTierModule } from '../../systemCapabilityRegistry.js'
import * as dnd5e from '../dnd5e/runtimeTier.js'

/** The installed Systems' rules runtime tier (D195), one list per capability (ADR 0042). */
type _Dnd5eRuntimeTier = SystemTierModule<
  typeof import('../dnd5e/runtimeTier.js'),
  Required<GameSystemRuntimeTier>
>

export const installedAttackTriggers = [
  {
    gameSystemId: dnd5e.gameSystemId,
    isMeleeAttackTrigger: dnd5e.isMeleeAttackTrigger,
    isSpellAttackTrigger: dnd5e.isSpellAttackTrigger
  }
]
export const installedCreatureRuleFactCompilers = [
  { gameSystemId: dnd5e.gameSystemId, compileCreatureRuleFacts: dnd5e.compileCreatureRuleFacts }
]
export const installedRuleCapabilities = [dnd5e.capabilities]
export const installedRuleOperations = [dnd5e.operations]
