import type { NodeId, NodeSectionSpec, NodeStepSpec, RuntimeNodeEntry } from './nodeDefinition.js'

export type ResolvedNodeSection = NodeSectionSpec
export type ResolvedNodeStep = NodeStepSpec

/** The node fields sectioning reads; every `NodeEntry` has them. */
type SectionableNode = { order?: number; section?: NodeSectionSpec }

export type SectionedNodeEntry<TNode extends SectionableNode> = {
  id: NodeId
  node: TNode
  section: ResolvedNodeSection
}

export type SectionedNodeGroup<TNode extends SectionableNode = RuntimeNodeEntry> =
  ResolvedNodeSection & {
    nodes: SectionedNodeEntry<TNode>[]
  }

export type SteppedNodeGroup<TNode extends SectionableNode = RuntimeNodeEntry> =
  ResolvedNodeStep & {
    sections: SectionedNodeGroup<TNode>[]
  }

export function resolveNodeMapSteps<TNode extends SectionableNode>(nodeMap: {
  nodes: Record<NodeId, TNode>
}): SteppedNodeGroup<TNode>[] {
  const steps = new Map<string, SteppedNodeGroup<TNode>>()

  for (const section of resolveNodeMapSections(nodeMap)) {
    const step = upsertStep(steps, section.step ?? sectionToStep(section))
    step.sections.push(section)
  }

  return Array.from(steps.values())
    .sort((a, b) => a.order - b.order)
    .map((step) => ({
      ...step,
      sections: step.sections.sort((a, b) => a.order - b.order)
    }))
}

export function resolveNodeMapSections<TNode extends SectionableNode>(nodeMap: {
  nodes: Record<NodeId, TNode>
}): SectionedNodeGroup<TNode>[] {
  const sections = new Map<string, SectionedNodeGroup<TNode>>()

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

function upsertStep<TNode extends SectionableNode>(
  steps: Map<string, SteppedNodeGroup<TNode>>,
  step: NodeStepSpec
) {
  const existing = steps.get(step.id)
  if (existing) return existing

  const next = {
    ...step,
    sections: [] as SectionedNodeGroup<TNode>[]
  }
  steps.set(step.id, next)
  return next
}

function upsertSection<TNode extends SectionableNode>(
  sections: Map<string, SectionedNodeGroup<TNode>>,
  section: NodeSectionSpec
) {
  const existing = sections.get(section.id)
  if (existing) return existing

  const next = {
    ...section,
    nodes: [] as SectionedNodeEntry<TNode>[]
  }
  sections.set(section.id, next)
  return next
}

function sectionToStep(section: NodeSectionSpec): NodeStepSpec {
  return {
    id: section.id,
    label: section.label,
    description: section.description,
    order: section.order
  }
}
