import { afterEach, describe, expect, it } from 'vitest'
import { validateMapFile } from './CampaignScenePreparation.model'
import {
  clearVttMapUploadIdempotencyKey,
  createVttMapUploadFingerprint,
  createVttMapUploadOptions,
  getOrCreateVttMapUploadIdempotencyKey,
  resolveVttMapTusEndpoint
} from './vttMapUpload'

const campaignA = '11111111-1111-4111-8111-111111111111'
const campaignB = '22222222-2222-4222-8222-222222222222'
const firstKey = '11111111-1111-4111-8111-111111111111'
const secondKey = '22222222-2222-4222-8222-222222222222'

function mapFile(name = 'vault.webp'): File {
  return new File(['map'], name, { lastModified: 1_700_000_000_000, type: 'image/webp' })
}

function uploadOptions(objectKey: string) {
  const file = mapFile()
  return createVttMapUploadOptions({
    file,
    intent: {
      assetId: '33333333-3333-4333-8333-333333333333',
      bucket: 'media',
      expiresAt: '2026-08-16T00:00:00.000Z',
      objectKey,
      resumable: { chunkBytes: 6 * 1024 * 1024, protocol: 'TUS' },
      token: 'upload-token'
    },
    onError: () => undefined,
    onProgress: () => undefined,
    onSuccess: () => undefined,
    supabaseUrl: 'https://project-ref.supabase.co'
  })
}

describe('Campaign scene preparation', () => {
  afterEach(() => sessionStorage.clear())

  it('uses the direct hosted Storage endpoint and the local Storage endpoint', () => {
    expect(resolveVttMapTusEndpoint('https://project-ref.supabase.co')).toBe(
      'https://project-ref.storage.supabase.co/storage/v1/upload/resumable/sign'
    )
    expect(resolveVttMapTusEndpoint('http://127.0.0.1:54321')).toBe(
      'http://127.0.0.1:54321/storage/v1/upload/resumable/sign'
    )
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

  it('scopes TUS resumption to its pending bucket and object identity', async () => {
    const first = uploadOptions('campaigns/a/maps/first.webp')
    const second = uploadOptions('campaigns/a/maps/second.webp')

    expect(await first.fingerprint()).toBe(
      createVttMapUploadFingerprint({ bucket: 'media', objectKey: 'campaigns/a/maps/first.webp' })
    )
    expect(await second.fingerprint()).toBe(
      createVttMapUploadFingerprint({ bucket: 'media', objectKey: 'campaigns/a/maps/second.webp' })
    )
    expect(await first.fingerprint()).not.toBe(await second.fingerprint())
    expect(first.removeFingerprintOnSuccess).toBe(true)
  })
})
