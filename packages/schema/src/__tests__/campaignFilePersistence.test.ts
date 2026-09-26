import { describe, expect, it } from 'vitest'
import { mediaStoredAssetSchema } from '../api/mediaAssets.js'
import {
  campaignStoredFileAssetSchema,
  campaignFileFinalizeInputSchema,
  campaignFileProcessClaimSchema,
  campaignFileDeliverySourceSchema,
  campaignStoredAttachmentSchema
} from '../projections/campaignFilePersistence.js'
import {
  campaignAttachmentDtoSchema,
  campaignAttachmentListInputSchema,
  campaignAttachmentListPageSchema
} from '../api/campaignAttachments.js'

const id = '550e8400-e29b-41d4-a716-446655440000'
const textAsset = {
  id,
  ownerUserId: id,
  campaignId: id.toUpperCase(),
  profile: 'CAMPAIGN_FILE',
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
  crop: null,
  operation: null,
  cleanupAt: null
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

  it('keeps internal processing claims and settlement strict, bounded and UUID-backed', () => {
    const operation = {
      id,
      kind: 'INITIAL',
      expiresAt: 1000,
      outputs: [{ kind: 'SOURCE', objectKey: 'ready/file/source.txt' }]
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
    const finish = { assetId: id, operationId: id, variants: textAsset.variants }
    expect(campaignFileFinalizeInputSchema.safeParse(finish).success).toBe(true)
    for (const patch of [
      { operationId: 'not-a-uuid' },
      { variants: [] },
      { variants: Array(4).fill(textAsset.variants[0]) },
      { ownerUserId: id }
    ])
      expect(campaignFileFinalizeInputSchema.safeParse({ ...finish, ...patch }).success).toBe(false)
  })

  it('keeps strict text variants separate from the existing image-only asset contract', () => {
    expect(campaignStoredFileAssetSchema.parse(textAsset)).toEqual({ ...textAsset, campaignId: id })
    expect(mediaStoredAssetSchema.safeParse(textAsset).success).toBe(false)
    for (const patch of [
      { campaignId: 'not-a-uuid' },
      { profile: 'ACCOUNT_AVATAR' },
      { profile: 'CAMPAIGN_HANDOUT_MAP' },
      { authoredTarget: { type: 'AUTHORED_IMAGE', subjectId: id, subjectKind: 'BACKGROUND' } },
      { crop: { x: 0, y: 0, width: 1, height: 1 } },
      { upload: { ...textAsset.upload, declaredBytes: 6 * 1024 * 1024 + 1 } },
      { upload: { ...textAsset.upload, declaredMimeType: 'application/pdf' } }
    ])
      expect(campaignStoredFileAssetSchema.safeParse({ ...textAsset, ...patch }).success).toBe(
        false
      )
    for (const patch of [{ kind: 'THUMBNAIL' }, { width: 1 }, { height: 1 }, { byteSize: 0 }])
      expect(
        campaignStoredFileAssetSchema.safeParse({
          ...textAsset,
          variants: [{ ...textAsset.variants[0], ...patch }]
        }).success
      ).toBe(false)
  })

  it('accepts normalized file/handout image variants without allowing text, crops or authored operations', () => {
    const imageAsset = {
      ...textAsset,
      profile: 'CAMPAIGN_HANDOUT_MAP',
      upload: { ...textAsset.upload, originalFileName: 'map.png', declaredMimeType: 'image/png' },
      variants: ['SOURCE', 'DISPLAY', 'THUMBNAIL'].map((kind) => ({
        kind,
        objectKey: `ready/file/${kind}.webp`,
        byteSize: 12,
        mimeType: 'image/webp',
        width: 40,
        height: 20
      })),
      operation: {
        id,
        kind: 'INITIAL',
        expiresAt: 1000,
        outputs: [{ kind: 'SOURCE', objectKey: 'ready/file/source.webp' }]
      }
    }
    expect(campaignStoredFileAssetSchema.safeParse(imageAsset).success).toBe(true)
    expect(
      campaignStoredFileAssetSchema.safeParse({ ...imageAsset, profile: 'CAMPAIGN_FILE' }).success
    ).toBe(true)
    expect(
      campaignStoredFileAssetSchema.safeParse({ ...imageAsset, variants: textAsset.variants })
        .success
    ).toBe(false)
    expect(
      campaignStoredFileAssetSchema.safeParse({ ...textAsset, variants: imageAsset.variants })
        .success
    ).toBe(false)
    expect(
      campaignStoredFileAssetSchema.safeParse({
        ...imageAsset,
        operation: { ...imageAsset.operation, kind: 'CROP' }
      }).success
    ).toBe(false)
    expect(
      campaignStoredFileAssetSchema.safeParse({
        ...imageAsset,
        operation: { ...imageAsset.operation, expectedAvatarRevision: 1 }
      }).success
    ).toBe(false)
    const { campaignId: _campaignId, ...imageOnly } = imageAsset
    expect(
      mediaStoredAssetSchema.safeParse({ ...imageOnly, profile: 'ACCOUNT_AVATAR', operation: null })
        .success
    ).toBe(true)
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
