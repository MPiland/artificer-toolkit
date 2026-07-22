import { describe, expect, it, vi } from 'vitest'
import type { AuthoringNavigationNode, AuthoringNavigationTarget } from '../authoringNavigation'
import {
  toAuthoringNavigationRailItems,
  toAuthoringRailItems,
  toAuthoringRailSummaries
} from './Steps.utils'

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

describe('toAuthoringRailItems', () => {
  it('keeps unvisited requirement-free create steps neutral until visited', () => {
    const steps = [{ id: 'details', label: 'Details' }]
    const baseInput = {
      activeSections: [],
      activeStepId: 'details',
      mode: 'create',
      onStepSelect: vi.fn(),
      steps,
      stepStatuses: { details: 'complete' as const }
    }

    expect(toAuthoringRailItems({ ...baseInput, visitedStepIds: new Set() })[0]?.status).toBe('empty')
    expect(toAuthoringRailItems({ ...baseInput, visitedStepIds: new Set(['details']) })[0]?.status).toBe('complete')
  })

  it('keeps unvisited incomplete create steps neutral until visited', () => {
    const baseInput = {
      activeSections: [],
      activeStepId: 'details',
      mode: 'create',
      onStepSelect: vi.fn(),
      steps: [{ id: 'details', label: 'Details' }],
      stepStatuses: { details: 'incomplete' as const }
    }

    expect(toAuthoringRailItems({ ...baseInput, visitedStepIds: new Set() })[0]?.status).toBe('empty')
    expect(toAuthoringRailItems({ ...baseInput, visitedStepIds: new Set(['details']) })[0]?.status).toBe('incomplete')
  })

  it('shows later warnings even after a visited step was complete', () => {
    const [item] = toAuthoringRailItems({
      activeSections: [],
      activeStepId: 'details',
      mode: 'create',
      onStepSelect: vi.fn(),
      steps: [{ id: 'details', label: 'Details' }],
      stepStatuses: { details: 'warning' },
      visitedStepIds: new Set(['details'])
    })

    expect(item?.status).toBe('warning')
  })
})

describe('toAuthoringRailSummaries', () => {
  it('does not count incomplete steps as issues', () => {
    const summaries = toAuthoringRailSummaries({
      hasChanges: false,
      mode: 'create',
      summary: {
        completeCount: 1,
        errorCount: 0,
        incompleteCount: 1,
        stepCount: 2,
        warningCount: 0
      }
    })

    expect(summaries[1]).toEqual(expect.objectContaining({
      markerLabel: 'No issues',
      status: 'complete',
      value: '0'
    }))
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
