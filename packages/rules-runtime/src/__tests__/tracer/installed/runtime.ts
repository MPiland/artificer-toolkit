import type { GameSystemRuntimeTier } from '../../../platformRulesRuntime.js'
import { dnd5eRulesRuntimeRegistration } from '../../../systems/dnd5e/characterActionRuntime.js'
import { tracerRuntimeTier } from '../runtimeTier.js'

export const installedRuntimeSystems: readonly GameSystemRuntimeTier[] = [
  dnd5eRulesRuntimeRegistration,
  tracerRuntimeTier
]
