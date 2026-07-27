export interface AuthoredCloneInput {
  id: string
  label: string
  status?: unknown
}

export function cloneAuthoredItem<TInput extends AuthoredCloneInput>(input: TInput): TInput {
  const idMap = collectAuthoredIds(input)
  const cloned = cloneAuthoredValue(input, idMap) as TInput

  return {
    ...cloned,
    label: `${input.label} Copy`,
    ...('status' in input ? { status: 'DRAFT' } : {})
  }
}

function collectAuthoredIds(
  value: unknown,
  key?: string,
  ids = new Map<string, string>()
): Map<string, string> {
  if (key === 'id' && typeof value === 'string' && !ids.has(value)) {
    ids.set(value, crypto.randomUUID())
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectAuthoredIds(item, key, ids))
    return ids
  }

  if (!isPlainRecord(value)) return ids

  Object.entries(value).forEach(([entryKey, entryValue]) => {
    collectAuthoredIds(entryValue, entryKey, ids)
  })

  return ids
}

function cloneAuthoredValue(
  value: unknown,
  idMap: ReadonlyMap<string, string>,
  key?: string
): unknown {
  if (typeof value === 'string' && shouldRemapAuthoredId(key)) return idMap.get(value) ?? value
  if (Array.isArray(value)) return value.map((item) => cloneAuthoredValue(item, idMap, key))
  if (!isPlainRecord(value)) return value

  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      cloneAuthoredValue(entryValue, idMap, entryKey)
    ])
  )
}

function shouldRemapAuthoredId(key: string | undefined): boolean {
  return key === 'id' || key?.endsWith('Id') === true || key?.endsWith('Ids') === true
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}
