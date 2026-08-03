import { EFFECT_KIND, type ShapeMeasurementValueAuthored, type SizeCode } from '#core'

export type PlantPortalAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.PLANT_PORTAL
  minimumPlantSize: SizeCode
  requiresInanimatePlant: boolean
  samePlaneOnly: boolean
  destinationMustBeSeenOrTouched: boolean
  movementCost: ShapeMeasurementValueAuthored
}
