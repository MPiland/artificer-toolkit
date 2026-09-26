import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type { CreateVttMapUploadIntentInput } from '@artificer-toolkit/schema/api/media'
import type {
  CampaignAttachmentDto,
  CreateCampaignAttachmentInput
} from '@artificer-toolkit/schema/api/campaignAttachments'
import type {
  BeginSceneDefinitionInput,
  SceneDefinitionSaveProgress
} from '@artificer-toolkit/schema/api/sceneDefinitionSave'
import {
  mediaSinglePutUploadSchema,
  mediaStoredAssetSchema
} from '@artificer-toolkit/schema/api/mediaAssets'
import { campaignStoredFileAssetSchema } from '@artificer-toolkit/schema/projections/campaignFilePersistence'
import { vttMapStoredAssetSchema } from '@artificer-toolkit/schema/projections/vttMapPersistence'
import {
  sceneStoredDefinitionSchema,
  sceneStoredInitialStateSchema
} from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { ENTITLEMENT_LIMITS } from '@artificer-toolkit/shared/account/entitlements'
import type { z } from 'zod'
import { fixture } from '../../tests/fixtures/characters'
import { components, internal } from '../_generated/api'
import { retainAccountCampaignMedia } from './accountRetention.helper'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const readDelivery = makeFunctionReference<
  'query',
  { assetId: string },
  { id: string; ownerUserId: string }
>('media/vttMapAssets:readDelivery')
const createMapUpload = makeFunctionReference<
  'mutation',
  CreateVttMapUploadIntentInput,
  z.infer<typeof mediaSinglePutUploadSchema>
>('media/vttMapAssets:createUpload')
const createAttachment = makeFunctionReference<
  'mutation',
  CreateCampaignAttachmentInput,
  CampaignAttachmentDto
>('campaigns/attachments:create')
const readAttachmentDelivery = makeFunctionReference<
  'query',
  { campaignId: string; attachmentId: string },
  { assetId: string; objectKey: string; mimeType: string; fileName: string; byteSize: number }
>('campaigns/attachments:readDelivery')
const backfill = makeFunctionReference<
  'mutation',
  { cursor: string | null },
  {
    cursor: string | null
    isDone: boolean
    processed: number
    orphanedReferencedMapIds: string[]
  }
>('media/vttMapRetention:backfill')
const beginScene = makeFunctionReference<
  'mutation',
  BeginSceneDefinitionInput,
  SceneDefinitionSaveProgress
>('scenes/definitions:begin')
const publishScene = makeFunctionReference<
  'mutation',
  { saveId: string },
  SceneDefinitionSaveProgress
>('scenes/definitions:publish')

async function setup() {
  const base = await fixture()
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'VTT map retention',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  return { ...base, campaign }
}

function map(ownerUserId: string, campaignId: string, overrides: Record<string, unknown> = {}) {
  const id = crypto.randomUUID()
  return vttMapStoredAssetSchema.parse({
    id,
    ownerUserId,
    profile: 'VTT_MAP',
    campaignId,
    upload: {
      originalFileName: 'map.png',
      declaredMimeType: 'image/png',
      declaredBytes: 1,
      idempotencyKey: crypto.randomUUID()
    },
    status: 'READY',
    rawObjectKey: null,
    uploadExpiresAt: 123,
    chargedBytes: 3,
    width: 100,
    height: 100,
    crop: null,
    operation: null,
    cleanupAt: 456,
    variants: [
      {
        kind: 'DISPLAY',
        objectKey: `ready/${id}/display.webp`,
        byteSize: 1,
        width: 100,
        height: 100,
        mimeType: 'image/webp'
      },
      {
        kind: 'THUMBNAIL',
        objectKey: `ready/${id}/thumbnail.webp`,
        byteSize: 1,
        width: 100,
        height: 100,
        mimeType: 'image/webp'
      },
      {
        kind: 'TILE',
        row: 0,
        column: 0,
        objectKey: `ready/${id}/tile.webp`,
        byteSize: 1,
        width: 100,
        height: 100,
        mimeType: 'image/webp'
      }
    ],
    ...overrides
  })
}

function file(ownerUserId: string, campaignId: string, overrides: Record<string, unknown> = {}) {
  const id = crypto.randomUUID()
  return campaignStoredFileAssetSchema.parse({
    id,
    ownerUserId,
    profile: 'CAMPAIGN_FILE',
    campaignId,
    upload: {
      originalFileName: 'notes.txt',
      declaredMimeType: 'text/plain',
      declaredBytes: 5,
      idempotencyKey: crypto.randomUUID()
    },
    status: 'READY',
    rawObjectKey: null,
    uploadExpiresAt: 123,
    chargedBytes: 5,
    crop: null,
    operation: null,
    cleanupAt: null,
    variants: [
      {
        kind: 'SOURCE',
        objectKey: `ready/${id}/source.txt`,
        byteSize: 5,
        width: null,
        height: null,
        mimeType: 'text/plain'
      }
    ],
    ...overrides
  })
}

async function referenceMap(
  base: Awaited<ReturnType<typeof setup>>,
  assetId: string,
  kind: 'definition' | 'live'
) {
  const now = new Date().toISOString()
  const settings = {
    campaignId: base.campaign.id,
    name: 'Retention reference',
    ambientIllumination: 'BRIGHT' as const,
    fogMode: 'PER_PLAYER' as const,
    visionRevealMode: 'ON_DRAG' as const,
    grid: { kind: 'GRIDLESS' as const, pixelsPerUnit: 50, unit: 'FEET' as const },
    map: { assetId, width: 100, height: 100, tileManifestAssetId: null }
  }
  await base.t.run(async (ctx) => {
    if (kind === 'definition')
      await ctx.db.insert(
        'sceneDefinitions',
        sceneStoredDefinitionSchema.parse({
          ...settings,
          id: crypto.randomUUID(),
          saveId: crypto.randomUUID(),
          version: 1,
          counts: { annotations: 0, barriers: 0, darknessZones: 0, lights: 0, tokens: 0 },
          createdAt: now,
          updatedAt: now
        })
      )
    else
      await ctx.db.insert(
        'campaignScenes',
        sceneStoredInitialStateSchema.parse({
          ...settings,
          id: crypto.randomUUID(),
          definitionId: crypto.randomUUID(),
          definitionVersion: 1,
          definitionSaveId: crypto.randomUUID(),
          version: 0,
          materializationCommandId: crypto.randomUUID(),
          materializationCommandFingerprint: '0'.repeat(64),
          createdAt: now,
          updatedAt: now
        })
      )
  })
}

it.each([true, undefined])(
  'deletes the uploader while retaining a referenced READY map with %s metadata',
  async (hasSceneReferences) => {
    const base = await setup()
    const asset = map(base.other.userId, base.campaign.id, { hasSceneReferences })
    await base.t.run((ctx) => ctx.db.insert('mediaAssets', asset))
    const profile = await base.t.run((ctx) =>
      ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
        .unique()
    )
    if (!profile) throw new Error('Missing uploader profile.')
    await referenceMap(base, asset.id, 'definition')
    await base.t.run(async (ctx) =>
      ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: { model: 'user', where: [{ field: '_id', value: profile.authUserId }] },
        onDeleteHandle: await createFunctionHandle(internal.auth.onDelete)
      })
    )
    expect(
      await base.t.run(async (ctx) => ({
        profile: await ctx.db.get(profile._id),
        asset: await ctx.db
          .query('mediaAssets')
          .withIndex('by_publicId', (q) => q.eq('id', asset.id))
          .unique(),
        authUser: await ctx.runQuery(components.betterAuth.adapter.findOne, {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }]
        })
      }))
    ).toEqual({
      profile: null,
      asset: expect.objectContaining({
        id: asset.id,
        ownerUserId: base.owner.userId,
        hasSceneReferences: true
      }),
      authUser: null
    })
    await expect(
      base.owner.caller.query(readDelivery, { assetId: asset.id })
    ).resolves.toMatchObject({
      id: asset.id,
      ownerUserId: base.owner.userId
    })
    await expect(base.other.caller.query(readDelivery, { assetId: asset.id })).rejects.toThrow()
  }
)

it.each([true, undefined])(
  'retains referenced READY maps with %s metadata for the current Campaign owner',
  async (hasSceneReferences) => {
    const base = await setup()
    const sharedKey = crypto.randomUUID()
    const retained = map(base.other.userId, base.campaign.id, {
      hasSceneReferences,
      upload: {
        originalFileName: 'map.png',
        declaredMimeType: 'image/png',
        declaredBytes: 1,
        idempotencyKey: sharedKey
      }
    })
    const collision = map(base.owner.userId, base.campaign.id, {
      upload: {
        originalFileName: 'other.png',
        declaredMimeType: 'image/png',
        declaredBytes: 1,
        idempotencyKey: sharedKey
      }
    })
    await base.t.run(async (ctx) => {
      await ctx.db.insert('mediaAssets', retained)
      await ctx.db.insert('mediaAssets', collision)
    })
    await referenceMap(base, retained.id, 'definition')
    const before = await base.t.run(async (ctx) => ({
      retained: await ctx.db
        .query('mediaAssets')
        .withIndex('by_publicId', (q) => q.eq('id', retained.id))
        .unique(),
      source: await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
        .unique(),
      owner: await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique()
    }))
    await base.t.run((ctx) => retainAccountCampaignMedia(ctx, base.other.userId))
    const after = await base.t.run(async (ctx) => ({
      retained: await ctx.db
        .query('mediaAssets')
        .withIndex('by_publicId', (q) => q.eq('id', retained.id))
        .unique(),
      source: await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
        .unique(),
      owner: await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique()
    }))
    expect(after.retained).toMatchObject({
      id: retained.id,
      ownerUserId: base.owner.userId,
      hasSceneReferences: true,
      rawObjectKey: before.retained!.rawObjectKey,
      variants: before.retained!.variants
    })
    expect(after.retained!.upload.idempotencyKey).not.toBe(sharedKey)
    expect(after.source).toEqual(before.source)
    expect(after.owner!.mediaBytes).toBe((before.owner!.mediaBytes ?? 0) + retained.chargedBytes)
    await expect(
      base.owner.caller.query(readDelivery, { assetId: retained.id })
    ).resolves.toMatchObject({
      id: retained.id,
      ownerUserId: base.owner.userId
    })
  }
)

it('allows retention over quota and rolls an outer account-deletion transaction back exactly', async () => {
  const base = await setup()
  const asset = map(base.other.userId, base.campaign.id, { hasSceneReferences: false })
  await base.t.run(async (ctx) => {
    await ctx.db.insert('mediaAssets', asset)
    const owner = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
      .unique()
    if (!owner) throw new Error('Missing Campaign owner profile.')
    await ctx.db.patch(owner._id, { mediaBytes: ENTITLEMENT_LIMITS.FREE.storageBytes })
  })
  await referenceMap(base, asset.id, 'live')
  const snapshot = () =>
    base.t.run(async (ctx) => ({
      assets: await ctx.db.query('mediaAssets').collect(),
      profiles: await ctx.db.query('userProfiles').collect(),
      definitions: await ctx.db.query('sceneDefinitions').collect(),
      scenes: await ctx.db.query('campaignScenes').collect()
    }))
  const before = await snapshot()
  await expect(
    base.t.run(async (ctx) => {
      await retainAccountCampaignMedia(ctx, base.other.userId)
      throw new Error('late outer rollback')
    })
  ).rejects.toThrow('late outer rollback')
  expect(await snapshot()).toEqual(before)
  await base.t.run((ctx) => retainAccountCampaignMedia(ctx, base.other.userId))
  const owner = await base.t.run((ctx) =>
    ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
      .unique()
  )
  expect(owner!.mediaBytes).toBe(ENTITLEMENT_LIMITS.FREE.storageBytes + asset.chargedBytes)
  await expect(
    base.owner.caller.mutation(createMapUpload, {
      profile: 'VTT_MAP',
      target: { type: 'VTT_MAP', campaignId: base.campaign.id },
      originalFileName: 'new-map.png',
      declaredMimeType: 'image/png',
      declaredBytes: 1,
      idempotencyKey: crypto.randomUUID()
    })
  ).rejects.toThrow('Image storage limit reached.')
})

it.each(['CAMPAIGN_FILE', 'CAMPAIGN_HANDOUT_MAP'] as const)(
  'retains a public Campaign attachment through native uploader deletion without changing attribution: %s',
  async (profile) => {
    const base = await setup()
    const image = map(base.other.userId, base.campaign.id)
    const asset = file(
      base.other.userId,
      base.campaign.id,
      profile === 'CAMPAIGN_FILE'
        ? {}
        : {
            profile,
            upload: image.upload,
            variants: [
              {
                kind: 'SOURCE',
                objectKey: `ready/${image.id}/source.webp`,
                byteSize: 1,
                width: 100,
                height: 100,
                mimeType: 'image/webp'
              }
            ],
            chargedBytes: image.chargedBytes
          }
    )
    await base.t.run(async (ctx) => {
      await ctx.db.insert('mediaAssets', asset)
      await ctx.db.insert('campaignMemberships', {
        campaignId: base.campaign.id,
        userId: base.other.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: base.campaign.createdAt,
        joinedAt: base.campaign.createdAt,
        leftAt: null
      })
    })
    const attachment = await base.other.caller.mutation(createAttachment, {
      campaignId: base.campaign.id,
      assetId: asset.id,
      displayName: 'Original notes'
    })
    const snapshot = () =>
      base.t.run(async (ctx) => ({
        assets: await ctx.db.query('mediaAssets').collect(),
        attachments: await ctx.db.query('campaignAttachments').collect(),
        profiles: await ctx.db.query('userProfiles').collect()
      }))
    const beforeRollback = await snapshot()
    await expect(
      base.t.run(async (ctx) => {
        await retainAccountCampaignMedia(ctx, base.other.userId)
        throw new Error('late attachment rollback')
      })
    ).rejects.toThrow('late attachment rollback')
    expect(await snapshot()).toEqual(beforeRollback)
    const source = await base.t.run((ctx) =>
      ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
        .unique()
    )
    if (!source) throw new Error('Missing uploader profile.')
    await base.t.run(async (ctx) =>
      ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: { model: 'user', where: [{ field: '_id', value: source.authUserId }] },
        onDeleteHandle: await createFunctionHandle(internal.auth.onDelete)
      })
    )
    const after = await base.t.run(async (ctx) => ({
      asset: await ctx.db
        .query('mediaAssets')
        .withIndex('by_publicId', (q) => q.eq('id', asset.id))
        .unique(),
      attachment: await ctx.db
        .query('campaignAttachments')
        .withIndex('by_campaignId_id', (q) =>
          q.eq('campaignId', base.campaign.id).eq('id', attachment.id)
        )
        .unique(),
      source: await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
        .unique(),
      owner: await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique()
    }))
    expect(after.asset).toMatchObject({
      id: asset.id,
      ownerUserId: base.owner.userId,
      retainedFromUserId: base.other.userId,
      variants: asset.variants
    })
    if (!after.attachment) throw new Error('Missing retained attachment.')
    const {
      _id: _attachmentId,
      _creationTime: _attachmentCreated,
      ...storedAttachment
    } = after.attachment
    const { uploaderLabel: _uploaderLabel, ...storedFields } = attachment
    expect(storedAttachment).toEqual(storedFields)
    expect(after.source).toBeNull()
    expect(after.owner!.mediaBytes).toBe(
      (beforeRollback.profiles.find((profile) => profile.userId === base.owner.userId)
        ?.mediaBytes ?? 0) + asset.chargedBytes
    )
    await expect(
      base.owner.caller.query(readAttachmentDelivery, {
        campaignId: base.campaign.id,
        attachmentId: attachment.id
      })
    ).resolves.toMatchObject({ assetId: asset.id, objectKey: asset.variants[0]!.objectKey })
    await expect(
      base.other.caller.query(readAttachmentDelivery, {
        campaignId: base.campaign.id,
        attachmentId: attachment.id
      })
    ).rejects.toThrow()
  }
)

it('refuses a retained attachment whose stored uploader cannot be the asset owner', async () => {
  const base = await setup()
  const asset = file(base.other.userId, base.campaign.id)
  await base.t.run(async (ctx) => {
    await ctx.db.insert('mediaAssets', asset)
    await ctx.db.insert('campaignAttachments', {
      id: crypto.randomUUID(),
      campaignId: base.campaign.id,
      assetId: asset.id,
      uploaderUserId: crypto.randomUUID(),
      profile: 'CAMPAIGN_FILE',
      displayName: 'Counterfeit attribution',
      description: null,
      sessionId: null,
      noteSectionId: null,
      createdAt: new Date().toISOString()
    })
  })
  const before = await base.t.run(async (ctx) => ({
    assets: await ctx.db.query('mediaAssets').collect(),
    attachments: await ctx.db.query('campaignAttachments').collect(),
    profiles: await ctx.db.query('userProfiles').collect()
  }))
  await expect(
    base.t.run((ctx) => retainAccountCampaignMedia(ctx, base.other.userId))
  ).rejects.toThrow('Stored Campaign media attachment mismatch.')
  expect(
    await base.t.run(async (ctx) => ({
      assets: await ctx.db.query('mediaAssets').collect(),
      attachments: await ctx.db.query('campaignAttachments').collect(),
      profiles: await ctx.db.query('userProfiles').collect()
    }))
  ).toEqual(before)
})

it('blocks a saved-before-deletion publication and Campaign-owner delivery after uploader deletion', async () => {
  const base = await setup()
  const asset = map(base.other.userId, base.campaign.id, { hasSceneReferences: false })
  await base.t.run((ctx) => ctx.db.insert('mediaAssets', asset))
  const save = await base.owner.caller.mutation(beginScene, {
    commandId: crypto.randomUUID(),
    sceneId: null,
    expectedVersion: null,
    settings: {
      campaignId: base.campaign.id,
      name: 'Saved before deletion',
      ambientIllumination: 'BRIGHT',
      fogMode: 'PER_PLAYER',
      visionRevealMode: 'ON_DRAG',
      grid: { kind: 'GRIDLESS', pixelsPerUnit: 50, unit: 'FEET' },
      map: { assetId: asset.id, width: 100, height: 100, tileManifestAssetId: null }
    },
    counts: { annotations: 0, barriers: 0, darknessZones: 0, lights: 0, tokens: 0 }
  })
  const profile = await base.t.run((ctx) =>
    ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
      .unique()
  )
  if (!profile) throw new Error('Missing uploader profile.')
  await base.owner.caller.run(async (ctx) => {
    await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
      input: { model: 'user', where: [{ field: '_id', value: profile.authUserId }] },
      onDeleteHandle: await createFunctionHandle(internal.auth.onDelete)
    })
    // Exercise the deleted-uploader fence before the scheduled asset purge can run.
    await expect(ctx.runMutation(publishScene, { saveId: save.saveId })).rejects.toThrow(
      'Scene map is unavailable.'
    )
    await expect(ctx.runQuery(readDelivery, { assetId: asset.id })).rejects.toThrow(
      'Scene map is unavailable.'
    )
  })
})

it('preserves uploader storage ownership across Campaign transfer while delivery follows Campaign authority', async () => {
  const base = await setup()
  const asset = map(base.owner.userId, base.campaign.id, { hasSceneReferences: false })
  await base.t.run(async (ctx) => {
    await ctx.db.insert('mediaAssets', asset)
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
      .unique()
    await ctx.db.patch(profile!._id, { mediaBytes: 3 })
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
    await ctx.db.patch(campaign!._id, { ownerUserId: base.other.userId })
    const membership = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.owner.userId)
      )
      .unique()
    await ctx.db.patch(membership!._id, { role: 'PLAYER' })
    await ctx.db.insert('campaignMemberships', {
      campaignId: base.campaign.id,
      userId: base.other.userId,
      role: 'OWNER',
      status: 'ACTIVE',
      accessStartedAt: base.campaign.createdAt,
      joinedAt: base.campaign.createdAt,
      leftAt: null
    })
  })
  await expect(base.owner.caller.query(readDelivery, { assetId: asset.id })).rejects.toThrow()
  await expect(base.other.caller.query(readDelivery, { assetId: asset.id })).resolves.toMatchObject(
    {
      id: asset.id,
      ownerUserId: base.owner.userId
    }
  )
  expect(
    await base.t.run((ctx) =>
      ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique()
    )
  ).toMatchObject({ mediaBytes: 3 })
})

it('backfills definition-only and live-only references without changing retained media metadata', async () => {
  const base = await setup()
  const definitionMap = map(base.owner.userId, base.campaign.id)
  const liveMap = map(base.owner.userId, base.campaign.id)
  const staleMap = map(base.owner.userId, base.campaign.id, { hasSceneReferences: true })
  const terminalMap = map(base.owner.userId, base.campaign.id, {
    status: 'DELETED',
    rawObjectKey: null,
    variants: [],
    chargedBytes: 0,
    cleanupAt: null
  })
  const unrelated = mediaStoredAssetSchema.parse({
    id: crypto.randomUUID(),
    ownerUserId: base.owner.userId,
    profile: 'ACCOUNT_AVATAR',
    upload: {
      originalFileName: 'avatar.png',
      declaredMimeType: 'image/png',
      declaredBytes: 1,
      idempotencyKey: crypto.randomUUID()
    },
    status: 'READY',
    rawObjectKey: null,
    uploadExpiresAt: 123,
    chargedBytes: 3,
    variants: [],
    crop: null,
    operation: null,
    cleanupAt: 456
  })
  const filler = Array.from({ length: 5 }, () => map(base.owner.userId, base.campaign.id))
  const orphan = map(crypto.randomUUID(), base.campaign.id)
  await base.t.run(async (ctx) => {
    for (const asset of [
      unrelated,
      definitionMap,
      liveMap,
      staleMap,
      terminalMap,
      ...filler,
      orphan
    ])
      await ctx.db.insert('mediaAssets', asset)
  })
  await referenceMap(base, definitionMap.id, 'definition')
  await referenceMap(base, liveMap.id, 'live')
  await referenceMap(base, orphan.id, 'definition')
  const before = await base.t.run((ctx) => ctx.db.query('mediaAssets').collect())
  const first = await base.t.mutation(backfill, { cursor: null })
  expect(first).toMatchObject({ processed: 7, isDone: false })
  const second = await base.t.mutation(backfill, { cursor: first.cursor })
  expect(second).toMatchObject({ processed: 3, isDone: true })
  expect([...first.orphanedReferencedMapIds, ...second.orphanedReferencedMapIds]).toContain(
    orphan.id
  )
  const result = await base.t.run((ctx) => ctx.db.query('mediaAssets').collect())
  expect(result).toEqual(
    before.map((asset) =>
      asset.profile === 'VTT_MAP'
        ? {
            ...asset,
            hasSceneReferences: [definitionMap.id, liveMap.id, orphan.id].includes(asset.id)
          }
        : asset
    )
  )
})
