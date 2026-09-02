import { afterEach, describe, expect, it, vi } from 'vitest'
import { validateMapFile } from './CampaignScenePreparation.model'
import {
  clearVttMapUploadIdempotencyKey,
  createVttMapUploadFingerprint,
  getOrCreateVttMapUploadIdempotencyKey,
  uploadVttMap
} from './vttMapUpload'

const campaignA = '11111111-1111-4111-8111-111111111111'
const campaignB = '22222222-2222-4222-8222-222222222222'
const firstKey = '11111111-1111-4111-8111-111111111111'
const secondKey = '22222222-2222-4222-8222-222222222222'

function mapFile(name = 'vault.webp'): File {
  return new File(['map'], name, { lastModified: 1_700_000_000_000, type: 'image/webp' })
}

class SuccessfulXmlHttpRequest {
  static readonly sentUrls: string[] = []
  status = 0
  readonly upload: { onprogress: ((event: { loaded: number }) => void) | null } = {
    onprogress: null
  }
  onerror: (() => void) | null = null
  onload: (() => void) | null = null
  #url = ''

  open(_method: string, url: string): void {
    this.#url = url
  }

  getResponseHeader(name: string): string | null {
    return name.toLowerCase() === 'etag' ? `"${this.#url}"` : null
  }

  send(body: Blob): void {
    SuccessfulXmlHttpRequest.sentUrls.push(this.#url)
    this.status = 200
    this.upload.onprogress?.({ loaded: body.size })
    queueMicrotask(() => this.onload?.())
  }
}

describe('Campaign scene preparation', () => {
  afterEach(() => {
    sessionStorage.clear()
    SuccessfulXmlHttpRequest.sentUrls.length = 0
    vi.unstubAllGlobals()
  })

  it('accepts the locked map formats and 25 MiB boundary', () => {
    expect(validateMapFile(new File(['map'], 'map.webp', { type: 'image/webp' }))).toBeNull()
    expect(validateMapFile(new File(['map'], 'map.gif', { type: 'image/gif' }))).toMatch(
      /JPEG, PNG, or WebP/
    )
    const oversized = new File([new Uint8Array(25 * 1024 * 1024 + 1)], 'map.png', {
      type: 'image/png'
    })
    expect(validateMapFile(oversized)).toMatch(/25 MiB/)
  })

  it('retains a pending idempotency key across retries and tab reloads, then clears it after completion', () => {
    const file = mapFile()
    let generated = 0
    const nextKey = () => {
      generated += 1
      return generated === 1 ? firstKey : secondKey
    }

    expect(getOrCreateVttMapUploadIdempotencyKey(campaignA, file, nextKey)).toBe(firstKey)
    expect(getOrCreateVttMapUploadIdempotencyKey(campaignA, file, nextKey)).toBe(firstKey)
    expect(generated).toBe(1)

    clearVttMapUploadIdempotencyKey(campaignA, file)
    expect(getOrCreateVttMapUploadIdempotencyKey(campaignA, file, nextKey)).toBe(secondKey)
  })

  it('keeps idempotency keys distinct for different campaigns and files', () => {
    expect(getOrCreateVttMapUploadIdempotencyKey(campaignA, mapFile(), () => firstKey)).toBe(
      firstKey
    )
    expect(getOrCreateVttMapUploadIdempotencyKey(campaignB, mapFile(), () => secondKey)).toBe(
      secondKey
    )
    expect(
      getOrCreateVttMapUploadIdempotencyKey(campaignA, mapFile('courtyard.webp'), () => secondKey)
    ).toBe(secondKey)
  })

  it('scopes resumable parts to the R2 object identity', () => {
    const first = createVttMapUploadFingerprint({
      storageProvider: 'R2',
      objectKey: 'campaigns/a/maps/first.webp'
    })
    const second = createVttMapUploadFingerprint({
      storageProvider: 'R2',
      objectKey: 'campaigns/a/maps/second.webp'
    })

    expect(first).toBe('vtt-map:R2:campaigns/a/maps/first.webp')
    expect(first).not.toBe(second)
  })

  it('retains completed R2 parts across retries and clears them after completion', async () => {
    vi.stubGlobal('XMLHttpRequest', SuccessfulXmlHttpRequest)
    const file = new File([new Uint8Array(6 * 1024 * 1024 + 1)], 'large-map.webp', {
      type: 'image/webp'
    })
    const intent = {
      assetId: '33333333-3333-4333-8333-333333333333',
      storageProvider: 'R2' as const,
      expiresAt: '2026-08-16T00:00:00.000Z',
      objectKey: 'raw/user/map',
      resumable: {
        chunkBytes: 6_291_456 as const,
        protocol: 'R2_MULTIPART' as const,
        parts: [
          { partNumber: 1, url: 'https://storage.example/part-1' },
          { partNumber: 2, url: 'https://storage.example/part-2' }
        ]
      }
    }

    expect(await uploadVttMap({ file, intent, onProgress: () => undefined })).toEqual([
      { partNumber: 1, etag: '"https://storage.example/part-1"' },
      { partNumber: 2, etag: '"https://storage.example/part-2"' }
    ])
    expect(SuccessfulXmlHttpRequest.sentUrls).toHaveLength(2)

    await uploadVttMap({ file, intent, onProgress: () => undefined })
    expect(SuccessfulXmlHttpRequest.sentUrls).toHaveLength(2)

    clearVttMapUploadIdempotencyKey(campaignA, file, intent.assetId)
    await uploadVttMap({ file, intent, onProgress: () => undefined })
    expect(SuccessfulXmlHttpRequest.sentUrls).toHaveLength(4)
  })
})
