import type {
  CompleteVttMapMultipartUploadInput,
  CreateVttMapUploadIntentOutput
} from '@artificer-toolkit/schema/api/media'

const retryDelays = [0, 1_000, 3_000, 5_000]
const idempotencyKeyPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function mapUploadStorageKey(campaignId: string, file: File): string {
  return JSON.stringify([
    'vtt-map-upload-intent',
    campaignId,
    file.name,
    file.type,
    file.size,
    file.lastModified
  ])
}

export function getOrCreateVttMapUploadIdempotencyKey(
  campaignId: string,
  file: File,
  generateId: () => string = () => crypto.randomUUID()
): string {
  const storageKey = mapUploadStorageKey(campaignId, file)
  const existing = sessionStorage.getItem(storageKey)
  if (existing && idempotencyKeyPattern.test(existing)) return existing

  const idempotencyKey = generateId()
  sessionStorage.setItem(storageKey, idempotencyKey)
  return idempotencyKey
}

export function clearVttMapUploadIdempotencyKey(
  campaignId: string,
  file: File,
  assetId?: string
): void {
  sessionStorage.removeItem(mapUploadStorageKey(campaignId, file))
  if (assetId) sessionStorage.removeItem(completedPartsStorageKey(assetId))
}

export function createVttMapUploadFingerprint(
  intent: Pick<CreateVttMapUploadIntentOutput, 'storageProvider' | 'objectKey'>
): string {
  return `vtt-map:${intent.storageProvider}:${intent.objectKey}`
}

function completedPartsStorageKey(assetId: string): string {
  return `vtt-map-r2-parts:${assetId}`
}

function readCompletedParts(assetId: string): CompleteVttMapMultipartUploadInput['parts'] {
  const stored = sessionStorage.getItem(completedPartsStorageKey(assetId))
  if (!stored) return []
  try {
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (part): part is CompleteVttMapMultipartUploadInput['parts'][number] =>
        typeof part === 'object' &&
        part !== null &&
        'partNumber' in part &&
        Number.isInteger(part.partNumber) &&
        'etag' in part &&
        typeof part.etag === 'string' &&
        part.etag.length > 0
    )
  } catch {
    return []
  }
}

function retainCompletedParts(
  assetId: string,
  parts: CompleteVttMapMultipartUploadInput['parts']
): void {
  sessionStorage.setItem(completedPartsStorageKey(assetId), JSON.stringify(parts))
}

async function uploadPart(
  url: string,
  body: Blob,
  onProgress: (uploadedBytes: number) => void
): Promise<string> {
  let lastError: unknown
  for (const delay of retryDelays) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
    try {
      return await new Promise<string>((resolve, reject) => {
        const request = new XMLHttpRequest()
        request.open('PUT', url)
        request.upload.onprogress = (event) => onProgress(event.loaded)
        request.onerror = () => reject(new Error('R2 map part upload failed.'))
        request.onload = () => {
          if (request.status < 200 || request.status >= 300) {
            reject(new Error(`R2 map part upload failed (${request.status}).`))
            return
          }
          const etag = request.getResponseHeader('etag')?.trim()
          if (!etag) {
            reject(new Error('R2 map part upload did not return an ETag.'))
            return
          }
          resolve(etag)
        }
        request.send(body)
      })
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('R2 map part upload failed.')
}

export async function uploadVttMap({
  file,
  intent,
  onProgress
}: {
  file: File
  intent: CreateVttMapUploadIntentOutput
  onProgress: (percentage: number) => void
}): Promise<CompleteVttMapMultipartUploadInput['parts']> {
  const completed = new Map(
    readCompletedParts(intent.assetId).map((part) => [part.partNumber, part.etag])
  )
  let completedBytes = intent.resumable.parts.reduce((total, part) => {
    if (!completed.has(part.partNumber)) return total
    const start = (part.partNumber - 1) * intent.resumable.chunkBytes
    return total + Math.min(intent.resumable.chunkBytes, file.size - start)
  }, 0)
  onProgress((completedBytes / file.size) * 100)

  for (const part of intent.resumable.parts) {
    if (completed.has(part.partNumber)) continue
    const start = (part.partNumber - 1) * intent.resumable.chunkBytes
    const body = file.slice(start, Math.min(file.size, start + intent.resumable.chunkBytes))
    const etag = await uploadPart(part.url, body, (uploadedBytes) =>
      onProgress(((completedBytes + uploadedBytes) / file.size) * 100)
    )
    completed.set(part.partNumber, etag)
    completedBytes += body.size
    retainCompletedParts(
      intent.assetId,
      [...completed].map(([partNumber, retainedEtag]) => ({ etag: retainedEtag, partNumber }))
    )
  }
  onProgress(100)
  return [...completed]
    .map(([partNumber, etag]) => ({ etag, partNumber }))
    .sort((left, right) => left.partNumber - right.partNumber)
}
