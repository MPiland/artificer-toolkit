import type { ConditionIfExpr, IdRef, NodeLocalCollectionSource } from './nodeDefinition.js'

export type RuntimePath = readonly (string | number)[]

export type NodeRuntimeScope = {
  systemId?: string
  values: Record<string, unknown>
  parentValues?: Record<string, unknown>
  ancestors?: readonly Record<string, unknown>[]
}

export function isRuntimeRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function getValueAtPath(source: unknown, path: RuntimePath): unknown {
  return path.reduce<unknown>((current, segment) => {
    if (current == null) return undefined

    if (typeof segment === 'number') {
      return Array.isArray(current) ? current[segment] : undefined
    }

    return isRuntimeRecord(current) ? current[segment] : undefined
  }, source)
}

export function resolveLocalCollectionOptions(
  source: NodeLocalCollectionSource,
  scope: NodeRuntimeScope
): Array<{ value: string; label: string }> {
  const root = scope.ancestors?.at(-1) ?? scope.values
  const collection = getValueAtPath(root, source.rootCollectionPath)
  if (!Array.isArray(collection)) return []

  const options: Array<{ value: string; label: string }> = []
  for (const item of collection) {
    if (!isRuntimeRecord(item)) return []

    const value = getValueAtPath(item, source.valuePath)
    const label = getValueAtPath(item, source.labelPath)
    if (typeof value !== 'string' || typeof label !== 'string') return []
    options.push({ value, label })
  }

  return options
}

export function resolveIdRef(ref: IdRef, scope: NodeRuntimeScope): unknown {
  return getValueAtPath(resolveScopedSource(ref, scope), ref.path)
}

export function isIdRef(value: unknown): value is IdRef {
  if (!isRuntimeRecord(value)) return false
  if (value.from === 'LOCAL' || value.from === 'PARENT') {
    return Array.isArray(value.path)
  }

  return value.from === 'ANCESTOR' && typeof value.up === 'number' && Array.isArray(value.path)
}

export function evaluateConditionIf(
  expr: ConditionIfExpr | undefined,
  scope: NodeRuntimeScope
): boolean {
  if (!expr) return true

  switch (expr.kind) {
    case 'AND':
      return expr.expressions.every((child) => evaluateConditionIf(child, scope))
    case 'OR':
      return expr.expressions.some((child) => evaluateConditionIf(child, scope))
    case 'NOT':
      return !evaluateConditionIf(expr.expression, scope)
    case 'PREDICATE': {
      const left = getValueAtPath(resolveScopedSource(expr, scope), expr.path)

      switch (expr.op) {
        case '=':
          return left === expr.value
        case '>':
          return compareNumbers(
            left,
            expr.value,
            (leftNumber, rightNumber) => leftNumber > rightNumber
          )
        case '>=':
          return compareNumbers(
            left,
            expr.value,
            (leftNumber, rightNumber) => leftNumber >= rightNumber
          )
        case '<':
          return compareNumbers(
            left,
            expr.value,
            (leftNumber, rightNumber) => leftNumber < rightNumber
          )
        case '<=':
          return compareNumbers(
            left,
            expr.value,
            (leftNumber, rightNumber) => leftNumber <= rightNumber
          )
        case 'contains':
          return containsAny(left, expr.value)
        case 'empty':
          return isEmptyValue(left)
        case 'onlyValues':
          return hasOnlyValues(left, expr.value)
        default:
          throw new Error(`Unknown condition predicate: ${JSON.stringify(expr)}`)
      }
    }
    default: {
      const impossibleExpression: never = expr
      throw new Error(`Unknown condition expression kind: ${JSON.stringify(impossibleExpression)}`)
    }
  }
}

export function clearValuesAtPaths<TValues extends Record<string, unknown>>(
  values: TValues,
  paths: readonly RuntimePath[]
): { values: TValues; clearedPaths: RuntimePath[] } {
  let nextValues: unknown = values
  const clearedPaths: RuntimePath[] = []

  for (const path of paths) {
    const result = clearValueAtPath(nextValues, path)
    nextValues = result.value
    if (result.cleared) clearedPaths.push(path)
  }

  return {
    values: isRuntimeRecord(nextValues) ? (nextValues as TValues) : values,
    clearedPaths
  }
}

function resolveScopedSource(
  ref: { from: 'LOCAL' | 'PARENT' | 'ANCESTOR'; up?: number },
  scope: NodeRuntimeScope
): unknown {
  if (ref.from === 'LOCAL') return scope.values
  if (ref.from === 'PARENT') return scope.parentValues

  const index = Math.max((ref.up ?? 1) - 1, 0)
  return scope.ancestors?.[index]
}

function compareNumbers(
  left: unknown,
  right: unknown,
  compare: (leftNumber: number, rightNumber: number) => boolean
): boolean {
  return typeof left === 'number' && typeof right === 'number' && compare(left, right)
}

function containsAny(left: unknown, rightValues: readonly unknown[]): boolean {
  if (Array.isArray(left)) {
    return rightValues.some((value) => left.includes(value))
  }

  if (typeof left === 'string') {
    return rightValues.some((value) => typeof value === 'string' && left.includes(value))
  }

  return false
}

function isEmptyValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  )
}

function hasOnlyValues(left: unknown, rightValues: readonly unknown[]): boolean {
  if (!Array.isArray(left)) return false
  return left.every((value) => rightValues.includes(value))
}

function clearValueAtPath(value: unknown, path: RuntimePath): { value: unknown; cleared: boolean } {
  if (path.length === 0) return { value, cleared: false }

  const [head, ...tail] = path
  if (typeof head === 'number') {
    if (!Array.isArray(value) || head < 0 || head >= value.length) return { value, cleared: false }

    const nextArray = [...value]
    if (tail.length === 0) {
      nextArray.splice(head, 1)
      return { value: nextArray, cleared: true }
    }

    const child = clearValueAtPath(nextArray[head], tail)
    if (!child.cleared) return { value, cleared: false }

    nextArray[head] = child.value
    return { value: nextArray, cleared: true }
  }

  if (!isRuntimeRecord(value) || !(head in value)) return { value, cleared: false }

  const nextRecord = { ...value }
  if (tail.length === 0) {
    delete nextRecord[head]
    return { value: nextRecord, cleared: true }
  }

  const child = clearValueAtPath(nextRecord[head], tail)
  if (!child.cleared) return { value, cleared: false }

  nextRecord[head] = child.value
  return { value: nextRecord, cleared: true }
}
