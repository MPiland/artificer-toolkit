export function uniqueIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)))
}

export async function hydrateByIds<T>(
  ids: readonly string[],
  hydrate: (id: string) => Promise<T | null>
): Promise<Map<string, T>> {
  const distinctIds = uniqueIds(ids)
  const records = await Promise.all(distinctIds.map((id) => hydrate(id)))
  const result = new Map<string, T>()

  records.forEach((record, index) => {
    if (record !== null) {
      result.set(distinctIds[index]!, record)
    }
  })

  return result
}

export function orderedHydratedRecords<T>(
  ids: readonly string[],
  recordsById: Map<string, T>
): T[] {
  return ids.flatMap((id) => {
    const record = recordsById.get(id)
    return record ? [record] : []
  })
}
