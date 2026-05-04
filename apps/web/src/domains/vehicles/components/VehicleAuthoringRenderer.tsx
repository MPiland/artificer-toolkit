import { createAuthoringFormRenderer } from '#forms'
import {
  createEmptyVehicle,
  type VehicleFormValues
} from '../vehicleAuthoring.utils'

const vehicleRendererDefaults = createEmptyVehicle({ systemId: '' })

export const VehicleAuthoringRenderer = createAuthoringFormRenderer<VehicleFormValues>({
  defaultValues: vehicleRendererDefaults
})
