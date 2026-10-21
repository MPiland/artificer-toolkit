import type { EncounterOptionalCombatPolicyFacts } from '@artificer-toolkit/schema/shared/optionalCombat'
import type { SceneGrid } from '@artificer-toolkit/shared/vtt'

import { sceneGridPolicyCapabilityRegistry } from './platformEncounterPolicy.js'

export interface EncounterSceneGridPolicyAdapter {
  readonly gameSystemId: string
  resolveEffectiveGrid(input: {
    readonly encounter: EncounterOptionalCombatPolicyFacts
    readonly sceneGrid: SceneGrid
  }): SceneGrid
}

/** The grid an Encounter plays on: its System's Scene-grid policy, or else the Scene's own grid. */
export function resolveEncounterSceneGrid(input: {
  readonly encounter: EncounterOptionalCombatPolicyFacts
  readonly sceneGrid: SceneGrid
}): SceneGrid {
  return (
    sceneGridPolicyCapabilityRegistry
      .find(input.encounter.gameSystemId)
      ?.resolveEffectiveGrid(input) ?? input.sceneGrid
  )
}
