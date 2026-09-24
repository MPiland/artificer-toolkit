import type { z } from 'zod/mini'
import type { mediaSinglePutUploadSchema } from '@artificer-toolkit/schema/api/mediaAssets'

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

export function clearVttMapUploadIdempotencyKey(campaignId: string, file: File): void {
  sessionStorage.removeItem(mapUploadStorageKey(campaignId, file))
  sessionStorage.removeItem(`${mapUploadStorageKey(campaignId, file)}:uploaded`)
}

export function getUploadedVttMapAssetId(campaignId: string, file: File): string | null {
  const value = sessionStorage.getItem(`${mapUploadStorageKey(campaignId, file)}:uploaded`)
  return value && idempotencyKeyPattern.test(value) ? value : null
}

export async function uploadVttMap({
  campaignId,
  file,
  intent,
  onProgress
}: {
  campaignId: string
  file: File
  intent: z.infer<typeof mediaSinglePutUploadSchema>
  onProgress: (percentage: number) => void
}): Promise<void> {
  let lastError: unknown
  for (const delay of retryDelays) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
    try {
      onProgress(0)
      await new Promise<void>((resolve, reject) => {
        const request = new XMLHttpRequest()
        request.open(intent.method, intent.url)
        request.setRequestHeader('Content-Type', file.type)
        request.upload.onprogress = (event) =>
          onProgress(Math.min(100, (event.loaded / file.size) * 100))
        request.onerror = () => reject(new Error('Map upload failed. Try again.'))
        request.onabort = () => reject(new Error('Map upload was cancelled.'))
        request.onload = () => {
          if (request.status < 200 || request.status >= 300) {
            reject(new Error(`Map upload failed (${request.status}).`))
            return
          }
          resolve()
        }
        request.send(file)
      })
      sessionStorage.setItem(`${mapUploadStorageKey(campaignId, file)}:uploaded`, intent.assetId)
      onProgress(100)
      return
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Map upload failed.')
}
