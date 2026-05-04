import type { NodeRuntimeNodeDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { createAuthoringFormRenderer } from '#forms'
import {
  createEmptyAncestry,
  createEmptyAncestryOption,
  createEmptyBaseRace,
  createEmptyDetail,
  createEmptyFeature,
  createEmptySpeed,
  toRaceFormValues
} from '../raceAuthoring.utils'

const raceRendererDefaults = toRaceFormValues(createEmptyBaseRace({ systemId: '', userId: '' }))
const raceGroupRendererDefaults: Record<string, unknown> = createEmptyDetail(1)

export const RaceAuthoringRenderer = createAuthoringFormRenderer({
  defaultValues: raceRendererDefaults,
  groupDefaultValues: raceGroupRendererDefaults,
  createArrayItem: createRaceArrayItem,
  createObjectItem: createRaceObjectItem
})

function createRaceArrayItem(node: NodeRuntimeNodeDto, currentLength: number): Record<string, unknown> {
  const [rootPath] = node.path
  const order = currentLength + 1

  if (rootPath === 'details') return createEmptyDetail(order)
  if (rootPath === 'features') return createEmptyFeature(order)
  if (rootPath === 'options') return createEmptyAncestryOption(order)
  if (rootPath === 'speeds') return createEmptySpeed()

  return {
    id: crypto.randomUUID(),
    order
  }
}

function createRaceObjectItem(node: NodeRuntimeNodeDto): Record<string, unknown> {
  const [rootPath] = node.path

  if (rootPath === 'ancestry') return createEmptyAncestry()

  return {}
}
