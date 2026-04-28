import type { NodeEntry, NodeId, NodeMap, NodeSectionSpec } from './nodeDefinition.js'

export type ResolvedNodeSection = NodeSectionSpec

export type SectionedNodeEntry<NLocal extends object> = {
  id: NodeId
  node: NodeEntry<NLocal>
  section: ResolvedNodeSection
}

export type SectionedNodeGroup<NLocal extends object = Record<string, unknown>> = ResolvedNodeSection & {
  nodes: SectionedNodeEntry<NLocal>[]
}

export function resolveNodeMapSections<NLocal extends object>(
  nodeMap: NodeMap<NLocal>
): SectionedNodeGroup<NLocal>[] {
  const sections = new Map<string, SectionedNodeGroup<NLocal>>()

  Object.entries(nodeMap.nodes)
    .sort(([, a], [, b]) => (a.order ?? 0) - (b.order ?? 0))
    .forEach(([id, node]) => {
      if (!node.section) return

      const section = upsertSection(sections, node.section)
      section.nodes.push({ id, node, section })
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
): SectionedNodeEntry<Record<string, unknown>>[] {
  return Object.entries(nodeMap.nodes)
    .sort(([, a], [, b]) => (a.order ?? 0) - (b.order ?? 0))
    .flatMap(([id, node]) => {
      const section = node.section ?? inheritedSection
      const current = section ? [{ id, node: node as unknown as NodeEntry<Record<string, unknown>>, section }] : []

      if (node.kind !== 'GROUP') return current

      const childMap = typeof node.nodes === 'function' ? node.nodes() : node.nodes
      return [
        ...current,
        ...resolveNestedNodeSections(childMap, section)
      ]
    })
}

function upsertSection<NLocal extends object>(
  sections: Map<string, SectionedNodeGroup<NLocal>>,
  section: NodeSectionSpec
) {
  const existing = sections.get(section.id)
  if (existing) return existing

  const next = {
    ...section,
    nodes: [] as SectionedNodeEntry<NLocal>[]
  }
  sections.set(section.id, next)
  return next
}
