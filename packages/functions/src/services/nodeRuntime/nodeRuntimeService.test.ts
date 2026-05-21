import { describe, expect, it, vi } from 'vitest'
import type { DBLike, NodeRuntimeQueryRow } from '@artificer-toolkit/db'
import { normalizeNodeRuntimeValues, resolveNodeRuntime } from './nodeRuntimeService.js'
import { listRuntimeNodeMapIds } from './mapRegistry.js'

const unusedDb = {} as DBLike
const nodeRuntimeQueryMock = vi.hoisted(() => ({
  selectNodeRuntimeRows: vi.fn(async (_db: DBLike, _table: string): Promise<NodeRuntimeQueryRow[]> => [])
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    selectNodeRuntimeRows: nodeRuntimeQueryMock.selectNodeRuntimeRows
  }
})

describe('node runtime service', () => {
  it('registers active parent and child node maps used by authored forms', () => {
    expect(listRuntimeNodeMapIds()).toEqual(expect.arrayContaining([
      'background',
      'charges',
      'class',
      'classResource',
      'contains',
      'creature',
      'effect',
      'equipment',
      'facet',
      'feat',
      'feature',
      'featureGrants',
      'modifierGrant',
      'modifierGrantDomain',
      'modifierGrantPayload',
      'option',
      'proficiencyGrant',
      'race',
      'raceAncestry',
      'raceAncestryOption',
      'spell',
      'startingEquipment',
      'startingEquipmentItem',
      'vehicle'
    ]))
  })

  it('resolves visibility, requiredness, and inline options from a trusted map', async () => {
    const result = await resolveNodeRuntime(unusedDb, {
      mapId: 'proficiencyGrant',
      values: {
        proficiencyKind: 'SKILL',
        authoringModeKind: 'ALL',
        level: 'HALF'
      }
    })

    const flattened = result.steps.flatMap((step) => step.sections).flatMap((section) => section.nodes)
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

  it('treats nodes without requiredIf as optional', async () => {
    const result = await resolveNodeRuntime(unusedDb, {
      mapId: 'feature',
      values: {}
    })

    const flattened = result.steps.flatMap((step) => step.sections).flatMap((section) => section.nodes)
    expect(flattened.find((node) => node.id === 'attributes')).toMatchObject({
      visible: true,
      required: false
    })
  })

  it('resolves group requiredness from requiredIf metadata', async () => {
    const result = await resolveNodeRuntime(unusedDb, {
      mapId: 'invocation',
      values: {
        kind: 'ACTION',
        triggerCode: 'ACTIVATED'
      }
    })

    const flattened = result.steps.flatMap((step) => step.sections).flatMap((section) => section.nodes)
    expect(flattened.find((node) => node.id === 'activation')).toMatchObject({
      visible: true,
      required: true
    })
    expect(flattened.find((node) => node.id === 'targeting')).toMatchObject({
      visible: true,
      required: false
    })
  })

  it('separates feature mechanics into effects, usage, and restrictions sections', async () => {
    const result = await resolveNodeRuntime(unusedDb, {
      mapId: 'feature',
      values: {
        attributes: ['LIMITED_USE']
      }
    })

    const mechanics = result.steps.find((step) => step.id === 'mechanics')
    expect(mechanics?.sections.map((section) => section.label)).toEqual([
      'Effects',
      'Usage',
      'Restrictions'
    ])
    expect(mechanics?.sections.find((section) => section.label === 'Effects')?.nodes.map((node) => node.id)).toContain('effects')
    expect(mechanics?.sections.find((section) => section.label === 'Usage')?.nodes.map((node) => node.id)).toContain('charges')
    expect(mechanics?.sections.find((section) => section.label === 'Restrictions')?.nodes.map((node) => node.id)).toContain('restrictions')
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

  it('preserves hidden non-clear creature logistics values during normalization', async () => {
    const logistics = {
      cost: { amount: 125, currencyId: 'gp' },
      carryingCapacity: { amount: 500, unit: 'POUND' },
      logisticsNotes: [{ value: 'Can haul a compact supply wagon.' }]
    }

    const result = await normalizeNodeRuntimeValues(unusedDb, {
      mapId: 'creature',
      values: {
        id: 'creature-1',
        label: 'Clockwork Porter',
        userId: 'user-1',
        systemId: 'system-1',
        category: 'MONSTER',
        ...logistics,
        mountProfile: { mountType: 'CONTROLLED' }
      }
    })

    expect(result.values).toMatchObject(logistics)
    expect(result.values).not.toHaveProperty('mountProfile')
    expect(result.clearedPaths).not.toContainEqual(['cost'])
    expect(result.clearedPaths).not.toContainEqual(['carryingCapacity'])
    expect(result.clearedPaths).not.toContainEqual(['logisticsNotes'])
    expect(result.clearedPaths).toContainEqual(['mountProfile'])
  })

  it('resolves class category branches and parent class options', async () => {
    nodeRuntimeQueryMock.selectNodeRuntimeRows.mockImplementation(async (_db, table) => {
      if (table === 'classes') {
        return [
          { id: 'fighter', label: 'Fighter', category: 'BASE' },
          { id: 'champion', label: 'Champion', category: 'SUBCLASS' }
        ]
      }

      return []
    })

    const result = await resolveNodeRuntime(unusedDb, {
      mapId: 'class',
      values: {
        category: 'SUBCLASS'
      }
    })

    const flattened = result.steps.flatMap((step) => step.sections).flatMap((section) => section.nodes)
    expect(result.steps.map((step) => step.id)).toEqual([
      'basics',
      'classDetails',
      'equipment',
      'spellcasting',
      'advancement'
    ])
    expect(flattened.find((node) => node.id === 'parentClassId')).toMatchObject({
      visible: true,
      required: true,
      options: [{ value: 'fighter', label: 'Fighter' }]
    })
    expect(flattened.find((node) => node.id === 'startingEquipment')).toMatchObject({
      visible: false
    })
    expect(flattened.find((node) => node.id === 'subclassAttributes')).toMatchObject({
      visible: true
    })
  })

  it('normalizes class attributes to the visible category option set', async () => {
    nodeRuntimeQueryMock.selectNodeRuntimeRows.mockResolvedValue([])

    const result = await normalizeNodeRuntimeValues(unusedDb, {
      mapId: 'class',
      values: {
        category: 'BASE',
        attributes: ['SPELLCASTER', 'SPECIALIZATION']
      }
    })

    expect(result.values).toMatchObject({
      category: 'BASE',
      attributes: ['SPELLCASTER']
    })
    expect(result.clearedPaths).toContainEqual(['attributes'])
  })

  it('resolves parent-scoped nested maps from parentValues', async () => {
    const result = await resolveNodeRuntime(unusedDb, {
      mapId: 'modifierGrantDomain',
      values: {},
      parentValues: {
        valueDomainCode: 'SKILL_MODIFIER'
      }
    })

    const flattened = result.steps.flatMap((step) => step.sections).flatMap((section) => section.nodes)
    expect(flattened.find((node) => node.id === 'skillId')).toMatchObject({
      visible: true
    })
    expect(flattened.find((node) => node.id === 'ability')).toMatchObject({
      visible: false
    })
  })

  it('resolves ancestor-scoped nested maps from ancestors', async () => {
    const result = await resolveNodeRuntime(unusedDb, {
      mapId: 'featGrantLevel',
      values: {
        authoringModeKind: 'ALL'
      },
      parentValues: {
        scalingSource: 'CHARACTER_LEVEL'
      },
      ancestors: [
        {
          selectionKind: 'CHOSEN'
        }
      ]
    })

    const flattened = result.steps.flatMap((step) => step.sections).flatMap((section) => section.nodes)
    expect(flattened.find((node) => node.id === 'count')).toMatchObject({
      visible: true
    })
  })

  it('rejects unknown map ids safely', async () => {
    await expect(resolveNodeRuntime(unusedDb, {
      mapId: 'unknown-map',
      values: {}
    })).rejects.toThrow('Unknown node map')
  })
})
