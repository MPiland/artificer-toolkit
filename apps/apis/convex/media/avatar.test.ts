// @vitest-environment node
import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test'
import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { convexTest } from '../../tests/convexTest'
import { register } from '@convex-dev/r2/test'
import { register as registerRetrier } from '@convex-dev/action-retrier/test'
import sharp from 'sharp'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { MediaProcessClaim } from '@artificer-toolkit/schema/api/mediaAssets'
import schema from '../schema'
import type { TableNames } from '../_generated/dataModel'
import authSchema from '../betterAuth/schema'
import { api, components, internal } from '../_generated/api'
import {
  advanceAccountDeletionToProvider,
  assertAccountDeletionRetired,
  drainScheduledWork
} from '../../tests/fixtures/accountDeletion'
import { startLocalR2 } from '../../tests/localR2'

let t = convexTest(schema, import.meta.glob('/apps/apis/convex/**/*.*s'))
let server: Awaited<ReturnType<typeof startLocalR2>>
const crop = { x: 0, y: 0, width: 2 / 3, height: 1 }
const upload = (declaredBytes = 1000) => ({
  originalFileName: 'avatar.png',
  declaredMimeType: 'image/png' as const,
  declaredBytes,
  idempotencyKey: crypto.randomUUID()
})

beforeEach(async () => {
  server = await startLocalR2()
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  vi.stubEnv('MEDIA_STORAGE_MODE', 'local')
  vi.stubEnv('CONVEX_SITE_URL', 'http://127.0.0.1:3221')
  // The account deletion's ACCOUNT step deletes the provider user through the configured auth.
  vi.stubEnv('SITE_URL', 'http://localhost:3000')
  vi.stubEnv('BETTER_AUTH_SECRET', 'avatar-account-deletion-test-secret-with-sufficient-length')
  vi.stubEnv('LOCAL_R2_ENDPOINT', server.endpoint)
  t = convexTest(schema, import.meta.glob('/apps/apis/convex/**/*.*s'))
  t.registerComponent('betterAuth', authSchema, import.meta.glob('../betterAuth/**/*.*s'))
  registerRateLimiter(t)
  register(t)
  registerRetrier(t, 'r2/actionRetrier')
})
afterEach(async () => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  await server.close()
})

async function actor() {
  const user = await t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'Avatar test',
          email: `${crypto.randomUUID()}@example.invalid`,
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      },
      onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
    })
  )
  const session = await t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: {
          userId: user._id,
          token: crypto.randomUUID(),
          expiresAt: Date.now() + 3 * 86_400_000,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
  )
  const client = t.withIdentity({ subject: user._id, sessionId: session._id })
  const identity = await client.query(api.account.identity, {})
  return { client, user, session, identity }
}
async function put(url: string, body: Buffer) {
  expect(
    (
      await fetch(url, {
        method: 'PUT',
        body: new Uint8Array(body),
        headers: { 'content-type': 'image/png' }
      })
    ).status
  ).toBe(200)
}
async function picture() {
  return sharp({ create: { width: 600, height: 400, channels: 3, background: '#ac4f29' } })
    .png()
    .toBuffer()
}
function outputs(claim: MediaProcessClaim) {
  if (claim.kind !== 'PROCESS') throw new Error('Expected a processing claim.')
  return claim.operation.outputs.map((output) => ({
    ...output,
    byteSize: 1000,
    width: 320,
    height: 320,
    mimeType: 'image/webp' as const
  }))
}

it('uploads, crops, reads, replays, recrops and removes the owner avatar with real loopback bytes', async () => {
  const owner = await actor()
  const foreign = await actor()
  await expect(t.query(api.media.assets.avatar, {})).rejects.toThrow('Unauthenticated')
  await expect(
    t.action(api.media.avatarActions.getAvatarImage, { variantKind: 'THUMBNAIL' })
  ).rejects.toThrow('Unauthenticated')
  const image = await picture()
  const input = upload(image.byteLength)
  const intent = await owner.client.mutation(api.media.assets.createAvatarUpload, input)
  expect(
    (
      await owner.client.mutation(api.media.assets.createAvatarUpload, {
        idempotencyKey: input.idempotencyKey,
        declaredBytes: input.declaredBytes,
        declaredMimeType: input.declaredMimeType,
        originalFileName: input.originalFileName
      })
    ).assetId
  ).toBe(intent.assetId)
  await expect(
    owner.client.mutation(api.media.assets.createAvatarUpload, { ...input, declaredBytes: 2000 })
  ).rejects.toThrow('already been used')
  expect(new URL(intent.url).searchParams.get('X-Amz-SignedHeaders')).toContain('content-length')
  expect(
    (
      await fetch(intent.url, {
        method: 'PUT',
        body: new Uint8Array(image.byteLength + 1),
        headers: { 'content-type': 'image/png' }
      })
    ).status
  ).toBe(403)
  expect(server.objects.size).toBe(0)
  await put(intent.url, image)
  expect(
    await owner.client.action(api.media.avatarActions.saveAvatar, { assetId: intent.assetId, crop })
  ).toEqual({ assetId: intent.assetId, revision: 1 })
  const delivery = await owner.client.action(api.media.avatarActions.getAvatarImage, {
    variantKind: 'THUMBNAIL'
  })
  expect(delivery).toMatchObject({
    assetId: intent.assetId,
    width: 320,
    height: 320,
    mimeType: 'image/webp',
    crop
  })
  const bytes = Buffer.from(await (await fetch(delivery!.url)).arrayBuffer())
  expect(await sharp(bytes).metadata()).toMatchObject({ width: 320, height: 320, format: 'webp' })
  expect(
    await foreign.client.action(api.media.avatarActions.getAvatarImage, {
      variantKind: 'THUMBNAIL'
    })
  ).toBeNull()
  await expect(
    foreign.client.action(api.media.avatarActions.saveAvatar, { assetId: intent.assetId, crop })
  ).rejects.toThrow('unavailable')
  const writes = server.methods.filter((method) => method === 'PUT').length
  expect(
    await owner.client.action(api.media.avatarActions.saveAvatar, {
      assetId: intent.assetId,
      crop: { height: 1, width: 2 / 3, y: 0, x: 0 }
    })
  ).toEqual({ assetId: intent.assetId, revision: 1 })
  expect(server.methods.filter((method) => method === 'PUT')).toHaveLength(writes)
  const original = await owner.client.action(api.media.avatarActions.getAvatarImage, {
    variantKind: 'SOURCE'
  })
  expect(
    await owner.client.action(api.media.avatarActions.saveAvatar, {
      assetId: intent.assetId,
      crop: { ...crop, x: 1 / 3 }
    })
  ).toEqual({ assetId: intent.assetId, revision: 2 })
  const recropped = await owner.client.action(api.media.avatarActions.getAvatarImage, {
    variantKind: 'SOURCE'
  })
  expect(new URL(recropped!.url).pathname).toBe(new URL(original!.url).pathname)
  expect(await owner.client.mutation(api.media.assets.removeAvatar, {})).toEqual({
    assetId: null,
    revision: 3
  })
  expect(await owner.client.query(api.media.assets.avatar, {})).toEqual({
    assetId: null,
    revision: 3
  })
  expect(server.objects.size).toBeGreaterThan(0)
  await t.finishAllScheduledFunctions(vi.runAllTimers)
  expect(server.objects.size).toBe(0)
}, 20_000)

it('enforces quota atomically and rejects client identity or storage-key injection', async () => {
  const owner = await actor()
  await t.run(async (ctx) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', owner.identity.userId))
      .unique()
    await ctx.db.patch(profile!._id, { mediaBytes: 250 * 1024 * 1024 })
  })
  await expect(
    owner.client.mutation(api.media.assets.createAvatarUpload, upload())
  ).rejects.toThrow('storage limit')
  await expect(
    owner.client.mutation(api.media.assets.createAvatarUpload, {
      ...upload(),
      ...{ userId: crypto.randomUUID(), objectKey: 'other/image' }
    })
  ).rejects.toThrow()
  expect(
    await t.run((ctx) =>
      ctx.db
        .query('mediaAssets')
        .withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', owner.identity.userId))
        .take(1)
    )
  ).toEqual([])
})

it('rejects forged processing outputs, competing avatar updates, and revoked-session settlement', async () => {
  const owner = await actor()
  const first = await owner.client.mutation(api.media.assets.createAvatarUpload, upload())
  const second = await owner.client.mutation(api.media.assets.createAvatarUpload, upload())
  const one = await owner.client.mutation(internal.media.assets.beginSave, {
    assetId: first.assetId,
    crop
  })
  const two = await owner.client.mutation(internal.media.assets.beginSave, {
    assetId: second.assetId,
    crop
  })
  if (one.kind !== 'PROCESS' || two.kind !== 'PROCESS')
    throw new Error('Expected processing claims.')
  await expect(
    owner.client.mutation(internal.media.assets.beginSave, { assetId: first.assetId, crop })
  ).rejects.toThrow('still running')
  await expect(
    owner.client.mutation(internal.media.imageSaves.finish, {
      assetId: first.assetId,
      operationId: one.operation.id,
      variants: outputs(one).map((item) => ({ ...item, objectKey: 'forged' })),
      contentHash: 'a'.repeat(64)
    })
  ).rejects.toThrow('mismatch')
  await owner.client.mutation(internal.media.imageSaves.finish, {
    assetId: first.assetId,
    operationId: one.operation.id,
    variants: outputs(one),
    contentHash: 'a'.repeat(64)
  })
  await expect(
    owner.client.mutation(internal.media.imageSaves.finish, {
      assetId: second.assetId,
      operationId: two.operation.id,
      variants: outputs(two),
      contentHash: 'b'.repeat(64)
    })
  ).rejects.toThrow('changed during processing')
  expect(await owner.client.query(api.media.assets.avatar, {})).toEqual({
    assetId: first.assetId,
    revision: 1
  })
  await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.deleteOne, {
      input: { model: 'session', where: [{ field: '_id', value: owner.session._id }] }
    })
  )
  await expect(
    owner.client.mutation(internal.media.imageSaves.finish, {
      assetId: second.assetId,
      operationId: two.operation.id,
      variants: outputs(two),
      contentHash: 'b'.repeat(64)
    })
  ).rejects.toThrow('Unauthenticated')
})

it('leaves the current avatar intact on invalid bytes and releases failed-upload storage', async () => {
  const owner = await actor()
  const image = await picture()
  const first = await owner.client.mutation(
    api.media.assets.createAvatarUpload,
    upload(image.byteLength)
  )
  await put(first.url, image)
  await owner.client.action(api.media.avatarActions.saveAvatar, { assetId: first.assetId, crop })
  const invalidBytes = Buffer.from('not an image')
  const invalid = await owner.client.mutation(
    api.media.assets.createAvatarUpload,
    upload(invalidBytes.byteLength)
  )
  await put(invalid.url, invalidBytes)
  await expect(
    owner.client.action(api.media.avatarActions.saveAvatar, { assetId: invalid.assetId, crop })
  ).rejects.toThrow('decoded')
  const failed = await t.run((ctx) =>
    ctx.db
      .query('mediaAssets')
      .withIndex('by_publicId', (q) => q.eq('id', invalid.assetId))
      .unique()
  )
  expect(failed?.operation?.expiresAt).toBeGreaterThanOrEqual(Date.now() + 14 * 60_000)
  expect(await owner.client.query(api.media.assets.avatar, {})).toEqual({
    assetId: first.assetId,
    revision: 1
  })
  await t.finishAllScheduledFunctions(vi.runAllTimers)
  expect(server.objects.size).toBe(3)
  const stored = await t.run(async (ctx) => ({
    profile: await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', owner.identity.userId))
      .unique(),
    asset: await ctx.db
      .query('mediaAssets')
      .withIndex('by_publicId', (q) => q.eq('id', first.assetId))
      .unique()
  }))
  expect(stored.profile?.mediaBytes).toBe(stored.asset?.chargedBytes)
}, 20_000)

it('cleans pending and ready keys after account deletion, without touching another owner', async () => {
  const owner = await actor()
  const foreign = await actor()
  const image = await picture()
  const ready = await owner.client.mutation(
    api.media.assets.createAvatarUpload,
    upload(image.byteLength)
  )
  await put(ready.url, image)
  await owner.client.action(api.media.avatarActions.saveAvatar, { assetId: ready.assetId, crop })
  const pending = await owner.client.mutation(
    api.media.assets.createAvatarUpload,
    upload(image.byteLength)
  )
  const foreignIntent = await foreign.client.mutation(
    api.media.assets.createAvatarUpload,
    upload(image.byteLength)
  )
  await put(foreignIntent.url, image)
  await foreign.client.action(api.media.avatarActions.saveAvatar, {
    assetId: foreignIntent.assetId,
    crop
  })
  await t.mutation(internal.accountDeletion.schedule, { authUserId: owner.user._id })
  // An already issued PUT may arrive after deletion starts; its exact key is retained by cleanup.
  await put(pending.url, image)
  await drainScheduledWork(t)
  await assertAccountDeletionRetired(t, owner.user._id)
  expect(
    await t.run((ctx) =>
      ctx.db
        .query('mediaAssets')
        .withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', owner.identity.userId))
        .take(1)
    )
  ).toEqual([])
  expect(server.objects.size).toBe(3)
  expect(await foreign.client.query(api.media.assets.avatar, {})).toEqual({
    assetId: foreignIntent.assetId,
    revision: 1
  })
}, 20_000)

it('converges identically when every deferred account cleanup reruns', async () => {
  const owner = await actor()
  const image = await picture()
  const ready = await owner.client.mutation(
    api.media.assets.createAvatarUpload,
    upload(image.byteLength)
  )
  await put(ready.url, image)
  await owner.client.action(api.media.avatarActions.saveAvatar, { assetId: ready.assetId, crop })
  const pending = await owner.client.mutation(
    api.media.assets.createAvatarUpload,
    upload(image.byteLength)
  )
  await put(pending.url, image)
  const scheduledBefore = await advanceAccountDeletionToProvider(
    t,
    owner.user._id,
    owner.identity.userId
  )
  await t.mutation(internal.auth.onDelete, { model: 'user', doc: { _id: owner.user._id } })
  const scheduledSinceProvider = async (before: ReadonlySet<string>) =>
    (await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())).filter(
      (job) => !before.has(job._id)
    )
  // The provider delete schedules only the purge, which schedules the per-module account cleanups.
  const [purge, ...unexpected] = await scheduledSinceProvider(scheduledBefore)
  expect(unexpected).toEqual([])
  expect(purge?.name).toBe('accountDeletionFinish:purge')
  const scheduledBeforePurge = new Set([...scheduledBefore, purge!._id])
  await t.mutation(internal.accountDeletionFinish.purge, purge!.args[0])
  const cleanups = await scheduledSinceProvider(scheduledBeforePurge)
  expect(cleanups.map((job) => job.name).sort()).toEqual([
    'media/assets:purgeAccount',
    'notifications/delivery:purgeRecipient',
    'social/accountCleanup:run'
  ])
  const converged = async () => {
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    return {
      app: await t.run(async (ctx) =>
        Object.fromEntries(
          await Promise.all(
            (Object.keys(schema.tables) as TableNames[]).map(async (name) => [
              name,
              await ctx.db.query(name).collect()
            ])
          )
        )
      ),
      objects: [...server.objects.keys()].sort()
    }
  }
  const first = await converged()
  expect(first.app.mediaAssets).toEqual([])
  for (const job of [purge!, ...cleanups])
    await t.mutation(
      makeFunctionReference<'mutation', Record<string, unknown>, null>(job.name),
      job.args[0]
    )
  expect(await converged()).toEqual(first)
}, 20_000)

it('retains deletion obligations beyond four failed attempts and recovers after R2 returns', async () => {
  const key = `pending/${crypto.randomUUID()}`
  server.objects.set(key, {
    body: Buffer.from('private'),
    contentType: 'text/plain',
    modified: new Date()
  })
  server.faults.rejectDeletes = true
  await t.mutation(internal.media.assets.deleteObjects, { keys: [key] })
  for (let attempt = 0; attempt < 6; attempt++) {
    await vi.advanceTimersByTimeAsync(attempt ? 15 * 60_000 : 0)
    await t.finishInProgressScheduledFunctions()
  }
  expect(server.methods.filter((method) => method === 'DELETE').length).toBeGreaterThanOrEqual(5)
  expect(server.objects.has(key)).toBe(true)
  const scheduled = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())
  expect(
    scheduled.some((job) => job.state.kind === 'pending' && JSON.stringify(job.args).includes(key))
  ).toBe(true)
  server.faults.rejectDeletes = false
  await t.finishAllScheduledFunctions(vi.runAllTimers)
  expect(server.objects.has(key)).toBe(false)
}, 20_000)
