import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'

/**
 * A field a voluntary mover may cross carefully: it allows passage at half speed and the mover can
 * see it (public, or revealed). A hidden field is never skipped or discounted on a client's word.
 */
export function isVisibleHalfSpeedField({
  placement,
  spatialState
}: Pick<EncounterSpatialRuleEffectRecord, 'placement' | 'spatialState'>): boolean {
  return (
    placement.bypassAtHalfSpeed === true &&
    (placement.visibility === 'PUBLIC' || spatialState.revealed)
  )
}
