import { describe, expect, it } from 'vitest'

import { CREATURE_CATEGORY_CODE } from '#core'
import {
  type NodeMap,
  BACKGROUND_NODE_MAP,
  CLASS_NODE_MAP,
  CREATURE_NODE_MAP,
  EQUIPMENT_NODE_MAP,
  FEAT_NODE_MAP,
  FEATURE_GRANTS_NODE_MAP,
  FEATURE_NODE_MAP,
  MODIFIER_GRANT_NODE_MAP,
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

  it('forwards a section description to its derived step', () => {
    const nodeMap = buildNodeMap<{ label?: string }>().define(
      'described-step',
      ({ map, nodes }) => {
        map.set(
          'label',
          nodes.text(['label'], 'Name', {
            section: {
              id: 'basics',
              label: 'Basics',
              description: 'Define the core identity for this item.',
              order: 10
            }
          })
        )
      }
    )

    expect(resolveNodeMapSteps(nodeMap)).toMatchObject([
      {
        id: 'basics',
        label: 'Basics',
        description: 'Define the core identity for this item.'
      }
    ])
  })

  it('inherits nearest parent sections for nested nodes', () => {
    const childMap = buildNodeMap<{ label?: string }>().define('child', ({ map, nodes }) => {
      map.set('label', nodes.text(['label'], 'Name'))
    })

    const parentMap = buildNodeMap<{ child?: { label?: string } }>().define(
      'parent',
      ({ map, nodes }) => {
        map.set(
          'child',
          nodes.groupObject(['child'], 'Child', () => childMap, {
            presentation: 'inline',
            section: { id: 'details', label: 'Details', order: 10 }
          })
        )
      }
    )

    const entries = resolveNestedNodeSections(parentMap)

    expect(entries.map((entry) => `${entry.section.id}:${entry.id}`)).toEqual([
      'details:child',
      'details:label'
    ])
  })

  it('models spell material details as a conditional clearable field', () => {
    const materialNode = SPELL_NODE_MAP.nodes.materialDescription

    expect(materialNode.hiddenBehavior).toBe('CLEAR')
    expect(
      evaluateConditionIf(materialNode.showIf, {
        values: { components: ['MATERIAL'] }
      })
    ).toBe(true)
    expect(
      evaluateConditionIf(materialNode.showIf, {
        values: { components: ['VERBAL'] }
      })
    ).toBe(false)
  })

  it('models creature category-specific profiles as conditional clearable groups', () => {
    const mountNode = CREATURE_NODE_MAP.nodes.mountProfile
    const companionNode = CREATURE_NODE_MAP.nodes.companionProfile

    expect(mountNode.hiddenBehavior).toBe('CLEAR')
    expect(
      evaluateConditionIf(mountNode.showIf, {
        values: { category: CREATURE_CATEGORY_CODE.BEAST }
      })
    ).toBe(true)
    expect(
      evaluateConditionIf(mountNode.showIf, {
        values: { category: CREATURE_CATEGORY_CODE.MONSTER }
      })
    ).toBe(false)

    expect(companionNode.hiddenBehavior).toBe('CLEAR')
    expect(
      evaluateConditionIf(companionNode.showIf, {
        values: { category: CREATURE_CATEGORY_CODE.COMPANION }
      })
    ).toBe(true)
    expect(
      evaluateConditionIf(companionNode.showIf, {
        values: { category: CREATURE_CATEGORY_CODE.SUMMON }
      })
    ).toBe(true)
  })

  it('authors creature presentation sections on the canonical feature model', () => {
    const sectionNode = FEATURE_NODE_MAP.nodes.section

    expect(sectionNode.kind).toBe('INPUT')
    expect(CREATURE_NODE_MAP.nodes.features.kind).toBe('GROUP')
    expect(CREATURE_NODE_MAP.nodes.equipmentLoadout).toMatchObject({
      kind: 'GROUP',
      groupKind: 'ARRAY',
      presentation: 'table'
    })
    expect('actions' in CREATURE_NODE_MAP.nodes).toBe(false)
    expect('legendaryProfile' in CREATURE_NODE_MAP.nodes).toBe(false)
  })

  it('keeps creature logistics fields hidden for non-beasts without clearing preserved data', () => {
    const costNode = CREATURE_NODE_MAP.nodes.cost
    const capacityNode = CREATURE_NODE_MAP.nodes.carryingCapacity
    const notesNode = CREATURE_NODE_MAP.nodes.logisticsNotes

    expect(costNode.hiddenBehavior).toBeUndefined()
    expect(capacityNode.hiddenBehavior).toBeUndefined()
    expect(notesNode.hiddenBehavior).toBeUndefined()
    expect(
      evaluateConditionIf(costNode.showIf, {
        values: { category: CREATURE_CATEGORY_CODE.BEAST }
      })
    ).toBe(true)
    expect(
      evaluateConditionIf(costNode.showIf, {
        values: { category: CREATURE_CATEGORY_CODE.MONSTER }
      })
    ).toBe(false)
    expect(
      evaluateConditionIf(capacityNode.showIf, {
        values: { category: CREATURE_CATEGORY_CODE.MONSTER }
      })
    ).toBe(false)
    expect(
      evaluateConditionIf(notesNode.showIf, {
        values: { category: CREATURE_CATEGORY_CODE.MONSTER }
      })
    ).toBe(false)
  })

  it('models vehicle authoring as stable node-driven steps', () => {
    const steps = resolveNodeMapSteps(VEHICLE_NODE_MAP)
    const nodes = steps.flatMap((step) => step.sections).flatMap((section) => section.nodes)

    expect(steps.map((step) => step.id)).toEqual([
      'overview',
      'stats',
      'capacity',
      'economy',
      'features',
      'details'
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
    expect(nodes.find((entry) => entry.id === 'subclassAttributes')?.node.path).toEqual([
      'attributes'
    ])
    expect(
      evaluateConditionIf(CLASS_NODE_MAP.nodes.subclassSelectionLevel.showIf, {
        values: { category: 'BASE' }
      })
    ).toBe(true)
    expect(
      evaluateConditionIf(CLASS_NODE_MAP.nodes.subclassSelectionLevel.showIf, {
        values: { category: 'SUBCLASS' }
      })
    ).toBe(false)
    expect(
      evaluateConditionIf(CLASS_NODE_MAP.nodes.parentClassId.showIf, {
        values: { category: 'SUBCLASS' }
      })
    ).toBe(true)
    expect(CLASS_NODE_MAP.nodes.parentClassId.kind).toBe('INPUT')
    if (CLASS_NODE_MAP.nodes.parentClassId.kind === 'INPUT') {
      const requiredIf = CLASS_NODE_MAP.nodes.parentClassId.requiredIf

      expect(
        requiredIf === true ||
          evaluateConditionIf(requiredIf, {
            values: { category: 'SUBCLASS' }
          })
      ).toBe(true)
    }
    expect(
      evaluateConditionIf(CLASS_NODE_MAP.nodes.startingEquipment.showIf, {
        values: { category: 'SUBCLASS' }
      })
    ).toBe(false)
  })

  it('models feature and option child maps as stable node-driven editors', () => {
    const featureSteps = resolveNodeMapSteps(FEATURE_NODE_MAP)
    const optionSteps = resolveNodeMapSteps(OPTION_NODE_MAP)

    expect(featureSteps.map((step) => step.id)).toEqual(['basics', 'effects', 'grants', 'options'])
    expect(optionSteps.map((step) => step.id)).toEqual(['basics', 'effects', 'grants'])
    expect(resolveNodeMapSteps(EQUIPMENT_NODE_MAP).map((step) => step.id)).toEqual([
      'basics',
      'properties',
      'economy',
      'effects',
      'grants',
      'features',
      'contents'
    ])
    expect(resolveNodeMapSteps(FEAT_NODE_MAP).map((step) => step.id)).toEqual([
      'basics',
      'requirements',
      'effects',
      'grants',
      'features'
    ])
    expect(resolveNodeMapSteps(CREATURE_NODE_MAP).map((step) => step.id)).toEqual([
      'basics',
      'stats',
      'defenses',
      'details',
      'features',
      'equipment',
      'proficiencies',
      'profiles'
    ])
    expect(resolveNodeMapSteps(FEATURE_GRANTS_NODE_MAP).map((step) => step.id)).toEqual([
      'feats',
      'modifiers',
      'proficiencies',
      'senses',
      'spells'
    ])
    expect(resolveNodeMapSteps(MODIFIER_GRANT_NODE_MAP).map((step) => step.id)).toEqual([
      'modifier',
      'domain',
      'value'
    ])

    expect(FEATURE_NODE_MAP.nodes.description.kind).toBe('INPUT')
    if (FEATURE_NODE_MAP.nodes.description.kind === 'INPUT') {
      expect(FEATURE_NODE_MAP.nodes.description.type).toBe('RICH_TEXT')
    }
    expect(FEATURE_NODE_MAP.nodes.details).toMatchObject({
      kind: 'GROUP',
      groupKind: 'ARRAY'
    })
    expect(FEATURE_NODE_MAP.nodes.availableAtLevel.order).toBe(30)
    expect(FEATURE_NODE_MAP.nodes.attributes.order).toBe(40)
    expect(OPTION_NODE_MAP.nodes.details).toMatchObject({
      kind: 'GROUP',
      groupKind: 'ARRAY'
    })
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
    expect(MODIFIER_GRANT_NODE_MAP.nodes.restrictions.section?.id).toBe('modifier')
    expect(FEATURE_NODE_MAP.nodes.charges.section?.step?.id).toBe('basics')
    expect(OPTION_NODE_MAP.nodes.charges.section?.step?.id).toBe('basics')
    expect(FEAT_NODE_MAP.nodes.charges.section?.id).toBe('basics')
    expect(FEATURE_NODE_MAP.nodes.restrictions).toMatchObject({
      presentation: 'inline',
      section: expect.objectContaining({ step: expect.objectContaining({ id: 'basics' }) })
    })
    expect(OPTION_NODE_MAP.nodes.restrictions).toMatchObject({
      presentation: 'inline',
      section: expect.objectContaining({ step: expect.objectContaining({ id: 'basics' }) })
    })
    expect(EQUIPMENT_NODE_MAP.nodes.charges.section?.id).toBe('basics')
    expect(EQUIPMENT_NODE_MAP.nodes.restrictions).toMatchObject({
      presentation: 'inline',
      section: expect.objectContaining({ id: 'basics' })
    })
  })

  it('uses semantic authoring steps across every authored domain map', () => {
    const maps: NodeMap<object>[] = [
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
    ]

    maps.forEach((nodeMap) => {
      expect(
        resolveNodeMapSteps(nodeMap).map((step) => step.label),
        `${nodeMap.mapId} should not expose a generic Mechanics step`
      ).not.toContain('Mechanics')
    })
  })

  it('requires parent equipment only for variants', () => {
    const parentNode = EQUIPMENT_NODE_MAP.nodes.parentEquipmentId

    expect(
      evaluateConditionIf(parentNode.showIf, {
        values: { category: 'VARIANT' }
      })
    ).toBe(true)
    expect(
      evaluateConditionIf(parentNode.showIf, {
        values: { category: 'ADVENTURING_GEAR' }
      })
    ).toBe(false)

    expect(parentNode.kind).toBe('INPUT')
    if (parentNode.kind !== 'INPUT') return

    const requiredIf = parentNode.requiredIf
    expect(requiredIf).toBeDefined()
    if (!requiredIf) return
    expect(requiredIf).not.toBe(true)
    if (requiredIf === true) return

    expect(
      evaluateConditionIf(requiredIf, {
        values: { category: 'VARIANT' }
      })
    ).toBe(true)
    expect(
      evaluateConditionIf(requiredIf, {
        values: { category: 'ADVENTURING_GEAR' }
      })
    ).toBe(false)
  })

  it('authors equipment attunement as a boolean toggle', () => {
    expect(EQUIPMENT_NODE_MAP.nodes.requiresAttunement).toMatchObject({
      kind: 'INPUT',
      type: 'TOGGLE',
      path: ['requiresAttunement']
    })
  })

  it('limits equipment requirements to character contexts in the node map', () => {
    const restrictionsNode = EQUIPMENT_NODE_MAP.nodes.restrictions
    expect(restrictionsNode.kind).toBe('GROUP')
    if (restrictionsNode.kind !== 'GROUP') return

    const facetMap =
      typeof restrictionsNode.nodes === 'function'
        ? restrictionsNode.nodes()
        : restrictionsNode.nodes
    expect(facetMap.mapId).toBe('characterFacet')

    const groupsNode = facetMap.nodes.groups
    if (groupsNode.kind !== 'GROUP') return
    const groupMap = typeof groupsNode.nodes === 'function' ? groupsNode.nodes() : groupsNode.nodes
    const contextsNode = groupMap.nodes.contexts
    if (contextsNode.kind !== 'GROUP') return
    const contextMap =
      typeof contextsNode.nodes === 'function' ? contextsNode.nodes() : contextsNode.nodes
    const subjectNode = contextMap.nodes.subject
    if (subjectNode.kind !== 'INPUT' || subjectNode.type !== 'SELECT_SINGLE') return

    expect(subjectNode.source).toEqual({
      kind: 'INLINE_OPTIONS',
      options: [expect.objectContaining({ code: 'CHARACTER' })]
    })
  })

  it('requires top-level names for every authored subject map', () => {
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
      const labelNode = nodeMap.nodes.label

      expect(labelNode?.kind, `${nodeMap.mapId} label should be an input node`).toBe('INPUT')
      if (!labelNode || labelNode.kind !== 'INPUT') return

      expect(labelNode.requiredIf, `${nodeMap.mapId} label should be required`).toBe(true)
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
