import { createAuthoringFormRenderer } from '#forms'
import {
  createEmptyEquipment,
  type EquipmentFormValues
} from '../equipmentAuthoring.utils'

const equipmentRendererDefaults = createEmptyEquipment({ systemId: '' })

export const EquipmentAuthoringRenderer = createAuthoringFormRenderer<EquipmentFormValues>({
  defaultValues: equipmentRendererDefaults
})
