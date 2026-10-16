import { describe, expect, it } from 'vitest'

import {
  CREATURE_FEATURE_NODE_MAP,
  CREATURE_OPTION_NODE_MAP,
  FEATURE_NODE_MAP,
  OPTION_NODE_MAP
} from '#maps'

type ChildMap = { mapId: string; nodes: Record<string, unknown> }

/** The node map a group node opens. */
function childMap(candidate: unknown) {
  const node = candidate as { kind: string; nodes?: ChildMap | (() => ChildMap) } | undefined
  if (node?.kind !== 'GROUP' || !node.nodes) throw new Error('Expected a group node.')
  return typeof node.nodes === 'function' ? node.nodes() : node.nodes
}

describe('Creature-only Feature authoring fields (D51, D57)', () => {
  it('offers a versatile grip and an option action reference only in Creature editors', () => {
    expect(childMap(CREATURE_FEATURE_NODE_MAP.nodes.effects).nodes.grip).toBeDefined()
    expect(childMap(CREATURE_FEATURE_NODE_MAP.nodes.options).mapId).toBe('creatureOption')
    expect(CREATURE_OPTION_NODE_MAP.nodes.actionReference).toBeDefined()
    expect(childMap(CREATURE_OPTION_NODE_MAP.nodes.effects).nodes.grip).toBeDefined()

    expect(childMap(FEATURE_NODE_MAP.nodes.effects).nodes.grip).toBeUndefined()
    expect(childMap(FEATURE_NODE_MAP.nodes.options).mapId).toBe('option')
    expect(OPTION_NODE_MAP.nodes.actionReference).toBeUndefined()
    expect(childMap(OPTION_NODE_MAP.nodes.effects).nodes.grip).toBeUndefined()
  })
})

describe('Creature spellCast authoring (REACTION-4.T3h)', () => {
  it('authors a spell reference or a cast level from core nodes, only in Creature editors', () => {
    const creatureEffect = childMap(CREATURE_FEATURE_NODE_MAP.nodes.effects).nodes
    expect(Object.keys(childMap(creatureEffect.spellCast).nodes).sort()).toEqual([
      'castLevel',
      'spellId'
    ])
    expect(childMap(childMap(CREATURE_OPTION_NODE_MAP.nodes.effects).nodes.spellCast).nodes).toBeDefined()

    expect(childMap(FEATURE_NODE_MAP.nodes.effects).nodes.spellCast).toBeUndefined()
    expect(childMap(OPTION_NODE_MAP.nodes.effects).nodes.spellCast).toBeUndefined()
  })
})
