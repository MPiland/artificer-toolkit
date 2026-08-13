import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const source = await readFile(new URL('./mediaService.ts', import.meta.url), 'utf8')

describe('media service safety contracts', () => {
  it('uses one generated id for the raw path and persisted asset', () => {
    expect(source).toContain('id: assetId')
    expect(source).toContain('ownerUserId: userId')
    expect(source).toContain('rawObjectKey: `raw/${userId}/${assetId}`')
  })

  it('does not reuse finalized idempotency keys and verifies the real MIME type', () => {
    expect(source).toContain("existing.status !== 'PENDING_UPLOAD'")
    expect(source).toContain('asset.declared_mime_type !== mime')
  })

  it('binds the upload intent and attachment to the same authorized target', () => {
    expect(source).toContain('const targetKey = mediaTargetKey(input.target)')
    expect(source).toContain('existing.target_key !== targetKey')
    expect(source).toContain('asset.target_key !== targetKey')
  })

  it('keeps operational upload failures retryable while rejecting invalid images', () => {
    expect(source).toContain('await media.resetPending(assetId)')
    expect(source).toContain('await media.reject(assetId, error.message)')
    expect(source).toContain("throw new MediaValidationError('Image data could not be decoded.')")
    expect(source).toContain("throw new Error('Unable to load uploaded image.')")
  })

  it('retains the raw text upload when finalization can be retried', () => {
    const retryCleanup = source.slice(
      source.indexOf('[readyKey].filter((key): key is string => Boolean(key))'),
      source.indexOf('await media.resetPending(assetId)')
    )

    expect(retryCleanup).not.toContain('asset.raw_object_key')
  })

  it('checks character ownership before loading the crop source', () => {
    expect(source.indexOf('select id from characters')).toBeLessThan(
      source.indexOf('download(source.object_key)')
    )
  })

  it('checks square crops against source pixels instead of normalized percentages', () => {
    expect(source).toContain('Math.abs(pixels.width - pixels.height) > 2')
  })

  it('rechecks ready ownership while attaching under a row lock', () => {
    expect(source).toContain('findByIdForUpdate(input.assetId)')
  })

  it('locks authored drafts while mutating their image slot', () => {
    expect(source).toContain('async function lockAuthoredDraft(')
    expect(source).toContain('for update')
    expect(source.indexOf('await lockAuthoredDraft(trx, userId, target.')).toBeLessThan(
      source.indexOf('await repository.findByIdForUpdate(input.assetId)')
    )
  })

  it('enforces account quota when replacing a crop thumbnail', () => {
    expect(source).not.toContain('const quotaBytes = 250 * 1024 * 1024')
    expect(source).toContain('const quotaBytes = await getStorageQuotaBytes(trx, userId)')
    expect(source).toContain('repository.replaceThumbnail(asset.id, userId, quotaBytes, {')
    expect(source).toContain('if (!replacement) throw new MediaQuotaError()')
  })

  it('durably records uploaded object keys until their metadata commits', () => {
    expect(source).toContain('await media.scheduleObjectDeletions([objectKey])')
    expect(source).toContain('await removeMediaObjects(db, newKeys)')
  })

  it('converts Postgres numeric crop fields before returning the delivery DTO', () => {
    expect(source).toContain('x: Number(asset.crop_x)')
    expect(source).toContain('height: Number(asset.crop_height)')
  })

  it('rejects missing active authored targets', () => {
    expect(source).toContain('if (!ownership) throw new MediaAccessError()')
  })

  it('stores validated text files without fake image dimensions', () => {
    expect(source).toContain("verifiedMimeType: 'text/plain'")
    expect(source).toContain('width: null')
    expect(source).toContain('height: null')
  })
})
