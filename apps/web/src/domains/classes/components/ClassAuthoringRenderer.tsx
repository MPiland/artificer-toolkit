import type { NodeRuntimeNodeDto } from '@artificer-toolkit/schema'
import { createAuthoringFormRenderer } from '#forms'
import {
  createEmptyCharge,
  createEmptyClass,
  createEmptyDetail,
  createEmptyFeature,
  createEmptyHitpoint,
  createEmptyMulticlass,
  createEmptyPrepareLimit,
  createEmptyPrepareLimitLevel,
  createEmptyProficiency,
  createEmptyRequirement,
  createEmptyRequirementGroup,
  createEmptyResource,
  createEmptySpecialization,
  createEmptySpellLimit,
  createEmptySpellSlot,
  createEmptySpellcasting,
  createEmptyStartingEquipmentRecord,
  createEmptyStartingGold,
  type ClassFormValues
} from '../classAuthoring.utils'

const classRendererDefaults = createEmptyClass({ systemId: '' })
const classGroupRendererDefaults: Record<string, unknown> = createEmptyDetail(1)

export const ClassAuthoringRenderer = createAuthoringFormRenderer<ClassFormValues>({
  defaultValues: classRendererDefaults,
  groupDefaultValues: classGroupRendererDefaults,
  createArrayItem: createClassArrayItem,
  createObjectItem: createClassObjectItem
})

function createClassArrayItem(node: NodeRuntimeNodeDto, currentLength: number): Record<string, unknown> {
  const [rootPath] = node.path
  const order = currentLength + 1

  if (rootPath === 'details') return createEmptyDetail(order)
  if (rootPath === 'features') return createEmptyFeature(order)
  if (rootPath === 'proficiencies') return createEmptyProficiency(order)
  if (rootPath === 'specializations') return createEmptySpecialization(order)
  if (rootPath === 'spellLimits') return createEmptySpellLimit(order)
  if (rootPath === 'slots') return createEmptySpellSlot(order)
  if (rootPath === 'groups') return createEmptyRequirementGroup()
  if (rootPath === 'requirements') return createEmptyRequirement()
  if (rootPath === 'perLevel') return createEmptyPrepareLimitLevel(order)

  return {
    id: crypto.randomUUID(),
    order
  }
}

function createClassObjectItem(node: NodeRuntimeNodeDto): Record<string, unknown> {
  const [rootPath] = node.path

  if (rootPath === 'startingGold') return createEmptyStartingGold()
  if (rootPath === 'startingEquipment') return createEmptyStartingEquipmentRecord()
  if (rootPath === 'hitpoint') return createEmptyHitpoint()
  if (rootPath === 'multiclass') return createEmptyMulticlass()
  if (rootPath === 'requirementGroups') return { groups: [] }
  if (rootPath === 'spellcasting') return createEmptySpellcasting()
  if (rootPath === 'resources') return createEmptyResource()
  if (rootPath === 'charges') return createEmptyCharge()
  if (rootPath === 'prepareLimit') return createEmptyPrepareLimit()

  return {}
}
