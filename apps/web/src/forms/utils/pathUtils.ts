import type { NodeRuntimePathDto } from '@artificer-toolkit/schema'
import type { DeepKeys, DeepKeysOfType } from '@tanstack/form-core'

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
  return toAuthoringFieldName(prefix, path) as DeepKeysOfType<TValues, TGroupValues | null | undefined>
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

export function getAuthoringFieldValue(values: Record<string, unknown>, fieldName: string): unknown {
  let current: unknown = values

  for (const segment of parseAuthoringFieldName(fieldName)) {
    if (typeof current !== 'object' || current === null) return undefined
    current = (current as Record<string, unknown>)[String(segment)]
  }

  return current
}

export function prefixRuntimePaths(
  fieldPathPrefix: string | undefined,
  paths: readonly NodeRuntimePathDto[]
): NodeRuntimePathDto[] {
  if (!fieldPathPrefix) return [...paths]

  const prefix = parseAuthoringFieldName(fieldPathPrefix)
  return paths.map((path) => [...prefix, ...path] as NodeRuntimePathDto)
}
