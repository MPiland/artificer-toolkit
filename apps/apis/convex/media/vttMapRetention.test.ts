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
import { createPartyPlayer } from '../../tests/fixtures/partyPlayer'
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

function map(ownerUserId: string, overrides: Record<string, unknown> = {}) {
  const id = crypto.randomUUID()
  return vttMapStoredAssetSchema.parse({
    id,
    ownerUserId,
    storageAssetId: id,
    profileClass: 'VTT_MAP',
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
    contentHash: null,
    width: 100,
    height: 100,
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

function file(ownerUserId: string, overrides: Record<string, unknown> = {}) {
  const id = crypto.randomUUID()
  return mediaStoredAssetSchema.parse({
    id,
    ownerUserId,
    storageAssetId: id,
    profileClass: 'TEXT_FILE',
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
    contentHash: null,
    cropThumbnails: [],
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

async function readAsset(base: Awaited<ReturnType<typeof setup>>, id: string) {
  return base.t.run((ctx) =>
    ctx.db
      .query('mediaAssets')
      .withIndex('by_publicId', (q) => q.eq('id', id))
      .unique()
  )
}

async function readProfile(base: Awaited<ReturnType<typeof setup>>, userId: string) {
  return base.t.run((ctx) =>
    ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
  )
}

async function deleteAccount(base: Awaited<ReturnType<typeof setup>>, userId: string) {
  const profile = await readProfile(base, userId)
  if (!profile) throw new Error('Missing uploader profile.')
  await base.t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.deleteOne, {
      input: { model: 'user', where: [{ field: '_id', value: profile.authUserId }] },
      onDeleteHandle: await createFunctionHandle(internal.auth.onDelete)
    })
  )
  return profile
}

it.each([true, undefined])(
  'moves a deleted uploader’s referenced READY map to a Campaign-owner copy with %s metadata',
  async (hasSceneReferences) => {
    const base = await setup()
    const asset = map(base.other.userId, { hasSceneReferences })
    await base.t.run((ctx) => ctx.db.insert('mediaAssets', asset))
    await referenceMap(base, asset.id, 'definition')
    const profile = await deleteAccount(base, base.other.userId)
    const definitions = await base.t.run((ctx) => ctx.db.query('sceneDefinitions').take(8))
    expect(definitions).toHaveLength(1)
    const copyId = definitions[0]!.map.assetId
    expect(copyId).not.toBe(asset.id)
    expect(await readProfile(base, base.other.userId)).toBeNull()
    expect(await readAsset(base, copyId)).toMatchObject({
      ownerUserId: base.owner.userId,
      storageAssetId: asset.id,
      hasSceneReferences: true,
      variants: asset.variants
    })
    // The departing user's own asset is never handed to the GM.
    expect(await readAsset(base, asset.id)).toMatchObject({ ownerUserId: base.other.userId })
    await expect(base.owner.caller.query(readDelivery, { assetId: copyId })).resolves.toMatchObject(
      { id: copyId, ownerUserId: base.owner.userId }
    )
    await expect(base.other.caller.query(readDelivery, { assetId: copyId })).rejects.toThrow()
    expect(profile.userId).toBe(base.other.userId)

    // Purging the departed account retires its row but keeps the stored objects the copy shares.
    const scheduledBefore = await base.t.run((ctx) =>
      ctx.db.system.query('_scheduled_functions').collect()
    )
    await base.t.mutation(internal.media.assets.purgeAccount, { userId: base.other.userId })
    expect(await readAsset(base, asset.id)).toBeNull()
    const scheduled = (
      await base.t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())
    ).filter((job) => !scheduledBefore.some((prior) => prior._id === job._id))
    for (const variant of asset.variants)
      expect(JSON.stringify(scheduled.map((job) => job.args))).not.toContain(variant.objectKey)
  }
)

it.each([true, undefined])(
  'charges the Campaign owner once for a retained map copy with %s metadata and a fresh command key',
  async (hasSceneReferences) => {
    const base = await setup()
    const sharedKey = crypto.randomUUID()
    const retained = map(base.other.userId, {
      hasSceneReferences,
      upload: {
        originalFileName: 'map.png',
        declaredMimeType: 'image/png',
        declaredBytes: 1,
        idempotencyKey: sharedKey
      }
    })
    const collision = map(base.owner.userId, {
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
    // Two Scenes in one Campaign share a single owner copy.
    await referenceMap(base, retained.id, 'definition')
    await referenceMap(base, retained.id, 'live')
    const before = {
      retained: await readAsset(base, retained.id),
      source: await readProfile(base, base.other.userId),
      owner: await readProfile(base, base.owner.userId)
    }
    await base.t.run((ctx) => retainAccountCampaignMedia(ctx, base.other.userId))
    const references = await base.t.run(async (ctx) => [
      ...(await ctx.db.query('sceneDefinitions').take(8)),
      ...(await ctx.db.query('campaignScenes').take(8))
    ])
    const copyIds = new Set(references.map((row) => row.map.assetId))
    expect(copyIds.size).toBe(1)
    const [copyId] = [...copyIds]
    const copy = await readAsset(base, copyId!)
    expect(copy).toMatchObject({
      ownerUserId: base.owner.userId,
      storageAssetId: retained.id,
      hasSceneReferences: true,
      rawObjectKey: null,
      variants: before.retained!.variants
    })
    expect(copy!.upload.idempotencyKey).not.toBe(sharedKey)
    expect(await readAsset(base, retained.id)).toEqual(before.retained)
    expect(await readProfile(base, base.other.userId)).toEqual(before.source)
    expect((await readProfile(base, base.owner.userId))!.mediaBytes).toBe(
      (before.owner!.mediaBytes ?? 0) + retained.chargedBytes
    )
  }
)

it('allows retention over quota and rolls an outer account-deletion transaction back exactly', async () => {
  const base = await setup()
  const asset = map(base.other.userId, { hasSceneReferences: false })
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
      assets: await ctx.db.query('mediaAssets').take(8),
      profiles: await ctx.db.query('userProfiles').take(8),
      definitions: await ctx.db.query('sceneDefinitions').take(8),
      scenes: await ctx.db.query('campaignScenes').take(8)
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
  expect((await readProfile(base, base.owner.userId))!.mediaBytes).toBe(
    ENTITLEMENT_LIMITS.FREE.storageBytes + asset.chargedBytes
  )
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

it.each(['TEXT_FILE', 'HANDOUT_MAP'] as const)(
  'moves a public Campaign attachment to an owner copy through uploader deletion, keeping attribution: %s',
  async (profileClass) => {
    const base = await setup()
    const asset = file(
      base.other.userId,
      profileClass === 'TEXT_FILE'
        ? {}
        : {
            profileClass,
            upload: {
              originalFileName: 'map.png',
              declaredMimeType: 'image/png',
              declaredBytes: 1,
              idempotencyKey: crypto.randomUUID()
            },
            variants: [
              {
                kind: 'SOURCE',
                objectKey: `ready/${crypto.randomUUID()}/source.webp`,
                byteSize: 1,
                width: 100,
                height: 100,
                mimeType: 'image/webp'
              }
            ],
            chargedBytes: 1
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
        assets: await ctx.db.query('mediaAssets').take(8),
        attachments: await ctx.db.query('campaignAttachments').take(8),
        profiles: await ctx.db.query('userProfiles').take(8)
      }))
    const beforeRollback = await snapshot()
    await expect(
      base.t.run(async (ctx) => {
        await retainAccountCampaignMedia(ctx, base.other.userId)
        throw new Error('late attachment rollback')
      })
    ).rejects.toThrow('late attachment rollback')
    expect(await snapshot()).toEqual(beforeRollback)
    await deleteAccount(base, base.other.userId)
    const stored = await base.t.run((ctx) =>
      ctx.db
        .query('campaignAttachments')
        .withIndex('by_campaignId_id', (q) =>
          q.eq('campaignId', base.campaign.id).eq('id', attachment.id)
        )
        .unique()
    )
    if (!stored) throw new Error('Missing retained attachment.')
    const { _id: _attachmentId, _creationTime: _attachmentCreated, ...storedFields } = stored
    const { uploaderLabel: _uploaderLabel, ...originalFields } = attachment
    // Only the asset moves; the departed uploader stays the attachment's author.
    expect(storedFields).toEqual({ ...originalFields, assetId: storedFields.assetId })
    expect(storedFields.assetId).not.toBe(asset.id)
    expect(await readAsset(base, storedFields.assetId)).toMatchObject({
      ownerUserId: base.owner.userId,
      storageAssetId: asset.id,
      profileClass,
      variants: asset.variants
    })
    expect(await readProfile(base, base.other.userId)).toBeNull()
    expect((await readProfile(base, base.owner.userId))!.mediaBytes).toBe(
      (beforeRollback.profiles.find((profile) => profile.userId === base.owner.userId)
        ?.mediaBytes ?? 0) + asset.chargedBytes
    )
    await expect(
      base.owner.caller.query(readAttachmentDelivery, {
        campaignId: base.campaign.id,
        attachmentId: attachment.id
      })
    ).resolves.toMatchObject({
      assetId: storedFields.assetId,
      objectKey: asset.variants[0]!.objectKey
    })
    await expect(
      base.other.caller.query(readAttachmentDelivery, {
        campaignId: base.campaign.id,
        attachmentId: attachment.id
      })
    ).rejects.toThrow()
  }
)

it('copies one asset once per Campaign owner and never retains personal references', async () => {
  const base = await setup()
  const departing = await createPartyPlayer(base.t, base.campaign)
  const elsewhere = await base.other.caller.mutation(createCampaign, {
    name: 'Second table',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const art = file(departing.userId, {
    profileClass: 'CONTENT_ART',
    upload: {
      originalFileName: 'art.png',
      declaredMimeType: 'image/png',
      declaredBytes: 1,
      idempotencyKey: crypto.randomUUID()
    },
    variants: [
      {
        kind: 'SOURCE',
        objectKey: `ready/${crypto.randomUUID()}/source.webp`,
        byteSize: 2,
        width: 100,
        height: 100,
        mimeType: 'image/webp'
      }
    ],
    chargedBytes: 2
  })
  await base.t.run(async (ctx) => {
    await ctx.db.insert('mediaAssets', art)
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', departing.userId))
      .unique()
    // The same image is also the departing user's avatar: a personal reference.
    await ctx.db.patch(profile!._id, {
      avatarAssetId: art.id,
      avatarCrop: { x: 0, y: 0, width: 1, height: 1 }
    })
    for (const campaignId of [base.campaign.id, elsewhere.id])
      await ctx.db.insert('campaignAttachments', {
        id: crypto.randomUUID(),
        campaignId,
        assetId: art.id,
        uploaderUserId: departing.userId,
        profile: 'CAMPAIGN_FILE',
        displayName: 'Shared art',
        description: null,
        sessionId: null,
        noteSectionId: null,
        createdAt: new Date().toISOString()
      })
  })
  await base.t.run((ctx) => retainAccountCampaignMedia(ctx, departing.userId))
  const attachments = await base.t.run((ctx) => ctx.db.query('campaignAttachments').take(8))
  const copies = await Promise.all(attachments.map((row) => readAsset(base, row.assetId)))
  expect(copies.map((copy) => copy?.ownerUserId).sort()).toEqual(
    [base.owner.userId, base.other.userId].sort()
  )
  expect(new Set(copies.map((copy) => copy?.id)).size).toBe(2)
  for (const copy of copies)
    expect(copy).toMatchObject({ storageAssetId: art.id, cropThumbnails: [], chargedBytes: 2 })
  // The original stays the departing user's, still only their avatar.
  expect(await readAsset(base, art.id)).toMatchObject({ ownerUserId: departing.userId })
  expect((await readProfile(base, departing.userId))?.avatarAssetId).toBe(art.id)
})

it('blocks a saved-before-deletion publication and Campaign-owner delivery after uploader deletion', async () => {
  const base = await setup()
  const asset = map(base.other.userId, { hasSceneReferences: false })
  await base.t.run((ctx) => ctx.db.insert('mediaAssets', asset))
  await referenceMap(base, asset.id, 'definition')
  // A GM may start a save with a map the Campaign already references, even another user's.
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
  await deleteAccount(base, base.other.userId)
  // Retention moved the Campaign's reference to a copy; the save still names the original.
  await expect(base.owner.caller.mutation(publishScene, { saveId: save.saveId })).rejects.toThrow(
    'Scene map is unavailable.'
  )
  await expect(base.owner.caller.query(readDelivery, { assetId: asset.id })).rejects.toThrow(
    'Scene map is unavailable.'
  )
})

it('keeps uploader storage ownership across Campaign transfer while delivery follows the Campaign references', async () => {
  const base = await setup()
  const asset = map(base.owner.userId, { hasSceneReferences: true })
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
  // Before any Scene uses it, only its uploader reads the map.
  await expect(base.other.caller.query(readDelivery, { assetId: asset.id })).rejects.toThrow()
  await referenceMap(base, asset.id, 'definition')
  await expect(base.other.caller.query(readDelivery, { assetId: asset.id })).resolves.toMatchObject(
    { id: asset.id, ownerUserId: base.owner.userId }
  )
  // The uploader keeps reading their own image after handing the Campaign over.
  await expect(base.owner.caller.query(readDelivery, { assetId: asset.id })).resolves.toMatchObject(
    { id: asset.id }
  )
  expect(await readProfile(base, base.owner.userId)).toMatchObject({ mediaBytes: 3 })
})

it('backfills definition-only and live-only references without changing retained media metadata', async () => {
  const base = await setup()
  const definitionMap = map(base.owner.userId)
  const liveMap = map(base.owner.userId)
  const staleMap = map(base.owner.userId, { hasSceneReferences: true })
  const terminalMap = map(base.owner.userId, {
    status: 'DELETED',
    rawObjectKey: null,
    variants: [],
    chargedBytes: 0,
    cleanupAt: null
  })
  const unrelatedId = crypto.randomUUID()
  const unrelated = mediaStoredAssetSchema.parse({
    id: unrelatedId,
    ownerUserId: base.owner.userId,
    storageAssetId: unrelatedId,
    profileClass: 'CONTENT_ART',
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
    contentHash: null,
    variants: [],
    cropThumbnails: [],
    operation: null,
    cleanupAt: 456
  })
  const filler = Array.from({ length: 5 }, () => map(base.owner.userId))
  const orphan = map(crypto.randomUUID())
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
  const before = await base.t.run((ctx) => ctx.db.query('mediaAssets').take(16))
  const first = await base.t.mutation(backfill, { cursor: null })
  expect(first).toMatchObject({ processed: 7, isDone: false })
  const second = await base.t.mutation(backfill, { cursor: first.cursor })
  expect(second).toMatchObject({ processed: 3, isDone: true })
  expect([...first.orphanedReferencedMapIds, ...second.orphanedReferencedMapIds]).toContain(
    orphan.id
  )
  const result = await base.t.run((ctx) => ctx.db.query('mediaAssets').take(16))
  expect(result).toEqual(
    before.map((asset) =>
      asset.profileClass === 'VTT_MAP'
        ? {
            ...asset,
            hasSceneReferences: [definitionMap.id, liveMap.id, orphan.id].includes(asset.id)
          }
        : asset
    )
  )
})
