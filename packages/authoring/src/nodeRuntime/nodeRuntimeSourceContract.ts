import type { NodeRuntimeSourceTable } from './nodeRuntimeSourceManifest.js'

export type NodeRuntimeQueryRow = Record<string, unknown>

export type NodeRuntimeQueryWhere =
  | { kind: 'PREDICATE'; column: string; op: '=' | '!='; value: unknown }
  | { kind: 'PREDICATE'; column: string; op: 'IN'; values: readonly unknown[] }
  | { kind: 'AND'; expressions: readonly NodeRuntimeQueryWhere[] }
  | { kind: 'OR'; expressions: readonly NodeRuntimeQueryWhere[] }
  | { kind: 'NOT'; expression: NodeRuntimeQueryWhere }
  | { kind: 'CONSTANT'; value: boolean }

export type NodeRuntimeSourceReader = (
  table: NodeRuntimeSourceTable,
  columns: readonly string[],
  where: NodeRuntimeQueryWhere | undefined,
  systemId: string | undefined
) => Promise<NodeRuntimeQueryRow[]>
