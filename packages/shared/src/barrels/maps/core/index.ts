/**
 * Core map module - exports existing node definition utilities
 * Leverages the sophisticated node system from utils/nodeDefinition.ts
 */

export * from '../../../utils/nodeDefinition.js'

// Re-export commonly used types for convenience
export type {
  NodeMap,
  NodeEntry,
  NodeInput,
  NodeGroupObject,
  NodeGroupArray,
  NodeBuilder,
  BuildNodeMap,
  NodeSelectSource,
  NodeDataSource,
  NodeInlineSource,
  RelationshipPlan,
  ConditionIfExpr,
  ConditionIfBuilder,
  DataBuilder
} from '../../../utils/nodeDefinition.js'

export {
  NODE_KIND,
  INLINE_FILTER_KIND,
  INLINE_FILTER_REGISTRY,
  INLINE_FILTER_OPTIONS,
  buildNodeMap,
  buildRegistryOptionGroups
} from '../../../utils/nodeDefinition.js'
