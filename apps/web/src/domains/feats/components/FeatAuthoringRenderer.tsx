import type { NodeRuntimeNodeDto } from '@artificer-toolkit/schema'
import { createAuthoringFormRenderer } from '#forms'
import {
  createDefaultEffect,
  createDefaultPath
} from '#components/editors'
import {
  createEmptyCharge,
  createEmptyFeat,
  createEmptyFeature,
  createEmptyGrants,
  createEmptyPrerequisites
} from '../featAuthoring.utils'

const featRendererDefaults = createEmptyFeat({ systemId: '', userId: '' })
const featGroupRendererDefaults: Record<string, unknown> = createEmptyFeature(1)

export const FeatAuthoringRenderer = createAuthoringFormRenderer({
  defaultValues: featRendererDefaults,
  groupDefaultValues: featGroupRendererDefaults,
  createArrayItem: createFeatArrayItem,
  createObjectItem: createFeatObjectItem
})

function createFeatArrayItem(node: NodeRuntimeNodeDto, currentLength: number): Record<string, unknown> {
  const [rootPath] = node.path
  const order = currentLength + 1

  if (rootPath === 'effects') return createDefaultEffect(order)
  if (rootPath === 'features') return createEmptyFeature(order)
  if (rootPath === 'paths') return createDefaultPath(order)
  if (rootPath === 'proficiencies') return createEmptyProficiencyGrant(order)
  if (rootPath === 'modifiers') return createEmptyModifierGrant(order)

  return {
    id: crypto.randomUUID(),
    order
  }
}

function createFeatObjectItem(node: NodeRuntimeNodeDto): Record<string, unknown> {
  const [rootPath] = node.path

  if (rootPath === 'charges') return createEmptyCharge()
  if (rootPath === 'grants') return createEmptyGrants()
  if (rootPath === 'prerequisites') return createEmptyPrerequisites()

  return {}
}

function createEmptyModifierGrant(order: number): Record<string, unknown> {
  return {
    id: crypto.randomUUID(),
    order,
    grantKind: 'MODIFIER_GRANT',
    selectionKind: 'GRANTED'
  }
}

function createEmptyProficiencyGrant(order: number): Record<string, unknown> {
  return {
    id: crypto.randomUUID(),
    order,
    grantKind: 'PROFICIENCY_GRANT',
    selectionKind: 'GRANTED',
    proficiencyKind: 'SKILL',
    level: 'FULL'
  }
}
