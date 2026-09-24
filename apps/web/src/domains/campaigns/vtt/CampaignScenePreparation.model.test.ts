import { afterEach, describe, expect, it, vi } from 'vitest'
import { validateMapFile } from './CampaignScenePreparation.model'
import {
  clearVttMapUploadIdempotencyKey,
  getUploadedVttMapAssetId,
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
  static readonly headers: Array<[string, string]> = []
  static readonly statuses: number[] = []
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

  setRequestHeader(name: string, value: string): void {
    SuccessfulXmlHttpRequest.headers.push([name, value])
  }

  send(body: Blob): void {
    SuccessfulXmlHttpRequest.sentUrls.push(this.#url)
    this.status = SuccessfulXmlHttpRequest.statuses.shift() ?? 200
    this.upload.onprogress?.({ loaded: body.size })
    queueMicrotask(() => this.onload?.())
  }
}

describe('Campaign scene preparation', () => {
  afterEach(() => {
    sessionStorage.clear()
    SuccessfulXmlHttpRequest.sentUrls.length = 0
    SuccessfulXmlHttpRequest.headers.length = 0
    SuccessfulXmlHttpRequest.statuses.length = 0
    vi.unstubAllGlobals()
    vi.useRealTimers()
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

  it('sends one exact typed PUT and retains its asset for finalization retry after reload', async () => {
    vi.stubGlobal('XMLHttpRequest', SuccessfulXmlHttpRequest)
    const file = new File([new Uint8Array(6 * 1024 * 1024 + 1)], 'large-map.webp', {
      type: 'image/webp'
    })
    const intent = {
      assetId: '33333333-3333-4333-8333-333333333333',
      expiresAt: '2026-08-16T00:00:00.000Z',
      method: 'PUT' as const,
      url: 'https://storage.example/map'
    }
    const onProgress = vi.fn()
    await uploadVttMap({ campaignId: campaignA, file, intent, onProgress })
    expect(SuccessfulXmlHttpRequest.sentUrls).toEqual([intent.url])
    expect(SuccessfulXmlHttpRequest.headers).toEqual([['Content-Type', 'image/webp']])
    expect(onProgress).toHaveBeenLastCalledWith(100)
    expect(getUploadedVttMapAssetId(campaignA, file)).toBe(intent.assetId)
    expect(getUploadedVttMapAssetId(campaignB, file)).toBeNull()
    clearVttMapUploadIdempotencyKey(campaignA, file)
    expect(getUploadedVttMapAssetId(campaignA, file)).toBeNull()
  })

  it('never retains an asset after all PUT attempts fail', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('XMLHttpRequest', SuccessfulXmlHttpRequest)
    SuccessfulXmlHttpRequest.statuses.push(503, 503, 503, 503)
    const file = mapFile()
    const result = expect(
      uploadVttMap({
        campaignId: campaignA,
        file,
        intent: {
          assetId: firstKey,
          method: 'PUT',
          url: 'https://storage.example/map',
          expiresAt: '2026-09-11T01:00:00.000Z'
        },
        onProgress: () => undefined
      })
    ).rejects.toThrow('503')
    await vi.runAllTimersAsync()
    await result
    expect(SuccessfulXmlHttpRequest.sentUrls).toHaveLength(4)
    expect(getUploadedVttMapAssetId(campaignA, file)).toBeNull()
  })
})
