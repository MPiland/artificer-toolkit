// @vitest-environment node
import { makeFunctionReference } from 'convex/server'
import { register } from '@convex-dev/r2/test'
import { register as registerRetrier } from '@convex-dev/action-retrier/test'
import sharp from 'sharp'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  CreateCampaignFileUploadIntentInput,
  FinalizeImageUploadOutput,
  SignedCampaignFileDeliveryDto
} from '@artificer-toolkit/schema/api/media'
import type { mediaSinglePutUploadSchema } from '@artificer-toolkit/schema/api/mediaAssets'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CreateCampaignAttachmentInput,
  CampaignAttachmentDto
} from '@artificer-toolkit/schema/api/campaignAttachments'
import type {
  CampaignFileProcessClaim,
  CampaignFileFinalizeInput,
  CampaignFileDeliverySource
} from '@artificer-toolkit/schema/projections/campaignFilePersistence'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { ENTITLEMENT_LIMITS } from '@artificer-toolkit/shared/account/entitlements'
import { fixture } from '../../tests/fixtures/characters'
import { startLocalR2 } from '../../tests/localR2'
import { components, internal } from '../_generated/api'
import { processCampaignFileClaim } from './fileProcessing'
import { MediaValidationError } from './processing'

// Test-only references keep this file independent from generated API bindings.
const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const createUpload = makeFunctionReference<
  'mutation',
  CreateCampaignFileUploadIntentInput,
  z.infer<typeof mediaSinglePutUploadSchema>
>('media/fileAssets:createUpload')
const begin = makeFunctionReference<'mutation', { assetId: string }, CampaignFileProcessClaim>(
  'media/fileAssets:beginFinalize'
)
const finish = makeFunctionReference<
  'mutation',
  CampaignFileFinalizeInput,
  FinalizeImageUploadOutput
>('media/fileAssets:finishFinalize')
const reject = makeFunctionReference<'mutation', { assetId: string; operationId: string }, null>(
  'media/fileAssets:rejectFinalize'
)
const attach = makeFunctionReference<
  'mutation',
  CreateCampaignAttachmentInput,
  CampaignAttachmentDto
>('campaigns/attachments:create')
const removeAttachment = makeFunctionReference<
  'mutation',
  { campaignId: string; attachmentId: string },
  { ok: true }
>('campaigns/attachments:remove')
const readDelivery = makeFunctionReference<
  'query',
  { campaignId: string; attachmentId: string },
  CampaignFileDeliverySource
>('campaigns/attachments:readDelivery')
const finalizeAction = makeFunctionReference<
  'action',
  { assetId: string },
  FinalizeImageUploadOutput
>('media/fileActions:finalize')
const getDeliveryAction = makeFunctionReference<
  'action',
  { campaignId: string; attachmentId: string },
  SignedCampaignFileDeliveryDto
>('media/fileActions:getDelivery')

let server: Awaited<ReturnType<typeof startLocalR2>>
beforeEach(async () => {
  server = await startLocalR2()
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  vi.stubEnv('MEDIA_STORAGE_MODE', 'local')
  vi.stubEnv('CONVEX_SITE_URL', 'http://127.0.0.1:3221')
  vi.stubEnv('LOCAL_R2_ENDPOINT', server.endpoint)
})
afterEach(async () => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  await server.close()
})

async function setup() {
  const base = await fixture()
  register(base.t)
  registerRetrier(base.t, 'r2/actionRetrier')
  await base.t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.updateMany, {
      input: { model: 'session', update: { expiresAt: Date.now() + 3 * 86_400_000 } },
      paginationOpts: { cursor: null, numItems: 10 }
    })
  )
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Finalize files',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const membershipId = await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.other.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
  const snapshot = () =>
    base.t.run(async (ctx) => ({
      assets: await ctx.db.query('mediaAssets').collect(),
      profiles: await ctx.db.query('userProfiles').collect(),
      scheduled: await ctx.db.system.query('_scheduled_functions').collect()
    }))
  return { ...base, campaign, membershipId, snapshot }
}

async function uploadIntent(
  base: Awaited<ReturnType<typeof setup>>,
  body: Buffer,
  image = false,
  originalFileName = image ? 'map.png' : 'notes.txt'
) {
  const declaredMimeType = image ? 'image/png' : 'text/plain'
  const profile = image ? 'CAMPAIGN_HANDOUT_MAP' : 'CAMPAIGN_FILE'
  const intent = await base.other.caller.mutation(createUpload, {
    profile,
    target: { type: profile, campaignId: base.campaign.id },
    originalFileName,
    declaredMimeType,
    declaredBytes: body.byteLength,
    idempotencyKey: crypto.randomUUID()
  })
  expect(
    (
      await fetch(intent.url, {
        method: 'PUT',
        body: new Uint8Array(body),
        headers: { 'content-type': declaredMimeType }
      })
    ).status
  ).toBe(200)
  return intent
}

async function upload(base: Awaited<ReturnType<typeof setup>>, body: Buffer, image = false) {
  const intent = await uploadIntent(base, body, image)
  const claim = await base.other.caller.mutation(begin, { assetId: intent.assetId.toUpperCase() })
  if (claim.kind !== 'PROCESS') throw new Error('Expected processing claim.')
  return claim
}

it.each([
  ['text', async () => Buffer.from('public finalize')],
  [
    'image',
    async () =>
      sharp({ create: { width: 600, height: 400, channels: 3, background: '#ac4f29' } })
        .png()
        .toBuffer()
  ]
])(
  'finalizes a public %s upload and replays READY without charging twice',
  async (_, makeBody) => {
    const base = await setup()
    const body = await makeBody()
    const intent = await uploadIntent(base, body, _ === 'image')
    await expect(
      base.owner.caller.action(finalizeAction, { assetId: intent.assetId })
    ).rejects.toThrow('unavailable')
    const result = await base.other.caller.action(finalizeAction, { assetId: intent.assetId })
    expect(result).toMatchObject({ assetId: intent.assetId, status: 'READY', preview: null })
    const settled = await base.snapshot()
    expect(await base.other.caller.action(finalizeAction, { assetId: intent.assetId })).toEqual(
      result
    )
    expect(await base.snapshot()).toEqual(settled)
  },
  20_000
)

it('returns a rejected result for invalid content and preserves the public output shape', async () => {
  const base = await setup()
  const intent = await uploadIntent(base, Buffer.from([0xc3, 0x28]))
  expect(await base.other.caller.action(finalizeAction, { assetId: intent.assetId })).toEqual({
    assetId: intent.assetId,
    status: 'REJECTED',
    preview: null
  })
  expect((await base.snapshot()).assets[0]).toMatchObject({ status: 'REJECTED' })
})

it('sanitizes operational failures, keeps the raw upload, and retries after the fence', async () => {
  const base = await setup()
  const intent = await uploadIntent(base, Buffer.from('retry me'))
  server.faults.getStatus = 503
  await expect(
    base.other.caller.action(finalizeAction, { assetId: intent.assetId })
  ).rejects.toThrow('Could not finalize the file. Try again.')
  const failed = (await base.snapshot()).assets[0]!
  expect(failed).toMatchObject({ status: 'PROCESSING', rawObjectKey: expect.any(String) })
  expect(server.objects.has(failed.rawObjectKey!)).toBe(true)
  vi.setSystemTime(failed.operation!.expiresAt)
  await base.t.mutation(internal.media.assets.expireOperation, {
    assetId: failed.id,
    operationId: failed.operation!.id
  })
  server.faults.getStatus = null
  expect(await base.other.caller.action(finalizeAction, { assetId: intent.assetId })).toMatchObject(
    {
      status: 'READY'
    }
  )
}, 20_000)

it('signs campaign delivery for current members, serves bytes, and denies removed or revoked access', async () => {
  const base = await setup()
  const body = Buffer.from('download bytes')
  const intent = await uploadIntent(base, body, false, 'rapport "été".txt')
  await base.other.caller.action(finalizeAction, { assetId: intent.assetId })
  const attachment = await base.other.caller.mutation(attach, {
    campaignId: base.campaign.id,
    assetId: intent.assetId,
    displayName: 'Shared report'
  })
  const delivery = await base.owner.caller.action(getDeliveryAction, {
    campaignId: base.campaign.id,
    attachmentId: attachment.id
  })
  expect(delivery).toMatchObject({
    assetId: intent.assetId,
    mimeType: 'text/plain',
    fileName: 'rapport "été".txt',
    byteSize: body.byteLength
  })
  const url = new URL(delivery.url)
  expect(url.searchParams.get('X-Amz-Expires')).toBe('300')
  expect(url.searchParams.get('response-content-type')).toBe('text/plain')
  expect(url.searchParams.get('response-content-disposition')).toBe(
    "attachment; filename*=UTF-8''rapport%20%22%C3%A9t%C3%A9%22.txt"
  )
  expect(Buffer.from(await (await fetch(delivery.url)).arrayBuffer())).toEqual(body)
  await base.t.run((ctx) =>
    ctx.db.patch(base.membershipId, { status: 'LEFT', leftAt: new Date().toISOString() })
  )
  await expect(
    base.other.caller.action(getDeliveryAction, {
      campaignId: base.campaign.id,
      attachmentId: attachment.id
    })
  ).rejects.toThrow('Campaign not found')
  await base.owner.caller.mutation(removeAttachment, {
    campaignId: base.campaign.id,
    attachmentId: attachment.id
  })
  await expect(
    base.owner.caller.action(getDeliveryAction, {
      campaignId: base.campaign.id,
      attachmentId: attachment.id
    })
  ).rejects.toThrow()
}, 20_000)

it('normalizes real UTF-8 bytes, settles actual quota once, attaches and retains only verified content', async () => {
  const base = await setup()
  const claim = await upload(base, Buffer.from('\uFEFFRésumé 🐉\r\n'))
  const variants = await base.other.caller.action((ctx) =>
    processCampaignFileClaim(ctx, claim.asset, claim.operation)
  )
  expect(variants).toHaveLength(1)
  const source = variants[0]!
  expect(source).toMatchObject({
    kind: 'SOURCE',
    mimeType: 'text/plain',
    width: null,
    height: null
  })
  expect(server.objects.get(source.objectKey)?.body).toEqual(Buffer.from('Résumé 🐉\r\n'))
  const result = await base.other.caller.mutation(finish, {
    assetId: claim.asset.id,
    operationId: claim.operation.id,
    variants
  })
  expect(result).toEqual({ assetId: claim.asset.id, status: 'READY', preview: null })
  const ready = await base.snapshot()
  expect(ready.assets[0]).toMatchObject({
    status: 'READY',
    chargedBytes: source.byteSize,
    crop: null,
    operation: null
  })
  expect(ready.profiles.find((p) => p.userId === base.other.userId)?.mediaBytes).toBe(
    source.byteSize
  )
  expect(await base.other.caller.mutation(begin, { assetId: claim.asset.id })).toEqual({
    kind: 'CURRENT',
    result
  })
  expect(await base.snapshot()).toEqual(ready)
  const attachment = await base.other.caller.mutation(attach, {
    campaignId: base.campaign.id,
    assetId: claim.asset.id,
    displayName: 'Verified notes'
  })
  expect(
    await base.owner.caller.query(readDelivery, {
      campaignId: base.campaign.id,
      attachmentId: attachment.id
    })
  ).toEqual({
    assetId: claim.asset.id,
    objectKey: source.objectKey,
    mimeType: 'text/plain',
    byteSize: source.byteSize,
    fileName: 'notes.txt'
  })
  await base.t.finishAllScheduledFunctions(vi.runAllTimers)
  expect([...server.objects.keys()]).toEqual([source.objectKey])
  expect((await base.snapshot()).assets[0]).toMatchObject({
    status: 'READY',
    cleanupAt: null,
    rawObjectKey: null
  })
  await base.t.run((ctx) =>
    ctx.db.patch(base.membershipId, { status: 'LEFT', leftAt: new Date().toISOString() })
  )
  await expect(base.other.caller.mutation(begin, { assetId: claim.asset.id })).rejects.toThrow(
    'Campaign not found'
  )
}, 20_000)

it('creates three metadata-free image variants without introducing a crop and collects unattached output', async () => {
  const base = await setup()
  const body = await sharp({
    create: { width: 600, height: 400, channels: 3, background: '#ac4f29' }
  })
    .withMetadata()
    .png()
    .toBuffer()
  const claim = await upload(base, body, true)
  const variants = await base.other.caller.action((ctx) =>
    processCampaignFileClaim(ctx, claim.asset, claim.operation)
  )
  expect(variants.map((v) => v.kind).sort()).toEqual(['DISPLAY', 'SOURCE', 'THUMBNAIL'])
  for (const variant of variants) {
    const metadata = await sharp(server.objects.get(variant.objectKey)!.body).metadata()
    expect(metadata).toMatchObject({ format: 'webp', width: variant.width, height: variant.height })
    expect(metadata.exif).toBeUndefined()
    expect(metadata.icc).toBeUndefined()
  }
  const before = await base.snapshot()
  for (const invalid of [variants.slice(0, 2), [variants[0]!, variants[0]!, variants[0]!]]) {
    await expect(
      base.other.caller.mutation(finish, {
        assetId: claim.asset.id,
        operationId: claim.operation.id,
        variants: invalid
      })
    ).rejects.toThrow('output mismatch')
  }
  expect(await base.snapshot()).toEqual(before)
  await base.other.caller.mutation(finish, {
    assetId: claim.asset.id,
    operationId: claim.operation.id,
    variants
  })
  const ready = (await base.snapshot()).assets[0]!
  expect(ready.crop).toBeNull()
  expect(ready.chargedBytes).toBe(variants.reduce((sum, v) => sum + v.byteSize, 0))
  await base.t.finishAllScheduledFunctions(vi.runAllTimers)
  expect(server.objects.size).toBe(0)
  expect((await base.snapshot()).assets[0]).toMatchObject({ status: 'DELETED', chargedBytes: 0 })
}, 20_000)

it('rejects stale, forged and incomplete settlement without writes and rolls back the complete transaction', async () => {
  const base = await setup()
  const claim = await upload(base, Buffer.from('valid text'))
  const variants = await base.other.caller.action((ctx) =>
    processCampaignFileClaim(ctx, claim.asset, claim.operation)
  )
  const input = { assetId: claim.asset.id, operationId: claim.operation.id, variants }
  const before = await base.snapshot()
  await expect(base.owner.caller.mutation(begin, { assetId: claim.asset.id })).rejects.toThrow(
    'unavailable'
  )
  await expect(base.other.caller.mutation(begin, { assetId: claim.asset.id })).rejects.toThrow(
    'still running'
  )
  for (const invalid of [
    { ...input, operationId: crypto.randomUUID() },
    { ...input, variants: [] },
    { ...input, variants: [...variants, ...variants] },
    { ...input, variants: variants.map((v) => ({ ...v, objectKey: 'forged/source.txt' })) },
    {
      ...input,
      variants: variants.map((v) => ({
        ...v,
        mimeType: 'image/webp' as const,
        width: 10,
        height: 10
      }))
    }
  ])
    await expect(base.other.caller.mutation(finish, invalid)).rejects.toThrow()
  await expect(base.owner.caller.mutation(finish, input)).rejects.toThrow('unavailable')
  expect(await base.snapshot()).toEqual(before)
  await expect(
    base.other.caller.mutation(async (ctx) => {
      await ctx.runMutation(finish, input)
      throw new Error('Injected post-settlement rollback')
    })
  ).rejects.toThrow('Injected post-settlement rollback')
  expect(await base.snapshot()).toEqual(before)
  await base.t.run((ctx) =>
    ctx.db.patch(base.membershipId, { status: 'LEFT', leftAt: new Date().toISOString() })
  )
  const revoked = await base.snapshot()
  await expect(base.other.caller.mutation(finish, input)).rejects.toThrow('Campaign not found')
  expect(await base.snapshot()).toEqual(revoked)
})

it('retains explicit quota rejection until the write fence, then deletes bytes and releases only its reservation', async () => {
  const base = await setup()
  const claim = await upload(base, Buffer.from('valid text'))
  await base.t.run(async (ctx) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
      .unique()
    await ctx.db.patch(profile!._id, { mediaBytes: ENTITLEMENT_LIMITS.FREE.storageBytes })
  })
  // Internally supplied output metadata can exceed the reservation (image expansion).
  const variants = claim.operation.outputs.map((output) => ({
    ...output,
    kind: 'SOURCE' as const,
    mimeType: 'text/plain' as const,
    width: null,
    height: null,
    byteSize: 6 * 1024 * 1024 + 1
  }))
  expect(
    await base.other.caller.mutation(finish, {
      assetId: claim.asset.id,
      operationId: claim.operation.id,
      variants
    })
  ).toEqual({ assetId: claim.asset.id, status: 'REJECTED', preview: null })
  expect((await base.snapshot()).assets[0]).toMatchObject({
    status: 'REJECTED',
    operation: claim.operation,
    chargedBytes: 6 * 1024 * 1024
  })
  await expect(
    base.other.caller.mutation(finish, {
      assetId: claim.asset.id,
      operationId: claim.operation.id,
      variants
    })
  ).rejects.toThrow('no longer current')
  await base.t.finishAllScheduledFunctions(vi.runAllTimers)
  expect(server.objects.size).toBe(0)
  const after = await base.snapshot()
  expect(after.assets[0]).toMatchObject({ status: 'DELETED', chargedBytes: 0 })
  expect(after.profiles.find((p) => p.userId === base.other.userId)?.mediaBytes).toBe(
    ENTITLEMENT_LIMITS.FREE.storageBytes - 6 * 1024 * 1024
  )
}, 20_000)

it('recovers from a real partial provider PUT failure without leaking its earlier output', async () => {
  const base = await setup()
  const body = await sharp({
    create: { width: 600, height: 400, channels: 3, background: '#ac4f29' }
  })
    .png()
    .toBuffer()
  const claim = await upload(base, body, true)
  const rejectedKey = claim.operation.outputs[1]!.objectKey
  server.faults.rejectPutKey = rejectedKey
  await expect(
    base.other.caller.action((ctx) => processCampaignFileClaim(ctx, claim.asset, claim.operation))
  ).rejects.toThrow()
  expect(server.objects.has(claim.operation.outputs[0]!.objectKey)).toBe(true)
  expect(server.objects.has(rejectedKey)).toBe(false)
  expect(server.objects.has(claim.operation.outputs[2]!.objectKey)).toBe(false)
  const args = { assetId: claim.asset.id, operationId: claim.operation.id }
  await base.t.mutation(internal.media.assets.failSave, args)
  expect((await base.snapshot()).assets[0]).toMatchObject({
    status: 'PROCESSING',
    operation: claim.operation
  })
  vi.setSystemTime(claim.operation.expiresAt)
  await base.t.mutation(internal.media.assets.expireOperation, args)
  server.faults.rejectPutKey = null
  const retry = await base.other.caller.mutation(begin, { assetId: claim.asset.id })
  if (retry.kind !== 'PROCESS') throw new Error('Expected retry claim.')
  const variants = await base.other.caller.action((ctx) =>
    processCampaignFileClaim(ctx, retry.asset, retry.operation)
  )
  await base.other.caller.mutation(finish, {
    assetId: claim.asset.id,
    operationId: retry.operation.id,
    variants
  })
  await base.other.caller.mutation(attach, {
    campaignId: base.campaign.id,
    assetId: claim.asset.id,
    displayName: 'Recovered map'
  })
  await base.t.finishAllScheduledFunctions(vi.runAllTimers)
  expect([...server.objects.keys()].sort()).toEqual(variants.map((v) => v.objectKey).sort())
}, 20_000)

it('preserves retryable uploads when storage reads fail operationally', async () => {
  const base = await setup()
  const claim = await upload(base, Buffer.from('keep the valid upload'))
  const before = await base.snapshot()
  for (const status of [403, 408, 429, 503]) {
    server.faults.getStatus = status
    const processing = base.other.caller.action((ctx) =>
      processCampaignFileClaim(ctx, claim.asset, claim.operation)
    )
    await expect(processing).rejects.toThrow('temporarily unavailable')
    await expect(processing).rejects.not.toBeInstanceOf(MediaValidationError)
    expect(await base.snapshot()).toEqual(before)
    expect(server.objects.has(claim.asset.rawObjectKey!)).toBe(true)
  }
  const args = { assetId: claim.asset.id, operationId: claim.operation.id }
  await base.t.mutation(internal.media.assets.failSave, args)
  vi.setSystemTime(claim.operation.expiresAt)
  await base.t.mutation(internal.media.assets.expireOperation, args)
  server.faults.getStatus = null
  const retry = await base.other.caller.mutation(begin, { assetId: claim.asset.id })
  if (retry.kind !== 'PROCESS') throw new Error('Expected retry claim.')
  const variants = await base.other.caller.action((ctx) =>
    processCampaignFileClaim(ctx, retry.asset, retry.operation)
  )
  expect(
    await base.other.caller.mutation(finish, {
      assetId: claim.asset.id,
      operationId: retry.operation.id,
      variants
    })
  ).toMatchObject({ status: 'READY' })
}, 20_000)

it('rejects invalid UTF-8, missing objects and mismatched byte counts before storing verified output', async () => {
  for (const body of [
    Buffer.from([0xc3, 0x28]),
    Buffer.from('valid text'),
    Buffer.from('missing')
  ]) {
    const base = await setup()
    const claim = await upload(base, body)
    if (body.toString() === 'valid text')
      server.objects.get(claim.asset.rawObjectKey!)!.body = Buffer.from('short')
    if (body.toString() === 'missing') server.objects.delete(claim.asset.rawObjectKey!)
    await expect(
      base.other.caller.action((ctx) => processCampaignFileClaim(ctx, claim.asset, claim.operation))
    ).rejects.toBeInstanceOf(MediaValidationError)
    expect(claim.operation.outputs.every((output) => !server.objects.has(output.objectKey))).toBe(
      true
    )
    await base.t.mutation(reject, { assetId: claim.asset.id, operationId: claim.operation.id })
    expect((await base.snapshot()).assets[0]).toMatchObject({
      status: 'REJECTED',
      operation: claim.operation
    })
    await base.t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(server.objects.size).toBe(0)
  }
}, 20_000)

it.each(['failed', 'killed'])(
  'retries a %s operation on the same upload after the fence and ignores its old callbacks',
  async (failure) => {
    const base = await setup()
    const claim = await upload(base, Buffer.from('retry these bytes'))
    // A write can finish even when its action never reports success.
    const oldVariants = await base.other.caller.action((ctx) =>
      processCampaignFileClaim(ctx, claim.asset, claim.operation)
    )
    const args = { assetId: claim.asset.id, operationId: claim.operation.id }
    if (failure === 'failed') await base.t.mutation(internal.media.assets.failSave, args)
    await base.t.mutation(internal.media.assets.expireOperation, args)
    expect((await base.snapshot()).assets[0]?.operation?.id).toBe(claim.operation.id)
    await expect(base.other.caller.mutation(begin, { assetId: claim.asset.id })).rejects.toThrow(
      'still running'
    )
    vi.setSystemTime(claim.operation.expiresAt)
    await base.t.mutation(internal.media.assets.expireOperation, args)
    expect((await base.snapshot()).assets[0]).toMatchObject({
      status: 'PENDING_UPLOAD',
      operation: null,
      rawObjectKey: claim.asset.rawObjectKey,
      chargedBytes: claim.asset.chargedBytes
    })
    expect(server.objects.has(claim.asset.rawObjectKey!)).toBe(true)
    const retry = await base.other.caller.mutation(begin, { assetId: claim.asset.id })
    if (retry.kind !== 'PROCESS') throw new Error('Expected retry claim.')
    expect(retry.operation.id).not.toBe(claim.operation.id)
    expect(retry.operation.outputs[0]?.objectKey).not.toBe(claim.operation.outputs[0]?.objectKey)
    const before = await base.snapshot()
    await base.t.mutation(reject, args)
    await base.t.mutation(internal.media.assets.failSave, args)
    await base.t.mutation(internal.media.assets.expireOperation, args)
    await expect(
      base.other.caller.mutation(finish, { ...args, variants: oldVariants })
    ).rejects.toThrow('no longer current')
    expect(await base.snapshot()).toEqual(before)
    const variants = await base.other.caller.action((ctx) =>
      processCampaignFileClaim(ctx, retry.asset, retry.operation)
    )
    await base.other.caller.mutation(finish, {
      assetId: retry.asset.id,
      operationId: retry.operation.id,
      variants
    })
    await base.other.caller.mutation(attach, {
      campaignId: base.campaign.id,
      assetId: claim.asset.id,
      displayName: 'Retried file'
    })
    await base.t.finishAllScheduledFunctions(vi.runAllTimers)
    expect([...server.objects.keys()]).toEqual(variants.map((v) => v.objectKey))
    expect(
      (await base.snapshot()).profiles.find((p) => p.userId === base.other.userId)?.mediaBytes
    ).toBe(variants[0]!.byteSize)
  },
  20_000
)
