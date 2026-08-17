import type { CreateVttMapUploadIntentOutput } from '@artificer-toolkit/schema/api/media'

const retryDelays = [0, 3_000, 5_000, 10_000, 20_000]
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
}

export function createVttMapUploadFingerprint(
  intent: Pick<CreateVttMapUploadIntentOutput, 'bucket' | 'objectKey'>
): string {
  return `vtt-map:${intent.bucket}:${intent.objectKey}`
}

export function resolveVttMapTusEndpoint(supabaseUrl: string): string {
  const url = new URL(supabaseUrl)
  const hosted = url.hostname.match(/^([^.]+)\.supabase\.co$/)
  if (hosted) return `https://${hosted[1]}.storage.supabase.co/storage/v1/upload/resumable/sign`
  return new URL('/storage/v1/upload/resumable/sign', url).toString()
}

export function createVttMapUploadOptions({
  file,
  intent,
  onError,
  onProgress,
  onSuccess,
  supabaseUrl
}: {
  file: File
  intent: CreateVttMapUploadIntentOutput
  onError: (error: unknown) => void
  onProgress: (percentage: number) => void
  onSuccess: () => void
  supabaseUrl: string
}) {
  return {
    chunkSize: intent.resumable.chunkBytes,
    endpoint: resolveVttMapTusEndpoint(supabaseUrl),
    fingerprint: async () => createVttMapUploadFingerprint(intent),
    headers: { 'x-signature': intent.token },
    metadata: {
      bucketName: intent.bucket,
      cacheControl: '3600',
      contentType: file.type,
      objectName: intent.objectKey
    },
    onError,
    onProgress: (uploaded: number, total: number) =>
      onProgress(total === 0 ? 0 : (uploaded / total) * 100),
    onSuccess,
    removeFingerprintOnSuccess: true,
    retryDelays,
    uploadDataDuringCreation: true
  }
}

export async function uploadVttMap({
  file,
  intent,
  onProgress,
  supabaseUrl
}: {
  file: File
  intent: CreateVttMapUploadIntentOutput
  onProgress: (percentage: number) => void
  supabaseUrl: string
}): Promise<void> {
  const { Upload } = await import('tus-js-client')
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(
      file,
      createVttMapUploadOptions({
        file,
        intent,
        onError: reject,
        onProgress,
        onSuccess: resolve,
        supabaseUrl
      })
    )

    void upload.findPreviousUploads().then((previous) => {
      if (previous[0]) upload.resumeFromPreviousUpload(previous[0])
      upload.start()
    }, reject)
  })
}
