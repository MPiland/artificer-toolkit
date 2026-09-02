import { describe, expect, it } from 'vitest'

import {
  completeVttMapMultipartUploadInputSchema,
  createVttMapUploadIntentInputSchema,
  createVttMapUploadIntentOutputSchema,
  signedVttMapDeliveryDtoSchema
} from '../api/media.js'

const uuid = '00000000-0000-4000-8000-000000000001'

describe('VTT map media contracts', () => {
  it('accepts only bounded image upload intents', () => {
    const input = {
      profile: 'VTT_MAP',
      target: { type: 'VTT_MAP', campaignId: uuid },
      originalFileName: 'castle.webp',
      declaredMimeType: 'image/webp',
      declaredBytes: 25 * 1024 * 1024,
      idempotencyKey: uuid
    }
    expect(createVttMapUploadIntentInputSchema.safeParse(input).success).toBe(true)
    expect(
      createVttMapUploadIntentInputSchema.safeParse({
        ...input,
        declaredBytes: input.declaredBytes + 1
      }).success
    ).toBe(false)
    expect(
      createVttMapUploadIntentInputSchema.safeParse({ ...input, declaredMimeType: 'text/plain' })
        .success
    ).toBe(false)
  })

  it('advertises bounded R2 multipart uploads without exposing storage credentials', () => {
    const output = createVttMapUploadIntentOutputSchema.parse({
      assetId: uuid,
      storageProvider: 'R2',
      objectKey: `raw/${uuid}/${uuid}`,
      expiresAt: '2026-08-15T12:00:00.000Z',
      resumable: {
        protocol: 'R2_MULTIPART',
        chunkBytes: 6 * 1024 * 1024,
        parts: [{ partNumber: 1, url: 'https://storage.example/part-1' }]
      }
    })

    expect(output.resumable.protocol).toBe('R2_MULTIPART')
    expect(output).not.toHaveProperty('token')
    expect(output).not.toHaveProperty('bucket')
  })

  it('rejects duplicate multipart completion parts', () => {
    expect(
      completeVttMapMultipartUploadInputSchema.safeParse({
        assetId: uuid,
        parts: [
          { partNumber: 1, etag: 'first' },
          { partNumber: 1, etag: 'duplicate' }
        ]
      }).success
    ).toBe(false)
  })

  it('delivers only stable map metadata and signed URLs', () => {
    const result = signedVttMapDeliveryDtoSchema.parse({
      assetId: uuid,
      expiresAt: '2026-08-15T12:00:00.000Z',
      width: 2048,
      height: 1024,
      overview: { url: 'https://storage.example/overview', width: 1600, height: 800 },
      tiles: [
        { row: 0, column: 0, url: 'https://storage.example/tile-0-0', width: 1024, height: 1024 },
        { row: 0, column: 1, url: 'https://storage.example/tile-0-1', width: 1024, height: 1024 }
      ]
    })
    expect(result).not.toHaveProperty('objectKey')
    expect(result.tiles).toHaveLength(2)
  })
})
