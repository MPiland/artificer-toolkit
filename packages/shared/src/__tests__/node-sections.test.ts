import { describe, expect, it } from 'vitest'

import { CREATURE_CATEGORY_CODE } from '#core'
import {
  type NodeMap,
  BACKGROUND_NODE_MAP,
  CLASS_NODE_MAP,
  CREATURE_NODE_MAP,
  EQUIPMENT_NODE_MAP,
  FEAT_NODE_MAP,
  FEATURE_NODE_MAP,
  OPTION_NODE_MAP,
  RACE_NODE_MAP,
  SPELL_NODE_MAP,
  VEHICLE_NODE_MAP
} from '#maps'
import {
  buildNodeMap,
  evaluateConditionIf,
  resolveNestedNodeSections,
  resolveNodeMapSections,
  resolveNodeMapSteps
} from '#utils'

describe('node map sections', () => {
  it('resolves section groups in stable order', () => {
    const sections = resolveNodeMapSections(SPELL_NODE_MAP)

    expect(sections.map((section) => section.id)).toEqual([
      'basics',
      'casting',
      'relationships',
      'effects'
    ])
    expect(sections[0]?.nodes.map((node) => node.id)).toContain('label')
  })

  it('inherits nearest parent sections for nested nodes', () => {
    const childMap = buildNodeMap<{ label?: string }>().define('child', ({ map, nodes }) => {
      map.set('label', nodes.text(['label'], 'Name'))
    })

    const parentMap = buildNodeMap<{ child?: { label?: string } }>().define('parent', ({ map, nodes }) => {
      map.set('child', nodes.groupObject(['child'], 'Child', () => childMap, {
        section: { id: 'details', label: 'Details', order: 10 }
      }))
    })

    const entries = resolveNestedNodeSections(parentMap)

    expect(entries.map((entry) => `${entry.section.id}:${entry.id}`)).toEqual([
      'details:child',
      'details:label'
    ])
  })

  it('models spell material details as a conditional clearable field', () => {
    const materialNode = SPELL_NODE_MAP.nodes.materialDescription

    expect(materialNode.hiddenBehavior).toBe('CLEAR')
    expect(evaluateConditionIf(materialNode.showIf, {
      values: { components: ['MATERIAL'] }
    })).toBe(true)
    expect(evaluateConditionIf(materialNode.showIf, {
      values: { components: ['VERBAL'] }
    })).toBe(false)
  })

  it('models creature category-specific profiles as conditional clearable groups', () => {
    const mountNode = CREATURE_NODE_MAP.nodes.mountProfile
    const legendaryNode = CREATURE_NODE_MAP.nodes.legendaryProfile
    const companionNode = CREATURE_NODE_MAP.nodes.companionProfile

    expect(mountNode.hiddenBehavior).toBe('CLEAR')
    expect(evaluateConditionIf(mountNode.showIf, {
      values: { category: CREATURE_CATEGORY_CODE.BEAST }
    })).toBe(true)
    expect(evaluateConditionIf(mountNode.showIf, {
      values: { category: CREATURE_CATEGORY_CODE.MONSTER }
    })).toBe(false)

    expect(legendaryNode.hiddenBehavior).toBe('CLEAR')
    expect(evaluateConditionIf(legendaryNode.showIf, {
      values: { category: CREATURE_CATEGORY_CODE.MONSTER }
    })).toBe(true)
    expect(evaluateConditionIf(legendaryNode.showIf, {
      values: { category: CREATURE_CATEGORY_CODE.BEAST }
    })).toBe(false)

    expect(companionNode.hiddenBehavior).toBe('CLEAR')
    expect(evaluateConditionIf(companionNode.showIf, {
      values: { category: CREATURE_CATEGORY_CODE.COMPANION }
    })).toBe(true)
    expect(evaluateConditionIf(companionNode.showIf, {
      values: { category: CREATURE_CATEGORY_CODE.SUMMON }
    })).toBe(true)
  })

  it('keeps creature logistics fields hidden for non-beasts without clearing preserved data', () => {
    const costNode = CREATURE_NODE_MAP.nodes.cost
    const capacityNode = CREATURE_NODE_MAP.nodes.carryingCapacity
    const notesNode = CREATURE_NODE_MAP.nodes.logisticsNotes

    expect(costNode.hiddenBehavior).toBeUndefined()
    expect(capacityNode.hiddenBehavior).toBeUndefined()
    expect(notesNode.hiddenBehavior).toBeUndefined()
    expect(evaluateConditionIf(costNode.showIf, {
      values: { category: CREATURE_CATEGORY_CODE.BEAST }
    })).toBe(true)
    expect(evaluateConditionIf(costNode.showIf, {
      values: { category: CREATURE_CATEGORY_CODE.MONSTER }
    })).toBe(false)
    expect(evaluateConditionIf(capacityNode.showIf, {
      values: { category: CREATURE_CATEGORY_CODE.MONSTER }
    })).toBe(false)
    expect(evaluateConditionIf(notesNode.showIf, {
      values: { category: CREATURE_CATEGORY_CODE.MONSTER }
    })).toBe(false)
  })

  it('models vehicle authoring as stable node-driven steps', () => {
    const steps = resolveNodeMapSteps(VEHICLE_NODE_MAP)
    const nodes = steps.flatMap((step) => step.sections).flatMap((section) => section.nodes)

    expect(steps.map((step) => step.id)).toEqual([
      'overview',
      'stats',
      'capacity',
      'economy',
      'content'
    ])
    const descriptionNode = VEHICLE_NODE_MAP.nodes.description

    expect(descriptionNode.kind).toBe('INPUT')
    if (descriptionNode.kind === 'INPUT') {
      expect(descriptionNode.type).toBe('RICH_TEXT')
    }
    expect(nodes.find((entry) => entry.id === 'category')?.node).toMatchObject({
      kind: 'INPUT',
      type: 'SELECT_SINGLE'
    })
    expect(nodes.find((entry) => entry.id === 'cost')?.node).toMatchObject({
      kind: 'GROUP',
      groupKind: 'OBJECT'
    })
    expect(nodes.find((entry) => entry.id === 'features')?.node).toMatchObject({
      kind: 'GROUP',
      groupKind: 'ARRAY'
    })
  })

  it('models class authoring as category-driven node steps', () => {
    const steps = resolveNodeMapSteps(CLASS_NODE_MAP)
    const nodes = steps.flatMap((step) => step.sections).flatMap((section) => section.nodes)
    const descriptionNode = CLASS_NODE_MAP.nodes.description

    expect(steps.map((step) => step.id)).toEqual([
      'basics',
      'classDetails',
      'equipment',
      'spellcasting',
      'advancement'
    ])
    expect(descriptionNode.kind).toBe('INPUT')
    if (descriptionNode.kind === 'INPUT') {
      expect(descriptionNode.type).toBe('RICH_TEXT')
    }
    expect(nodes.find((entry) => entry.id === 'category')?.node).toMatchObject({
      kind: 'INPUT',
      type: 'SELECT_SINGLE'
    })
    expect(nodes.find((entry) => entry.id === 'baseAttributes')?.node.path).toEqual(['attributes'])
    expect(nodes.find((entry) => entry.id === 'subclassAttributes')?.node.path).toEqual(['attributes'])
    expect(evaluateConditionIf(CLASS_NODE_MAP.nodes.parentClassId.showIf, {
      values: { category: 'SUBCLASS' }
    })).toBe(true)
    expect(CLASS_NODE_MAP.nodes.parentClassId.kind).toBe('INPUT')
    if (CLASS_NODE_MAP.nodes.parentClassId.kind === 'INPUT') {
      const requiredIf = CLASS_NODE_MAP.nodes.parentClassId.requiredIf

      expect(requiredIf === true || evaluateConditionIf(requiredIf, {
        values: { category: 'SUBCLASS' }
      })).toBe(true)
    }
    expect(evaluateConditionIf(CLASS_NODE_MAP.nodes.startingEquipment.showIf, {
      values: { category: 'SUBCLASS' }
    })).toBe(false)
  })

  it('models feature and option child maps as stable node-driven editors', () => {
    const featureSteps = resolveNodeMapSteps(FEATURE_NODE_MAP)
    const optionSteps = resolveNodeMapSteps(OPTION_NODE_MAP)

    expect(featureSteps.map((step) => step.id)).toEqual([
      'basics',
      'mechanics',
      'grants',
      'options'
    ])
    expect(optionSteps.map((step) => step.id)).toEqual([
      'basics',
      'mechanics',
      'grants'
    ])

    expect(FEATURE_NODE_MAP.nodes.description.kind).toBe('INPUT')
    if (FEATURE_NODE_MAP.nodes.description.kind === 'INPUT') {
      expect(FEATURE_NODE_MAP.nodes.description.type).toBe('RICH_TEXT')
    }
    expect(FEATURE_NODE_MAP.nodes.detail.kind).toBe('INPUT')
    if (FEATURE_NODE_MAP.nodes.detail.kind === 'INPUT') {
      expect(FEATURE_NODE_MAP.nodes.detail.type).toBe('RICH_TEXT')
    }
    expect(OPTION_NODE_MAP.nodes.description.kind).toBe('INPUT')
    if (OPTION_NODE_MAP.nodes.description.kind === 'INPUT') {
      expect(OPTION_NODE_MAP.nodes.description.type).toBe('RICH_TEXT')
    }
    expect(FEATURE_NODE_MAP.nodes.grants).toMatchObject({
      kind: 'GROUP',
      groupKind: 'OBJECT'
    })
    expect(OPTION_NODE_MAP.nodes.grants).toMatchObject({
      kind: 'GROUP',
      groupKind: 'OBJECT'
    })
  })

  it('provides sections for every authored subject map', () => {
    const maps: NodeMap<object>[] = [
      BACKGROUND_NODE_MAP,
      CLASS_NODE_MAP,
      CREATURE_NODE_MAP,
      EQUIPMENT_NODE_MAP,
      FEAT_NODE_MAP,
      RACE_NODE_MAP,
      SPELL_NODE_MAP,
      VEHICLE_NODE_MAP
    ]

    maps.forEach((nodeMap) => {
      const sections = resolveNodeMapSections(nodeMap)
      expect(sections.length, `${nodeMap.mapId} should expose form sections`).toBeGreaterThan(0)
      expect(sections.every((section) => section.nodes.length > 0)).toBe(true)
    })
  })
})
