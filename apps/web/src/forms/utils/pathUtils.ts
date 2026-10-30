import type { NodeRuntimePathDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import type { DeepKeys, DeepKeysOfType } from '@tanstack/form-core'
import { isObjectValue, isRecord } from './valueGuards'

export function toAuthoringFieldName(
  prefix: string | undefined,
  path: readonly (string | number)[]
): string {
  const suffix = path.reduce<string>((fieldName, segment) => {
    if (typeof segment === 'number') return `${fieldName}[${segment}]`
    return fieldName ? `${fieldName}.${segment}` : segment
  }, '')

  if (!prefix) return suffix
  if (!suffix) return prefix

  return `${prefix}.${suffix}`
}

export function toTypedAuthoringFieldName<TValues>(
  prefix: string | undefined,
  path: readonly (string | number)[]
): DeepKeys<TValues> {
  return toAuthoringFieldName(prefix, path) as DeepKeys<TValues>
}

export function toTypedAuthoringArrayFieldName<TValues>(
  prefix: string | undefined,
  path: readonly (string | number)[]
): DeepKeysOfType<TValues, unknown[] | undefined> {
  return toAuthoringFieldName(prefix, path) as DeepKeysOfType<TValues, unknown[] | undefined>
}

export function toTypedAuthoringGroupFieldName<TValues, TGroupValues>(
  prefix: string | undefined,
  path: readonly (string | number)[]
): DeepKeysOfType<TValues, TGroupValues | null | undefined> {
  return toAuthoringFieldName(prefix, path) as DeepKeysOfType<
    TValues,
    TGroupValues | null | undefined
  >
}

export function parseAuthoringFieldName(fieldName: string): readonly (string | number)[] {
  const segments: (string | number)[] = []
  for (const part of fieldName.split('.')) {
    const [head, ...indexes] = part.split('[')
    if (head) segments.push(head)
    for (const index of indexes) {
      const value = Number(index.replace(']', ''))
      if (Number.isInteger(value)) segments.push(value)
    }
  }

  return segments
}

export function areAuthoringFieldPathsRelated(left: string, right: string) {
  return (
    left === right ||
    left.startsWith(`${right}.`) ||
    left.startsWith(`${right}[`) ||
    right.startsWith(`${left}.`) ||
    right.startsWith(`${left}[`)
  )
}

export function getAuthoringFieldValue(
  values: Record<string, unknown>,
  fieldName: string
): unknown {
  let current: unknown = values

  for (const segment of parseAuthoringFieldName(fieldName)) {
    if (!isObjectValue(current)) return undefined
    current = current[String(segment)]
  }

  return current
}

export function setAuthoringFieldValue(
  values: Record<string, unknown>,
  fieldName: string,
  value: unknown
): Record<string, unknown> {
  const next = setAuthoringValueAtPath(values, parseAuthoringFieldName(fieldName), value)
  return isRecord(next) ? next : values
}

export function hasMeaningfulAuthoringValueAtPaths(
  values: Record<string, unknown>,
  paths: readonly NodeRuntimePathDto[]
): boolean {
  return paths.some((path) =>
    hasMeaningfulAuthoringValue(
      getAuthoringFieldValue(values, toAuthoringFieldName(undefined, path))
    )
  )
}

function setAuthoringValueAtPath(
  current: unknown,
  path: readonly (string | number)[],
  value: unknown
): unknown {
  const [segment, ...remainingPath] = path
  if (segment === undefined) return value

  if (typeof segment === 'number') {
    const next = Array.isArray(current) ? [...current] : []
    next[segment] = setAuthoringValueAtPath(next[segment], remainingPath, value)
    return next
  }

  const next = isObjectValue(current) ? { ...current } : {}
  next[segment] = setAuthoringValueAtPath(next[segment], remainingPath, value)
  return next
}

function hasMeaningfulAuthoringValue(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.some(hasMeaningfulAuthoringValue)
  if (isRecord(value)) return Object.values(value).some(hasMeaningfulAuthoringValue)
  return true
}
