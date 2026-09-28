// @vitest-environment node
import { makeFunctionReference } from 'convex/server'
import { register } from '@convex-dev/r2/test'
import { register as registerRetrier } from '@convex-dev/action-retrier/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type { CreateCampaignFileUploadIntentInput } from '@artificer-toolkit/schema/api/media'
import type { mediaSinglePutUploadSchema } from '@artificer-toolkit/schema/api/mediaAssets'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CreateCampaignAttachmentInput,
  CampaignAttachmentDto
} from '@artificer-toolkit/schema/api/campaignAttachments'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { ENTITLEMENT_LIMITS } from '@artificer-toolkit/shared/account/entitlements'
import { fixture } from '../../tests/fixtures/characters'
import { startLocalR2 } from '../../tests/localR2'
import { api, internal } from '../_generated/api'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const createUpload = makeFunctionReference<
  'mutation',
  CreateCampaignFileUploadIntentInput,
  z.infer<typeof mediaSinglePutUploadSchema>
>('media/fileAssets:createUpload')
const attach = makeFunctionReference<
  'mutation',
  CreateCampaignAttachmentInput,
  CampaignAttachmentDto
>('campaigns/attachments:create')
const archive = makeFunctionReference<
  'mutation',
  { campaignId: string; expectedVersion: number },
  CampaignDetailDto
>('campaigns/archive:archive')

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
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Upload files',
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
  return { ...base, campaign, membershipId }
}

const input = (campaignId: string, bytes = 12): CreateCampaignFileUploadIntentInput => ({
  profile: 'CAMPAIGN_FILE',
  target: { type: 'CAMPAIGN_FILE', campaignId },
  originalFileName: 'notes.txt',
  declaredMimeType: 'text/plain',
  declaredBytes: bytes,
  idempotencyKey: crypto.randomUUID()
})

describe('native Campaign file upload intents', () => {
  it('signs exact private text PUTs, reserves once, replays and cleans abandoned bytes after the fence', async () => {
    const { t, other, campaign } = await setup()
    const body = Buffer.from('Résumé 🐉\n', 'utf8')
    const request = input(campaign.id.toUpperCase(), body.byteLength)
    const intent = await other.caller.mutation(createUpload, request)
    expect(Object.keys(intent).sort()).toEqual(['assetId', 'expiresAt', 'method', 'url'])
    expect(intent.method).toBe('PUT')
    const url = new URL(intent.url)
    expect(url.origin).toBe(server.endpoint)
    expect(url.searchParams.get('X-Amz-SignedHeaders')?.split(';')).toEqual(
      expect.arrayContaining(['content-length', 'content-type'])
    )
    const snapshot = () =>
      t.run(async (ctx) => ({
        assets: await ctx.db.query('mediaAssets').collect(),
        profile: await ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', other.userId))
          .unique()
      }))
    const before = await snapshot()
    expect(before.assets).toHaveLength(1)
    expect(before.assets[0]).toMatchObject({
      id: intent.assetId,
      ownerUserId: other.userId,
      storageAssetId: intent.assetId,
      profileClass: 'TEXT_FILE',
      status: 'PENDING_UPLOAD',
      chargedBytes: 6 * 1024 * 1024,
      contentHash: null,
      variants: [],
      cropThumbnails: [],
      operation: null
    })
    expect(before.profile?.mediaBytes).toBe(6 * 1024 * 1024)
    vi.setSystemTime(Date.now() + 1000)
    const replay = await other.caller.mutation(createUpload, request)
    expect(replay.assetId).toBe(intent.assetId)
    expect(Date.parse(replay.expiresAt)).toBeGreaterThan(Date.parse(intent.expiresAt))
    expect((await snapshot()).profile?.mediaBytes).toBe(6 * 1024 * 1024)
    const row = (await snapshot()).assets[0]!
    expect(row.cleanupAt).toBe(Date.parse(replay.expiresAt) + 15 * 60_000)
    await t.mutation(internal.media.assets.cleanup, { assetId: intent.assetId })
    expect((await snapshot()).assets[0]?.status).toBe('PENDING_UPLOAD')
    expect(
      (
        await fetch(replay.url, {
          method: 'PUT',
          body: new Uint8Array(body),
          headers: { 'content-type': 'text/plain' }
        })
      ).status
    ).toBe(200)
    expect(server.objects.get(row.rawObjectKey!)?.body).toEqual(body)
    expect(
      (
        await fetch(replay.url, {
          method: 'PUT',
          body: new Uint8Array(body),
          headers: { 'content-type': 'image/png' }
        })
      ).status
    ).toBe(403)
    expect(
      (
        await fetch(replay.url, {
          method: 'PUT',
          body: new Uint8Array(Buffer.concat([body, Buffer.from('extra')])),
          headers: { 'content-type': 'text/plain' }
        })
      ).status
    ).toBe(403)
    expect(server.objects.get(row.rawObjectKey!)?.body).toEqual(body)
    await expect(
      other.caller.mutation(attach, {
        campaignId: campaign.id,
        assetId: intent.assetId,
        displayName: 'Not verified'
      })
    ).rejects.toThrow('unavailable')
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(server.objects.size).toBe(0)
    expect((await snapshot()).assets[0]).toMatchObject({
      status: 'DELETED',
      chargedBytes: 0,
      rawObjectKey: null
    })
    expect((await snapshot()).profile?.mediaBytes).toBe(0)
    await t.mutation(internal.media.assets.cleanup, { assetId: intent.assetId })
    expect((await snapshot()).profile?.mediaBytes).toBe(0)
  }, 20_000)

  it('preserves upload membership authority on archived Campaigns and rejects removed/nonmembers', async () => {
    const { t, owner, other, campaign, membershipId } = await setup()
    await owner.caller.mutation(archive, {
      campaignId: campaign.id,
      expectedVersion: campaign.version
    })
    const request: CreateCampaignFileUploadIntentInput = {
      ...input(campaign.id),
      profile: 'CAMPAIGN_HANDOUT_MAP',
      target: { type: 'CAMPAIGN_HANDOUT_MAP', campaignId: campaign.id },
      originalFileName: 'handout.png',
      declaredMimeType: 'image/png'
    }
    const intent = await other.caller.mutation(createUpload, request)
    expect(intent.assetId).toBeTruthy()
    await expect(
      other.caller.mutation(attach, {
        campaignId: campaign.id,
        assetId: intent.assetId,
        displayName: 'Archived'
      })
    ).rejects.toThrow('read-only')
    await t.run((ctx) =>
      ctx.db.patch(membershipId, { status: 'LEFT', leftAt: new Date().toISOString() })
    )
    const before = await t.run((ctx) => ctx.db.query('mediaAssets').collect())
    await expect(other.caller.mutation(createUpload, request)).rejects.toThrow('Campaign not found')
    await expect(t.mutation(createUpload, request)).rejects.toThrow()
    await expect(owner.caller.mutation(createUpload, input(crypto.randomUUID()))).rejects.toThrow(
      'Campaign not found'
    )
    expect(await t.run((ctx) => ctx.db.query('mediaAssets').collect())).toEqual(before)
  })

  it('binds owner-scoped replay to the upload class and immutable metadata, not its Campaign', async () => {
    const { t, owner, other, campaign } = await setup()
    const request: CreateCampaignFileUploadIntentInput = {
      ...input(campaign.id),
      originalFileName: 'file.png',
      declaredMimeType: 'image/png'
    }
    const first = await owner.caller.mutation(createUpload, request)
    const secondOwner = await other.caller.mutation(createUpload, request)
    expect(secondOwner.assetId).not.toBe(first.assetId)
    const otherCampaign = await other.caller.mutation(createCampaign, {
      name: 'Other target',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    await t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: otherCampaign.id,
        userId: owner.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: otherCampaign.createdAt,
        joinedAt: otherCampaign.createdAt,
        leftAt: null
      })
    )
    const snapshot = () =>
      t.run(async (ctx) => ({
        assets: await ctx.db.query('mediaAssets').collect(),
        profiles: await ctx.db.query('userProfiles').collect()
      }))
    const before = await snapshot()
    for (const next of [
      { ...request, originalFileName: 'different.png' },
      { ...request, declaredBytes: request.declaredBytes + 1 },
      { ...request, declaredMimeType: 'image/jpeg' as const },
      {
        ...request,
        profile: 'CAMPAIGN_HANDOUT_MAP' as const,
        target: { type: 'CAMPAIGN_HANDOUT_MAP' as const, campaignId: campaign.id }
      }
    ])
      await expect(owner.caller.mutation(createUpload, next)).rejects.toThrow('already been used')
    expect(await snapshot()).toEqual(before)
    // The pending upload is the owner's: it replays for another Campaign or an image slot.
    expect(
      await owner.caller.mutation(createUpload, {
        ...request,
        target: { ...request.target, campaignId: otherCampaign.id }
      })
    ).toMatchObject({ assetId: first.assetId })
    const { profile: _profile, target: _target, ...metadata } = request
    expect(
      await owner.caller.mutation(api.media.assets.createAvatarUpload, {
        ...metadata,
        declaredMimeType: 'image/png'
      })
    ).toMatchObject({ assetId: first.assetId })
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('mediaAssets')
        .withIndex('by_publicId', (q) => q.eq('id', first.assetId))
        .unique()
      await ctx.db.patch(row!._id, { status: 'READY' })
    })
    await expect(owner.caller.mutation(createUpload, request)).rejects.toThrow('already been used')
  })

  it('rolls back reservations on invalid intent, exhausted quota and signer-configuration failure', async () => {
    const { t, owner, campaign } = await setup()
    const request = input(campaign.id)
    const snapshot = () =>
      t.run(async (ctx) => ({
        assets: await ctx.db.query('mediaAssets').collect(),
        profiles: await ctx.db.query('userProfiles').collect(),
        scheduled: await ctx.db.system.query('_scheduled_functions').collect()
      }))
    const before = await snapshot()
    for (const next of [
      { ...request, declaredBytes: 6 * 1024 * 1024 + 1 },
      { ...request, declaredBytes: 0 },
      { ...request, originalFileName: '' },
      {
        ...request,
        profile: 'CAMPAIGN_HANDOUT_MAP' as const,
        target: { type: 'CAMPAIGN_HANDOUT_MAP' as const, campaignId: campaign.id }
      },
      { ...request, target: { type: 'CAMPAIGN_HANDOUT_MAP' as const, campaignId: campaign.id } }
    ])
      await expect(owner.caller.mutation(createUpload, next)).rejects.toThrow()
    expect(await snapshot()).toEqual(before)
    vi.stubEnv('LOCAL_R2_ENDPOINT', 'https://not-loopback.invalid')
    await expect(owner.caller.mutation(createUpload, request)).rejects.toThrow('loopback')
    expect(await snapshot()).toEqual(before)
    vi.stubEnv('LOCAL_R2_ENDPOINT', server.endpoint)
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', owner.userId))
        .unique()
      await ctx.db.patch(profile!._id, {
        mediaBytes: ENTITLEMENT_LIMITS.FREE.storageBytes - 6 * 1024 * 1024 + 1
      })
    })
    const full = await snapshot()
    await expect(owner.caller.mutation(createUpload, request)).rejects.toThrow('storage limit')
    expect(await snapshot()).toEqual(full)
    expect(server.objects.size).toBe(0)
  })
})
