import { createEncounterSceneGridPolicyRegistry } from './sceneGridPolicy.js'
import { dnd5eEncounterSceneGridPolicyAdapter } from './systems/dnd5e/optionalCombatPolicy.js'

export const encounterSceneGridPolicyRegistry = createEncounterSceneGridPolicyRegistry([
  dnd5eEncounterSceneGridPolicyAdapter
])
