// @vitest-environment node
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { internal } from '../_generated/api'
import schema from '../schema'
import {
  dropImageSlot,
  ensureDraftImageSlot,
  promoteDraftImageSlot,
  readImageSlot
} from './imageSlots'

const modules = import.meta.glob('/apps/apis/convex/**/*.*s')
const target = {
  subjectId: '00000000-0000-0000-0000-000000000001',
  subjectKind: 'BACKGROUND' as const
}
const assetId = '00000000-0000-0000-0000-000000000002'
const crop = { x: 0.25, y: 0, width: 0.5, height: 1 }

function test() {
  return convexTest(schema, modules)
}

async function insertAsset(t: ReturnType<typeof test>, id = assetId) {
  await t.run((ctx) =>
    ctx.db.insert('mediaAssets', {
      id,
      ownerUserId: '00000000-0000-0000-0000-000000000003',
      storageAssetId: id,
      profileClass: 'CONTENT_ART',
      upload: {
        originalFileName: 'art.png',
        declaredMimeType: 'image/png',
        declaredBytes: 1,
        idempotencyKey: '00000000-0000-0000-0000-000000000004'
      },
      status: 'READY',
      rawObjectKey: null,
      uploadExpiresAt: Date.now(),
      chargedBytes: 1,
      contentHash: null,
      variants: [],
      cropThumbnails: [],
      operation: null,
      cleanupAt: null
    })
  )
}

describe('authored image slots', () => {
  it('inherits active artwork once and preserves the draft slot', async () => {
    const t = test()
    await t.run((ctx) =>
      ctx.db.insert('authoredImageSlots', {
        ...target,
        scope: 'ACTIVE',
        assetId,
        crop,
        revision: 4
      })
    )
    const first = await t.run((ctx) => ensureDraftImageSlot(ctx, target))
    expect(first).toMatchObject({ assetId, crop })
    await t.run((ctx) => ctx.db.patch(first._id, { assetId: null, crop: null, revision: 5 }))
    const second = await t.run((ctx) => ensureDraftImageSlot(ctx, target))
    expect(second).toMatchObject({ scope: 'DRAFT', assetId: null, crop: null, revision: 5 })
  })

  it('promotes an explicit empty draft without falling back to active artwork', async () => {
    const t = test()
    await t.run((ctx) =>
      ctx.db.insert('authoredImageSlots', {
        ...target,
        scope: 'ACTIVE',
        assetId,
        crop,
        revision: 4
      })
    )
    await t.run((ctx) => ensureDraftImageSlot(ctx, target))
    await t.run((ctx) => promoteDraftImageSlot(ctx, target))
    expect(await t.run((ctx) => readImageSlot(ctx, target.subjectId, 'ACTIVE'))).toMatchObject({
      assetId,
      crop,
      revision: 5
    })

    const draft = await t.run((ctx) => ensureDraftImageSlot(ctx, target))
    await t.run((ctx) => ctx.db.patch(draft._id, { assetId: null, crop: null, revision: 1 }))
    await t.run((ctx) => promoteDraftImageSlot(ctx, target))
    expect(await t.run((ctx) => readImageSlot(ctx, target.subjectId, 'ACTIVE'))).toMatchObject({
      assetId: null,
      crop: null,
      revision: 6
    })
  })

  it('drops only the selected scope and schedules a detached asset for cleanup', async () => {
    const t = test()
    await insertAsset(t)
    await t.run((ctx) =>
      ctx.db.insert('authoredImageSlots', {
        ...target,
        scope: 'ACTIVE',
        assetId,
        crop,
        revision: 1
      })
    )
    await t.run((ctx) => ensureDraftImageSlot(ctx, target))
    await t.run((ctx) => dropImageSlot(ctx, target.subjectId, 'DRAFT'))
    expect(await t.run((ctx) => readImageSlot(ctx, target.subjectId, 'ACTIVE'))).toBeTruthy()
    await t.run((ctx) => dropImageSlot(ctx, target.subjectId, 'ACTIVE'))
    expect(await t.run((ctx) => readImageSlot(ctx, target.subjectId, 'ACTIVE'))).toBeNull()
    await t.mutation(internal.media.assets.cleanup, { assetId })
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('mediaAssets')
          .withIndex('by_publicId', (q) => q.eq('id', assetId))
          .unique()
      )
    ).toMatchObject({ cleanupAt: expect.any(Number) })
  })
  it('hides an incomplete import slot until the job completes', async () => {
    const t = test()
    const jobId = crypto.randomUUID()
    const ownerUserId = crypto.randomUUID()
    const previewId = crypto.randomUUID()
    const command = {
      commandId: crypto.randomUUID(),
      previewId,
      selectedEntryIds: [target.subjectId],
      resolutions: [],
      customContentChoices: []
    }
    const now = new Date().toISOString()
    await t.run(async (ctx) => {
      await ctx.db.insert('importJobs', {
        id: jobId,
        ownerUserId,
        previewId,
        command,
        inputFingerprint: checksumCanonicalJson({
          operation: 'PORTABLE_IMPORT',
          ownerUserId,
          command
        }),
        source: 'ARTIFICER_JSON',
        status: 'RUNNING',
        terminalStatus: null,
        phase: 'STAGING',
        entryIndex: 0,
        cursor: null,
        processedEntries: 0,
        totalEntries: 1,
        expectedStageCount: 1,
        stagedStageCount: 1,
        failureReason: null,
        summary: null,
        cleanupTableIndex: 0,
        cleanupCursor: null,
        expiresAt: Date.now() + 60_000,
        createdAt: now,
        updatedAt: now
      })
      await ensureDraftImageSlot(ctx, target, jobId)
    })

    expect(await t.run((ctx) => readImageSlot(ctx, target.subjectId, 'DRAFT'))).toBeNull()
    expect(
      await t.run((ctx) => readImageSlot(ctx, target.subjectId, 'DRAFT', jobId))
    ).toMatchObject({ importJobId: jobId })

    await t.run(async (ctx) => {
      const job = await ctx.db
        .query('importJobs')
        .withIndex('by_publicId', (query) => query.eq('id', jobId))
        .unique()
      if (!job) throw new Error('Missing import job fixture.')
      await ctx.db.patch(job._id, { status: 'COMPLETED' })
    })
    expect(await t.run((ctx) => readImageSlot(ctx, target.subjectId, 'DRAFT'))).toMatchObject({
      importJobId: jobId
    })
  })
})
