import type { NodeRuntimeNodeDto } from '@artificer-toolkit/schema'
import { createAuthoringFormRenderer } from '#forms'
import {
  createDefaultEffect,
  createDefaultPath
} from '#components/editors/effects'
import {
  createEmptyCapacity,
  createEmptyCharge,
  createEmptyContains,
  createEmptyCost,
  createEmptyEquipment,
  createEmptyFeature,
  createEmptyModifier,
  createEmptyRestrictions,
  createEmptyWeight,
  type EquipmentFormValues
} from '../equipmentAuthoring.utils'

const equipmentRendererDefaults = createEmptyEquipment({ systemId: '' })
const equipmentGroupRendererDefaults: Record<string, unknown> = createEmptyWeight()

export const EquipmentAuthoringRenderer = createAuthoringFormRenderer<EquipmentFormValues>({
  defaultValues: equipmentRendererDefaults,
  groupDefaultValues: equipmentGroupRendererDefaults,
  createArrayItem: createEquipmentArrayItem,
  createObjectItem: createEquipmentObjectItem
})

function createEquipmentArrayItem(node: NodeRuntimeNodeDto, currentLength: number): Record<string, unknown> {
  const [rootPath] = node.path
  const order = currentLength + 1

  if (rootPath === 'contains') return createEmptyContains()
  if (rootPath === 'effects') return createDefaultEffect(order)
  if (rootPath === 'features') return createEmptyFeature(order)
  if (rootPath === 'modifiers') return createEmptyModifier(order)
  if (rootPath === 'paths') return createDefaultPath(order)

  return {
    id: crypto.randomUUID(),
    order
  }
}

function createEquipmentObjectItem(node: NodeRuntimeNodeDto): Record<string, unknown> {
  const [rootPath] = node.path

  if (rootPath === 'capacity') return createEmptyCapacity()
  if (rootPath === 'charges') return createEmptyCharge()
  if (rootPath === 'cost') return createEmptyCost()
  if (rootPath === 'restrictions') return createEmptyRestrictions()
  if (rootPath === 'weight') return createEmptyWeight()

  return {}
}
