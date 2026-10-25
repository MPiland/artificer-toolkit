import type { GameSystemRuntimeTier } from '../../platformRulesRuntime.js'
import { dnd5eRulesRuntimeRegistration } from '../dnd5e/characterActionRuntime.js'

/** The installed Systems' rules runtime tier (D195): rule capabilities, operations and compilers. */
export const installedRuntimeSystems: readonly GameSystemRuntimeTier[] = [
  dnd5eRulesRuntimeRegistration
]
