import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'

import { createClient } from '@supabase/supabase-js'
import { createDb, createMediaRepository, type DBLike } from '@artificer-toolkit/db'
import type { CreateSceneDefinitionInputDto } from '@artificer-toolkit/schema/api/vttScenes'
import { sql } from 'kysely'
import sharp from 'sharp'
import { Upload } from 'tus-js-client'

import { createCampaign } from '../services/campaign/campaignService.js'
import { createCampaignSceneDefinition } from '../services/encounter/vttSceneService.js'
import {
  createVttMapUploadIntent,
  finalizeVttMapUpload,
  getVttMapDelivery
} from '../services/media/mediaService.js'

const LOCAL_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])
const SIX_MIB = 6 * 1024 * 1024
const MAP_WIDTH = 3_000
const MAP_HEIGHT = 2_100

interface LocalEnvironment {
  databaseConnectionString: string
  supabaseSecretKey: string
  supabaseUrl: string
}

interface UploadIntent {
  assetId: string
  bucket: 'media'
  objectKey: string
  resumable: { chunkBytes: number; protocol: 'TUS' }
  token: string
}

type UploadUrlStorage = NonNullable<ConstructorParameters<typeof Upload>[1]['urlStorage']>
type PreviousUpload = Awaited<ReturnType<Upload['findPreviousUploads']>>[number]

class MemoryUrlStorage implements UploadUrlStorage {
  readonly #uploads = new Map<string, { fingerprint: string; upload: PreviousUpload }>()

  async addUpload(fingerprint: string, upload: PreviousUpload): Promise<string> {
    const key = randomUUID()
    this.#uploads.set(key, { fingerprint, upload: { ...upload, urlStorageKey: key } })
    return key
  }

  async findAllUploads(): Promise<PreviousUpload[]> {
    return [...this.#uploads.values()].map(({ upload }) => upload)
  }

  async findUploadsByFingerprint(fingerprint: string): Promise<PreviousUpload[]> {
    return [...this.#uploads.values()]
      .filter((entry) => entry.fingerprint === fingerprint)
      .map(({ upload }) => upload)
  }

  async removeUpload(urlStorageKey: string): Promise<void> {
    this.#uploads.delete(urlStorageKey)
  }
}

function requireLoopbackUrl(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is required for the local VTT map integration gate.`)
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be a URL for the local VTT map integration gate.`)
  }
  if (!LOCAL_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error(
      `Refusing to run the VTT map integration gate against non-loopback ${name} host "${url.hostname}".`
    )
  }
  return value
}

function requireLocalEnvironment(): LocalEnvironment {
  const databaseConnectionString = requireLoopbackUrl(
    'DATABASE_CONNECTION_STRING',
    process.env.DATABASE_CONNECTION_STRING
  )
  const supabaseUrl = requireLoopbackUrl('SUPABASE_URL', process.env.SUPABASE_URL)
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY
  if (!supabaseSecretKey) {
    throw new Error('SUPABASE_SECRET_KEY is required for the local VTT map integration gate.')
  }
  return { databaseConnectionString, supabaseSecretKey, supabaseUrl }
}

function resolveTusEndpoint(supabaseUrl: string): string {
  return new URL('/storage/v1/upload/resumable/sign', supabaseUrl).toString()
}

function createSceneInput(campaignId: string, assetId: string): CreateSceneDefinitionInputDto {
  return {
    annotations: [],
    ambientIllumination: 'BRIGHT',
    barriers: [],
    campaignId,
    darknessZones: [],
    fogMode: 'SHARED_PARTY',
    visionRevealMode: 'ON_DRAG',
    grid: {
      cellSize: 50,
      diagonalPolicy: 'EQUAL',
      distancePerCell: 5,
      kind: 'SQUARE',
      origin: { x: 0, y: 0 },
      unit: 'FEET'
    },
    lights: [],
    map: { assetId, height: MAP_HEIGHT, tileManifestAssetId: null, width: MAP_WIDTH },
    name: 'VTT map media integration scene',
    tokens: []
  }
}

async function createNoisyPng(): Promise<Buffer> {
  const pixels = randomBytes(MAP_WIDTH * MAP_HEIGHT * 3)
  const png = await sharp(pixels, {
    raw: { channels: 3, height: MAP_HEIGHT, width: MAP_WIDTH }
  })
    .png({ compressionLevel: 0 })
    .toBuffer()
  assert.ok(png.byteLength > SIX_MIB, 'Fixture PNG must exceed the 6 MiB TUS chunk size.')
  assert.ok(png.byteLength <= 25 * 1024 * 1024, 'Fixture PNG must fit the VTT map byte limit.')
  return png
}

async function createOversizedPng(): Promise<Buffer> {
  return sharp({
    create: { background: { alpha: 1, b: 10, g: 10, r: 10 }, channels: 3, height: 1, width: 8_193 }
  })
    .png()
    .toBuffer()
}

function uploadOptions(
  intent: UploadIntent,
  urlStorage: UploadUrlStorage,
  fingerprint: string,
  callbacks: Pick<
    NonNullable<ConstructorParameters<typeof Upload>[1]>,
    'onChunkComplete' | 'onError' | 'onSuccess'
  >
) {
  return {
    ...callbacks,
    chunkSize: intent.resumable.chunkBytes,
    endpoint: resolveTusEndpoint(requireLocalEnvironment().supabaseUrl),
    fingerprint: async () => fingerprint,
    headers: { 'x-signature': intent.token },
    metadata: {
      bucketName: intent.bucket,
      cacheControl: '3600',
      contentType: 'image/png',
      objectName: intent.objectKey
    },
    removeFingerprintOnSuccess: true,
    retryDelays: [0, 100, 250],
    uploadDataDuringCreation: true,
    urlStorage
  }
}

async function interruptAfterFirstAcceptedChunk(
  source: Buffer,
  intent: UploadIntent,
  urlStorage: UploadUrlStorage,
  fingerprint: string
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let upload: Upload | undefined
    let stopped = false
    upload = new Upload(
      source,
      uploadOptions(intent, urlStorage, fingerprint, {
        onChunkComplete: (_chunkSize, bytesAccepted) => {
          if (stopped || bytesAccepted < SIX_MIB || !upload?.url) return
          stopped = true
          const uploadUrl = upload.url
          void upload.abort().then(() => resolve(uploadUrl), reject)
        },
        onError: reject,
        onSuccess: () => reject(new Error('The resumable upload completed before interruption.'))
      })
    )
    upload.start()
  })
}

async function resumeAndComplete(
  source: Buffer,
  intent: UploadIntent,
  urlStorage: UploadUrlStorage,
  fingerprint: string,
  expectedUploadUrl: string
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(
      source,
      uploadOptions(intent, urlStorage, fingerprint, {
        onError: reject,
        onSuccess: () => resolve()
      })
    )
    void upload.findPreviousUploads().then((previous) => {
      assert.equal(previous.length, 1, 'Expected exactly one interrupted TUS upload.')
      assert.equal(previous[0]?.uploadUrl, expectedUploadUrl, 'TUS resumed a different upload URL.')
      const prior = previous[0]
      if (!prior) throw new Error('Interrupted TUS upload metadata was unavailable.')
      upload.resumeFromPreviousUpload(prior)
      upload.start()
    }, reject)
  })
  const remaining = await urlStorage.findUploadsByFingerprint(fingerprint)
  assert.equal(remaining.length, 0, 'Successful upload must remove its resumable fingerprint.')
}

async function completeUpload(
  source: Buffer,
  intent: UploadIntent,
  urlStorage: UploadUrlStorage,
  fingerprint: string
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(
      source,
      uploadOptions(intent, urlStorage, fingerprint, {
        onError: reject,
        onSuccess: () => resolve()
      })
    )
    upload.start()
  })
}

async function assertDeliveryUrls(urls: readonly string[]): Promise<void> {
  for (const value of urls) {
    const url = new URL(value)
    assert.ok(
      LOCAL_HOSTS.has(url.hostname.toLowerCase()),
      'Signed delivery escaped local Supabase.'
    )
    const response = await fetch(url)
    assert.ok(response.ok, `Signed map delivery failed with HTTP ${response.status}.`)
    await response.arrayBuffer()
  }
}

async function mediaObjectKeys(db: DBLike, assetId: string): Promise<string[]> {
  const result = await sql<{ object_key: string }>`
    select raw_object_key as object_key from media_assets where id = ${assetId}::uuid
    union all
    select object_key from media_variants where asset_id = ${assetId}::uuid
    union all
    select object_key from vtt_map_tiles where asset_id = ${assetId}::uuid
  `.execute(db)
  return [...new Set(result.rows.map((row) => row.object_key))]
}

async function cleanupAsset(
  db: DBLike,
  assetId: string,
  removeObjects: (objectKeys: string[]) => Promise<void>
): Promise<void> {
  const objectKeys = await mediaObjectKeys(db, assetId)
  if (objectKeys.length > 0) {
    await removeObjects(objectKeys)
    await sql`
      delete from media_object_deletions where object_key = any(${sql.val(objectKeys)}::text[])
    `.execute(db)
  }
  await createMediaRepository(db).deleteAsset(assetId)
}

async function main(): Promise<void> {
  const environment = requireLocalEnvironment()
  const db = createDb({ connectionString: environment.databaseConnectionString })
  const supabase = createClient(environment.supabaseUrl, environment.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const assetIds: string[] = []
  let campaignId: string | undefined
  let sceneId: string | undefined
  let userId: string | undefined
  let primaryFailure: unknown
  const cleanupFailures: unknown[] = []

  try {
    const email = `vtt-map-integration-${randomUUID()}@local.test`
    const user = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      password: randomUUID(),
      user_metadata: { username: `vtt_map_${randomUUID().slice(0, 8)}` }
    })
    if (user.error || !user.data.user) {
      throw new Error(
        `Local Supabase Auth is unavailable: ${user.error?.message ?? 'createUser returned no user.'}`
      )
    }
    userId = user.data.user.id

    const profile = await sql<{ id: string }>`
      select id::text as id from profiles where id = ${userId}::uuid
    `.execute(db)
    assert.equal(profile.rows[0]?.id, userId, 'Local Auth user did not receive a profile.')

    const campaign = await createCampaign(db, userId, {
      contentMaturity: 'STANDARD',
      gameSystemId: '00000000-0000-0000-0000-000000000001',
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
      format: 'ONGOING',
      name: 'VTT map media integration',
      toneTags: ['HEROIC']
    })
    campaignId = campaign.id
    const entitlement = await sql<{ tier: string }>`
      select tier from account_entitlements where user_id = ${userId}::uuid
    `.execute(db)
    assert.ok(entitlement.rows[0], 'Campaign creation did not establish a local entitlement row.')

    const map = await createNoisyPng()
    const intent = await createVttMapUploadIntent(db, userId, {
      declaredBytes: map.byteLength,
      declaredMimeType: 'image/png',
      idempotencyKey: randomUUID(),
      originalFileName: 'vtt-map-integration.png',
      profile: 'VTT_MAP',
      target: { campaignId, type: 'VTT_MAP' }
    })
    assetIds.push(intent.assetId)
    assert.equal(intent.resumable.chunkBytes, SIX_MIB)
    assert.equal(intent.resumable.protocol, 'TUS')

    const fingerprint = `vtt-map-integration:${intent.bucket}:${intent.objectKey}`
    const urlStorage = new MemoryUrlStorage()
    const interruptedUrl = await interruptAfterFirstAcceptedChunk(
      map,
      intent,
      urlStorage,
      fingerprint
    )
    await resumeAndComplete(map, intent, urlStorage, fingerprint, interruptedUrl)

    const finalized = await finalizeVttMapUpload(db, userId, intent.assetId)
    assert.equal(finalized.status, 'READY')
    const asset = await createMediaRepository(db).findById(intent.assetId)
    assert.equal(asset?.status, 'READY')
    assert.equal(asset?.width, MAP_WIDTH)
    assert.equal(asset?.height, MAP_HEIGHT)
    const [display, thumbnail, tiles] = await Promise.all([
      createMediaRepository(db).findVariant(intent.assetId, 'DISPLAY'),
      createMediaRepository(db).findVariant(intent.assetId, 'THUMBNAIL'),
      sql<{
        count: string
      }>`select count(*)::text as count from vtt_map_tiles where asset_id = ${intent.assetId}::uuid`.execute(
        db
      )
    ])
    assert.ok(display, 'VTT map DISPLAY variant is missing.')
    assert.ok(thumbnail, 'VTT map THUMBNAIL variant is missing.')
    assert.equal(tiles.rows[0]?.count, '9', 'VTT map renderer tile count was not 3 by 3.')

    const delivery = await getVttMapDelivery(db, userId, intent.assetId)
    assert.equal(delivery.width, MAP_WIDTH)
    assert.equal(delivery.height, MAP_HEIGHT)
    assert.equal(delivery.tiles.length, 9)
    await assertDeliveryUrls([delivery.overview.url, ...delivery.tiles.map((tile) => tile.url)])

    const scene = await createCampaignSceneDefinition(
      db,
      userId,
      createSceneInput(campaignId, intent.assetId)
    )
    sceneId = scene.id
    await assert.rejects(
      createMediaRepository(db).deleteAsset(intent.assetId),
      /referenced by a scene/i,
      'A referenced VTT map must not be directly deletable.'
    )
    assert.equal((await createMediaRepository(db).findById(intent.assetId))?.status, 'READY')

    const oversized = await createOversizedPng()
    const oversizedIntent = await createVttMapUploadIntent(db, userId, {
      declaredBytes: oversized.byteLength,
      declaredMimeType: 'image/png',
      idempotencyKey: randomUUID(),
      originalFileName: 'vtt-map-too-wide.png',
      profile: 'VTT_MAP',
      target: { campaignId, type: 'VTT_MAP' }
    })
    assetIds.push(oversizedIntent.assetId)
    await completeUpload(
      oversized,
      oversizedIntent,
      new MemoryUrlStorage(),
      `vtt-map-integration:${oversizedIntent.bucket}:${oversizedIntent.objectKey}`
    )
    const rejected = await finalizeVttMapUpload(db, userId, oversizedIntent.assetId)
    assert.equal(rejected.status, 'REJECTED')

    console.info(
      JSON.stringify({
        vttMapMediaIntegration: {
          assetId: intent.assetId,
          deliveryUrlsFetched: delivery.tiles.length + 1,
          dimensions: { height: MAP_HEIGHT, width: MAP_WIDTH },
          resumedTusUrl: true,
          sceneDeletionProtection: true,
          tileCount: delivery.tiles.length,
          oversizedMapRejected: true
        }
      })
    )
  } catch (error) {
    primaryFailure = error
  } finally {
    if (sceneId && campaignId) {
      try {
        await sql`delete from campaign_scene_definitions where campaign_id = ${campaignId}::uuid and id = ${sceneId}::uuid`.execute(
          db
        )
      } catch (error) {
        cleanupFailures.push(error)
      }
    }
    if (campaignId) {
      try {
        await sql`delete from campaigns where id = ${campaignId}::uuid`.execute(db)
      } catch (error) {
        cleanupFailures.push(error)
      }
    }
    for (const assetId of assetIds) {
      try {
        await cleanupAsset(db, assetId, async (objectKeys) => {
          const { error } = await supabase.storage.from('media').remove(objectKeys)
          if (error) throw new Error(`Unable to clean local VTT map objects: ${error.message}`)
        })
      } catch (error) {
        cleanupFailures.push(error)
      }
    }
    if (userId) {
      try {
        const deleted = await supabase.auth.admin.deleteUser(userId)
        if (deleted.error) cleanupFailures.push(deleted.error)
      } catch (error) {
        cleanupFailures.push(error)
      }
    }
    try {
      await db.destroy()
    } catch (error) {
      cleanupFailures.push(error)
    }
  }

  if (cleanupFailures.length > 0) {
    console.error(
      `VTT map integration cleanup failed ${cleanupFailures.length} time(s):`,
      cleanupFailures
    )
  }
  if (primaryFailure) throw primaryFailure
  if (cleanupFailures.length > 0) {
    throw new AggregateError(cleanupFailures, 'VTT map integration cleanup failed.')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
