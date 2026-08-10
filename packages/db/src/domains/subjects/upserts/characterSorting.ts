export function sortByDependency<T>(
  items: T[],
  getId: (item: T) => string,
  getDependencyId: (item: T) => string | undefined,
  label: string
): T[] {
  const knownIds = new Set<string>()

  for (const item of items) {
    const id = getId(item)
    if (knownIds.has(id)) {
      throw new Error(`${label} contains duplicate id "${id}".`)
    }
    knownIds.add(id)
  }

  for (const item of items) {
    const dependencyId = getDependencyId(item)

    if (dependencyId && !knownIds.has(dependencyId)) {
      throw new Error(`${label} references missing dependency "${dependencyId}".`)
    }
  }

  const pending = [...items]
  const resolvedIds = new Set<string>()
  const ordered: T[] = []

  while (pending.length > 0) {
    let inserted = false

    for (let index = 0; index < pending.length; index += 1) {
      const item = pending[index] as T
      const dependencyId = getDependencyId(item)

      if (!dependencyId || resolvedIds.has(dependencyId)) {
        ordered.push(item)
        resolvedIds.add(getId(item))
        pending.splice(index, 1)
        inserted = true
        break
      }
    }

    if (!inserted) {
      throw new Error(`${label} contains a cyclical dependency chain.`)
    }
  }

  return ordered
}

export function countRolls(rolls: Array<{ die: number; value: number }>) {
  const counts = new Map<string, number>()

  for (const roll of rolls) {
    const key = `${roll.die}:${roll.value}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return counts
}
