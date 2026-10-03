import migrations from '@convex-dev/migrations/test'
import { register } from '@convex-dev/r2/test'
import { register as registerRetrier } from '@convex-dev/action-retrier/test'
import { defineSchema, makeFunctionReference, type WithoutSystemFields } from 'convex/server'
import { convexTest } from '../../tests/convexTest'
import { expect, it, vi } from 'vitest'
import { mediaStoredAssetSchema } from '@artificer-toolkit/schema/api/mediaAssets'
import { vttMapStoredAssetSchema } from '@artificer-toolkit/schema/projections/vttMapPersistence'
import type { Doc, TableNames } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'
import { startLocalR2 } from '../../tests/localR2'

const runMediaMigrations = makeFunctionReference<'mutation', Record<string, never>, unknown>(
  'media/migrations:run'
)
// Development rows predate the narrow schema, so the legacy store must accept removed fields.
const legacySchema = defineSchema(schema.tables, { schemaValidation: false })

/** Rows written before the Q17 amendment carry fields the narrow data model no longer types. */
function insertLegacy<T extends TableNames>(ctx: MutationCtx, table: T, row: object) {
  return ctx.db.insert(table, row as WithoutSystemFields<Doc<T>>)
}

const owner = crypto.randomUUID()
const campaignId = crypto.randomUUID()
const crop = { x: 0.25, y: 0, width: 0.5, height: 1 }

function webp(id: string, kinds: string[] = ['SOURCE', 'DISPLAY', 'THUMBNAIL']) {
  return kinds.map((kind) => ({
    kind,
    objectKey: `ready/${id}/${kind.toLowerCase()}.webp`,
    byteSize: 1,
    width: kind === 'THUMBNAIL' ? 320 : 600,
    height: kind === 'THUMBNAIL' ? 320 : 400,
    mimeType: 'image/webp'
  }))
}

function legacyAsset(id: string, fields: Record<string, unknown>) {
  return {
    id,
    ownerUserId: owner,
    upload: {
      originalFileName: 'art.png',
      declaredMimeType: 'image/png',
      declaredBytes: 10,
      idempotencyKey: crypto.randomUUID()
    },
    status: 'READY',
    rawObjectKey: null,
    uploadExpiresAt: 0,
    chargedBytes: 3,
    variants: webp(id),
    crop: null,
    operation: null,
    cleanupAt: null,
    ...fields
  }
}

it('moves crops onto references and rewrites every asset as an owner-scoped asset of its class', async ({
  onTestFinished
}) => {
  const server = await startLocalR2()
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  vi.stubEnv('MEDIA_STORAGE_MODE', 'local')
  vi.stubEnv('CONVEX_SITE_URL', 'http://127.0.0.1:3221')
  vi.stubEnv('LOCAL_R2_ENDPOINT', server.endpoint)
  onTestFinished(async () => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllEnvs()
    await server.close()
  })
  const t = convexTest(legacySchema, import.meta.glob('/apps/apis/convex/**/*.*s'))
  migrations.register(t)
  // Failed legacy processing retires its claimed outputs through the real deletion path.
  register(t)
  registerRetrier(t, 'r2/actionRetrier')
  const ids = {
    avatar: crypto.randomUUID(),
    portrait: crypto.randomUUID(),
    artwork: crypto.randomUUID(),
    uncropped: crypto.randomUUID(),
    text: crypto.randomUUID(),
    handout: crypto.randomUUID(),
    map: crypto.randomUUID(),
    processing: crypto.randomUUID()
  }
  const rows = await t.run(async (ctx) => {
    await insertLegacy(
      ctx,
      'mediaAssets',
      legacyAsset(ids.avatar, { profile: 'ACCOUNT_AVATAR', crop })
    )
    await insertLegacy(
      ctx,
      'mediaAssets',
      legacyAsset(ids.portrait, {
        profile: 'CHARACTER_PORTRAIT',
        characterTarget: { type: 'CHARACTER_PORTRAIT', characterId: crypto.randomUUID() },
        crop
      })
    )
    await insertLegacy(
      ctx,
      'mediaAssets',
      legacyAsset(ids.artwork, {
        profile: 'AUTHORED_IMAGE',
        authoredTarget: {
          type: 'AUTHORED_IMAGE',
          subjectKind: 'BACKGROUND',
          subjectId: crypto.randomUUID()
        },
        copiedFromAssetId: crypto.randomUUID(),
        crop
      })
    )
    // A reference whose legacy asset lost its crop falls back to the centered square.
    await insertLegacy(
      ctx,
      'mediaAssets',
      legacyAsset(ids.uncropped, { profile: 'AUTHORED_IMAGE', crop: null })
    )
    await insertLegacy(
      ctx,
      'mediaAssets',
      legacyAsset(ids.text, {
        profile: 'CAMPAIGN_FILE',
        campaignId,
        retainedFromUserId: crypto.randomUUID(),
        upload: {
          originalFileName: 'notes.txt',
          declaredMimeType: 'text/plain',
          declaredBytes: 5,
          idempotencyKey: crypto.randomUUID()
        },
        variants: [
          {
            kind: 'SOURCE',
            objectKey: `ready/${ids.text}/source.txt`,
            byteSize: 5,
            width: null,
            height: null,
            mimeType: 'text/plain'
          }
        ]
      })
    )
    await insertLegacy(
      ctx,
      'mediaAssets',
      legacyAsset(ids.handout, { profile: 'CAMPAIGN_HANDOUT_MAP', campaignId })
    )
    await insertLegacy(
      ctx,
      'mediaAssets',
      legacyAsset(ids.map, {
        profile: 'VTT_MAP',
        campaignId,
        hasSceneReferences: true,
        width: 600,
        height: 400,
        variants: webp(ids.map, ['DISPLAY', 'THUMBNAIL'])
      })
    )
    await insertLegacy(
      ctx,
      'mediaAssets',
      legacyAsset(ids.processing, {
        profile: 'ACCOUNT_AVATAR',
        status: 'PROCESSING',
        rawObjectKey: `pending/${ids.processing}/raw`,
        variants: [],
        operation: {
          id: crypto.randomUUID(),
          kind: 'INITIAL',
          crop,
          expectedAvatarRevision: 0,
          expiresAt: Date.now() + 60_000,
          outputs: [{ kind: 'SOURCE', objectKey: `ready/${ids.processing}/op/source.webp` }]
        }
      })
    )
    const profile = await insertLegacy(ctx, 'userProfiles', {
      userId: owner,
      authUserId: 'legacy-auth-user',
      bio: null,
      avatarAssetId: ids.avatar,
      avatarRevision: 1,
      mediaBytes: 100,
      entitlementUsage: {},
      entitlementUsageReady: true,
      autoRollDice: true,
      gmRollVisibility: 'PUBLIC'
    })
    const character = await insertLegacy(ctx, 'characters', {
      id: crypto.randomUUID(),
      userId: owner,
      portraitAssetId: ids.portrait,
      portraitRevision: 1
    })
    const slot = await insertLegacy(ctx, 'authoredImageSlots', {
      subjectKind: 'BACKGROUND',
      subjectId: crypto.randomUUID(),
      scope: 'DRAFT',
      assetId: ids.artwork,
      revision: 1
    })
    const fallbackSlot = await insertLegacy(ctx, 'authoredImageSlots', {
      subjectKind: 'BACKGROUND',
      subjectId: crypto.randomUUID(),
      scope: 'ACTIVE',
      assetId: ids.uncropped,
      revision: 1
    })
    const emptySlot = await insertLegacy(ctx, 'authoredImageSlots', {
      subjectKind: 'BACKGROUND',
      subjectId: crypto.randomUUID(),
      scope: 'ACTIVE',
      assetId: null,
      revision: 2
    })
    return { profile, character, slot, fallbackSlot, emptySlot }
  })

  await t.mutation(runMediaMigrations, {})
  await t.finishAllScheduledFunctions(vi.runAllTimers)
  // A second pass proves every migration is idempotent on narrowed rows.
  await t.mutation(runMediaMigrations, {})
  await t.finishAllScheduledFunctions(vi.runAllTimers)

  const migrated = await t.run(async (ctx) => ({
    profile: await ctx.db.get(rows.profile),
    character: await ctx.db.get(rows.character),
    slot: await ctx.db.get(rows.slot),
    fallbackSlot: await ctx.db.get(rows.fallbackSlot),
    emptySlot: await ctx.db.get(rows.emptySlot),
    assets: await ctx.db.query('mediaAssets').take(16)
  }))
  expect(migrated.profile).toMatchObject({ avatarAssetId: ids.avatar, avatarCrop: crop })
  expect(migrated.character).toMatchObject({ portraitAssetId: ids.portrait, portraitCrop: crop })
  expect(migrated.slot).toMatchObject({ assetId: ids.artwork, crop })
  expect(migrated.fallbackSlot).toMatchObject({
    assetId: ids.uncropped,
    crop: { x: 100 / 600, y: 0, width: 400 / 600, height: 1 }
  })
  expect(migrated.emptySlot).toMatchObject({ assetId: null, crop: null })

  const byId = new Map(migrated.assets.map(({ _id, _creationTime, ...row }) => [row.id, row]))
  for (const [id, profileClass] of [
    [ids.avatar, 'CONTENT_ART'],
    [ids.portrait, 'CONTENT_ART'],
    [ids.artwork, 'CONTENT_ART'],
    [ids.uncropped, 'CONTENT_ART'],
    [ids.text, 'TEXT_FILE'],
    [ids.handout, 'HANDOUT_MAP']
  ] as const) {
    const asset = byId.get(id)
    expect(mediaStoredAssetSchema.parse(asset)).toMatchObject({
      id,
      ownerUserId: owner,
      storageAssetId: id,
      profileClass,
      contentHash: null,
      cropThumbnails: []
    })
  }
  expect(vttMapStoredAssetSchema.parse(byId.get(ids.map))).toMatchObject({
    profileClass: 'VTT_MAP',
    storageAssetId: ids.map,
    hasSceneReferences: true,
    width: 600,
    height: 400
  })
  // Legacy content art keeps its stored thumbnail; each slot's framing regenerates from SOURCE.
  expect(byId.get(ids.avatar)?.variants).toEqual(webp(ids.avatar))
  // In-flight processing fails closed and retires through normal cleanup.
  expect(byId.get(ids.processing)).toMatchObject({
    profileClass: 'CONTENT_ART',
    status: 'DELETED',
    operation: null
  })
})
