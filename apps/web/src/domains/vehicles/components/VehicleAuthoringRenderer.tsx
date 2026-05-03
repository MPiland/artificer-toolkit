import type { NodeRuntimeNodeDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { createAuthoringFormRenderer } from '#forms'
import {
  createEmptyCost,
  createEmptyDetail,
  createEmptyFeature,
  createEmptyProperty,
  createEmptyVehicle,
  type VehicleFormValues
} from '../vehicleAuthoring.utils'

const vehicleRendererDefaults = createEmptyVehicle({ systemId: '' })
const vehicleGroupRendererDefaults: Record<string, unknown> = createEmptyCost()

export const VehicleAuthoringRenderer = createAuthoringFormRenderer<VehicleFormValues>({
  defaultValues: vehicleRendererDefaults,
  groupDefaultValues: vehicleGroupRendererDefaults,
  createArrayItem: createVehicleArrayItem,
  createObjectItem: createVehicleObjectItem
})

function createVehicleArrayItem(node: NodeRuntimeNodeDto, currentLength: number): Record<string, unknown> {
  const [rootPath] = node.path
  const order = currentLength + 1

  if (rootPath === 'details') return createEmptyDetail(order)
  if (rootPath === 'features') return createEmptyFeature(order)
  if (rootPath === 'properties') return createEmptyProperty()

  return {
    id: crypto.randomUUID(),
    order
  }
}

function createVehicleObjectItem(node: NodeRuntimeNodeDto): Record<string, unknown> {
  const [rootPath] = node.path

  if (rootPath === 'cost') return createEmptyCost()

  return {}
}
