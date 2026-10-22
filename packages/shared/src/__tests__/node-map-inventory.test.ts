import { describe, expect, it } from 'vitest'
import {
  BACKGROUND_NODE_MAP,
  CLASS_NODE_MAP,
  CREATURE_NODE_MAP,
  EFFECT_NODE_MAP,
  EQUIPMENT_NODE_MAP,
  FACET_NODE_MAP,
  FACET_SCOPED_NODE_MAP,
  FEAT_NODE_MAP,
  FEATURE_NODE_MAP,
  RACE_NODE_MAP,
  SPELL_NODE_MAP,
  STARTING_EQUIPMENT_NODE_MAP,
  SHAPE_NODE_MAP,
  VEHICLE_NODE_MAP,
  type NodeMap
} from '../barrels/maps/index.js'

type RuntimeMap = NodeMap<Record<string, unknown>>

const activeRootMaps = [
  BACKGROUND_NODE_MAP,
  CLASS_NODE_MAP,
  CREATURE_NODE_MAP,
  EFFECT_NODE_MAP,
  EQUIPMENT_NODE_MAP,
  FEAT_NODE_MAP,
  FEATURE_NODE_MAP,
  RACE_NODE_MAP,
  SPELL_NODE_MAP,
  STARTING_EQUIPMENT_NODE_MAP,
  VEHICLE_NODE_MAP
] as readonly unknown[]

describe('node map inventory', () => {
  it('registers every active child map reachable from authored root maps', () => {
    const registry = collectNodeMaps(activeRootMaps)

    expect([...registry.keys()].sort()).toEqual(
      expect.arrayContaining([
        'background',
        'charges',
        'class',
        'classResource',
        'contains',
        'creature',
        'creatureEquipmentLoadout',
        'effect',
        'equipment',
        'facet',
        'feat',
        'featGrant',
        'featGrantLevel',
        'featGrantProgression',
        'feature',
        'featureGrants',
        'modifierGrant',
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

  it('does not leave active group nodes without child maps', () => {
    const registry = collectNodeMaps(activeRootMaps)
    const missingChildren = [...registry.values()].flatMap((nodeMap) =>
      Object.entries(nodeMap.nodes).flatMap(([nodeId, node]) => {
        if (node.kind !== 'GROUP') return []

        const childMap = typeof node.nodes === 'function' ? node.nodes() : node.nodes
        return childMap?.mapId ? [] : [`${nodeMap.mapId}.${nodeId}`]
      })
    )

    expect(missingChildren).toEqual([])
  })

  it('assigns an explicit supported presentation to every reachable group', () => {
    const registry = collectNodeMaps(activeRootMaps)
    const supportedArrayPresentations = new Set(['inline', 'table', 'summary', 'branch', 'focused'])
    const supportedObjectPresentations = new Set(['inline', 'branch'])
    const failures = [...registry.entries()].flatMap(([mapId, nodeMap]) =>
      Object.entries(nodeMap.nodes).flatMap(([nodeId, node]) => {
        if (node.kind !== 'GROUP') return []

        const supported =
          node.groupKind === 'OBJECT' ? supportedObjectPresentations : supportedArrayPresentations
        return supported.has(node.presentation)
          ? []
          : [`${mapId}.${nodeId}:${node.groupKind}:${String(node.presentation)}`]
      })
    )

    expect(failures).toEqual([])
  })

  it('keeps direct staged-drawer child groups inline', () => {
    const registry = collectNodeMaps(activeRootMaps)
    const failures = [...registry.entries()].flatMap(([mapId, nodeMap]) =>
      Object.entries(nodeMap.nodes).flatMap(([nodeId, node]) => {
        if (
          node.kind !== 'GROUP' ||
          String(node.groupKind) !== 'ARRAY' ||
          String(node.presentation) !== 'focused'
        )
          return []

        const childMap = typeof node.nodes === 'function' ? node.nodes() : node.nodes
        return collectNonTerminalChildren(childMap, `${mapId}.${nodeId}`)
      })
    )

    expect(failures).toEqual([])
  })

  it('keeps feature grant families reachable through feature-backed child maps', () => {
    const registry = collectNodeMaps(activeRootMaps)

    expect(registry.get('featureGrants')?.nodes).toMatchObject({
      feats: { kind: 'GROUP', groupKind: 'ARRAY' },
      modifiers: { kind: 'GROUP', groupKind: 'ARRAY' },
      proficiencies: { kind: 'GROUP', groupKind: 'ARRAY' },
      senses: { kind: 'GROUP', groupKind: 'ARRAY' },
      spells: { kind: 'GROUP', groupKind: 'ARRAY' }
    })
    expect(registry.has('featGrant')).toBe(true)
    expect(registry.has('modifierGrant')).toBe(true)
    expect(registry.has('proficiencyGrant')).toBe(true)
    expect(registry.has('senseGrant')).toBe(true)
    expect(registry.has('spellGrant')).toBe(true)
  })

  it('uses rich text controls for prose fields', () => {
    const registry = collectNodeMaps(activeRootMaps)
    const failures = [...registry.entries()].flatMap(([mapId, nodeMap]) =>
      Object.entries(nodeMap.nodes).flatMap(([nodeId, node]) => {
        if (node.kind !== 'INPUT' || !isProseField(node) || node.type === 'RICH_TEXT') return []
        return [`${mapId}.${nodeId}:${node.type}`]
      })
    )

    expect(failures).toEqual([])
  })

  it('keeps shape field paths aligned with their authored payloads', () => {
    expect(SHAPE_NODE_MAP.nodes.edgeLength.path).toEqual(['edgeLength'])
    expect(SHAPE_NODE_MAP.nodes.height.showIf).toMatchObject({
      kind: 'OR',
      expressions: expect.any(Array)
    })
    expect(JSON.stringify(SHAPE_NODE_MAP.nodes.height.showIf)).toContain('CYLINDER')
    expect(JSON.stringify(SHAPE_NODE_MAP.nodes.height.showIf)).not.toContain('CUBE')
  })

  it('uses multi-value facet controls and traverses skill proficiency data', () => {
    const conditionMap = collectNodeMaps([FACET_NODE_MAP]).get('facetCondition')

    expect(conditionMap?.nodes.predicateRangeKind).toMatchObject({ type: 'SELECT_MULTI' })
    expect(conditionMap?.nodes.predicateDurationKind).toMatchObject({ type: 'SELECT_MULTI' })
    const skillRelationship = JSON.stringify(conditionMap?.nodes.predicateSkillIds)
    expect(skillRelationship).toContain('proficiency_grant_skills')
    expect(skillRelationship).toContain('skill_id')
    expect(skillRelationship).not.toContain('proficiency_grant_languages')
  })

  it('offers the attack roll mode check on facet conditions and gates effect paths with a facet', () => {
    const registry = collectNodeMaps([EFFECT_NODE_MAP, FACET_NODE_MAP])

    expect(registry.get('facetCondition')?.nodes.predicateRollMode).toMatchObject({
      type: 'SELECT_SINGLE',
      hiddenBehavior: 'CLEAR'
    })
    expect(JSON.stringify(registry.get('facetCondition')?.nodes.predicateRollMode)).toContain(
      'roll_modes'
    )
    expect(registry.get('facetCondition')?.nodes.predicateNegated).toMatchObject({
      type: 'TOGGLE'
    })
    expect(registry.get('facetCondition')?.nodes.predicateFeet).toMatchObject({
      type: 'NUMBER',
      hiddenBehavior: 'CLEAR'
    })
    for (const mapId of ['effectPath', 'manifestBehaviorPath']) {
      const pathMap = registry.get(mapId)
      expect(pathMap?.nodes.restrictions, mapId).toMatchObject({
        kind: 'GROUP',
        groupKind: 'OBJECT'
      })
      expect(pathMap?.nodes.usage, mapId).toMatchObject({ type: 'SELECT_SINGLE' })
    }
  })

  it('keeps both facet condition branches and generic subject selection reachable', () => {
    expect(FACET_SCOPED_NODE_MAP.mapId).toBe('facetScoped')

    const registry = collectNodeMaps([FACET_NODE_MAP])
    const contextMap = registry.get('facetContext')
    const conditionMap = registry.get('facetCondition')
    const bodyConditionMap = registry.get('facetBodyCondition')

    expect(contextMap?.nodes).toMatchObject({
      subject: { type: 'SELECT_SINGLE' },
      authoringModeKind: { type: 'SELECT_SINGLE' },
      classIds: { type: 'SELECT_MULTI' },
      equipmentIds: { type: 'SELECT_MULTI' },
      raceIds: { type: 'SELECT_MULTI' },
      spellIds: { type: 'SELECT_MULTI' }
    })
    expect(conditionMap?.nodes).toMatchObject({
      kind: { type: 'SELECT_SINGLE' },
      constraint: { type: 'SELECT_SINGLE' },
      existsRelationCode: { type: 'SELECT_SINGLE', hiddenBehavior: 'CLEAR' },
      predicatePredicateCode: { type: 'SELECT_SINGLE', hiddenBehavior: 'CLEAR' },
      predicateSizes: { type: 'SELECT_MULTI', hiddenBehavior: 'CLEAR' }
    })
    expect(bodyConditionMap?.nodes).toMatchObject({
      existsRelationCode: { type: 'SELECT_SINGLE' },
      predicatePredicateCode: { type: 'SELECT_SINGLE' }
    })
    const bodyConditionJson = JSON.stringify(bodyConditionMap)
    expect(bodyConditionJson).toContain('"from":"ANCESTOR","up":2')
    expect(bodyConditionJson).toContain('"from":"ANCESTOR","up":3')

    const prerequisitesNode = FEAT_NODE_MAP.nodes.prerequisites
    expect(prerequisitesNode.kind).toBe('GROUP')
    if (prerequisitesNode.kind === 'GROUP') {
      const prerequisiteMap =
        typeof prerequisitesNode.nodes === 'function'
          ? prerequisitesNode.nodes()
          : prerequisitesNode.nodes
      expect(prerequisiteMap.mapId).toBe('characterFacet')
    }
  })
})

function collectNodeMaps(nodeMaps: readonly unknown[]): ReadonlyMap<string, RuntimeMap> {
  const registry = new Map<string, RuntimeMap>()

  for (const nodeMap of nodeMaps) collectNodeMap(nodeMap, registry)

  return registry
}

function collectNodeMap(nodeMap: unknown, registry: Map<string, RuntimeMap>) {
  const runtimeNodeMap = nodeMap as RuntimeMap
  if (registry.has(runtimeNodeMap.mapId)) return

  registry.set(runtimeNodeMap.mapId, runtimeNodeMap)

  for (const node of Object.values(runtimeNodeMap.nodes)) {
    if (node.kind !== 'GROUP') continue

    const childMap = typeof node.nodes === 'function' ? node.nodes() : node.nodes
    collectNodeMap(childMap, registry)
  }
}

function collectNonTerminalChildren(nodeMap: RuntimeMap, parentPath: string): string[] {
  return Object.entries(nodeMap.nodes).flatMap(([nodeId, node]) => {
    if (node.kind !== 'GROUP') return []

    const nodePath = `${parentPath}>${nodeMap.mapId}.${nodeId}`
    return String(node.presentation) === 'inline' ||
      (String(node.groupKind) === 'ARRAY' && String(node.presentation) === 'table')
      ? []
      : [`${nodePath}:${node.presentation}`]
  })
}

const proseFieldKeys = new Set(['description', 'detail', 'quote'])

function isProseField(node: RuntimeMap['nodes'][string]): boolean {
  if (node.kind !== 'INPUT') return false

  const lastPathSegment = node.path[node.path.length - 1]
  if (typeof lastPathSegment !== 'string') return false

  const pathKey = lastPathSegment.toLowerCase()
  const labelKey = node.label.toLowerCase()

  return (
    proseFieldKeys.has(pathKey) ||
    pathKey.endsWith('description') ||
    pathKey.endsWith('detail') ||
    pathKey.endsWith('quote') ||
    proseFieldKeys.has(labelKey)
  )
}
