import type { NodeRuntimeNodeDto } from '@artificer-toolkit/schema'
import { createAuthoringFormRenderer } from '#forms'
import {
  createEmptyStartingEquipment,
  createEmptyStartingEquipmentItem
} from '#components/editors'
import {
  createEmptyBackground,
  createEmptyDetail,
  createEmptyFeature,
  createEmptyProficiency
} from '../backgroundAuthoring.utils'

const backgroundRendererDefaults = createEmptyBackground({ systemId: '', userId: '' })
const backgroundGroupRendererDefaults: Record<string, unknown> = createEmptyDetail(1)

export const BackgroundAuthoringRenderer = createAuthoringFormRenderer({
  defaultValues: backgroundRendererDefaults,
  groupDefaultValues: backgroundGroupRendererDefaults,
  createArrayItem: createBackgroundArrayItem,
  createObjectItem: createBackgroundObjectItem
})

function createBackgroundArrayItem(node: NodeRuntimeNodeDto, currentLength: number): Record<string, unknown> {
  const [rootPath] = node.path
  const order = currentLength + 1

  if (rootPath === 'details') return createEmptyDetail(order)
  if (rootPath === 'features') return createEmptyFeature(order)
  if (rootPath === 'items') return createEmptyStartingEquipmentItem(order)
  if (rootPath === 'proficiencies') return createEmptyProficiency(order)

  return {
    id: crypto.randomUUID(),
    order
  }
}

function createBackgroundObjectItem(node: NodeRuntimeNodeDto): Record<string, unknown> {
  const [rootPath] = node.path

  if (rootPath === 'startingEquipment') return createEmptyStartingEquipment()

  return {}
}
