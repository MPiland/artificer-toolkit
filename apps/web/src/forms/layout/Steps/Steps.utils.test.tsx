import { describe, expect, it, vi } from 'vitest'
import type { AuthoringNavigationNode, AuthoringNavigationTarget } from '../authoringNavigation'
import { toAuthoringNavigationRailItems } from './Steps.utils'

describe('toAuthoringNavigationRailItems', () => {
  it('aggregates a selectable parent target with its child statuses', () => {
    const onTargetSelect = vi.fn()
    const navigationTree = [
      {
        children: [
          {
            id: 'modifier-child',
            label: '+1 Damage Rolls',
            level: 1,
            status: 'error',
            target: createTarget('modifier-child')
          }
        ],
        id: 'modifiers',
        label: 'Modifiers',
        level: 0,
        status: 'complete',
        target: createTarget('modifiers')
      }
    ] satisfies readonly AuthoringNavigationNode[]

    const [item] = toAuthoringNavigationRailItems({
      mode: 'edit',
      navigationTree,
      onTargetSelect,
      visitedStepIds: new Set()
    })

    expect(item?.status).toBe('error')
    item?.onSelect?.()
    expect(onTargetSelect).toHaveBeenCalledWith('modifiers', true)
  })

  it('identifies a selected leaf so overlay navigation can close', () => {
    const onTargetSelect = vi.fn()
    const navigationTree = [
      {
        id: 'modifier-child',
        label: '+1 Damage Rolls',
        level: 0,
        status: 'complete',
        target: createTarget('modifier-child')
      }
    ] satisfies readonly AuthoringNavigationNode[]

    const [item] = toAuthoringNavigationRailItems({
      mode: 'edit',
      navigationTree,
      onTargetSelect,
      visitedStepIds: new Set()
    })

    item?.onSelect?.()
    expect(onTargetSelect).toHaveBeenCalledWith('modifier-child', false)
  })
})

function createTarget(id: string): AuthoringNavigationTarget {
  return {
    id,
    kind: 'overview',
    label: id,
    mapId: 'equipment',
    ownedFieldPaths: []
  }
}
