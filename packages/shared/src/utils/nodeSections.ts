import type { NodeEntry, NodeId, NodeMap, NodeSectionSpec } from './nodeDefinition.js'

export type ResolvedNodeSection = NodeSectionSpec

export type SectionedNodeEntry = {
  id: NodeId
  node: NodeEntry<object>
  section: ResolvedNodeSection
}

export type SectionedNodeGroup = ResolvedNodeSection & {
  nodes: SectionedNodeEntry[]
}

export function resolveNodeMapSections<NLocal extends object>(
  nodeMap: NodeMap<NLocal>
): SectionedNodeGroup[] {
  const sections = new Map<string, SectionedNodeGroup>()

  Object.entries(nodeMap.nodes)
    .sort(([, a], [, b]) => (a.order ?? 0) - (b.order ?? 0))
    .forEach(([id, node]) => {
      if (!node.section) return

      const section = upsertSection(sections, node.section)
      section.nodes.push({ id, node: node as NodeEntry<object>, section })
    })

  return Array.from(sections.values())
    .sort((a, b) => a.order - b.order)
    .map((section) => ({
      ...section,
      nodes: section.nodes.sort((a, b) => (a.node.order ?? 0) - (b.node.order ?? 0))
    }))
}

export function resolveNestedNodeSections<NLocal extends object>(
  nodeMap: NodeMap<NLocal>,
  inheritedSection?: NodeSectionSpec
): SectionedNodeEntry[] {
  return Object.entries(nodeMap.nodes)
    .sort(([, a], [, b]) => (a.order ?? 0) - (b.order ?? 0))
    .flatMap(([id, node]) => {
      const section = node.section ?? inheritedSection
      const current = section ? [{ id, node: node as NodeEntry<object>, section }] : []

      if (node.kind !== 'GROUP') return current

      const childMap = typeof node.nodes === 'function' ? node.nodes() : node.nodes
      return [
        ...current,
        ...resolveNestedNodeSections(childMap, section)
      ]
    })
}

function upsertSection(
  sections: Map<string, SectionedNodeGroup>,
  section: NodeSectionSpec
) {
  const existing = sections.get(section.id)
  if (existing) return existing

  const next = {
    ...section,
    nodes: []
  }
  sections.set(section.id, next)
  return next
}
