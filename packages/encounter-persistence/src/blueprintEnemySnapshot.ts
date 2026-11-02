import type { EncounterBlueprintDto } from '@artificer-toolkit/schema/api/encounterData'
import type { JsonValue } from '@artificer-toolkit/schema/projections/identity'

export type BlueprintSetup = Pick<EncounterBlueprintDto, 'enemies' | 'snapshots'>

/** The snapshot a Blueprint enemy points at. */
export function blueprintEnemySnapshot(
  setup: BlueprintSetup,
  enemy: BlueprintSetup['enemies'][number]
): JsonValue {
  const snapshot = setup.snapshots[enemy.snapshotIndex]
  if (snapshot === undefined) throw new Error('Encounter Blueprint enemy snapshot is missing.')
  return snapshot
}
