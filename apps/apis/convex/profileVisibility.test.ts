// @vitest-environment node
import { register as registerRateLimiter } from '@convex-dev/rate-limiter/test'
import { createFunctionHandle } from 'convex/server'
import { convexTest } from '../tests/convexTest'
import { register } from '@convex-dev/r2/test'
import { register as registerRetrier } from '@convex-dev/action-retrier/test'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import schema from './schema'
import authSchema from './betterAuth/schema'
import { api, components, internal } from './_generated/api'
import { startLocalR2 } from '../tests/localR2'

process.env.SITE_URL = 'http://localhost:3000'
process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough'

let t = convexTest(schema, import.meta.glob('./**/*.*s'))
let server: Awaited<ReturnType<typeof startLocalR2>>

beforeEach(async () => {
  server = await startLocalR2()
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  vi.stubEnv('MEDIA_STORAGE_MODE', 'local')
  vi.stubEnv('CONVEX_SITE_URL', 'http://127.0.0.1:3221')
  vi.stubEnv('LOCAL_R2_ENDPOINT', server.endpoint)
  t = convexTest(schema, import.meta.glob('./**/*.*s'))
  t.registerComponent('betterAuth', authSchema, import.meta.glob('./betterAuth/**/*.*s'))
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

async function account(username: string, bio: string) {
  const user = await t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'Visibility test',
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
  await client.mutation(api.account.updateProfile, { username, bio })
  return { client, user }
}

async function saveAvatar(owner: Awaited<ReturnType<typeof account>>) {
  const image = await sharp({
    create: { width: 600, height: 400, channels: 3, background: '#ac4f29' }
  })
    .png()
    .toBuffer()
  const intent = await owner.client.mutation(api.media.assets.createAvatarUpload, {
    originalFileName: 'avatar.png',
    declaredMimeType: 'image/png',
    declaredBytes: image.byteLength,
    idempotencyKey: crypto.randomUUID()
  })
  const response = await fetch(intent.url, {
    method: 'PUT',
    body: new Uint8Array(image),
    headers: { 'content-type': 'image/png' }
  })
  expect(response.status).toBe(200)
  await owner.client.action(api.media.avatarActions.saveAvatar, {
    assetId: intent.assetId,
    crop: { x: 0, y: 0, width: 2 / 3, height: 1 }
  })
  return intent.assetId
}

describe('profile visibility', () => {
  it('keeps a new profile private from other accounts while the owner always sees it', async () => {
    const owner = await account('RiverScout', 'Ranger of the north')
    const viewer = await account('ForestScout', 'Someone else')

    expect(await owner.client.query(api.account.profile, {})).toMatchObject({
      visibility: 'PRIVATE'
    })
    expect(
      await viewer.client.query(api.account.publicProfile, { username: 'RiverScout' })
    ).toBeNull()
    expect(await owner.client.query(api.account.publicProfile, { username: 'RiverScout' })).toEqual(
      { username: 'RiverScout', bio: 'Ranger of the north', avatarRevision: null }
    )
  })

  it('shows only username, bio and avatar revision while Public and hides it again when Private', async () => {
    const owner = await account('RiverScout', 'Ranger of the north')
    const viewer = await account('ForestScout', 'Someone else')

    await owner.client.mutation(api.account.setProfileVisibility, { visibility: 'PUBLIC' })
    expect(await owner.client.query(api.account.profile, {})).toMatchObject({
      visibility: 'PUBLIC'
    })
    const expected = { username: 'RiverScout', bio: 'Ranger of the north', avatarRevision: null }
    expect(
      await viewer.client.query(api.account.publicProfile, { username: 'RiverScout' })
    ).toEqual(expected)
    expect(
      await viewer.client.query(api.account.publicProfile, { username: 'riverscout' })
    ).toEqual(expected)

    await owner.client.mutation(api.account.setProfileVisibility, { visibility: 'PRIVATE' })
    expect(
      await viewer.client.query(api.account.publicProfile, { username: 'RiverScout' })
    ).toBeNull()
  })

  it('returns the same null for unknown, banned and private targets and rejects anonymous callers', async () => {
    const owner = await account('RiverScout', 'Ranger of the north')
    const viewer = await account('ForestScout', 'Someone else')
    await owner.client.mutation(api.account.setProfileVisibility, { visibility: 'PUBLIC' })

    expect(
      await viewer.client.query(api.account.publicProfile, { username: 'NobodyHere' })
    ).toBeNull()

    await t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: owner.user._id }],
          update: { banned: true }
        }
      })
    )
    expect(
      await viewer.client.query(api.account.publicProfile, { username: 'RiverScout' })
    ).toBeNull()

    await expect(t.query(api.account.publicProfile, { username: 'RiverScout' })).rejects.toThrow(
      'Unauthenticated'
    )
    await expect(
      t.mutation(api.account.setProfileVisibility, { visibility: 'PUBLIC' })
    ).rejects.toThrow('Unauthenticated')
  })

  it('rejects an unknown visibility and extra fields', async () => {
    const owner = await account('RiverScout', 'Ranger of the north')

    await expect(
      // @ts-expect-error Only PRIVATE and PUBLIC are valid visibilities.
      owner.client.mutation(api.account.setProfileVisibility, { visibility: 'FRIENDS' })
    ).rejects.toThrow()
    await expect(
      owner.client.mutation(api.account.setProfileVisibility, {
        visibility: 'PUBLIC',
        ...{ userId: crypto.randomUUID() }
      })
    ).rejects.toThrow()
    expect(await owner.client.query(api.account.profile, {})).toMatchObject({
      visibility: 'PRIVATE'
    })
  })

  it('delivers the avatar to other accounts only while the profile is Public', async () => {
    const owner = await account('RiverScout', 'Ranger of the north')
    const viewer = await account('ForestScout', 'Someone else')
    const assetId = await saveAvatar(owner)
    const request = { username: 'RiverScout', variantKind: 'THUMBNAIL' } as const

    expect(
      await viewer.client.action(api.media.avatarActions.getProfileAvatarImage, request)
    ).toBeNull()

    await owner.client.mutation(api.account.setProfileVisibility, { visibility: 'PUBLIC' })
    expect(
      await viewer.client.query(api.account.publicProfile, { username: 'RiverScout' })
    ).toEqual({
      username: 'RiverScout',
      bio: 'Ranger of the north',
      avatarRevision: 1
    })
    const delivery = await viewer.client.action(
      api.media.avatarActions.getProfileAvatarImage,
      request
    )
    expect(delivery).toMatchObject({ assetId, mimeType: 'image/webp' })
    const bytes = Buffer.from(await (await fetch(delivery!.url)).arrayBuffer())
    expect(await sharp(bytes).metadata()).toMatchObject({ format: 'webp' })

    await owner.client.mutation(api.account.setProfileVisibility, { visibility: 'PRIVATE' })
    expect(
      await viewer.client.action(api.media.avatarActions.getProfileAvatarImage, request)
    ).toBeNull()
    await expect(t.action(api.media.avatarActions.getProfileAvatarImage, request)).rejects.toThrow(
      'Unauthenticated'
    )
  }, 20_000)
})
