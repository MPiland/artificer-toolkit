import type { EncounterSessionStateDto } from '@artificer-toolkit/schema/api/encounterData'
import { isVisibleHalfSpeedField } from '@artificer-toolkit/rules-runtime/halfSpeedField'
import { readSceneSpatialRows } from './sceneSpatialRows.js'
import type { EncounterReadContext } from './store.js'

/**
 * The visible fields in the Run's bound Scene that a voluntary mover may cross carefully. They are
 * the same for every member, so the tabletop can offer the choice before a move is sent.
 */
export async function readHalfSpeedFields(
  ctx: EncounterReadContext,
  encounterId: string
): Promise<EncounterSessionStateDto['halfSpeedFields']> {
  const rows = await readSceneSpatialRows(ctx, encounterId)
  return rows.flatMap((field) => {
    const { placement } = field
    return isVisibleHalfSpeedField(field) && placement.geometry.frame === 'SCENE_ABSOLUTE'
      ? [{ id: field.id, label: placement.label ?? null, shape: placement.geometry.shape }]
      : []
  })
}
