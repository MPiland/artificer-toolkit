import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  DND5E_ALTERNATING_DIAGONALS_OPERATION_KEY,
  activeOptionalCombatDefinitions,
  encounterOptionalCombatSnapshotDtoSchema
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { SceneGrid } from '@artificer-toolkit/shared/vtt'

import type { EncounterSceneGridPolicyAdapter } from '../../sceneGridPolicy.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'

export { DND5E_ALTERNATING_DIAGONALS_OPERATION_KEY } from '@artificer-toolkit/schema/shared/optionalCombat'

function hasExactAlternatingDiagonalModule(input: {
  automationMode: 'AUTOMATIC' | 'ASSISTED' | 'MANUAL'
  optionalCombatSnapshot: unknown
  optionalCombatSnapshotChecksum: string | null | undefined
}): boolean {
  if (input.optionalCombatSnapshot === null || input.optionalCombatSnapshotChecksum === null)
    return false
  const parsed = encounterOptionalCombatSnapshotDtoSchema.safeParse(input.optionalCombatSnapshot)
  if (
    !parsed.success ||
    checksumCanonicalJson(parsed.data) !== input.optionalCombatSnapshotChecksum
  )
    return false
  return activeOptionalCombatDefinitions({
    automationMode: input.automationMode,
    snapshot: parsed.data
  }).some(
    (definition) =>
      checksumRuleDocument(definition.document) === definition.definitionChecksum &&
      definition.document.module.policyModuleKey === DND5E_ALTERNATING_DIAGONALS_OPERATION_KEY &&
      definition.document.module.contractVersion === 1
  )
}

/**
 * D&D policy selects a mechanics-only Scene grid from the exact frozen Encounter snapshot.
 * It does not mutate the authored Scene definition or dispatch on source labels/UUID literals.
 */
export const dnd5eEncounterSceneGridPolicyAdapter: EncounterSceneGridPolicyAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  resolveEffectiveGrid({ encounter, sceneGrid }): SceneGrid {
    if (sceneGrid.kind !== 'SQUARE') return sceneGrid
    if (encounter.optionalCombatSnapshot?.gameSystemId !== encounter.gameSystemId) {
      return { ...sceneGrid, diagonalPolicy: 'EQUAL' }
    }
    if (
      hasExactAlternatingDiagonalModule({
        automationMode: encounter.automationMode,
        optionalCombatSnapshot: encounter.optionalCombatSnapshot,
        optionalCombatSnapshotChecksum: encounter.optionalCombatSnapshotChecksum
      })
    )
      return { ...sceneGrid, diagonalPolicy: 'ALTERNATING' }
    return { ...sceneGrid, diagonalPolicy: 'EQUAL' }
  }
}
