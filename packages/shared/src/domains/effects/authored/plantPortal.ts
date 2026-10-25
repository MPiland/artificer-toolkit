import { EFFECT_KIND, type ShapeMeasurementValueAuthored } from '#core'

export type PlantPortalAuthored = {
  id: string
  effectKind: typeof EFFECT_KIND.PLANT_PORTAL
  minimumPlantSize: string
  requiresInanimatePlant: boolean
  samePlaneOnly: boolean
  destinationMustBeSeenOrTouched: boolean
  movementCost: ShapeMeasurementValueAuthored
}
