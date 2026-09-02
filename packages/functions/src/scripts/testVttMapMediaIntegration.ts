import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseEnv } from 'node:util'

import { createClient } from '@supabase/supabase-js'
import { createDb, createMediaRepository, type DBLike } from '@artificer-toolkit/db'
import type { CreateVttMapUploadIntentOutput } from '@artificer-toolkit/schema/api/media'
import type { CreateSceneDefinitionInputDto } from '@artificer-toolkit/schema/api/vttScenes'
import { sql } from 'kysely'
import sharp from 'sharp'

import { createCampaign } from '../services/campaign/campaignService.js'
import { createCampaignSceneDefinition } from '../services/encounter/vttSceneService.js'
import {
  completeVttMapMultipartUpload,
  createVttMapUploadIntent,
  finalizeVttMapUpload,
  getVttMapDelivery
} from '../services/media/mediaService.js'

const LOCAL_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])
const SIX_MIB = 6 * 1024 * 1024
const MAP_WIDTH = 3_000
const MAP_HEIGHT = 2_100
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url))

interface LocalEnvironment {
  databaseConnectionString: string
  supabaseSecretKey: string
  supabaseUrl: string
}

class LocalR2Server {
  readonly #objects = new Map<string, Buffer>()
  readonly #uploads = new Map<
    string,
    { objectKey: string; parts: Map<number, { body: Buffer; etag: string }> }
  >()
  readonly #server = createServer((request, response) => {
    void this.#handle(request, response).catch((error: unknown) => {
      response.statusCode = 500
      response.end(error instanceof Error ? error.message : 'Local R2 failure.')
    })
  })

  async start(): Promise<string> {
    await new Promise<void>((resolve, reject) => {
      this.#server.once('error', reject)
      this.#server.listen(0, '127.0.0.1', () => resolve())
    })
    const address = this.#server.address()
    if (!address || typeof address === 'string') throw new Error('Local R2 did not bind a port.')
    return `http://127.0.0.1:${address.port}`
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve, reject) =>
      this.#server.close((error) => (error ? reject(error) : resolve()))
    )
  }

  remove(objectKeys: readonly string[]): void {
    for (const objectKey of objectKeys) this.#objects.delete(objectKey)
  }

  async #handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    const path = url.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment))
    if (path.shift() !== 'vtt-map-local') {
      response.statusCode = 404
      response.end()
      return
    }
    const objectKey = path.join('/')
    const body = await readRequestBody(request)
    const uploadId = url.searchParams.get('uploadId')

    if (request.method === 'POST' && url.searchParams.has('uploads')) {
      const createdUploadId = randomUUID()
      this.#uploads.set(createdUploadId, { objectKey, parts: new Map() })
      response.setHeader('content-type', 'application/xml')
      response.end(
        `<InitiateMultipartUploadResult><UploadId>${createdUploadId}</UploadId></InitiateMultipartUploadResult>`
      )
      return
    }
    if (request.method === 'PUT' && uploadId) {
      const upload = this.#uploads.get(uploadId)
      const partNumber = Number(url.searchParams.get('partNumber'))
      if (!upload || upload.objectKey !== objectKey || !Number.isInteger(partNumber)) {
        response.statusCode = 404
        response.end()
        return
      }
      const etag = `&quot;part-${partNumber}-${body.byteLength}&quot;`
      upload.parts.set(partNumber, { body, etag })
      response.setHeader('etag', etag.replaceAll('&quot;', '"'))
      response.end()
      return
    }
    if (request.method === 'POST' && uploadId) {
      const upload = this.#uploads.get(uploadId)
      if (!upload || upload.objectKey !== objectKey) {
        response.statusCode = 404
        response.end()
        return
      }
      const partNumbers = [
        ...body.toString('utf8').matchAll(/<PartNumber>(\d+)<\/PartNumber>/g)
      ].map((match) => Number(match[1]))
      const parts = partNumbers.map((partNumber) => upload.parts.get(partNumber)?.body)
      if (parts.some((part) => !part)) {
        response.statusCode = 400
        response.end('Missing multipart part.')
        return
      }
      this.#objects.set(objectKey, Buffer.concat(parts as Buffer[]))
      this.#uploads.delete(uploadId)
      response.end('<CompleteMultipartUploadResult />')
      return
    }
    if (request.method === 'DELETE' && uploadId) {
      this.#uploads.delete(uploadId)
      response.statusCode = 204
      response.end()
      return
    }
    if (request.method === 'GET' && url.searchParams.get('list-type') === '2') {
      const prefix = url.searchParams.get('prefix') ?? ''
      const contents = [...this.#objects.keys()]
        .filter((key) => key.startsWith(prefix))
        .sort()
        .map((key) => `<Contents><Key>${escapeXml(key)}</Key></Contents>`)
        .join('')
      response.setHeader('content-type', 'application/xml')
      response.end(`<ListBucketResult>${contents}</ListBucketResult>`)
      return
    }
    if (request.method === 'PUT') {
      this.#objects.set(objectKey, body)
      response.end()
      return
    }
    if (request.method === 'DELETE') {
      this.#objects.delete(objectKey)
      response.statusCode = 204
      response.end()
      return
    }
    const object = this.#objects.get(objectKey)
    if (!object) {
      response.statusCode = 404
      response.end()
      return
    }
    response.statusCode = 200
    response.setHeader('content-length', object.byteLength)
    if (request.method === 'HEAD') response.end()
    else response.end(object)
  }
}

async function readRequestBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of request)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
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

function loadLocalEnvironment(): void {
  const environmentPath = `${repoRoot}/.env.local`
  if (!existsSync(environmentPath)) {
    throw new Error('Root .env.local is required for the local VTT map integration gate.')
  }
  for (const [key, value] of Object.entries(parseEnv(readFileSync(environmentPath, 'utf8')))) {
    if (key.startsWith('PROD_') || key.startsWith('STAGING_')) continue
    process.env[key] = value
  }
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
  assert.ok(png.byteLength > SIX_MIB, 'Fixture PNG must exceed one multipart chunk.')
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

async function uploadParts(
  source: Buffer,
  intent: CreateVttMapUploadIntentOutput,
  partNumbers: readonly number[] = intent.resumable.parts.map((part) => part.partNumber)
): Promise<{ etag: string; partNumber: number }[]> {
  const requested = new Set(partNumbers)
  const completed: { etag: string; partNumber: number }[] = []
  for (const part of intent.resumable.parts) {
    if (!requested.has(part.partNumber)) continue
    const start = (part.partNumber - 1) * intent.resumable.chunkBytes
    const body = Uint8Array.from(
      source.subarray(start, Math.min(source.byteLength, start + intent.resumable.chunkBytes))
    )
    const response = await fetch(part.url, { body, method: 'PUT' })
    assert.ok(response.ok, `Local R2 part upload failed with HTTP ${response.status}.`)
    const etag = response.headers.get('etag')
    assert.ok(etag, 'Local R2 part upload did not return an ETag.')
    completed.push({ etag, partNumber: part.partNumber })
  }
  return completed
}

async function assertDeliveryUrls(urls: readonly string[]): Promise<void> {
  for (const value of urls) {
    const url = new URL(value)
    assert.ok(LOCAL_HOSTS.has(url.hostname.toLowerCase()), 'Signed delivery escaped local R2.')
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
      delete from media_object_deletions
      where storage_provider = 'R2' and object_key = any(${sql.val(objectKeys)}::text[])
    `.execute(db)
  }
  await createMediaRepository(db).deleteAsset(assetId)
}

async function main(): Promise<void> {
  loadLocalEnvironment()
  const environment = requireLocalEnvironment()
  const db = createDb({ connectionString: environment.databaseConnectionString })
  const supabase = createClient(environment.supabaseUrl, environment.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const localR2 = new LocalR2Server()
  const r2Endpoint = await localR2.start()
  process.env.R2_ACCOUNT_ID = 'local'
  process.env.R2_ACCESS_KEY_ID = 'local-access-key'
  process.env.R2_SECRET_ACCESS_KEY = 'local-secret-key'
  process.env.R2_VTT_MAP_BUCKET = 'vtt-map-local'
  process.env.R2_S3_ENDPOINT = r2Endpoint
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
    const uploadInput = {
      declaredBytes: map.byteLength,
      declaredMimeType: 'image/png',
      idempotencyKey: randomUUID(),
      originalFileName: 'vtt-map-integration.png',
      profile: 'VTT_MAP' as const,
      target: { campaignId, type: 'VTT_MAP' }
    } as const
    const intent = await createVttMapUploadIntent(db, userId, uploadInput)
    assetIds.push(intent.assetId)
    assert.equal(intent.resumable.chunkBytes, SIX_MIB)
    assert.equal(intent.resumable.protocol, 'R2_MULTIPART')
    assert.ok(intent.resumable.parts.length > 1, 'Fixture must exercise multipart resumption.')

    const retainedParts = await uploadParts(map, intent, [1])
    const resumedIntent = await createVttMapUploadIntent(db, userId, uploadInput)
    assert.equal(resumedIntent.assetId, intent.assetId)
    assert.equal(resumedIntent.objectKey, intent.objectKey)
    assert.equal(
      new URL(resumedIntent.resumable.parts[0]!.url).searchParams.get('uploadId'),
      new URL(intent.resumable.parts[0]!.url).searchParams.get('uploadId'),
      'Retry must retain the same R2 multipart upload.'
    )
    const remainingParts = await uploadParts(
      map,
      resumedIntent,
      resumedIntent.resumable.parts.slice(1).map((part) => part.partNumber)
    )
    const completedParts = [...retainedParts, ...remainingParts]
    await completeVttMapMultipartUpload(db, userId, {
      assetId: intent.assetId,
      parts: completedParts
    })
    await completeVttMapMultipartUpload(db, userId, {
      assetId: intent.assetId,
      parts: completedParts
    })

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
    await completeVttMapMultipartUpload(db, userId, {
      assetId: oversizedIntent.assetId,
      parts: await uploadParts(oversized, oversizedIntent)
    })
    const rejected = await finalizeVttMapUpload(db, userId, oversizedIntent.assetId)
    assert.equal(rejected.status, 'REJECTED')

    console.info(
      JSON.stringify({
        vttMapMediaIntegration: {
          assetId: intent.assetId,
          deliveryUrlsFetched: delivery.tiles.length + 1,
          dimensions: { height: MAP_HEIGHT, width: MAP_WIDTH },
          resumedMultipartUpload: true,
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
        await cleanupAsset(db, assetId, async (objectKeys) => localR2.remove(objectKeys))
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
    try {
      await localR2.close()
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
