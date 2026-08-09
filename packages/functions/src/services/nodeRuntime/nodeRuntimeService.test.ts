import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike, NodeRuntimeQueryRow, NodeRuntimeQueryWhere } from '@artificer-toolkit/db'
import type {
  NodeRuntimeNodeDto,
  NodeRuntimeOptionDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import { normalizeNodeRuntimeValues, resolveNodeRuntime } from './nodeRuntimeService.js'
import { listRuntimeNodeMapIds } from './mapRegistry.js'

const unusedDb = {} as DBLike
const nodeRuntimeQueryMock = vi.hoisted(() => ({
  selectNodeRuntimeRows: vi.fn(
    async (
      _db: DBLike,
      _table: string,
      _columns: readonly string[],
      _where?: NodeRuntimeQueryWhere,
      _systemId?: string
    ): Promise<NodeRuntimeQueryRow[]> => []
  )
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    selectNodeRuntimeRows: nodeRuntimeQueryMock.selectNodeRuntimeRows
  }
})

describe('node runtime service', () => {
  beforeEach(() => {
    nodeRuntimeQueryMock.selectNodeRuntimeRows.mockReset()
    nodeRuntimeQueryMock.selectNodeRuntimeRows.mockResolvedValue([])
  })

  it('registers active parent and child node maps used by authored forms', () => {
    expect(listRuntimeNodeMapIds()).toEqual(
      expect.arrayContaining([
        'background',
        'charges',
        'class',
        'classResource',
        'contains',
        'creature',
        'effect',
        'equipment',
        'facet',
        'facetBodyCondition',
        'facetCondition',
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
      ])
    )
  })

  it('resolves shared authoring metadata for system fields and collection rows', async () => {
    const modifierResult = await resolveNodeRuntime(unusedDb, {
      mapId: 'modifierGrant',
      systemId: 'system-1',
      values: {}
    })
    const modifierNodes = modifierResult.steps.flatMap((step) =>
      step.sections.flatMap((section) => section.nodes)
    )

    expect(modifierNodes.find((node) => node.id === 'grantKind')?.authoring).toEqual({
      exposure: 'system'
    })
    expect(modifierNodes.find((node) => node.id === 'selectionKind')?.authoring).toEqual({
      exposure: 'system'
    })

    const grantsResult = await resolveNodeRuntime(unusedDb, {
      mapId: 'featureGrants',
      systemId: 'system-1',
      values: {}
    })
    const grantNodes = grantsResult.steps.flatMap((step) =>
      step.sections.flatMap((section) => section.nodes)
    )

    const modifierGrantNode = grantNodes.find((node) => node.id === 'modifiers')
    if (
      !modifierGrantNode ||
      modifierGrantNode.kind !== 'GROUP' ||
      modifierGrantNode.groupKind !== 'ARRAY'
    ) {
      throw new Error('Expected modifiers to resolve as an array group.')
    }
    const modifierGrantAuthoring = modifierGrantNode.authoring
    expect(modifierGrantAuthoring).toMatchObject({
      exposure: 'author',
      collection: {
        ordering: { mode: 'derived' },
        rowSummary: 'modifier'
      }
    })
    expect(
      modifierGrantAuthoring?.collection?.actions.map(({ label, type }) => ({ label, type }))
    ).toEqual([
      { label: 'Add Modifier Grants', type: 'collection.add' },
      { label: 'Edit Modifier Grants', type: 'collection.edit' },
      { label: 'Duplicate Modifier Grants', type: 'collection.duplicate' },
      { label: 'Remove Modifier Grants', type: 'collection.remove' }
    ])
  })

  it('resolves visibility, requiredness, and inline options from a trusted map', async () => {
    const result = await resolveNodeRuntime(unusedDb, {
      mapId: 'proficiencyGrant',
      systemId: 'system-1',
      values: {
        proficiencyKind: 'SKILL',
        authoringModeKind: 'ALL',
        level: 'HALF'
      }
    })

    const flattened = result.steps
      .flatMap((step) => step.sections)
      .flatMap((section) => section.nodes)
    expect(flattened.find((node) => node.id === 'rounding')).toMatchObject({
      visible: true,
      required: true
    })
    expect(flattened.find((node) => node.id === 'skillIds')).toMatchObject({
      visible: false,
      required: false
    })
    expect(
      getNodeOptions(flattened.find((node) => node.id === 'proficiencyKind')).some(
        (option) => option.value === 'SKILL'
      )
    ).toBe(true)
  })

  it('shows duplicate policy only for chosen grant selections', async () => {
    const chosenResult = await resolveNodeRuntime(unusedDb, {
      mapId: 'proficiencyGrant',
      systemId: 'system-1',
      values: {
        proficiencyKind: 'SKILL',
        selectionKind: 'CHOSEN',
        authoringModeKind: 'SELECTED',
        level: 'FULL'
      }
    })
    const chosenNodes = chosenResult.steps
      .flatMap((step) => step.sections)
      .flatMap((section) => section.nodes)

    expect(chosenNodes.find((node) => node.id === 'count')).toMatchObject({
      visible: true,
      required: true
    })
    expect(chosenNodes.find((node) => node.id === 'selectionDuplicatePolicy')).toMatchObject({
      visible: true,
      required: true,
      label: 'Duplicate Policy',
      options: expect.arrayContaining([
        expect.objectContaining({ value: 'UNIQUE' }),
        expect.objectContaining({ value: 'REPEATABLE' })
      ])
    })

    const grantedResult = await resolveNodeRuntime(unusedDb, {
      mapId: 'proficiencyGrant',
      systemId: 'system-1',
      values: {
        proficiencyKind: 'SKILL',
        selectionKind: 'GRANTED',
        authoringModeKind: 'SELECTED',
        level: 'FULL'
      }
    })
    const grantedNodes = grantedResult.steps
      .flatMap((step) => step.sections)
      .flatMap((section) => section.nodes)

    expect(grantedNodes.find((node) => node.id === 'selectionDuplicatePolicy')).toMatchObject({
      visible: false,
      required: false
    })
  })

  it('treats nodes without requiredIf as optional', async () => {
    const result = await resolveNodeRuntime(unusedDb, {
      mapId: 'feature',
      systemId: 'system-1',
      values: {}
    })

    const flattened = result.steps
      .flatMap((step) => step.sections)
      .flatMap((section) => section.nodes)
    expect(flattened.find((node) => node.id === 'attributes')).toMatchObject({
      visible: true,
      required: false
    })
  })

  it('resolves authored boolean fields as toggles without select options', async () => {
    const result = await resolveNodeRuntime(unusedDb, {
      mapId: 'equipment',
      systemId: 'system-1',
      values: {
        category: 'ADVENTURING_GEAR'
      }
    })
    const nodes = result.steps.flatMap((step) => step.sections).flatMap((section) => section.nodes)

    expect(nodes.find((node) => node.id === 'requiresAttunement')).toMatchObject({
      kind: 'INPUT',
      type: 'TOGGLE',
      visible: true,
      required: false
    })
    expect(nodes.find((node) => node.id === 'requiresAttunement')).not.toHaveProperty('options')
  })

  it('resolves group requiredness from requiredIf metadata', async () => {
    const result = await resolveNodeRuntime(unusedDb, {
      mapId: 'invocation',
      systemId: 'system-1',
      values: {
        kind: 'ACTION',
        triggerCode: 'ACTIVATED'
      }
    })

    const flattened = result.steps
      .flatMap((step) => step.sections)
      .flatMap((section) => section.nodes)
    expect(flattened.find((node) => node.id === 'activation')).toMatchObject({
      visible: true,
      required: true
    })
    expect(flattened.find((node) => node.id === 'targeting')).toMatchObject({
      visible: true,
      required: false
    })
  })

  it('places feature effects separately from basic usage and restrictions', async () => {
    const result = await resolveNodeRuntime(unusedDb, {
      mapId: 'feature',
      systemId: 'system-1',
      values: {
        attributes: ['LIMITED_USE']
      }
    })

    const basics = result.steps.find((step) => step.id === 'basics')
    const effects = result.steps.find((step) => step.id === 'effects')
    expect(basics?.sections.map((section) => section.label)).toEqual([
      'Feature Basics',
      'Usage',
      'Restrictions'
    ])
    expect(effects?.sections.map((section) => section.label)).toEqual(['Effects'])
    expect(
      effects?.sections
        .find((section) => section.label === 'Effects')
        ?.nodes.map((node) => node.id)
    ).toContain('effects')
    expect(
      basics?.sections.find((section) => section.label === 'Usage')?.nodes.map((node) => node.id)
    ).toContain('charges')
    expect(
      basics?.sections
        .find((section) => section.label === 'Restrictions')
        ?.nodes.map((node) => node.id)
    ).toContain('restrictions')
  })

  it('carries explicit group presentation metadata without changing runtime semantics', async () => {
    const result = await resolveNodeRuntime(unusedDb, {
      mapId: 'spell',
      systemId: 'system-1',
      values: {
        components: []
      }
    })

    const nodes = result.steps.flatMap((step) => step.sections).flatMap((section) => section.nodes)
    expect(nodes.find((node) => node.id === 'effects')).toMatchObject({
      kind: 'GROUP',
      groupKind: 'ARRAY',
      presentation: 'branch',
      childMapId: 'effect',
      visible: true,
      required: false,
      clearPaths: []
    })
    expect(nodes.find((node) => node.id === 'castingTime')).toMatchObject({
      kind: 'GROUP',
      groupKind: 'OBJECT',
      presentation: 'inline',
      childMapId: 'castingTime',
      visible: true,
      required: false
    })
    const levelNode = nodes.find((node) => node.id === 'level')
    expect(levelNode).toMatchObject({
      constraints: { maximum: 9, minimum: 0 },
      type: 'SELECT_NUMBER'
    })
    expect(getNodeOptions(levelNode)).toContainEqual({ label: 'Cantrip', value: '0' })
  })

  it('preserves valid numeric select values and clears values outside their options', async () => {
    const valid = await normalizeNodeRuntimeValues(unusedDb, {
      mapId: 'spell',
      systemId: 'system-1',
      values: { components: [], level: 0 }
    })
    const invalid = await normalizeNodeRuntimeValues(unusedDb, {
      mapId: 'spell',
      systemId: 'system-1',
      values: { components: [], level: 10 }
    })

    expect(valid.values).toMatchObject({ level: 0 })
    expect(invalid.values).not.toHaveProperty('level')
    expect(invalid.clearedPaths).toContainEqual(['level'])
  })

  it('returns flat object and array scopes with absolute root paths', async () => {
    const result = await resolveNodeRuntime(unusedDb, {
      mapId: 'equipment',
      systemId: 'system-1',
      values: {
        category: 'GEAR',
        cost: {
          amount: 25
        },
        contains: [
          {
            equipmentId: 'rope',
            quantity: 1
          },
          {
            equipmentId: 'torch',
            quantity: 5
          }
        ]
      }
    })

    expect(result.scopes?.map(({ mapId, path }) => ({ mapId, path }))).toEqual([
      { mapId: 'cost', path: ['cost'] },
      { mapId: 'contains', path: ['contains', 0] },
      { mapId: 'contains', path: ['contains', 1] }
    ])
    expect(result.scopes?.find((scope) => scope.mapId === 'cost')?.steps).not.toHaveLength(0)
    expect(result.scopes?.find((scope) => scope.path.at(-1) === 1)?.steps).not.toHaveLength(0)
  })

  it('resolves deep nested scopes with the parent and ancestor chain used by child maps', async () => {
    const result = await resolveNodeRuntime(unusedDb, {
      mapId: 'facet',
      systemId: 'system-1',
      values: {
        groups: [
          {
            contexts: [
              {
                subject: 'CHARACTER',
                authoringModeKind: 'ALL',
                conditions: [
                  {
                    kind: 'EXISTS',
                    constraint: 'INCLUDE',
                    relationCode: 'CREATURE',
                    authoringModeKind: 'ALL',
                    where: {
                      authoringModeKind: 'SELECTED',
                      creatureIds: ['creature-1'],
                      groups: [
                        {
                          conditions: [
                            {
                              kind: 'PREDICATE',
                              constraint: 'INCLUDE',
                              predicateCode: 'CREATURE_SIZE',
                              authoringModeKind: 'SELECTED',
                              sizes: ['MEDIUM']
                            }
                          ]
                        }
                      ]
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    })

    const nestedConditionPath = [
      'groups',
      0,
      'contexts',
      0,
      'conditions',
      0,
      'where',
      'groups',
      0,
      'conditions',
      0
    ]
    const nestedCondition = result.scopes?.find((scope) => {
      return (
        scope.mapId === 'facetBodyCondition' &&
        JSON.stringify(scope.path) === JSON.stringify(nestedConditionPath)
      )
    })
    const nodes = nestedCondition?.steps
      .flatMap((step) => step.sections)
      .flatMap((section) => section.nodes)

    expect(nestedCondition).toBeDefined()
    expect(getNodeOptions(nodes?.find((node) => node.id === 'predicatePredicateCode'))).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: 'CREATURE_SIZE' })])
    )

    const scopeClearPaths = new Set(nestedCondition?.clearPaths.map((path) => JSON.stringify(path)))
    expect(nestedCondition?.clearPaths).toContainEqual(['relationCode'])
    expect(
      nodes?.every((node) => {
        return node.clearPaths.every((path) => scopeClearPaths.has(JSON.stringify(path)))
      })
    ).toBe(true)
  })

  it('omits scopes for empty records and hidden populated groups', async () => {
    const emptyResult = await resolveNodeRuntime(unusedDb, {
      mapId: 'equipment',
      systemId: 'system-1',
      values: {
        category: 'GEAR',
        cost: {},
        contains: [{}],
        restrictions: {}
      }
    })
    const hiddenResult = await resolveNodeRuntime(unusedDb, {
      mapId: 'equipment',
      systemId: 'system-1',
      values: {
        category: 'VARIANT',
        cost: { amount: 25 },
        contains: [{ equipmentId: 'rope', quantity: 1 }]
      }
    })

    expect(emptyResult.scopes).toEqual([])
    expect(hiddenResult.scopes).toEqual([])
  })

  it('normalizes values by clearing hidden CLEAR paths from the resolved runtime model', async () => {
    const result = await normalizeNodeRuntimeValues(unusedDb, {
      mapId: 'proficiencyGrant',
      systemId: 'system-1',
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
      systemId: 'system-1',
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
      systemId: 'dnd5e2014',
      values: {
        category: 'SUBCLASS'
      }
    })

    const flattened = result.steps
      .flatMap((step) => step.sections)
      .flatMap((section) => section.nodes)
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
    expect(nodeRuntimeQueryMock.selectNodeRuntimeRows).toHaveBeenCalledWith(
      unusedDb,
      'classes',
      ['id', 'label', 'category'],
      { kind: 'PREDICATE', column: 'category', op: '=', value: 'BASE' },
      'dnd5e2014'
    )
  })

  it('normalizes class attributes to the visible category option set', async () => {
    nodeRuntimeQueryMock.selectNodeRuntimeRows.mockResolvedValue([])

    const result = await normalizeNodeRuntimeValues(unusedDb, {
      mapId: 'class',
      systemId: 'system-1',
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

  it('normalizes system-scoped selections inside nested authored groups', async () => {
    nodeRuntimeQueryMock.selectNodeRuntimeRows.mockResolvedValue([])

    const result = await normalizeNodeRuntimeValues(unusedDb, {
      mapId: 'equipment',
      systemId: 'system-1',
      values: {
        category: 'GEAR',
        contains: [
          {
            equipmentId: 'equipment-from-another-system',
            quantity: 1
          }
        ]
      }
    })

    expect(result.values).toMatchObject({
      contains: [{ quantity: 1 }]
    })
    expect(result.clearedPaths).toContainEqual(['contains', 0, 'equipmentId'])
  })

  it('resolves parent-scoped nested maps from parentValues', async () => {
    const result = await resolveNodeRuntime(unusedDb, {
      mapId: 'modifierGrantDomain',
      systemId: 'system-1',
      values: {},
      parentValues: {
        valueDomainCode: 'SKILL_MODIFIER'
      }
    })

    const flattened = result.steps
      .flatMap((step) => step.sections)
      .flatMap((section) => section.nodes)
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
      systemId: 'system-1',
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

    const flattened = result.steps
      .flatMap((step) => step.sections)
      .flatMap((section) => section.nodes)
    expect(flattened.find((node) => node.id === 'count')).toMatchObject({
      visible: true
    })
    expect(flattened.find((node) => node.id === 'selectionDuplicatePolicy')).toMatchObject({
      visible: true,
      required: true
    })
  })

  it('resolves and clears discriminated facet condition branches', async () => {
    const existsResult = await resolveNodeRuntime(unusedDb, {
      mapId: 'facetCondition',
      systemId: 'system-1',
      values: {
        kind: 'EXISTS',
        constraint: 'INCLUDE',
        relationCode: 'FEATURE',
        authoringModeKind: 'ALL'
      },
      parentValues: {
        subject: 'CLASS',
        authoringModeKind: 'SELECTED',
        classIds: ['class-1']
      }
    })
    const existsNodes = existsResult.steps
      .flatMap((step) => step.sections)
      .flatMap((section) => section.nodes)

    expect(existsNodes.find((node) => node.id === 'existsRelationCode')).toMatchObject({
      visible: true,
      required: true
    })
    expect(getNodeOptions(existsNodes.find((node) => node.id === 'kind'))).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: 'EXISTS' })])
    )
    expect(existsNodes.find((node) => node.id === 'predicatePredicateCode')).toMatchObject({
      visible: false
    })
    expect(existsNodes.find((node) => node.id === 'predicateFeatureIds')?.clearPaths).toEqual([])
    expect(existsResult.clearPaths).not.toContainEqual(['featureIds'])

    const predicateResult = await resolveNodeRuntime(unusedDb, {
      mapId: 'facetCondition',
      systemId: 'system-1',
      values: {
        kind: 'PREDICATE',
        constraint: 'INCLUDE',
        predicateCode: 'OPTION_OBTAINED',
        featureIds: ['feature-1'],
        optionIds: ['option-1']
      },
      parentValues: { subject: 'CHARACTER' }
    })

    expect(predicateResult.clearPaths).not.toContainEqual(['featureIds'])
    expect(predicateResult.clearPaths).not.toContainEqual(['optionIds'])

    const nonRelationalResult = await resolveNodeRuntime(unusedDb, {
      mapId: 'facetCondition',
      systemId: 'system-1',
      values: {
        kind: 'PREDICATE',
        constraint: 'INCLUDE',
        predicateCode: 'MAGIC_SCHOOL',
        authoringModeKind: 'ALL'
      },
      parentValues: { subject: 'SPELL', authoringModeKind: 'ALL' }
    })
    const conditionKindNode = nonRelationalResult.steps
      .flatMap((step) => step.sections)
      .flatMap((section) => section.nodes)
      .find((node) => node.id === 'kind')
    const conditionKindOptions = getNodeOptions(conditionKindNode)
    expect(conditionKindOptions).toEqual([expect.objectContaining({ value: 'PREDICATE' })])

    const normalized = await normalizeNodeRuntimeValues(unusedDb, {
      mapId: 'facetCondition',
      systemId: 'system-1',
      values: {
        kind: 'PREDICATE',
        constraint: 'INCLUDE',
        predicateCode: 'SPELLCASTING',
        relationCode: 'FEATURE',
        featureIds: ['stale-feature'],
        authoringModeKind: 'ALL'
      },
      parentValues: { subject: 'CHARACTER' }
    })

    expect(normalized.values).toEqual({
      kind: 'PREDICATE',
      constraint: 'INCLUDE'
    })
    expect(normalized.clearedPaths).toEqual(
      expect.arrayContaining([
        ['predicateCode'],
        ['relationCode'],
        ['featureIds'],
        ['authoringModeKind']
      ])
    )
  })

  it('preserves same-draft option prerequisites that are not active yet', async () => {
    nodeRuntimeQueryMock.selectNodeRuntimeRows.mockResolvedValue([])

    const normalized = await normalizeNodeRuntimeValues(unusedDb, {
      mapId: 'facetCondition',
      systemId: 'system-1',
      values: {
        kind: 'PREDICATE',
        constraint: 'INCLUDE',
        predicateCode: 'OPTION_OBTAINED',
        optionIds: ['draft-option-1']
      },
      parentValues: { subject: 'CHARACTER' }
    })

    expect(normalized.values).toMatchObject({ optionIds: ['draft-option-1'] })
    expect(normalized.clearedPaths).not.toContainEqual(['optionIds'])
  })

  it('resolves nested facet conditions against the related subject and where selection', async () => {
    const result = await resolveNodeRuntime(unusedDb, {
      mapId: 'facetBodyCondition',
      systemId: 'system-1',
      values: {
        kind: 'PREDICATE',
        constraint: 'INCLUDE',
        predicateCode: 'CREATURE_SIZE',
        authoringModeKind: 'SELECTED'
      },
      parentValues: { id: 'where-group' },
      ancestors: [
        { id: 'where-group' },
        { authoringModeKind: 'SELECTED', creatureIds: ['creature-1'] },
        { kind: 'EXISTS', relationCode: 'CREATURE' }
      ]
    })
    const nodes = result.steps.flatMap((step) => step.sections).flatMap((section) => section.nodes)

    expect(getNodeOptions(nodes.find((node) => node.id === 'predicatePredicateCode'))).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: 'CREATURE_SIZE' })])
    )
    expect(nodes.find((node) => node.id === 'predicateSizes')).toMatchObject({
      visible: true
    })
  })

  it('rejects unknown map ids safely', async () => {
    await expect(
      resolveNodeRuntime(unusedDb, {
        mapId: 'unknown-map',
        systemId: 'system-1',
        values: {}
      })
    ).rejects.toThrow('Unknown node map')
  })
})

function getNodeOptions(node: NodeRuntimeNodeDto | undefined): readonly NodeRuntimeOptionDto[] {
  if (
    node?.kind !== 'INPUT' ||
    (node.type !== 'SELECT_SINGLE' && node.type !== 'SELECT_NUMBER' && node.type !== 'SELECT_MULTI')
  ) {
    return []
  }

  return node.options
}
