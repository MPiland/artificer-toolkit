import { describe, expect, it } from 'vitest'
import { mediaStoredAssetSchema } from '../api/mediaAssets.js'
import {
  campaignFileFinalizeInputSchema,
  campaignFileProcessClaimSchema,
  campaignFileDeliverySourceSchema,
  campaignStoredAttachmentSchema
} from '../projections/campaignFilePersistence.js'
import { vttMapStoredAssetSchema } from '../projections/vttMapPersistence.js'
import {
  campaignAttachmentDtoSchema,
  campaignAttachmentListInputSchema,
  campaignAttachmentListPageSchema
} from '../api/campaignAttachments.js'

const id = '550e8400-e29b-41d4-a716-446655440000'
const hash = 'a'.repeat(64)
const textAsset = {
  id,
  ownerUserId: id,
  storageAssetId: id,
  profileClass: 'TEXT_FILE',
  upload: {
    originalFileName: 'notes.txt',
    declaredMimeType: 'text/plain',
    declaredBytes: 12,
    idempotencyKey: id
  },
  status: 'READY',
  rawObjectKey: null,
  uploadExpiresAt: 0,
  chargedBytes: 12,
  contentHash: hash,
  variants: [
    {
      kind: 'SOURCE',
      objectKey: 'ready/file/source.txt',
      byteSize: 12,
      mimeType: 'text/plain',
      width: null,
      height: null
    }
  ],
  cropThumbnails: [],
  operation: null,
  cleanupAt: null
}
const imageVariants = ['SOURCE', 'DISPLAY', 'THUMBNAIL'].map((kind) => ({
  kind,
  objectKey: `ready/file/${kind}.webp`,
  byteSize: 12,
  mimeType: 'image/webp',
  width: 40,
  height: 20
}))
const imageAsset = {
  ...textAsset,
  profileClass: 'CONTENT_ART',
  upload: { ...textAsset.upload, originalFileName: 'art.png', declaredMimeType: 'image/png' },
  variants: imageVariants
}

describe('native Campaign file persistence contracts', () => {
  it('keeps the internal delivery source minimal and rejects a signed URL or raw-key field', () => {
    const source = {
      assetId: id,
      fileName: 'notes.txt',
      mimeType: 'text/plain',
      byteSize: 12,
      objectKey: 'ready/file/source.txt'
    }
    expect(campaignFileDeliverySourceSchema.parse(source)).toEqual(source)
    for (const patch of [
      { url: 'https://untrusted.invalid' },
      { rawObjectKey: 'raw/file' },
      { ownerUserId: id },
      { byteSize: 0 },
      { assetId: 'invalid' }
    ])
      expect(campaignFileDeliverySourceSchema.safeParse({ ...source, ...patch }).success).toBe(
        false
      )
  })

  it('keeps internal processing claims and settlement strict, bounded and hashed', () => {
    const operation = {
      id,
      expiresAt: 1000,
      outputs: [{ kind: 'SOURCE', objectKey: 'ready/file/source.txt' }],
      binding: null
    }
    const claim = {
      kind: 'PROCESS',
      asset: { ...textAsset, status: 'PROCESSING', operation },
      operation
    }
    expect(campaignFileProcessClaimSchema.safeParse(claim).success).toBe(true)
    const current = { kind: 'CURRENT', result: { assetId: id, status: 'READY', preview: null } }
    expect(campaignFileProcessClaimSchema.safeParse(current).success).toBe(true)
    expect(
      campaignFileProcessClaimSchema.safeParse({
        ...current,
        result: { ...current.result, status: 'REJECTED' }
      }).success
    ).toBe(false)
    expect(
      campaignFileProcessClaimSchema.safeParse({ ...claim, url: 'https://untrusted.invalid' })
        .success
    ).toBe(false)
    const finish = {
      assetId: id,
      operationId: id,
      variants: textAsset.variants,
      contentHash: hash
    }
    expect(campaignFileFinalizeInputSchema.safeParse(finish).success).toBe(true)
    for (const patch of [
      { operationId: 'not-a-uuid' },
      { variants: [] },
      { variants: Array(4).fill(textAsset.variants[0]) },
      { contentHash: 'A'.repeat(64) },
      { contentHash: undefined },
      { ownerUserId: id }
    ])
      expect(campaignFileFinalizeInputSchema.safeParse({ ...finish, ...patch }).success).toBe(false)
  })

  it('stores owner-scoped assets without a target, Campaign or crop', () => {
    expect(mediaStoredAssetSchema.parse(textAsset)).toEqual(textAsset)
    expect(mediaStoredAssetSchema.parse(imageAsset)).toEqual(imageAsset)
    for (const patch of [
      { campaignId: id },
      { profile: 'CAMPAIGN_FILE' },
      { authoredTarget: { type: 'AUTHORED_IMAGE', subjectId: id, subjectKind: 'BACKGROUND' } },
      { crop: { x: 0, y: 0, width: 1, height: 1 } },
      { contentHash: 'not-a-hash' },
      { upload: { ...imageAsset.upload, declaredBytes: 6 * 1024 * 1024 + 1 } },
      { upload: { ...imageAsset.upload, declaredMimeType: 'application/pdf' } }
    ])
      expect(mediaStoredAssetSchema.safeParse({ ...imageAsset, ...patch }).success).toBe(false)
  })

  it('keeps text, images and framing within their class', () => {
    expect(
      mediaStoredAssetSchema.safeParse({ ...textAsset, profileClass: 'CONTENT_ART' }).success
    ).toBe(false)
    expect(
      mediaStoredAssetSchema.safeParse({ ...imageAsset, profileClass: 'TEXT_FILE' }).success
    ).toBe(false)
    expect(
      mediaStoredAssetSchema.safeParse({ ...imageAsset, profileClass: 'HANDOUT_MAP' }).success
    ).toBe(true)
    expect(
      mediaStoredAssetSchema.safeParse({ ...imageAsset, variants: textAsset.variants }).success
    ).toBe(false)
    const cropThumbnail = {
      cropHash: hash,
      crop: { x: 0, y: 0, width: 0.5, height: 1 },
      variant: { ...imageVariants[2], objectKey: 'ready/file/crop.webp' }
    }
    expect(
      mediaStoredAssetSchema.safeParse({ ...imageAsset, cropThumbnails: [cropThumbnail] }).success
    ).toBe(true)
    expect(
      mediaStoredAssetSchema.safeParse({
        ...imageAsset,
        profileClass: 'HANDOUT_MAP',
        cropThumbnails: [cropThumbnail]
      }).success
    ).toBe(false)
    const binding = {
      type: 'ACCOUNT_AVATAR',
      crop: cropThumbnail.crop,
      expectedRevision: 0
    }
    const operation = { id, expiresAt: 1, outputs: [{ kind: 'SOURCE', objectKey: 'k' }], binding }
    expect(
      mediaStoredAssetSchema.safeParse({ ...imageAsset, status: 'PROCESSING', operation }).success
    ).toBe(true)
    expect(
      mediaStoredAssetSchema.safeParse({ ...textAsset, status: 'PROCESSING', operation }).success
    ).toBe(false)
  })

  it('stores maps without a Campaign binding or crops', () => {
    const map = {
      ...imageAsset,
      profileClass: 'VTT_MAP',
      upload: { ...imageAsset.upload, declaredBytes: 20 * 1024 * 1024 },
      width: 40,
      height: 20,
      variants: imageVariants.slice(1)
    }
    const { cropThumbnails: _cropThumbnails, ...stored } = map
    expect(vttMapStoredAssetSchema.safeParse(stored).success).toBe(true)
    expect(vttMapStoredAssetSchema.safeParse({ ...stored, campaignId: id }).success).toBe(false)
    expect(vttMapStoredAssetSchema.safeParse(map).success).toBe(false)
  })

  it('uses the shared bounded-page metadata without adding a total attachment cap', () => {
    expect(
      campaignAttachmentListInputSchema.safeParse({
        campaignId: id,
        paginationOpts: { cursor: null, numItems: 2 }
      }).success
    ).toBe(true)
    expect(
      campaignAttachmentListInputSchema.safeParse({
        campaignId: id,
        paginationOpts: { cursor: null, numItems: 0 }
      }).success
    ).toBe(false)
    const emptyPage = {
      page: [],
      isDone: false,
      continueCursor: 'next',
      splitCursor: 'split',
      pageStatus: 'SplitRecommended'
    }
    expect(campaignAttachmentListPageSchema.parse(emptyPage)).toEqual(emptyPage)
  })

  it('resolves the uploader label on read and never stores it', () => {
    const stored = {
      id,
      campaignId: id,
      assetId: id,
      uploaderUserId: id,
      displayName: 'Dungeon map',
      description: null,
      profile: 'CAMPAIGN_HANDOUT_MAP',
      sessionId: null,
      noteSectionId: null,
      createdAt: '2026-09-25T12:00:00.000Z'
    }
    expect(campaignStoredAttachmentSchema.parse(stored)).toEqual(stored)
    expect(campaignAttachmentDtoSchema.safeParse(stored).success).toBe(false)
    expect(
      campaignAttachmentDtoSchema.parse({ ...stored, uploaderLabel: 'Deleted user' })
    ).toMatchObject({ uploaderLabel: 'Deleted user' })
    expect(
      campaignStoredAttachmentSchema.safeParse({ ...stored, uploaderLabel: 'Mira' }).success
    ).toBe(false)
  })
})
