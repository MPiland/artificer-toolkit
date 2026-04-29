import { describe, expect, it } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'
import { normalizeNodeRuntimeValues, resolveNodeRuntime } from './nodeRuntimeService.js'

const unusedDb = {} as DBLike

describe('node runtime service', () => {
  it('resolves visibility, requiredness, and inline options from a trusted map', async () => {
    const result = await resolveNodeRuntime(unusedDb, {
      mapId: 'proficiencyGrant',
      values: {
        proficiencyKind: 'SKILL',
        authoringModeKind: 'ALL',
        level: 'HALF'
      }
    })

    const flattened = result.sections.flatMap((section) => section.nodes)
    expect(flattened.find((node) => node.id === 'rounding')).toMatchObject({
      visible: true,
      required: true
    })
    expect(flattened.find((node) => node.id === 'skillIds')).toMatchObject({
      visible: false,
      required: false
    })
    expect(flattened.find((node) => node.id === 'proficiencyKind')?.options?.some((option) => option.value === 'SKILL')).toBe(true)
  })

  it('normalizes values by clearing hidden CLEAR paths from the resolved runtime model', async () => {
    const result = await normalizeNodeRuntimeValues(unusedDb, {
      mapId: 'proficiencyGrant',
      values: {
        proficiencyKind: 'SKILL',
        authoringModeKind: 'ALL',
        level: 'FULL'
      }
    })

    expect(result.values).toEqual({
      proficiencyKind: 'SKILL',
      authoringModeKind: 'ALL',
      level: 'FULL'
    })
    expect(result.clearedPaths).toEqual([])
  })

  it('rejects unknown map ids safely', async () => {
    await expect(resolveNodeRuntime(unusedDb, {
      mapId: 'unknown-map',
      values: {}
    })).rejects.toThrow('Unknown node map')
  })
})
