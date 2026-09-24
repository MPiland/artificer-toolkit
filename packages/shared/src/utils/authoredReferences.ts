/** Collect exact reference fields from an already bounded authored document. */
export function collectReferenceIds(
  value: unknown,
  singularKey: string,
  pluralKey: string
): string[] {
  const ids = new Set<string>()
  function visit(current: unknown): void {
    if (Array.isArray(current)) {
      current.forEach(visit)
      return
    }
    if (!current || typeof current !== 'object') return
    for (const [key, nested] of Object.entries(current)) {
      if (key === singularKey && typeof nested === 'string' && nested) ids.add(nested)
      else if (key === pluralKey && Array.isArray(nested)) {
        for (const id of nested) if (typeof id === 'string') ids.add(id)
      }
      visit(nested)
    }
  }
  visit(value)
  return [...ids]
}
