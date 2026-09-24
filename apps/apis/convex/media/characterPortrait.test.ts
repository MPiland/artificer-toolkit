// @vitest-environment node
import { register } from '@convex-dev/r2/test'
import { register as registerRetrier } from '@convex-dev/action-retrier/test'
import sharp from 'sharp'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api, internal } from '../_generated/api'
import { startLocalR2 } from '../../tests/localR2'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'

let server: Awaited<ReturnType<typeof startLocalR2>>
const crop = { x: 0, y: 0, width: 2 / 3, height: 1 }

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

async function picture() {
  return sharp({
    create: { width: 600, height: 400, channels: 3, background: '#ac4f29' }
  })
    .png()
    .toBuffer()
}

it.each(['remove', 'purge'] as const)(
  'preserves owner-only portrait lifecycle and retires bytes through %s',
  async (retirement) => {
    const base = await readyCharacterFixture()
    register(base.t)
    registerRetrier(base.t, 'r2/actionRetrier')
    const first = await base.createCharacter()
    await base.owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: first.draft.id,
      mode: 'create',
      character: first.character
    })
    const target = {
      type: 'CHARACTER_PORTRAIT' as const,
      characterId: first.character.id
    }
    const image = await picture()
    const upload = (declaredBytes = image.byteLength) => ({
      target,
      originalFileName: 'portrait.png',
      declaredMimeType: 'image/png' as const,
      declaredBytes,
      idempotencyKey: crypto.randomUUID()
    })
    await expect(
      base.other.caller.mutation(api.media.characterPortraitAssets.createUpload, upload())
    ).rejects.toThrow('unavailable')
    const firstUpload = upload()
    const firstIntent = await base.owner.caller.mutation(
      api.media.characterPortraitAssets.createUpload,
      firstUpload
    )
    expect(
      await base.owner.caller.mutation(api.media.characterPortraitAssets.createUpload, firstUpload)
    ).toMatchObject({ assetId: firstIntent.assetId })
    await expect(
      base.owner.caller.mutation(api.media.assets.createAvatarUpload, {
        originalFileName: firstUpload.originalFileName,
        declaredMimeType: firstUpload.declaredMimeType,
        declaredBytes: firstUpload.declaredBytes,
        idempotencyKey: firstUpload.idempotencyKey
      })
    ).rejects.toThrow('already been used')
    expect(
      (
        await fetch(firstIntent.url, {
          method: 'PUT',
          body: new Uint8Array(image),
          headers: { 'content-type': 'image/png' }
        })
      ).status
    ).toBe(200)
    await base.owner.caller.action(api.media.characterPortraitActions.save, {
      assetId: firstIntent.assetId,
      crop,
      target
    })
    expect(
      await base.owner.caller.query(api.media.characterPortraitAssets.bindingForCharacter, target)
    ).toEqual({ assetId: firstIntent.assetId, revision: 1 })
    const delivery = await base.owner.caller.action(api.media.characterPortraitActions.getImage, {
      target,
      variantKind: 'THUMBNAIL'
    })
    expect(delivery).toMatchObject({
      assetId: firstIntent.assetId,
      variantKind: 'THUMBNAIL',
      width: 320,
      height: 320,
      mimeType: 'image/webp'
    })
    const deliveredBytes = Buffer.from(await (await fetch(delivery!.url)).arrayBuffer())
    expect(await sharp(deliveredBytes).metadata()).toMatchObject({
      width: 320,
      height: 320,
      format: 'webp'
    })
    await base.owner.caller.action(api.media.characterPortraitActions.save, {
      assetId: firstIntent.assetId,
      target,
      crop: { ...crop, x: 1 / 3 }
    })
    expect(
      await base.owner.caller.query(api.media.characterPortraitAssets.bindingForCharacter, target)
    ).toEqual({ assetId: firstIntent.assetId, revision: 2 })
    const secondIntent = await base.owner.caller.mutation(
      api.media.characterPortraitAssets.createUpload,
      upload()
    )
    const thirdIntent = await base.owner.caller.mutation(
      api.media.characterPortraitAssets.createUpload,
      upload()
    )
    const firstClaim = await base.owner.caller.mutation(
      internal.media.characterPortraitAssets.beginSave,
      { assetId: secondIntent.assetId, crop, target }
    )
    const secondClaim = await base.owner.caller.mutation(
      internal.media.characterPortraitAssets.beginSave,
      { assetId: thirdIntent.assetId, crop, target }
    )
    if (firstClaim.kind !== 'PROCESS' || secondClaim.kind !== 'PROCESS')
      throw new Error('Missing portrait claims')
    const outputs = (claim: typeof firstClaim) =>
      claim.operation.outputs.map((output) => ({
        ...output,
        byteSize: 1000,
        width: 320,
        height: 320,
        mimeType: 'image/webp' as const
      }))
    await base.owner.caller.mutation(internal.media.characterPortraitAssets.finishSave, {
      assetId: secondIntent.assetId,
      operationId: firstClaim.operation.id,
      variants: outputs(firstClaim)
    })
    await expect(
      base.owner.caller.mutation(internal.media.characterPortraitAssets.finishSave, {
        assetId: thirdIntent.assetId,
        operationId: secondClaim.operation.id,
        variants: outputs(secondClaim)
      })
    ).rejects.toThrow('changed during processing')
    expect(
      await base.owner.caller.query(api.media.characterPortraitAssets.bindingForCharacter, target)
    ).toEqual({ assetId: secondIntent.assetId, revision: 3 })
    expect(
      await base.other.caller.query(api.media.characterPortraitAssets.bindingForCharacter, target)
    ).toEqual({ assetId: null, revision: 0 })
    expect(
      await base.other.caller.action(api.media.characterPortraitActions.getImage, {
        target,
        variantKind: 'THUMBNAIL'
      })
    ).toBeNull()
    const edit = await base.owner.caller.mutation(api.characters.drafts.create, {
      id: first.character.id,
      systemId: first.character.systemId
    })
    await base.owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: edit.id,
      mode: 'edit',
      character: first.character
    })
    expect(
      await base.owner.caller.query(api.media.characterPortraitAssets.bindingForCharacter, target)
    ).toEqual({ assetId: secondIntent.assetId, revision: 3 })
    const invalidBytes = Buffer.from('not an image')
    const invalidIntent = await base.owner.caller.mutation(
      api.media.characterPortraitAssets.createUpload,
      upload(invalidBytes.byteLength)
    )
    expect(
      (
        await fetch(invalidIntent.url, {
          method: 'PUT',
          body: invalidBytes,
          headers: { 'content-type': 'image/png' }
        })
      ).status
    ).toBe(200)
    await expect(
      base.owner.caller.action(api.media.characterPortraitActions.save, {
        assetId: invalidIntent.assetId,
        crop,
        target
      })
    ).rejects.toThrow('decoded')
    expect(
      await base.owner.caller.query(api.media.characterPortraitAssets.bindingForCharacter, target)
    ).toEqual({ assetId: secondIntent.assetId, revision: 3 })
    await base.t.run(async (ctx) => {
      const active = await ctx.db
        .query('mediaAssets')
        .withIndex('by_publicId', (q) => q.eq('id', secondIntent.assetId))
        .unique()
      if (!active) throw new Error('Missing active portrait')
      await ctx.db.patch(active._id, { cleanupAt: Date.now() })
    })
    await base.t.mutation(internal.media.assets.cleanup, {
      assetId: secondIntent.assetId
    })
    expect(
      await base.owner.caller.query(api.media.characterPortraitAssets.bindingForCharacter, target)
    ).toEqual({ assetId: secondIntent.assetId, revision: 3 })
    if (retirement === 'remove') {
      expect(
        await base.owner.caller.mutation(api.media.characterPortraitAssets.remove, { target })
      ).toEqual({ assetId: null, revision: 4 })
      expect(
        await base.owner.caller.action(api.media.characterPortraitActions.getImage, {
          target,
          variantKind: 'THUMBNAIL'
        })
      ).toBeNull()
    } else {
      await base.t.mutation(internal.media.assets.purgeAccount, { userId: base.owner.userId })
      expect(
        await base.owner.caller.query(api.media.characterPortraitAssets.bindingForCharacter, target)
      ).toEqual({ assetId: secondIntent.assetId, revision: 3 })
      await base.t.run(async (ctx) => {
        const profile = await ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
          .unique()
        if (!profile) throw new Error('Missing owner profile')
        await ctx.db.delete(profile._id)
      })
      await base.t.mutation(internal.media.assets.purgeAccount, { userId: base.owner.userId })
      await base.t.run(async (ctx) => {
        const character = await ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', target.characterId))
          .unique()
        expect(character?.portraitAssetId).toBeUndefined()
        expect(character?.portraitRevision).toBe(4)
        expect(
          await ctx.db
            .query('userProfiles')
            .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
            .unique()
        ).not.toBeNull()
      })
    }
    await base.t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(server.objects.size).toBe(0)
  },
  60_000
)
