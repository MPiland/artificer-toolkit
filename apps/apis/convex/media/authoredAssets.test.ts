// @vitest-environment node
import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { convexTest } from '../../tests/convexTest'
import { register } from '@convex-dev/r2/test'
import { register as registerRetrier } from '@convex-dev/action-retrier/test'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { rowboat } from '@artificer-toolkit/source-data/srd/vehicles/rowboat.js'
import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import { fireball } from '@artificer-toolkit/source-data/srd/spells/fireball.js'
import { sorcerer } from '@artificer-toolkit/source-data/srd/classes/sorcerer.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { grappler } from '@artificer-toolkit/source-data/srd/feats/grappler.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  authoredPublishDraftInputSchema,
  type AuthoredDeleteActiveInput,
  type AuthoredPublishDraftInput,
  type AuthoredPublicationResult
} from '@artificer-toolkit/schema/api/authoredPublication'
import type { AuthoredDraftResult } from '@artificer-toolkit/schema/api/authoredDrafts'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { api, components, internal } from '../_generated/api'
import { cat as rawCat } from '@artificer-toolkit/source-data/srd/creatures/cat.js'
import { owl as rawOwl } from '@artificer-toolkit/source-data/srd/creatures/owl.js'
import schema from '../schema'
import authSchema from '../betterAuth/schema'
import { startLocalR2 } from '../../tests/localR2'
import { importedSubject } from '../../tests/fixtures/publication'
import { readImageSlot } from '../content/imageSlots'
import { srdCreatureRecord } from '../../tests/fixtures/srdCreatures'

const cat = srdCreatureRecord(rawCat.id)
const owl = srdCreatureRecord(rawOwl.id)

process.env.SITE_URL = 'http://localhost:3000'
process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough'

const modules = import.meta.glob('/apps/apis/convex/**/*.*s')
const crop = { x: 0, y: 0, width: 2 / 3, height: 1 }
const publish = makeFunctionReference<
  'mutation',
  AuthoredPublishDraftInput,
  AuthoredPublicationResult
>('content/publication:publishDraft')
const deleteActive = makeFunctionReference<'mutation', AuthoredDeleteActiveInput, null>(
  'content/deletion:deleteActive'
)
const equipmentIds = new Set([
  '00000000-0000-0000-0060-006000000000',
  '00000000-0000-0000-0060-00a500000000',
  '00000000-0000-0000-0060-016b00000000',
  '00000000-0000-0000-0060-016900000000',
  '00000000-0000-0000-0060-016a00000000',
  '00000000-0000-0000-0060-008300000000',
  '00000000-0000-0000-0060-009700000000'
])
let t = convexTest(schema, modules)
let server: Awaited<ReturnType<typeof startLocalR2>>

beforeEach(async () => {
  server = await startLocalR2()
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  vi.stubEnv('MEDIA_STORAGE_MODE', 'local')
  vi.stubEnv('CONVEX_SITE_URL', 'http://127.0.0.1:3221')
  vi.stubEnv('LOCAL_R2_ENDPOINT', server.endpoint)
  t = convexTest(schema, modules)
  t.registerComponent('betterAuth', authSchema, import.meta.glob('../betterAuth/**/*.*s'))
  register(t)
  registerRetrier(t, 'r2/actionRetrier')
  await t.mutation(internal.content.import.bootstrap, {
    systems: [
      {
        id: srdSystemRecord.id,
        document: jsonValueSchema.parse(srdSystemRecord),
        checksum: checksumRuleDocument(srdSystemRecord)
      }
    ],
    contentSource: SRD_CONTENT_SOURCE,
    catalogue: SRD_RULES_CATALOGUE
  })
  await t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({
        subjectKind: 'VEHICLE',
        ...rowboat,
        document: rowboat
      }),
      {
        subjectKind: 'BACKGROUND',
        id: acolyte.id,
        systemId: acolyte.systemId,
        label: acolyte.label,
        checksum: checksumRuleDocument(acolyte),
        document: jsonValueSchema.parse(acolyte)
      },
      ...srdBaselineContent.subjects.equipment
        .filter((item) => equipmentIds.has(item.id))
        .map((item) => ({
          subjectKind: 'EQUIPMENT' as const,
          id: item.id,
          systemId: item.systemId,
          label: item.label,
          checksum: checksumRuleDocument(item),
          document: jsonValueSchema.parse(item)
        }))
    ]
  })
})
afterEach(async () => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  await server.close()
})

async function actor(index: number) {
  const user = await t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'Author',
          email: `authored-${index}@example.invalid`,
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      },
      onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
    })
  )
  const session = await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: {
          userId: user._id,
          token: crypto.randomUUID(),
          expiresAt: Date.now() + 60_000,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
  )
  const client = t.withIdentity({ subject: user._id, sessionId: session._id })
  return {
    client,
    session,
    identity: await client.query(api.account.identity, {})
  }
}

async function draft(client: Awaited<ReturnType<typeof actor>>['client']) {
  return client.mutation(api.content.drafts.duplicate, {
    subjectKind: 'BACKGROUND',
    subjectId: acolyte.id
  })
}

function target(item: AuthoredDraftResult) {
  return {
    type: 'AUTHORED_IMAGE' as const,
    subjectKind: item.subjectKind,
    subjectId: item.subjectId
  }
}

async function picture(color = '#ac4f29') {
  const pixels = Buffer.alloc(600 * 400 * 3)
  for (let i = 0; i < pixels.length; i++)
    pixels[i] = (i * 31 + Math.floor(i / 257) * 17 + Number.parseInt(color.slice(1), 16)) % 256
  return sharp(pixels, { raw: { width: 600, height: 400, channels: 3 } })
    .png()
    .toBuffer()
}

async function uploadAndSave(
  client: Awaited<ReturnType<typeof actor>>['client'],
  item: AuthoredDraftResult,
  color?: string
) {
  const image = await picture(color)
  const intent = await client.mutation(api.media.authoredAssets.createUpload, {
    target: target(item),
    originalFileName: 'art.png',
    declaredMimeType: 'image/png',
    declaredBytes: image.byteLength,
    idempotencyKey: crypto.randomUUID()
  })
  expect(
    (
      await fetch(intent.url, {
        method: 'PUT',
        body: new Uint8Array(image),
        headers: { 'content-type': 'image/png' }
      })
    ).status
  ).toBe(200)
  return client.action(api.media.authoredActions.save, {
    target: target(item),
    assetId: intent.assetId,
    crop
  })
}

function publicationInput(item: AuthoredDraftResult) {
  return authoredPublishDraftInputSchema.parse({
    subjectKind: item.subjectKind,
    subjectId: item.subjectId,
    expectedDraftUpdatedAt: item.updatedAt
  })
}

describe('authored image media', () => {
  it('reads canonical Owl artwork bindings and keeps master artwork immutable', async () => {
    await t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject({ subjectKind: 'CREATURE', ...owl, document: owl })]
    })
    await t.run((ctx) =>
      ctx.db.insert('authoredImageSlots', {
        subjectId: owl.id,
        subjectKind: 'CREATURE',
        scope: 'ACTIVE',
        assetId: null,
        crop: null,
        revision: 7
      })
    )
    const owner = await actor(1)
    const target = {
      type: 'AUTHORED_IMAGE' as const,
      subjectKind: 'CREATURE' as const,
      subjectId: owl.id
    }
    expect(
      await owner.client.query(api.media.authoredAssets.binding, {
        ...target,
        scope: 'ACTIVE'
      })
    ).toEqual({
      assetId: null,
      revision: 7
    })
    expect(
      await owner.client.query(api.media.authoredAssets.binding, {
        ...target,
        subjectId: owl.id.toUpperCase(),
        scope: 'ACTIVE'
      })
    ).toEqual({ assetId: null, revision: 7 })
    expect(
      await owner.client.action(api.media.authoredActions.getImage, {
        target: { ...target, scope: 'ACTIVE' },
        variantKind: 'DISPLAY'
      })
    ).toBeNull()
    await expect(
      owner.client.mutation(api.media.authoredAssets.remove, { target })
    ).rejects.toThrow('Save an owned draft')
    expect(await t.run((ctx) => readImageSlot(ctx, owl.id, 'ACTIVE'))).toMatchObject({
      revision: 7
    })
  }, 40_000)

  it.each([
    { subjectKind: 'VEHICLE', subjectId: rowboat.id },
    { subjectKind: 'RACE', subjectId: human.id },
    { subjectKind: 'CREATURE', subjectId: cat.id },
    { subjectKind: 'SPELL', subjectId: fireball.id }
  ] as const)(
    'publishes $subjectKind artwork, isolates a working removal and denies foreign access',
    async (subject) => {
      if (subject.subjectKind === 'SPELL') {
        await t.mutation(internal.content.import.importSubjects, {
          contentSourceId: SRD_CONTENT_SOURCE.id,
          subjects: [
            importedSubject({
              subjectKind: 'SPELL',
              ...fireball,
              document: fireball
            }),
            importedSubject({
              subjectKind: 'CLASS',
              ...sorcerer,
              document: sorcerer
            }),
            importedSubject({
              subjectKind: 'CLASS',
              ...wizard,
              document: wizard
            })
          ]
        })
      }
      if (subject.subjectKind === 'CREATURE') {
        await t.mutation(internal.content.import.importSubjects, {
          contentSourceId: SRD_CONTENT_SOURCE.id,
          subjects: [importedSubject({ subjectKind: 'CREATURE', ...cat, document: cat })]
        })
      }
      if (subject.subjectKind === 'RACE') {
        const canonical = importedSubject({
          subjectKind: 'RACE',
          ...human,
          document: human
        })
        await t.mutation(internal.content.import.importSubjects, {
          contentSourceId: SRD_CONTENT_SOURCE.id,
          subjects: [canonical]
        })
        await t.mutation(internal.content.raceRelationships.syncDerived, {
          id: canonical.id,
          checksum: canonical.checksum
        })
      }
      const owner = await actor(1)
      const foreign = await actor(2)
      const first = await owner.client.mutation(api.content.drafts.duplicate, subject)
      const saved = await uploadAndSave(owner.client, first)
      const draftInput = {
        subjectKind: subject.subjectKind,
        subjectId: first.subjectId
      }
      const current = await owner.client.query(api.content.drafts.get, draftInput)
      if (!current) throw new Error('Missing authored draft')
      await owner.client.mutation(publish, publicationInput(current))
      const activeTarget = { ...target(first), scope: 'ACTIVE' as const }
      const active = await owner.client.action(api.media.authoredActions.getImage, {
        target: activeTarget,
        variantKind: 'THUMBNAIL'
      })
      expect(active?.assetId).toBe(saved.assetId)
      expect(
        await sharp(Buffer.from(await (await fetch(active!.url)).arrayBuffer())).metadata()
      ).toMatchObject({ width: 320, height: 320, format: 'webp' })
      for (const caller of [t, foreign.client]) {
        expect(
          await caller.action(api.media.authoredActions.getImage, {
            target: activeTarget,
            variantKind: 'SOURCE'
          })
        ).toBeNull()
        await expect(
          caller.mutation(api.media.authoredAssets.remove, {
            target: target(first)
          })
        ).rejects.toThrow()
      }
      await owner.client.mutation(api.content.drafts.save, {
        ...draftInput,
        systemId: first.systemId,
        label: first.label,
        payload: first.payload
      })
      await owner.client.mutation(api.media.authoredAssets.remove, {
        target: target(first)
      })
      expect(
        await owner.client.query(api.media.authoredAssets.binding, activeTarget)
      ).toMatchObject({
        assetId: saved.assetId
      })
      expect(
        await owner.client.query(api.media.authoredAssets.binding, {
          ...target(first),
          scope: 'DRAFT'
        })
      ).toMatchObject({ assetId: null })
      await owner.client.mutation(api.content.drafts.discard, draftInput)
      expect(
        await owner.client.query(api.media.authoredAssets.binding, activeTarget)
      ).toMatchObject({
        assetId: saved.assetId
      })
    },
    20_000
  )

  it.each([
    { subjectKind: 'BACKGROUND', subjectId: acolyte.id },
    { subjectKind: 'CLASS', subjectId: wizard.id },
    { subjectKind: 'EQUIPMENT', subjectId: '00000000-0000-0000-0060-006000000000' },
    { subjectKind: 'FEAT', subjectId: grappler.id },
    { subjectKind: 'RACE', subjectId: human.id },
    { subjectKind: 'CREATURE', subjectId: cat.id },
    { subjectKind: 'SPELL', subjectId: fireball.id },
    { subjectKind: 'VEHICLE', subjectId: rowboat.id }
  ] as const)(
    'binds a $subjectKind artwork upload to the owning caller and draft',
    async (subject) => {
      const race = importedSubject({ subjectKind: 'RACE', ...human, document: human })
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects: [
          importedSubject({ subjectKind: 'CLASS', ...sorcerer, document: sorcerer }),
          importedSubject({ subjectKind: 'CLASS', ...wizard, document: wizard }),
          importedSubject({ subjectKind: 'SPELL', ...fireball, document: fireball }),
          importedSubject({ subjectKind: 'FEAT', ...grappler, document: grappler }),
          importedSubject({ subjectKind: 'CREATURE', ...cat, document: cat }),
          race
        ]
      })
      await t.mutation(internal.content.raceRelationships.syncDerived, {
        id: race.id,
        checksum: race.checksum
      })
      const owner = await actor(1)
      const foreign = await actor(2)
      const item = await owner.client.mutation(api.content.drafts.duplicate, subject)
      const image = await picture()
      await expect(
        foreign.client.mutation(api.media.authoredAssets.createUpload, {
          target: target(item),
          originalFileName: 'art.png',
          declaredMimeType: 'image/png',
          declaredBytes: image.byteLength,
          idempotencyKey: crypto.randomUUID()
        })
      ).rejects.toThrow()
      const { assetId } = await uploadAndSave(owner.client, item)
      const draftTarget = { ...target(item), scope: 'DRAFT' as const }
      expect(
        await owner.client.query(api.media.authoredAssets.binding, draftTarget)
      ).toMatchObject({ assetId })
      const read = await owner.client.action(api.media.authoredActions.getImage, {
        target: draftTarget,
        variantKind: 'DISPLAY'
      })
      expect((await fetch(read!.url)).status).toBe(200)
      expect(
        await foreign.client.action(api.media.authoredActions.getImage, {
          target: draftTarget,
          variantKind: 'DISPLAY'
        })
      ).toBeNull()
    },
    20_000
  )

  it('uploads, saves, reads, and isolates draft artwork from active artwork', async () => {
    const owner = await actor(1)
    const foreign = await actor(2)
    const first = await draft(owner.client)
    const firstBinding = await uploadAndSave(owner.client, first)
    expect(firstBinding.revision).toBe(1)
    const draftImage = await owner.client.action(api.media.authoredActions.getImage, {
      target: { ...target(first), scope: 'DRAFT' },
      variantKind: 'THUMBNAIL'
    })
    expect(
      await sharp(Buffer.from(await (await fetch(draftImage!.url)).arrayBuffer())).metadata()
    ).toMatchObject({ width: 320, height: 320, format: 'webp' })
    for (const client of [t, foreign.client]) {
      expect(
        await client.action(api.media.authoredActions.getImage, {
          target: { ...target(first), scope: 'DRAFT' },
          variantKind: 'SOURCE'
        })
      ).toBeNull()
      expect(
        await client.query(api.media.authoredAssets.binding, {
          ...target(first),
          scope: 'DRAFT'
        })
      ).toEqual({ assetId: null, revision: 0 })
    }
    // The owner's artwork attaches to another of their drafts without a new upload.
    const otherDraft = await draft(owner.client)
    expect(
      await owner.client.action(api.media.authoredActions.save, {
        target: target(otherDraft),
        assetId: firstBinding.assetId!,
        crop
      })
    ).toEqual({ assetId: firstBinding.assetId, revision: 1 })
    await expect(
      foreign.client.mutation(api.media.authoredAssets.createUpload, {
        target: target(first),
        originalFileName: 'x.png',
        declaredMimeType: 'image/png',
        declaredBytes: 1,
        idempotencyKey: crypto.randomUUID()
      })
    ).rejects.toThrow('owned draft')
    await expect(
      owner.client.mutation(api.media.authoredAssets.createUpload, {
        target: { ...target(first), subjectId: crypto.randomUUID() },
        originalFileName: 'x.png',
        declaredMimeType: 'image/png',
        declaredBytes: 1,
        idempotencyKey: crypto.randomUUID()
      })
    ).rejects.toThrow('owned draft')
    await owner.client.mutation(
      publish,
      publicationInput(
        (await owner.client.query(api.content.drafts.get, {
          subjectKind: 'BACKGROUND',
          subjectId: first.subjectId
        })) as AuthoredDraftResult
      )
    )
    const active = await owner.client.action(api.media.authoredActions.getImage, {
      target: { ...target(first), scope: 'ACTIVE' },
      variantKind: 'THUMBNAIL'
    })
    const activeBytes = Buffer.from(await (await fetch(active!.url)).arrayBuffer())
    const edit = await owner.client.mutation(api.content.drafts.save, {
      subjectKind: 'BACKGROUND',
      subjectId: first.subjectId,
      systemId: first.systemId,
      label: first.label,
      payload: first.payload
    })
    const secondBinding = await uploadAndSave(owner.client, edit, '#1976d2')
    expect(secondBinding.assetId).not.toBe(firstBinding.assetId)
    const beforeCrop = await Promise.all(
      (['SOURCE', 'DISPLAY'] as const).map(async (variantKind) => {
        const image = await owner.client.action(api.media.authoredActions.getImage, {
          target: { ...target(edit), scope: 'DRAFT' },
          variantKind
        })
        return Buffer.from(await (await fetch(image!.url)).arrayBuffer())
      })
    )
    expect(
      await owner.client.query(api.media.authoredAssets.binding, {
        ...target(first),
        scope: 'ACTIVE'
      })
    ).toEqual({ assetId: firstBinding.assetId, revision: 1 })
    const recropped = await owner.client.action(api.media.authoredActions.save, {
      target: target(edit),
      assetId: secondBinding.assetId!,
      crop: { ...crop, x: 1 / 3 }
    })
    // Recropping reframes the draft slot only; the asset and its stored bytes stay the same.
    expect(recropped).toEqual({
      assetId: secondBinding.assetId,
      revision: secondBinding.revision + 1
    })
    for (const [i, variantKind] of (['SOURCE', 'DISPLAY'] as const).entries()) {
      const image = await owner.client.action(api.media.authoredActions.getImage, {
        target: { ...target(edit), scope: 'DRAFT' },
        variantKind
      })
      expect(Buffer.from(await (await fetch(image!.url)).arrayBuffer()).equals(beforeCrop[i])).toBe(
        true
      )
    }
    expect(Buffer.from(await (await fetch(active!.url)).arrayBuffer()).equals(activeBytes)).toBe(
      true
    )
  }, 40_000)

  it('keeps explicit draft removal empty through publication, discard, and active deletion', async () => {
    const owner = await actor(1)
    const first = await draft(owner.client)
    const saved = await uploadAndSave(owner.client, first)
    await owner.client.mutation(
      publish,
      publicationInput(
        (await owner.client.query(api.content.drafts.get, {
          subjectKind: 'BACKGROUND',
          subjectId: first.subjectId
        })) as AuthoredDraftResult
      )
    )
    const edit = await owner.client.mutation(api.content.drafts.save, {
      subjectKind: 'BACKGROUND',
      subjectId: first.subjectId,
      systemId: first.systemId,
      label: first.label,
      payload: first.payload
    })
    await owner.client.mutation(api.media.authoredAssets.remove, {
      target: target(edit)
    })
    expect(
      await owner.client.query(api.media.authoredAssets.binding, {
        ...target(edit),
        scope: 'DRAFT'
      })
    ).toEqual({ assetId: null, revision: 1 })
    await owner.client.mutation(api.content.drafts.discard, {
      subjectKind: 'BACKGROUND',
      subjectId: edit.subjectId
    })
    expect(
      await owner.client.query(api.media.authoredAssets.binding, {
        ...target(edit),
        scope: 'ACTIVE'
      })
    ).toEqual({ assetId: saved.assetId, revision: 1 })
    const working = await owner.client.mutation(api.content.drafts.save, {
      subjectKind: 'BACKGROUND',
      subjectId: first.subjectId,
      systemId: first.systemId,
      label: first.label,
      payload: first.payload
    })
    await owner.client.mutation(deleteActive, {
      subjectKind: 'BACKGROUND',
      subjectId: first.subjectId
    })
    expect(
      await owner.client.query(api.media.authoredAssets.binding, {
        ...target(working),
        scope: 'DRAFT'
      })
    ).toEqual({ assetId: saved.assetId, revision: 0 })
    await owner.client.mutation(api.media.authoredAssets.remove, {
      target: target(working)
    })
    const emptyDraft = await owner.client.query(api.content.drafts.get, {
      subjectKind: 'BACKGROUND',
      subjectId: first.subjectId
    })
    if (!emptyDraft) throw new Error('Expected remaining draft.')
    await owner.client.mutation(publish, publicationInput(emptyDraft))
    expect(
      await owner.client.query(api.media.authoredAssets.binding, {
        ...target(working),
        scope: 'ACTIVE'
      })
    ).toEqual({ assetId: null, revision: 1 })
  }, 20_000)

  it('deletes published artwork bytes and quota only after its last draft and active reference is gone', async () => {
    const owner = await actor(1)
    const foreign = await actor(2)
    const item = await draft(owner.client)
    const { assetId } = await uploadAndSave(owner.client, item)
    const readAsset = () =>
      t.run((ctx) =>
        ctx.db
          .query('mediaAssets')
          .withIndex('by_publicId', (q) => q.eq('id', assetId!))
          .unique()
      )
    const mediaBytes = async () =>
      (
        await t.run((ctx) =>
          ctx.db
            .query('userProfiles')
            .withIndex('by_userId', (q) => q.eq('userId', owner.identity.userId))
            .unique()
        )
      )?.mediaBytes ?? 0
    const uploaded = (await readAsset())!
    expect(uploaded.status).toBe('READY')
    expect(uploaded.chargedBytes).toBeGreaterThan(0)
    expect(uploaded.variants.length).toBeGreaterThan(0)
    for (const variant of uploaded.variants) expect(server.objects.has(variant.objectKey)).toBe(true)
    expect(await mediaBytes()).toBe(uploaded.chargedBytes)

    await owner.client.mutation(
      publish,
      publicationInput(
        (await owner.client.query(api.content.drafts.get, {
          subjectKind: 'BACKGROUND',
          subjectId: item.subjectId
        })) as AuthoredDraftResult
      )
    )
    const active = await owner.client.action(api.media.authoredActions.getImage, {
      target: { ...target(item), scope: 'ACTIVE' },
      variantKind: 'DISPLAY'
    })
    expect((await fetch(active!.url)).status).toBe(200)
    expect(
      await foreign.client.action(api.media.authoredActions.getImage, {
        target: { ...target(item), scope: 'ACTIVE' },
        variantKind: 'DISPLAY'
      })
    ).toBeNull()

    await owner.client.mutation(deleteActive, {
      subjectKind: 'BACKGROUND',
      subjectId: item.subjectId
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await readAsset()).toMatchObject({ status: 'DELETED', chargedBytes: 0 })
    expect(await mediaBytes()).toBe(0)
    for (const variant of uploaded.variants) expect(server.objects.has(variant.objectKey)).toBe(false)
  }, 40_000)

  it('rejects stale settlement after draft discard and keeps the prior draft artwork on failed processing', async () => {
    const owner = await actor(1)
    const first = await draft(owner.client)
    const prior = await uploadAndSave(owner.client, first)
    const raw = await picture('#1976d2')
    const intent = await owner.client.mutation(api.media.authoredAssets.createUpload, {
      target: target(first),
      originalFileName: 'new.png',
      declaredMimeType: 'image/png',
      declaredBytes: raw.byteLength,
      idempotencyKey: crypto.randomUUID()
    })
    const claim = await owner.client.mutation(internal.media.authoredAssets.beginSave, {
      target: target(first),
      assetId: intent.assetId,
      crop
    })
    if (claim.kind !== 'PROCESS') throw new Error('Expected processing claim.')
    await owner.client.mutation(api.content.drafts.discard, {
      subjectKind: 'BACKGROUND',
      subjectId: first.subjectId
    })
    const recreated = await owner.client.mutation(api.content.drafts.save, {
      subjectKind: 'BACKGROUND',
      subjectId: first.subjectId,
      systemId: first.systemId,
      label: first.label,
      payload: first.payload
    })
    await expect(
      owner.client.mutation(internal.media.imageSaves.finish, {
        assetId: claim.asset.id,
        operationId: claim.operation.id,
        variants: claim.operation.outputs.map((output) => ({
          ...output,
          byteSize: 1,
          width: 1,
          height: 1,
          mimeType: 'image/webp' as const
        })),
        contentHash: 'a'.repeat(64)
      })
    ).rejects.toThrow('Artwork changed during processing')
    expect(
      await owner.client.query(api.media.authoredAssets.binding, {
        ...target(recreated),
        scope: 'DRAFT'
      })
    ).toEqual({ assetId: null, revision: 0 })
    const current = await uploadAndSave(owner.client, recreated, '#1976d2')
    const invalid = await owner.client.mutation(api.media.authoredAssets.createUpload, {
      target: target(recreated),
      originalFileName: 'bad.png',
      declaredMimeType: 'image/png',
      declaredBytes: 12,
      idempotencyKey: crypto.randomUUID()
    })
    expect(
      (
        await fetch(invalid.url, {
          method: 'PUT',
          body: Buffer.from('not an image'),
          headers: { 'content-type': 'image/png' }
        })
      ).status
    ).toBe(200)
    await expect(
      owner.client.action(api.media.authoredActions.save, {
        target: target(recreated),
        assetId: invalid.assetId,
        crop
      })
    ).rejects.toThrow('decoded')
    expect(
      await owner.client.query(api.media.authoredAssets.binding, {
        ...target(recreated),
        scope: 'DRAFT'
      })
    ).toEqual(current)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    const stored = await t.run(async (ctx) => ({
      profile: await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', owner.identity.userId))
        .unique(),
      asset: await ctx.db
        .query('mediaAssets')
        .withIndex('by_publicId', (q) => q.eq('id', current.assetId!))
        .unique()
    }))
    expect(stored.profile?.mediaBytes).toBe(stored.asset?.chargedBytes)
    expect(prior.assetId).toBeTruthy()
  }, 20_000)
})
