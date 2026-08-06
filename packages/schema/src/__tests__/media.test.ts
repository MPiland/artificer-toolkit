import { describe, expect, it } from 'vitest'

import {
  attachImageInputSchema,
  createImageUploadIntentInputSchema,
  imageLookupInputSchema
} from '../api/media.js'

const id = '550e8400-e29b-41d4-a716-446655440000'

describe('media contracts', () => {
  it('accepts enabled image profiles and bounded uploads', () => {
    expect(
      createImageUploadIntentInputSchema.safeParse({
        profile: 'CHARACTER_PORTRAIT',
        target: { type: 'CHARACTER_PORTRAIT', characterId: id },
        originalFileName: 'portrait.png',
        declaredMimeType: 'image/png',
        declaredBytes: 6 * 1024 * 1024,
        idempotencyKey: id
      }).success
    ).toBe(true)
    expect(
      createImageUploadIntentInputSchema.safeParse({
        profile: 'VTT_MAP',
        target: { type: 'CHARACTER_PORTRAIT', characterId: id },
        originalFileName: 'map.webp',
        declaredMimeType: 'image/webp',
        declaredBytes: 1,
        idempotencyKey: id
      }).success
    ).toBe(false)
    expect(
      createImageUploadIntentInputSchema.safeParse({
        profile: 'ACCOUNT_AVATAR',
        target: { type: 'ACCOUNT_AVATAR' },
        originalFileName: 'avatar.gif',
        declaredMimeType: 'image/gif',
        declaredBytes: 1,
        idempotencyKey: id
      }).success
    ).toBe(false)
    expect(
      createImageUploadIntentInputSchema.safeParse({
        profile: 'ACCOUNT_AVATAR',
        target: { type: 'CHARACTER_PORTRAIT', characterId: id },
        originalFileName: 'avatar.png',
        declaredMimeType: 'image/png',
        declaredBytes: 1,
        idempotencyKey: id
      }).success
    ).toBe(false)
  })

  it('enforces target-specific crop and authored artwork rules', () => {
    expect(
      attachImageInputSchema.safeParse({
        assetId: id,
        target: { type: 'CHARACTER_PORTRAIT', characterId: id },
        crop: { x: 0, y: 0, width: 0.5, height: 0.5 }
      }).success
    ).toBe(true)
    expect(
      attachImageInputSchema.safeParse({
        assetId: id,
        target: { type: 'CHARACTER_PORTRAIT', characterId: id },
        crop: { x: 0, y: 0, width: 0.5, height: 0.25 }
      }).success
    ).toBe(true)
    expect(
      attachImageInputSchema.safeParse({
        assetId: id,
        target: { type: 'CHARACTER_PORTRAIT', characterId: id },
        crop: { x: 0.8, y: 0, width: 0.5, height: 0.25 }
      }).success
    ).toBe(false)
    expect(
      attachImageInputSchema.safeParse({
        assetId: id,
        target: { type: 'AUTHORED_IMAGE', subjectKind: 'SPELL', subjectId: id }
      }).success
    ).toBe(false)
    expect(
      attachImageInputSchema.safeParse({
        assetId: id,
        target: { type: 'AUTHORED_IMAGE', subjectKind: 'SPELL', subjectId: id },
        crop: { x: 0.25, y: 0, width: 0.5, height: 0.5 },
        isDecorative: true
      }).success
    ).toBe(true)
    expect(
      attachImageInputSchema.safeParse({
        assetId: id,
        target: { type: 'ACCOUNT_AVATAR' }
      }).success
    ).toBe(false)
    expect(
      attachImageInputSchema.safeParse({
        assetId: id,
        target: { type: 'AUTHORED_IMAGE', subjectKind: 'SPELL', subjectId: id },
        crop: { x: 0.25, y: 0, width: 0.5, height: 0.5 },
        altText: 'Ignored text',
        isDecorative: true
      }).success
    ).toBe(false)
    expect(
      imageLookupInputSchema.safeParse({
        target: { type: 'AUTHORED_IMAGE', subjectKind: 'CAMPAIGN', subjectId: id, scope: 'ACTIVE' }
      }).success
    ).toBe(false)
    expect(
      imageLookupInputSchema.safeParse({
        target: { type: 'AUTHORED_IMAGE', subjectKind: 'SPELL', subjectId: id }
      }).success
    ).toBe(false)
    expect(
      imageLookupInputSchema.safeParse({
        target: { type: 'AUTHORED_IMAGE', subjectKind: 'SPELL', subjectId: id, scope: 'DRAFT' }
      }).success
    ).toBe(true)
  })
})
