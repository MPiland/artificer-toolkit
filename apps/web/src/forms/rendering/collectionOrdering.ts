import type { NodeRuntimeCollectionOrderingDto } from '@artificer-toolkit/schema/api/nodeRuntime'

export function getCollectionItemIdentity(
  value: unknown,
  index: number,
  ordering: NodeRuntimeCollectionOrderingDto
): string {
  if (ordering.mode === 'derived') return readIdentity(value, 'id') ?? String(index)

  const identityKey = ordering.identityPath[0]
  const identity = readIdentity(value, identityKey)
  if (identity === undefined) {
    throw new Error(
      `Manual collection row ${index + 1} is missing stable identity field "${identityKey}".`
    )
  }
  return identity
}

export function moveAndRenumberCollectionRows(
  rows: readonly unknown[],
  fromIndex: number,
  toIndex: number,
  orderPath: readonly [string] | undefined
): unknown[] {
  if (fromIndex === toIndex) return [...rows]

  const nextRows = [...rows]
  const [moved] = nextRows.splice(fromIndex, 1)
  if (moved === undefined) return [...rows]
  nextRows.splice(toIndex, 0, moved)
  return renumberCollectionRows(nextRows, orderPath)
}

export function renumberCollectionRows(
  rows: readonly unknown[],
  orderPath: readonly [string] | undefined
): unknown[] {
  if (!orderPath) return [...rows]
  const orderKey = orderPath[0]

  return rows.map((row, index) =>
    isRecord(row)
      ? {
          ...row,
          [orderKey]: index + 1
        }
      : row
  )
}

function readIdentity(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined
  const identity = value[key]
  return typeof identity === 'string' || typeof identity === 'number' ? String(identity) : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
