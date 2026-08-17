import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { sql } from 'kysely'
import {
  createMediaRepository,
  type DBLike,
  type MediaAssetRow,
  withTransaction
} from '@artificer-toolkit/db'
import { assertWritableAuthoredSubject } from '../authoredContent/authoredContentService.js'
import type {
  AttachImageInput,
  CreateCampaignFileUploadIntentInput,
  CreateImageUploadIntentInput,
  CreateVttMapUploadIntentInput,
  FinalizeImageUploadOutput,
  ImageLookupInput,
  MediaTarget,
  MediaVariantKind,
  RemoveImageInput,
  SignedCampaignFileDeliveryDto,
  SignedImageDeliveryDto,
  SignedVttMapDeliveryDto
} from '@artificer-toolkit/schema/api/media'
import { createSupabaseClient } from '../../clients/supabaseClient.js'
import { withLockedEntitlementLimits } from '../account/entitlementService.js'
import {
  assertActiveCampaignMember,
  assertCampaignOwner,
  assertCampaignWritable,
  resolveCampaignAuthority
} from '../campaign/campaignService.js'

const bucket = 'media' as const
const maxBytes = 6 * 1024 * 1024
const maxDimension = 8192
const maxPixels = 25_000_000
const vttMapMaxBytes = 25 * 1024 * 1024
const vttMapMaxPixels = 64_000_000
const vttMapTileSize = 1024
const vttMapTileLimit = 64
const supportedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

async function getStorageQuotaBytes(db: DBLike, userId: string): Promise<number> {
  return withLockedEntitlementLimits(
    db,
    userId,
    async (_trx, limits) => limits.storageBytes ?? Number.MAX_SAFE_INTEGER
  )
}

export class MediaNotFoundError extends Error {
  constructor() {
    super('Media asset not found.')
    this.name = 'MediaNotFoundError'
  }
}
export class MediaAccessError extends Error {
  constructor() {
    super('You cannot access this media asset.')
    this.name = 'MediaAccessError'
  }
}
export class MediaConflictError extends Error {
  constructor(message = 'Media upload is already processing.') {
    super(message)
    this.name = 'MediaConflictError'
  }
}
export class MediaValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MediaValidationError'
  }
}
export class MediaQuotaError extends Error {
  constructor() {
    super('Image storage limit reached.')
    this.name = 'MediaQuotaError'
  }
}

function isoAfter(milliseconds: number) {
  return new Date(Date.now() + milliseconds).toISOString()
}

function imageSize(width: number, height: number, limit: number) {
  const scale = Math.min(1, limit / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  }
}

function cropPixels(
  width: number,
  height: number,
  crop: { x: number; y: number; width: number; height: number }
) {
  const left = Math.max(0, Math.min(width - 1, Math.round(crop.x * width)))
  const top = Math.max(0, Math.min(height - 1, Math.round(crop.y * height)))
  return {
    left,
    top,
    width: Math.max(1, Math.min(width - left, Math.round(crop.width * width))),
    height: Math.max(1, Math.min(height - top, Math.round(crop.height * height)))
  }
}

async function inspectImage(source: Buffer) {
  try {
    return await sharp(source, { animated: true }).metadata()
  } catch {
    throw new MediaValidationError('Image data could not be decoded.')
  }
}

async function normalizeImage(source: Buffer) {
  try {
    return await sharp(source)
      .rotate()
      .resize(4096, 4096, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer({ resolveWithObject: true })
  } catch {
    throw new MediaValidationError('Image data could not be normalized.')
  }
}

function mediaTargetKey(target: MediaTarget): string {
  if (target.type === 'ACCOUNT_AVATAR') return target.type
  if (target.type === 'CHARACTER_PORTRAIT') return `${target.type}:${target.characterId}`
  if (
    target.type === 'CAMPAIGN_FILE' ||
    target.type === 'CAMPAIGN_HANDOUT_MAP' ||
    target.type === 'VTT_MAP'
  ) {
    return `${target.type}:${target.campaignId}`
  }
  return `${target.type}:${target.subjectKind}:${target.subjectId}`
}

async function requireActiveCampaignMember(db: DBLike, campaignId: string, userId: string) {
  const membership = await db
    .selectFrom('campaign_memberships')
    .select('user_id')
    .where('campaign_id', '=', campaignId)
    .where('user_id', '=', userId)
    .where('status', '=', 'ACTIVE')
    .executeTakeFirst()
  if (!membership) throw new MediaAccessError()
}

export async function createCampaignFileUploadIntent(
  db: DBLike,
  userId: string,
  input: CreateCampaignFileUploadIntentInput
) {
  await requireActiveCampaignMember(db, input.target.campaignId, userId)
  return createImageUploadIntent(db, userId, input)
}

export async function createVttMapUploadIntent(
  db: DBLike,
  userId: string,
  input: CreateVttMapUploadIntentInput
) {
  const authority = await resolveCampaignAuthority(db, input.target.campaignId, userId)
  assertActiveCampaignMember(authority)
  assertCampaignOwner(authority)
  assertCampaignWritable(authority)
  const upload = await createImageUploadIntent(db, userId, input)
  return { ...upload, resumable: { chunkBytes: 6 * 1024 * 1024, protocol: 'TUS' as const } }
}

function assertReadyOwnedAsset(
  asset: MediaAssetRow | null,
  userId: string,
  profile: string,
  targetKey: string
) {
  if (
    !asset ||
    asset.owner_user_id !== userId ||
    asset.status !== 'READY' ||
    asset.profile !== profile ||
    asset.target_key !== targetKey
  ) {
    throw new MediaAccessError()
  }
}

function isStorageNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const statusCode = 'statusCode' in error ? error.statusCode : undefined
  const status = 'status' in error ? error.status : undefined
  return String(statusCode ?? status) === '404'
}

async function removeMediaObjects(db: DBLike, objectKeys: readonly string[]): Promise<boolean> {
  const keys = [...new Set(objectKeys)]
  if (keys.length === 0) return true
  const media = createMediaRepository(db)
  await media.scheduleObjectDeletions(keys)
  const { error } = await createSupabaseClient().storage.from(bucket).remove(keys)
  if (error) return false
  await media.completeObjectDeletions(keys)
  return true
}

async function signedDelivery(
  db: DBLike,
  assetId: string,
  variantKind: MediaVariantKind
): Promise<SignedImageDeliveryDto | null> {
  const media = createMediaRepository(db)
  const asset = await media.findById(assetId)
  if (!asset || asset.status !== 'READY') return null
  const variant = await media.findVariant(assetId, variantKind)
  if (!variant || variant.width === null || variant.height === null) return null
  const supabase = createSupabaseClient()
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(variant.object_key, 60 * 60)
  if (error || !data?.signedUrl) throw new Error('Unable to create image delivery URL.')
  return {
    assetId,
    variantKind,
    url: data.signedUrl,
    expiresAt: isoAfter(60 * 60 * 1000),
    width: variant.width,
    height: variant.height,
    mimeType: variant.mime_type as SignedImageDeliveryDto['mimeType'],
    crop:
      asset.crop_x === null
        ? null
        : {
            x: Number(asset.crop_x),
            y: Number(asset.crop_y),
            width: Number(asset.crop_width),
            height: Number(asset.crop_height)
          },
    altText: null,
    isDecorative: false
  }
}

export async function createImageUploadIntent(
  db: DBLike,
  userId: string,
  input:
    | CreateImageUploadIntentInput
    | CreateCampaignFileUploadIntentInput
    | CreateVttMapUploadIntentInput
) {
  const targetKey = mediaTargetKey(input.target)
  if (input.target.type === 'CHARACTER_PORTRAIT') {
    const character = await sql<{ id: string }>`
      select id from characters
      where id = ${input.target.characterId}::uuid and user_id = ${userId}::uuid
    `.execute(db)
    if (!character.rows[0]) throw new MediaAccessError()
  } else if (input.target.type === 'AUTHORED_IMAGE') {
    await ensureAuthoredWritable(db, userId, input.target.subjectKind, input.target.subjectId)
  }

  const asset = await withTransaction(db, async (trx) => {
    const media = createMediaRepository(trx)
    if (!(await media.lockOwner(userId))) throw new MediaAccessError()
    const quotaBytes = await getStorageQuotaBytes(trx, userId)
    const existing = await media.findByOwnerAndKey(userId, input.idempotencyKey)
    if (existing) {
      if (
        existing.status !== 'PENDING_UPLOAD' ||
        existing.profile !== input.profile ||
        existing.target_key !== targetKey
      )
        throw new MediaConflictError('This upload key has already been finalized.')
      return existing
    }
    const reservationBytes = input.profile === 'VTT_MAP' ? vttMapMaxBytes : maxBytes
    if ((await media.usageBytes(userId)) + reservationBytes > quotaBytes)
      throw new MediaQuotaError()
    const assetId = randomUUID()
    return media.createPending({
      ...input,
      id: assetId,
      ownerUserId: userId,
      rawObjectKey: `raw/${userId}/${assetId}`,
      targetKey
    })
  })
  const supabase = createSupabaseClient()
  if (asset.status !== 'PENDING_UPLOAD')
    throw new MediaConflictError('This upload key has already been finalized.')
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(asset.raw_object_key, { upsert: false })
  if (error || !data?.token) throw new Error('Unable to create image upload URL.')
  return {
    assetId: asset.id,
    bucket,
    objectKey: asset.raw_object_key,
    token: data.token,
    expiresAt: isoAfter(2 * 60 * 60 * 1000)
  }
}

export async function finalizeImageUpload(
  db: DBLike,
  userId: string,
  assetId: string
): Promise<FinalizeImageUploadOutput> {
  const media = createMediaRepository(db)
  const found = await media.findById(assetId)
  if (!found) throw new MediaNotFoundError()
  if (found.owner_user_id !== userId) throw new MediaAccessError()
  if (found.status === 'READY') {
    try {
      return {
        assetId,
        status: 'READY',
        preview: await signedDelivery(db, assetId, 'DISPLAY')
      }
    } catch {
      return { assetId, status: 'READY', preview: null }
    }
  }
  const asset = await media.claimForProcessing(assetId, userId)
  if (!asset) throw new MediaConflictError()
  const supabase = createSupabaseClient()
  const newKeys: string[] = []
  let isReady = false
  try {
    const readyPrefix = `ready/${userId}/${assetId}`
    const stale = await supabase.storage.from(bucket).list(readyPrefix, { limit: 100 })
    if (stale.error) throw new Error('Unable to clear interrupted image processing.')
    const staleKeys = (stale.data ?? []).map((object) => `${readyPrefix}/${object.name}`)
    if (!(await removeMediaObjects(db, staleKeys))) {
      throw new Error('Unable to clear interrupted image processing.')
    }
    const { data: file, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(asset.raw_object_key)
    if (downloadError) {
      if (isStorageNotFound(downloadError)) {
        throw new MediaValidationError('Upload data was not found.')
      }
      throw new Error('Unable to load uploaded image.')
    }
    if (!file) throw new MediaValidationError('Upload data was not found.')
    const source = Buffer.from(await file.arrayBuffer())
    if (source.byteLength > maxBytes)
      throw new MediaValidationError('Image exceeds the 6 MiB limit.')
    const inspection = await inspectImage(source)
    const mime =
      inspection.format === 'jpeg'
        ? 'image/jpeg'
        : inspection.format === 'png'
          ? 'image/png'
          : inspection.format === 'webp'
            ? 'image/webp'
            : null
    if (
      !mime ||
      !supportedMimeTypes.has(mime) ||
      (inspection.pages ?? 1) > 1 ||
      !inspection.width ||
      !inspection.height ||
      inspection.width > maxDimension ||
      inspection.height > maxDimension ||
      inspection.width * inspection.height > maxPixels
    ) {
      throw new MediaValidationError('Image format or dimensions are not supported.')
    }
    if (asset.declared_mime_type !== mime)
      throw new MediaValidationError('Image type does not match the upload intent.')
    const normalized = await normalizeImage(source)
    const width = normalized.info.width
    const height = normalized.info.height
    const variants: {
      id: string
      kind: MediaVariantKind
      object_key: string
      mime_type: string
      byte_size: number
      width: number
      height: number
    }[] = []
    for (const [kind, limit] of [
      ['SOURCE', 4096],
      ['DISPLAY', 1600],
      ['THUMBNAIL', 320]
    ] as const) {
      const size = imageSize(width, height, limit)
      const body =
        kind === 'SOURCE'
          ? normalized.data
          : await sharp(normalized.data)
              .resize(size.width, size.height, {
                fit: 'inside',
                withoutEnlargement: true
              })
              .webp({ quality: 85 })
              .toBuffer()
      const id = randomUUID()
      const objectKey = `ready/${userId}/${assetId}/${id}.webp`
      newKeys.push(objectKey)
      await media.scheduleObjectDeletions([objectKey])
      const { error } = await supabase.storage
        .from(bucket)
        .upload(objectKey, body, { contentType: 'image/webp', upsert: false })
      if (error) throw new Error('Unable to store processed image.')
      variants.push({
        id,
        kind,
        object_key: objectKey,
        mime_type: 'image/webp',
        byte_size: body.byteLength,
        ...size
      })
    }
    const ready = await withTransaction(db, async (trx) => {
      const repository = createMediaRepository(trx)
      if (!(await repository.lockOwner(userId))) throw new MediaAccessError()
      return repository.replaceReady({
        assetId,
        ownerUserId: userId,
        quotaBytes: await getStorageQuotaBytes(trx, userId),
        reservationBytes: maxBytes,
        verifiedMimeType: mime,
        verifiedBytes: source.byteLength,
        width,
        height,
        variants
      })
    })
    if (!ready) throw new MediaQuotaError()
    isReady = true
    await removeMediaObjects(db, [asset.raw_object_key])
    try {
      return {
        assetId,
        status: 'READY',
        preview: await signedDelivery(db, assetId, 'DISPLAY')
      }
    } catch {
      return { assetId, status: 'READY', preview: null }
    }
  } catch (error) {
    if (isReady) throw error
    if (error instanceof MediaValidationError || error instanceof MediaQuotaError) {
      await removeMediaObjects(db, [...newKeys, asset.raw_object_key])
      await media.reject(assetId, error.message)
      return { assetId, status: 'REJECTED', preview: null }
    }
    await removeMediaObjects(db, newKeys)
    await media.resetPending(assetId)
    throw error
  }
}

export async function finalizeVttMapUpload(
  db: DBLike,
  userId: string,
  assetId: string
): Promise<{ assetId: string; status: 'READY' | 'REJECTED' }> {
  const media = createMediaRepository(db)
  const found = await media.findById(assetId)
  if (!found) throw new MediaNotFoundError()
  if (found.owner_user_id !== userId || found.profile !== 'VTT_MAP') throw new MediaAccessError()
  const campaignId = found.target_key.slice(found.target_key.indexOf(':') + 1)
  const authority = await resolveCampaignAuthority(db, campaignId, userId)
  assertActiveCampaignMember(authority)
  assertCampaignOwner(authority)
  assertCampaignWritable(authority)
  if (found.status === 'READY') return { assetId, status: 'READY' }
  const asset = await media.claimForProcessing(assetId, userId)
  if (!asset) throw new MediaConflictError()
  const supabase = createSupabaseClient()
  const newKeys: string[] = []
  let isReady = false
  try {
    const readyPrefix = `ready/${userId}/${assetId}`
    const stale = await supabase.storage.from(bucket).list(readyPrefix, { limit: 1000 })
    if (stale.error) throw new Error('Unable to clear interrupted map processing.')
    const staleKeys = (stale.data ?? []).map((object) => `${readyPrefix}/${object.name}`)
    if (!(await removeMediaObjects(db, staleKeys))) {
      throw new Error('Unable to clear interrupted map processing.')
    }
    const { data: file, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(asset.raw_object_key)
    if (downloadError) {
      if (isStorageNotFound(downloadError)) {
        throw new MediaValidationError('Upload data was not found.')
      }
      throw new Error('Unable to load uploaded map.')
    }
    if (!file) throw new MediaValidationError('Upload data was not found.')
    const source = Buffer.from(await file.arrayBuffer())
    if (source.byteLength > vttMapMaxBytes) {
      throw new MediaValidationError('Map exceeds the 25 MiB limit.')
    }
    const inspection = await inspectImage(source)
    const mime =
      inspection.format === 'jpeg'
        ? 'image/jpeg'
        : inspection.format === 'png'
          ? 'image/png'
          : inspection.format === 'webp'
            ? 'image/webp'
            : null
    if (
      !mime ||
      !supportedMimeTypes.has(mime) ||
      (inspection.pages ?? 1) > 1 ||
      !inspection.width ||
      !inspection.height ||
      inspection.width > maxDimension ||
      inspection.height > maxDimension ||
      inspection.width * inspection.height > vttMapMaxPixels
    ) {
      throw new MediaValidationError('Map format or dimensions are not supported.')
    }
    if (asset.declared_mime_type !== mime) {
      throw new MediaValidationError('Map type does not match the upload intent.')
    }
    const normalized = await sharp(source)
      .rotate()
      .webp({ quality: 85 })
      .toBuffer({ resolveWithObject: true })
      .catch(() => {
        throw new MediaValidationError('Map data could not be normalized.')
      })
    const width = normalized.info.width
    const height = normalized.info.height
    if (!width || !height) throw new MediaValidationError('Map dimensions are unavailable.')
    const variants: {
      id: string
      kind: MediaVariantKind
      object_key: string
      mime_type: string
      byte_size: number
      width: number
      height: number
    }[] = []
    for (const [kind, limit] of [
      ['DISPLAY', 1600],
      ['THUMBNAIL', 320]
    ] as const) {
      const size = imageSize(width, height, limit)
      const body = await sharp(normalized.data)
        .resize(size.width, size.height, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer()
      const objectKey = `ready/${userId}/${assetId}/${randomUUID()}.webp`
      newKeys.push(objectKey)
      await media.scheduleObjectDeletions([objectKey])
      const { error } = await supabase.storage
        .from(bucket)
        .upload(objectKey, body, { contentType: 'image/webp', upsert: false })
      if (error) throw new Error('Unable to store processed map.')
      variants.push({
        id: randomUUID(),
        kind,
        object_key: objectKey,
        mime_type: 'image/webp',
        byte_size: body.byteLength,
        ...size
      })
    }
    const tiles: {
      byte_size: number
      column_index: number
      height: number
      object_key: string
      row_index: number
      width: number
    }[] = []
    const rows = Math.ceil(height / vttMapTileSize)
    const columns = Math.ceil(width / vttMapTileSize)
    if (rows * columns > vttMapTileLimit) {
      throw new MediaValidationError('Map requires too many renderer tiles.')
    }
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const tileWidth = Math.min(vttMapTileSize, width - column * vttMapTileSize)
        const tileHeight = Math.min(vttMapTileSize, height - row * vttMapTileSize)
        const body = await sharp(normalized.data)
          .extract({
            left: column * vttMapTileSize,
            top: row * vttMapTileSize,
            width: tileWidth,
            height: tileHeight
          })
          .webp({ quality: 85 })
          .toBuffer()
        const objectKey = `ready/${userId}/${assetId}/tile-${row}-${column}-${randomUUID()}.webp`
        newKeys.push(objectKey)
        await media.scheduleObjectDeletions([objectKey])
        const { error } = await supabase.storage
          .from(bucket)
          .upload(objectKey, body, { contentType: 'image/webp', upsert: false })
        if (error) throw new Error('Unable to store map tile.')
        tiles.push({
          byte_size: body.byteLength,
          column_index: column,
          height: tileHeight,
          object_key: objectKey,
          row_index: row,
          width: tileWidth
        })
      }
    }
    const ready = await withTransaction(db, async (trx) => {
      const repository = createMediaRepository(trx)
      if (!(await repository.lockOwner(userId))) throw new MediaAccessError()
      return repository.replaceReady({
        assetId,
        ownerUserId: userId,
        quotaBytes: await getStorageQuotaBytes(trx, userId),
        reservationBytes: vttMapMaxBytes,
        verifiedMimeType: mime,
        verifiedBytes: source.byteLength,
        width,
        height,
        variants,
        vttMapTiles: tiles
      })
    })
    if (!ready) throw new MediaQuotaError()
    isReady = true
    await removeMediaObjects(db, [asset.raw_object_key])
    return { assetId, status: 'READY' }
  } catch (error) {
    if (isReady) throw error
    if (error instanceof MediaValidationError || error instanceof MediaQuotaError) {
      await removeMediaObjects(db, [...newKeys, asset.raw_object_key])
      await media.reject(assetId, error.message)
      return { assetId, status: 'REJECTED' }
    }
    await removeMediaObjects(db, newKeys)
    await media.resetPending(assetId)
    throw error
  }
}

export async function getVttMapDelivery(
  db: DBLike,
  userId: string,
  assetId: string
): Promise<SignedVttMapDeliveryDto> {
  const media = createMediaRepository(db)
  const asset = await media.findById(assetId)
  if (!asset || asset.status !== 'READY' || asset.profile !== 'VTT_MAP') {
    throw new MediaNotFoundError()
  }
  const campaignId = asset.target_key.slice(asset.target_key.indexOf(':') + 1)
  const authority = await resolveCampaignAuthority(db, campaignId, userId)
  assertActiveCampaignMember(authority)
  const isOwner = authority.membership.role === 'OWNER'
  if (!isOwner) {
    const attachment = await sql<{ attached: boolean }>`
      select exists(
        select 1 from encounter_scenes scene
        join encounters encounter on encounter.id = scene.encounter_id
        where encounter.campaign_id = ${campaignId}::uuid
          and (
            scene.definition_snapshot #>> '{map,assetId}' = ${assetId}
            or scene.projection #>> '{map,assetId}' = ${assetId}
          )
      ) as attached
    `.execute(db)
    if (!attachment.rows[0]?.attached) throw new MediaAccessError()
  }
  const overview = await media.findVariant(assetId, 'DISPLAY')
  const tiles = await media.listVttMapTiles(assetId)
  if (!overview || overview.width === null || overview.height === null || tiles.length === 0) {
    throw new MediaNotFoundError()
  }
  const expiresInSeconds = 5 * 60
  const expiresAt = isoAfter(expiresInSeconds * 1000)
  const supabase = createSupabaseClient()
  const overviewUrl = await supabase.storage
    .from(bucket)
    .createSignedUrl(overview.object_key, expiresInSeconds)
  if (overviewUrl.error || !overviewUrl.data?.signedUrl) {
    throw new Error('Unable to create map overview URL.')
  }
  const signedTiles: SignedVttMapDeliveryDto['tiles'] = []
  for (const tile of tiles) {
    const signed = await supabase.storage
      .from(bucket)
      .createSignedUrl(tile.object_key, expiresInSeconds)
    if (signed.error || !signed.data?.signedUrl) throw new Error('Unable to create map tile URL.')
    signedTiles.push({
      column: tile.column_index,
      height: tile.height,
      row: tile.row_index,
      url: signed.data.signedUrl,
      width: tile.width
    })
  }
  if (asset.width === null || asset.height === null) throw new MediaNotFoundError()
  return {
    assetId,
    expiresAt,
    height: asset.height,
    overview: { height: overview.height, url: overviewUrl.data.signedUrl, width: overview.width },
    tiles: signedTiles,
    width: asset.width
  }
}

export async function finalizeCampaignFileUpload(
  db: DBLike,
  userId: string,
  assetId: string
): Promise<FinalizeImageUploadOutput> {
  const media = createMediaRepository(db)
  const found = await media.findById(assetId)
  if (!found) throw new MediaNotFoundError()
  if (found.owner_user_id !== userId) throw new MediaAccessError()
  if (found.profile !== 'CAMPAIGN_FILE' && found.profile !== 'CAMPAIGN_HANDOUT_MAP') {
    throw new MediaAccessError()
  }
  const campaignId = found.target_key.slice(found.target_key.indexOf(':') + 1)
  await requireActiveCampaignMember(db, campaignId, userId)
  if (found.declared_mime_type !== 'text/plain') {
    const result = await finalizeImageUpload(db, userId, assetId)
    return { ...result, preview: null }
  }
  if (found.profile === 'CAMPAIGN_HANDOUT_MAP') {
    throw new MediaValidationError('Handout maps must be images.')
  }
  if (found.status === 'READY') return { assetId, status: 'READY', preview: null }

  const asset = await media.claimForProcessing(assetId, userId)
  if (!asset) throw new MediaConflictError()
  let readyKey: string | null = null
  try {
    const download = await createSupabaseClient()
      .storage.from(bucket)
      .download(asset.raw_object_key)
    if (download.error || !download.data)
      throw new MediaValidationError('Upload data was not found.')
    const source = Buffer.from(await download.data.arrayBuffer())
    if (source.byteLength > maxBytes)
      throw new MediaValidationError('File exceeds the 6 MiB limit.')
    let text: string
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(source)
    } catch {
      throw new MediaValidationError('Text files must use valid UTF-8.')
    }
    let containsControlCharacter = false
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index)
      if (
        code === 0 ||
        (code >= 1 && code <= 8) ||
        code === 11 ||
        code === 12 ||
        (code >= 14 && code <= 31) ||
        code === 127
      ) {
        containsControlCharacter = true
        break
      }
    }
    if (containsControlCharacter) {
      throw new MediaValidationError('Text files cannot contain control characters.')
    }
    const body = Buffer.from(text, 'utf8')
    readyKey = `ready/${userId}/${assetId}/${randomUUID()}.txt`
    const objectKey = readyKey
    await media.scheduleObjectDeletions([objectKey])
    const upload = await createSupabaseClient().storage.from(bucket).upload(objectKey, body, {
      contentType: 'text/plain; charset=utf-8',
      upsert: false
    })
    if (upload.error) throw new Error('Unable to store processed text file.')
    const ready = await withTransaction(db, async (trx) => {
      const repository = createMediaRepository(trx)
      if (!(await repository.lockOwner(userId))) throw new MediaAccessError()
      return repository.replaceReady({
        assetId,
        ownerUserId: userId,
        quotaBytes: await getStorageQuotaBytes(trx, userId),
        reservationBytes: maxBytes,
        verifiedMimeType: 'text/plain',
        verifiedBytes: body.byteLength,
        width: null,
        height: null,
        variants: [
          {
            id: randomUUID(),
            kind: 'SOURCE',
            object_key: objectKey,
            mime_type: 'text/plain',
            byte_size: body.byteLength,
            width: null,
            height: null
          }
        ]
      })
    })
    if (!ready) throw new MediaQuotaError()
    await removeMediaObjects(db, [asset.raw_object_key])
    return { assetId, status: 'READY', preview: null }
  } catch (error) {
    if (error instanceof MediaValidationError || error instanceof MediaQuotaError) {
      await removeMediaObjects(
        db,
        [readyKey, asset.raw_object_key].filter((key): key is string => Boolean(key))
      )
      await media.reject(assetId, error.message)
      return { assetId, status: 'REJECTED', preview: null }
    }
    await removeMediaObjects(
      db,
      [readyKey].filter((key): key is string => Boolean(key))
    )
    await media.resetPending(assetId)
    throw error
  }
}

export async function getCampaignFileDelivery(
  db: DBLike,
  assetId: string
): Promise<SignedCampaignFileDeliveryDto> {
  const media = createMediaRepository(db)
  const asset = await media.findById(assetId)
  if (!asset || asset.status !== 'READY') throw new MediaNotFoundError()
  if (asset.profile !== 'CAMPAIGN_FILE' && asset.profile !== 'CAMPAIGN_HANDOUT_MAP') {
    throw new MediaAccessError()
  }
  const variant = await media.findVariant(assetId, 'SOURCE')
  if (!variant) throw new MediaNotFoundError()
  const { data, error } = await createSupabaseClient()
    .storage.from(bucket)
    .createSignedUrl(variant.object_key, 5 * 60, {
      download: asset.original_file_name
    })
  if (error || !data?.signedUrl) throw new Error('Unable to create file delivery URL.')
  return {
    assetId,
    url: data.signedUrl,
    expiresAt: isoAfter(5 * 60 * 1000),
    mimeType: variant.mime_type as SignedCampaignFileDeliveryDto['mimeType'],
    fileName: asset.original_file_name,
    byteSize: variant.byte_size
  }
}

async function ensureAuthoredWritable(
  db: DBLike,
  userId: string,
  subjectKind: string,
  subjectId: string
) {
  const result = await sql<{ writable: boolean }>`
    select exists(select 1 from authored_drafts where subject_kind = ${subjectKind} and subject_id = ${subjectId}::uuid and user_id = ${userId}::uuid) as writable
  `.execute(db)
  if (result.rows[0]?.writable) return
  try {
    const ownership = await assertWritableAuthoredSubject(
      db,
      subjectKind as Parameters<typeof assertWritableAuthoredSubject>[1],
      subjectId,
      userId
    )
    if (!ownership) throw new MediaAccessError()
  } catch {
    throw new MediaAccessError()
  }
}

async function lockAuthoredDraft(
  db: DBLike,
  userId: string,
  subjectKind: string,
  subjectId: string
): Promise<void> {
  const result = await sql<{ subject_id: string }>`
    select subject_id from authored_drafts
    where subject_kind = ${subjectKind} and subject_id = ${subjectId}::uuid
      and user_id = ${userId}::uuid
    for update
  `.execute(db)
  if (!result.rows[0]) throw new MediaAccessError()
}

export async function attachImage(
  db: DBLike,
  userId: string,
  input: AttachImageInput
): Promise<void> {
  const media = createMediaRepository(db)
  const targetKey = mediaTargetKey(input.target)
  const asset = await media.findById(input.assetId)
  if (!asset) throw new MediaNotFoundError()
  assertReadyOwnedAsset(asset, userId, input.target.type, targetKey)
  const crop = input.crop
  if (!crop) throw new MediaValidationError('A square crop is required.')
  if (input.target.type === 'ACCOUNT_AVATAR') {
    const profile = await sql<{
      id: string
    }>`select id from profiles where id = ${userId}::uuid`.execute(db)
    if (!profile.rows[0]) throw new MediaAccessError()
  }
  const characterId = input.target.type === 'CHARACTER_PORTRAIT' ? input.target.characterId : null
  if (characterId) {
    const character = await sql<{
      id: string
    }>`select id from characters where id = ${characterId}::uuid and user_id = ${userId}::uuid`.execute(
      db
    )
    if (!character.rows[0]) throw new MediaAccessError()
  }
  const source = await media.findVariant(asset.id, 'SOURCE')
  if (!source || source.width === null || source.height === null) throw new MediaNotFoundError()
  const supabase = createSupabaseClient()
  const { data: file, error } = await supabase.storage.from(bucket).download(source.object_key)
  if (error || !file) throw new Error('Unable to load source image.')
  const pixels = cropPixels(source.width, source.height, crop)
  if (Math.abs(pixels.width - pixels.height) > 2) {
    throw new MediaValidationError('Thumbnail crops must be square.')
  }
  const output = await sharp(Buffer.from(await file.arrayBuffer()))
    .extract(pixels)
    .resize(320, 320, { fit: 'cover', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true })
  const body = output.data
  const id = randomUUID()
  const objectKey = `ready/${userId}/${asset.id}/${id}.webp`
  await media.scheduleObjectDeletions([objectKey])
  const upload = await supabase.storage
    .from(bucket)
    .upload(objectKey, body, { contentType: 'image/webp', upsert: false })
  if (upload.error) throw new Error('Unable to store image crop.')
  let oldKey: string | null
  try {
    oldKey = await withTransaction(db, async (trx) => {
      const repository = createMediaRepository(trx)
      const target = input.target
      if (target.type === 'AUTHORED_IMAGE') {
        await lockAuthoredDraft(trx, userId, target.subjectKind, target.subjectId)
      }
      if (!(await repository.lockOwner(userId))) throw new MediaAccessError()
      const quotaBytes = await getStorageQuotaBytes(trx, userId)
      assertReadyOwnedAsset(
        await repository.findByIdForUpdate(input.assetId),
        userId,
        target.type,
        targetKey
      )
      const replacement = await repository.replaceThumbnail(asset.id, userId, quotaBytes, {
        id,
        kind: 'THUMBNAIL',
        object_key: objectKey,
        mime_type: 'image/webp',
        byte_size: body.byteLength,
        width: output.info.width,
        height: output.info.height
      })
      if (!replacement) throw new MediaQuotaError()
      await repository.setCrop(asset.id, crop)
      if (target.type === 'AUTHORED_IMAGE') {
        await repository.upsertAuthoredSlot({
          subject_kind: target.subjectKind,
          subject_id: target.subjectId,
          scope: 'DRAFT',
          asset_id: asset.id,
          alt_text: null,
          is_decorative: true
        })
      } else if (target.type === 'ACCOUNT_AVATAR') {
        await repository.setAccountAvatar(userId, asset.id)
      } else if (
        !characterId ||
        !(await repository.setCharacterPortrait(userId, characterId, asset.id))
      ) {
        throw new MediaAccessError()
      }
      return replacement.previousObjectKey
    })
  } catch (error) {
    await removeMediaObjects(db, [objectKey])
    throw error
  }
  if (oldKey) await removeMediaObjects(db, [oldKey])
}

export async function removeImage(
  db: DBLike,
  userId: string,
  input: RemoveImageInput
): Promise<void> {
  const media = createMediaRepository(db)
  if (input.target.type === 'ACCOUNT_AVATAR') return media.setAccountAvatar(userId, null)
  if (input.target.type === 'CHARACTER_PORTRAIT') {
    if (!(await media.setCharacterPortrait(userId, input.target.characterId, null)))
      throw new MediaAccessError()
    return
  }
  const target = input.target
  if (target.type !== 'AUTHORED_IMAGE') throw new MediaAccessError()
  await withTransaction(db, async (trx) => {
    await lockAuthoredDraft(trx, userId, target.subjectKind, target.subjectId)
    await createMediaRepository(trx).upsertAuthoredSlot({
      subject_kind: target.subjectKind,
      subject_id: target.subjectId,
      scope: 'DRAFT',
      asset_id: null,
      alt_text: null,
      is_decorative: false
    })
  })
}

export async function getImage(
  db: DBLike,
  userId: string,
  input: ImageLookupInput
): Promise<SignedImageDeliveryDto | null> {
  const media = createMediaRepository(db)
  let assetId: string | null = null
  let altText: string | null = null
  let isDecorative = false
  if (input.target.type === 'ACCOUNT_AVATAR') {
    const row = await sql<{
      avatar_asset_id: string | null
    }>`select avatar_asset_id from profiles where id = ${userId}::uuid`.execute(db)
    assetId = row.rows[0]?.avatar_asset_id ?? null
  } else if (input.target.type === 'CHARACTER_PORTRAIT') {
    const row = await sql<{
      portrait_asset_id: string | null
    }>`select portrait_asset_id from characters where id = ${input.target.characterId}::uuid and user_id = ${userId}::uuid`.execute(
      db
    )
    assetId = row.rows[0]?.portrait_asset_id ?? null
  } else {
    if (input.target.scope === 'DRAFT')
      await ensureAuthoredWritable(db, userId, input.target.subjectKind, input.target.subjectId)
    else {
      const access = await sql<{
        allowed: boolean
      }>`select public.can_access_authored_route_id(${input.target.subjectKind}, ${input.target.subjectId}::uuid) as allowed`.execute(
        db
      )
      if (!access.rows[0]?.allowed) throw new MediaAccessError()
    }
    const slot =
      (await media.getAuthoredSlot(
        input.target.subjectKind,
        input.target.subjectId,
        input.target.scope
      )) ??
      (input.target.scope === 'DRAFT'
        ? await media.getAuthoredSlot(input.target.subjectKind, input.target.subjectId, 'ACTIVE')
        : null)
    assetId = slot?.asset_id ?? null
    altText = slot?.alt_text ?? null
    isDecorative = slot?.is_decorative ?? false
  }
  if (!assetId) return null
  const delivery = await signedDelivery(db, assetId, input.variantKind ?? 'DISPLAY')
  return delivery ? { ...delivery, altText, isDecorative } : null
}

export async function purgeOwnedMedia(db: DBLike, userId: string): Promise<number> {
  const media = createMediaRepository(db)
  const assets = await media.claimCleanupObjects(userId)
  const supabase = createSupabaseClient()
  for (const asset of assets) {
    const readyPrefix = `ready/${userId}/${asset.assetId}`
    const listed = await supabase.storage.from(bucket).list(readyPrefix, { limit: 1000 })
    if (listed.error) throw new Error('Unable to list media files for cleanup.')
    const objectKeys = [
      asset.rawObjectKey,
      ...asset.objectKeys,
      ...(listed.data ?? []).map((object) => `${readyPrefix}/${object.name}`)
    ]
    const { error } = await supabase.storage.from(bucket).remove([...new Set(objectKeys)])
    if (error) throw new Error('Unable to remove media files.')
    await media.deleteAsset(asset.assetId)
    await media.completeObjectDeletions(objectKeys)
  }
  return assets.length
}

export async function cleanupScheduledMediaObjects(db: DBLike): Promise<number> {
  const keys = await createMediaRepository(db).listObjectDeletions()
  if (keys.length === 0) return 0
  if (!(await removeMediaObjects(db, keys))) throw new Error('Unable to remove queued media files.')
  return keys.length
}
