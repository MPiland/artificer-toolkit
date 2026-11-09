import type { GameSystemRuntimeTier } from '../../../platformRulesRuntime.js'
import * as dnd5e from '../../../systems/dnd5e/runtimeTier.js'
import type { SystemTierModule } from '../../../systemCapabilityRegistry.js'
import * as tracer from '../runtimeTier.js'

type _TracerRuntimeTier = SystemTierModule<
  typeof import('../runtimeTier.js'),
  GameSystemRuntimeTier
>

export const installedAttackTriggers = [
  {
    gameSystemId: dnd5e.gameSystemId,
    isMeleeAttackTrigger: dnd5e.isMeleeAttackTrigger,
    isSpellAttackTrigger: dnd5e.isSpellAttackTrigger
  },
  {
    gameSystemId: tracer.gameSystemId,
    isMeleeAttackTrigger: tracer.isMeleeAttackTrigger,
    isSpellAttackTrigger: tracer.isSpellAttackTrigger
  }
]
export const installedCreatureRuleFactCompilers = [
  { gameSystemId: dnd5e.gameSystemId, compileCreatureRuleFacts: dnd5e.compileCreatureRuleFacts }
]
export const installedRuleCapabilities = [dnd5e.capabilities, tracer.capabilities]
export const installedRuleOperations = [dnd5e.operations, tracer.operations]
