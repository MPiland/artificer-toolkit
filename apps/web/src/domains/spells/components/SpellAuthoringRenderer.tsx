import type { NodeRuntimeNodeDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { createAuthoringFormRenderer } from '#forms'
import {
  createDefaultEffect,
  createDefaultPath,
  createRange
} from '#components/editors'
import { createEmptySpell } from '../spellAuthoring.utils'

const spellRendererDefaults = createEmptySpell({ systemId: '', userId: '' })
const spellGroupRendererDefaults: Record<string, unknown> = {
  amount: 1,
  unit: 'ROUND'
}

export const SpellAuthoringRenderer = createAuthoringFormRenderer({
  defaultValues: spellRendererDefaults,
  groupDefaultValues: spellGroupRendererDefaults,
  createArrayItem: createSpellArrayItem,
  createObjectItem: createSpellObjectItem
})

function createSpellArrayItem(node: NodeRuntimeNodeDto, currentLength: number): Record<string, unknown> {
  const [rootPath] = node.path
  const order = currentLength + 1

  if (rootPath === 'effects') return createDefaultEffect(order)
  if (rootPath === 'paths') return createDefaultPath(order)

  return {
    id: crypto.randomUUID(),
    order
  }
}

function createSpellObjectItem(node: NodeRuntimeNodeDto): Record<string, unknown> {
  const [rootPath] = node.path

  if (rootPath === 'castingTime') {
    return {
      amount: 1,
      unit: 'ROUND'
    }
  }

  if (rootPath === 'range' || rootPath === 'rangeOverride' || rootPath === 'distance') {
    return createRange('DISTANCE')
  }

  return {}
}
