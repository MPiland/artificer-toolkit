import type { EncounterSessionStateDto } from '@artificer-toolkit/schema/api/encounterData'
import { isVisibleHalfSpeedField } from '@artificer-toolkit/rules-runtime/halfSpeedField'
import type { readSceneSpatialRows } from './sceneSpatialRows.js'

/**
 * The visible fields among the member's placed zones that a voluntary mover may cross carefully,
 * so the tabletop can offer the choice before a move is sent.
 */
export function halfSpeedFieldsOf(
  rows: Awaited<ReturnType<typeof readSceneSpatialRows>>
): EncounterSessionStateDto['halfSpeedFields'] {
  return rows.flatMap((field) => {
    const { placement } = field
    return isVisibleHalfSpeedField(field) && placement.geometry.frame === 'SCENE_ABSOLUTE'
      ? [{ id: field.id, label: placement.label ?? null, shape: placement.geometry.shape }]
      : []
  })
}
