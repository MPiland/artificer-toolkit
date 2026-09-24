// Class relationship validation is CPU-heavy enough to require one record per
// mutation. Other records share a payload/count bound; never split a document.
export function* sourceImportBatches<T>(records: readonly T[]) {
  const encoder = new TextEncoder()
  let batch: T[] = []
  let bytes = 0
  for (const record of records) {
    const size = encoder.encode(JSON.stringify(record)).byteLength
    const isClass =
      typeof record === 'object' &&
      record !== null &&
      'subjectKind' in record &&
      record.subjectKind === 'CLASS'
    if (isClass) {
      if (batch.length) yield batch
      yield [record]
      batch = []
      bytes = 0
      continue
    }
    if (batch.length && (batch.length === 10 || bytes + size > 128 * 1024)) {
      yield batch
      batch = []
      bytes = 0
    }
    batch.push(record)
    bytes += size
  }
  if (batch.length) yield batch
}
