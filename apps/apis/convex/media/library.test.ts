// @vitest-environment node
import { register } from '@convex-dev/r2/test'
import { register as registerRetrier } from '@convex-dev/action-retrier/test'
import sharp from 'sharp'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { api, components, internal } from '../_generated/api'
import { startLocalR2 } from '../../tests/localR2'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'

let server: Awaited<ReturnType<typeof startLocalR2>>
const avatarCrop = { x: 0, y: 0, width: 2 / 3, height: 1 }
const portraitCrop = { x: 1 / 3, y: 0, width: 2 / 3, height: 1 }

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

/** A 600×400 image whose left and right thirds differ, so distinct crops give distinct bytes. */
async function picture(seed = 0) {
  const pixels = Buffer.alloc(600 * 400 * 3)
  for (let i = 0; i < pixels.length; i++)
    pixels[i] = (i * 31 + Math.floor(i / 257) * 17 + seed) % 256
  return sharp(pixels, { raw: { width: 600, height: 400, channels: 3 } })
    .png()
    .toBuffer()
}

async function setup() {
  const base = await readyCharacterFixture()
  register(base.t)
  registerRetrier(base.t, 'r2/actionRetrier')
  await base.t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.updateMany, {
      input: { model: 'session', update: { expiresAt: Date.now() + 3 * 86_400_000 } },
      paginationOpts: { cursor: null, numItems: 10 }
    })
  )
  const created = await base.createCharacter()
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: created.draft.id,
    mode: 'create',
    character: created.character
  })
  const portrait = { type: 'CHARACTER_PORTRAIT' as const, characterId: created.character.id }
  type Caller = typeof base.owner.caller
  const put = async (url: string, body: Buffer) =>
    expect(
      (
        await fetch(url, {
          method: 'PUT',
          body: new Uint8Array(body),
          headers: { 'content-type': 'image/png' }
        })
      ).status
    ).toBe(200)
  const metadata = (body: Buffer) => ({
    originalFileName: 'art.png',
    declaredMimeType: 'image/png' as const,
    declaredBytes: body.byteLength,
    idempotencyKey: crypto.randomUUID()
  })
  const saveAvatar = async (caller: Caller, body: Buffer, crop = avatarCrop) => {
    const intent = await caller.mutation(api.media.assets.createAvatarUpload, metadata(body))
    await put(intent.url, body)
    return {
      intent,
      binding: await caller.action(api.media.avatarActions.saveAvatar, {
        assetId: intent.assetId,
        crop
      })
    }
  }
  const savePortrait = async (body: Buffer) => {
    const intent = await base.owner.caller.mutation(
      api.media.characterPortraitAssets.createUpload,
      { ...metadata(body), target: portrait }
    )
    await put(intent.url, body)
    return {
      intent,
      binding: await base.owner.caller.action(api.media.characterPortraitActions.save, {
        assetId: intent.assetId,
        crop: portraitCrop,
        target: portrait
      })
    }
  }
  const readAsset = (id: string) =>
    base.t.run((ctx) =>
      ctx.db
        .query('mediaAssets')
        .withIndex('by_publicId', (q) => q.eq('id', id))
        .unique()
    )
  const mediaBytes = async (userId: string) =>
    (
      await base.t.run((ctx) =>
        ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', userId))
          .unique()
      )
    )?.mediaBytes ?? 0
  return { ...base, portrait, saveAvatar, savePortrait, readAsset, mediaBytes }
}

it('reuses the same owner’s identical image within its class and charges it once', async () => {
  const base = await setup()
  const image = await picture()
  const avatar = await base.saveAvatar(base.owner.caller, image)
  const assetId = avatar.binding.assetId!
  const charged = (await base.readAsset(assetId))!.chargedBytes
  expect(await base.mediaBytes(base.owner.userId)).toBe(charged)

  // A portrait upload of the same image resolves to the existing asset and binds straight to the Character.
  const portraitUpload = await base.savePortrait(image)
  expect(portraitUpload.binding).toEqual({ assetId, revision: 1 })
  expect(await base.readAsset(portraitUpload.intent.assetId)).toMatchObject({
    status: 'DELETED',
    chargedBytes: 0,
    variants: []
  })
  expect(await base.mediaBytes(base.owner.userId)).toBe(charged)

  // Another owner never matches: the same image is charged to them separately.
  const foreign = await base.saveAvatar(base.other.caller, image)
  expect(foreign.binding.assetId).toBe(foreign.intent.assetId)
  expect(await base.readAsset(foreign.intent.assetId)).toMatchObject({
    ownerUserId: base.other.userId,
    contentHash: (await base.readAsset(assetId))!.contentHash
  })
  expect(await base.mediaBytes(base.owner.userId)).toBe(charged)

  await base.t.finishAllScheduledFunctions(vi.runAllTimers)
  const keys = [...server.objects.keys()]
  expect(keys.some((key) => key.includes(portraitUpload.intent.assetId))).toBe(false)
}, 60_000)

it('frames each reference on its own and prunes framing no slot uses', async () => {
  const base = await setup()
  const { binding } = await base.saveAvatar(base.owner.caller, await picture(7))
  const assetId = binding.assetId!
  const charged = (await base.readAsset(assetId))!.chargedBytes
  expect(
    await base.owner.caller.mutation(api.media.library.attachImage, {
      target: base.portrait,
      assetId,
      crop: portraitCrop
    })
  ).toEqual({ assetId, revision: 1 })
  const thumbnail = async () => ({
    avatar: (await base.owner.caller.action(api.media.avatarActions.getAvatarImage, {
      variantKind: 'THUMBNAIL'
    }))!,
    portrait: (await base.owner.caller.action(api.media.characterPortraitActions.getImage, {
      target: base.portrait,
      variantKind: 'THUMBNAIL'
    }))!
  })
  const first = await thumbnail()
  expect(first.avatar).toMatchObject({ assetId, crop: avatarCrop, width: 320, height: 320 })
  expect(first.portrait).toMatchObject({ assetId, crop: portraitCrop, width: 320, height: 320 })
  const bytes = async (url: string) => Buffer.from(await (await fetch(url)).arrayBuffer())
  const portraitBytes = await bytes(first.portrait.url)
  expect(portraitBytes.equals(await bytes(first.avatar.url))).toBe(false)
  const framings = async () => {
    const stored = await base.readAsset(assetId)
    if (stored?.profileClass !== 'CONTENT_ART') throw new Error('Missing content art.')
    return stored.cropThumbnails
  }
  const firstFramings = await framings()
  expect(firstFramings.map((thumbnail) => thumbnail.crop)).toEqual([avatarCrop, portraitCrop])
  // Derived framing is not charged: the asset still counts once.
  expect(await base.mediaBytes(base.owner.userId)).toBe(charged)

  // Recropping the avatar never changes the portrait's framing.
  expect(
    await base.owner.caller.mutation(api.media.library.attachImage, {
      target: { type: 'ACCOUNT_AVATAR' },
      assetId,
      crop: { x: 0.1, y: 0, width: 0.5, height: 0.75 }
    })
  ).toEqual({ assetId, revision: 2 })
  await base.t.finishAllScheduledFunctions(vi.runAllTimers)
  const second = await thumbnail()
  expect(new URL(second.portrait.url).pathname).toBe(new URL(first.portrait.url).pathname)
  expect((await bytes(second.portrait.url)).equals(portraitBytes)).toBe(true)
  expect(second.avatar.crop).toEqual({ x: 0.1, y: 0, width: 0.5, height: 0.75 })
  // The avatar's former framing was pruned once no slot used it.
  const secondFramings = await framings()
  expect(secondFramings.map((thumbnail) => thumbnail.crop)).toEqual([
    portraitCrop,
    { x: 0.1, y: 0, width: 0.5, height: 0.75 }
  ])
  expect(server.objects.has(firstFramings[0]!.variant.objectKey)).toBe(false)
  expect(server.objects.has(firstFramings[1]!.variant.objectKey)).toBe(true)
}, 60_000)

it('attaches only the caller’s own ready content art, under each slot’s own write rules', async () => {
  const base = await setup()
  const { binding } = await base.saveAvatar(base.owner.caller, await picture(3))
  const assetId = binding.assetId!
  const pending = await base.owner.caller.mutation(api.media.assets.createAvatarUpload, {
    originalFileName: 'pending.png',
    declaredMimeType: 'image/png',
    declaredBytes: 10,
    idempotencyKey: crypto.randomUUID()
  })
  const ownerDraft = await base.owner.caller.mutation(api.content.drafts.duplicate, {
    subjectKind: 'BACKGROUND',
    subjectId: acolyte.id
  })
  const otherDraft = await base.other.caller.mutation(api.content.drafts.duplicate, {
    subjectKind: 'BACKGROUND',
    subjectId: acolyte.id
  })
  const artwork = (draft: typeof ownerDraft) => ({
    type: 'AUTHORED_IMAGE' as const,
    subjectKind: draft.subjectKind,
    subjectId: draft.subjectId
  })
  const crop = { x: 0, y: 0, width: 0.5, height: 0.75 }
  const denied = [
    // Another user's image, even into the caller's own slots.
    [base.other.caller, { type: 'ACCOUNT_AVATAR' as const }, assetId, 'Image is unavailable.'],
    [base.other.caller, artwork(otherDraft), assetId, 'Image is unavailable.'],
    // The slot's own rules: another user's Character or draft.
    [base.other.caller, base.portrait, assetId, 'Character is unavailable.'],
    [base.owner.caller, artwork(otherDraft), assetId, 'Save an owned draft'],
    // Only READY content art fills an image slot.
    [base.owner.caller, base.portrait, pending.assetId, 'Image is unavailable.']
  ] as const
  for (const [caller, target, id, message] of denied)
    await expect(
      caller.mutation(api.media.library.attachImage, { target, assetId: id, crop })
    ).rejects.toThrow(message)
  expect(
    await base.owner.caller.mutation(api.media.library.attachImage, {
      target: artwork(ownerDraft),
      assetId,
      crop
    })
  ).toEqual({ assetId, revision: 1 })
}, 60_000)

it('lists only the caller’s ready images of one class, newest first, and previews them owner-only', async () => {
  const base = await setup()
  const older = await base.saveAvatar(base.owner.caller, await picture(11))
  vi.advanceTimersByTime(1000)
  const newer = await base.savePortrait(await picture(12))
  const foreign = await base.saveAvatar(base.other.caller, await picture(14))
  await base.owner.caller.mutation(api.media.assets.createAvatarUpload, {
    originalFileName: 'pending.png',
    declaredMimeType: 'image/png',
    declaredBytes: 10,
    idempotencyKey: crypto.randomUUID()
  })
  const list = (caller: typeof base.owner.caller) =>
    caller.query(api.media.library.list, {
      profileClass: 'CONTENT_ART',
      paginationOpts: { cursor: null, numItems: 10 }
    })
  const contentArt = await list(base.owner.caller)
  expect(contentArt.page.map((item) => item.assetId)).toEqual([
    newer.binding.assetId,
    older.binding.assetId
  ])
  expect(contentArt.page[0]).toMatchObject({
    profileClass: 'CONTENT_ART',
    originalFileName: 'art.png',
    width: 600,
    height: 400
  })
  expect((await list(base.other.caller)).page.map((item) => item.assetId)).toEqual([
    foreign.binding.assetId
  ])
  const firstPage = await base.owner.caller.query(api.media.library.list, {
    profileClass: 'CONTENT_ART',
    paginationOpts: { cursor: null, numItems: 1 }
  })
  expect(firstPage.page).toHaveLength(1)
  expect(firstPage.isDone).toBe(false)
  await expect(
    base.t.query(api.media.library.list, {
      profileClass: 'CONTENT_ART',
      paginationOpts: { cursor: null, numItems: 1 }
    })
  ).rejects.toThrow('Unauthenticated')

  const preview = await base.owner.caller.action(api.media.libraryActions.getImage, {
    assetId: newer.intent.assetId,
    variantKind: 'THUMBNAIL'
  })
  expect(preview).toMatchObject({
    assetId: newer.intent.assetId,
    crop: null,
    width: 320,
    height: 213
  })
  await expect(
    base.other.caller.action(api.media.libraryActions.getImage, {
      assetId: newer.intent.assetId,
      variantKind: 'THUMBNAIL'
    })
  ).rejects.toThrow('unavailable')
}, 60_000)

it('keeps a shared asset while any reference remains, then retires it once after grace', async () => {
  const base = await setup()
  const { binding } = await base.saveAvatar(base.owner.caller, await picture(21))
  const assetId = binding.assetId!
  const before = (await base.readAsset(assetId))!
  await base.owner.caller.mutation(api.media.library.attachImage, {
    target: base.portrait,
    assetId,
    crop: portraitCrop
  })
  await base.owner.caller.action(api.media.characterPortraitActions.getImage, {
    target: base.portrait,
    variantKind: 'THUMBNAIL'
  })
  const settle = () => base.t.mutation(internal.media.assets.cleanup, { assetId })

  await base.owner.caller.mutation(api.media.assets.removeAvatar, {})
  await settle()
  expect(await base.readAsset(assetId)).toMatchObject({ status: 'READY', cleanupAt: null })
  await base.owner.caller.mutation(api.media.characterPortraitAssets.remove, {
    target: base.portrait
  })
  // Past the last commit, so the next mutation's clock is the one this test reads.
  vi.setSystemTime(Date.now() + 1_000)
  await settle()
  const graced = (await base.readAsset(assetId))!
  expect(graced.cleanupAt).toBe(Date.now() + 24 * 60 * 60_000)
  expect(await base.mediaBytes(base.owner.userId)).toBe(before.chargedBytes)
  await base.t.finishAllScheduledFunctions(vi.runAllTimers)
  expect(await base.readAsset(assetId)).toMatchObject({ status: 'DELETED', chargedBytes: 0 })
  expect(await base.mediaBytes(base.owner.userId)).toBe(0)
  for (const variant of before.variants) expect(server.objects.has(variant.objectKey)).toBe(false)
}, 60_000)
