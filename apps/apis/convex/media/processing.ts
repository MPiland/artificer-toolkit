'use node'

import sharp from 'sharp'
import type { z } from 'zod'
import { normalizedImageCropSchema } from '@artificer-toolkit/schema/api/media'
import type {
  campaignFileMimeTypeSchema,
  imageMimeTypeSchema,
  mediaProfileSchema,
  MediaVariantKind
} from '@artificer-toolkit/schema/api/media'
import type { NormalizedImageCrop } from '@artificer-toolkit/schema/api/media'

type MediaProfile = z.infer<typeof mediaProfileSchema>
type ImageMimeType = z.infer<typeof imageMimeTypeSchema>
type MediaMimeType = z.infer<typeof campaignFileMimeTypeSchema>

export interface ProcessedMedia {
  originalByteSize: number
  verifiedByteSize: number
  verifiedMimeType: MediaMimeType
  width: number | null
  height: number | null
  variants: {
    kind: MediaVariantKind
    bytes: Buffer
    mimeType: 'image/webp' | 'text/plain'
    width: number | null
    height: number | null
  }[]
  tiles: {
    row: number
    column: number
    bytes: Buffer
    mimeType: 'image/webp'
    width: number
    height: number
  }[]
}

export class MediaValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MediaValidationError'
  }
}

export async function cropMediaThumbnail(
  source: Uint8Array,
  crop: NormalizedImageCrop
): Promise<ProcessedMedia['variants'][number]> {
  if (source.byteLength === 0) throw new MediaValidationError('Upload data is empty.')
  const parsedCrop = normalizedImageCropSchema.safeParse(crop)
  if (!parsedCrop.success) throw new MediaValidationError('Thumbnail crop is invalid.')

  const input = Buffer.from(source)
  const metadata = await sharp(input, { limitInputPixels: 25_000_000 })
    .metadata()
    .catch(() => {
      throw new MediaValidationError('Image data could not be decoded.')
    })
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > 25_000_000) {
    throw new MediaValidationError('Image data could not be decoded.')
  }

  const { width, height } = metadata
  const left = Math.max(0, Math.min(width - 1, Math.round(parsedCrop.data.x * width)))
  const top = Math.max(0, Math.min(height - 1, Math.round(parsedCrop.data.y * height)))
  const cropWidth = Math.max(1, Math.min(width - left, Math.round(parsedCrop.data.width * width)))
  const cropHeight = Math.max(
    1,
    Math.min(height - top, Math.round(parsedCrop.data.height * height))
  )
  if (Math.abs(cropWidth - cropHeight) > 2) {
    throw new MediaValidationError('Thumbnail crops must be square.')
  }

  const output = await sharp(input, { limitInputPixels: 25_000_000 })
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize(320, 320, { fit: 'cover', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true })
    .catch(() => {
      throw new MediaValidationError('Image data could not be processed.')
    })

  return {
    kind: 'THUMBNAIL',
    bytes: output.data,
    mimeType: 'image/webp',
    width: output.info.width,
    height: output.info.height
  }
}

/** Returns only normalized media; original image bytes and metadata never leave this helper. */
export async function processMedia(
  bytes: Uint8Array,
  profile: MediaProfile,
  declaredMimeType: MediaMimeType
): Promise<ProcessedMedia> {
  const isMap = profile === 'VTT_MAP'
  const isText = declaredMimeType === 'text/plain'
  const label = isMap ? 'Map' : isText ? 'File' : 'Image'
  const maxBytes = (isMap ? 25 : 6) * 1024 * 1024
  const maxPixels = isMap ? 64_000_000 : 25_000_000
  if (bytes.byteLength === 0) throw new MediaValidationError('Upload data is empty.')
  if (bytes.byteLength > maxBytes) {
    throw new MediaValidationError(`${label} exceeds the ${isMap ? 25 : 6} MiB limit.`)
  }
  const source = Buffer.from(bytes)

  if (isText) {
    if (profile === 'CAMPAIGN_HANDOUT_MAP') {
      throw new MediaValidationError('Handout maps must be images.')
    }
    if (profile !== 'CAMPAIGN_FILE') {
      throw new MediaValidationError(
        `${isMap ? 'Map' : 'Image'} format or dimensions are not supported.`
      )
    }
    let text: string
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(source)
    } catch {
      throw new MediaValidationError('Text files must use valid UTF-8.')
    }
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index)
      if (code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127) {
        throw new MediaValidationError('Text files cannot contain control characters.')
      }
    }
    const body = Buffer.from(text, 'utf8')
    if (body.byteLength === 0) throw new MediaValidationError('Upload data is empty.')
    return {
      originalByteSize: source.byteLength,
      verifiedByteSize: body.byteLength,
      verifiedMimeType: 'text/plain',
      width: null,
      height: null,
      variants: [
        {
          kind: 'SOURCE',
          bytes: body,
          mimeType: 'text/plain',
          width: null,
          height: null
        }
      ],
      tiles: []
    }
  }

  const inspection = await sharp(source, { animated: true })
    .metadata()
    .catch(() => {
      throw new MediaValidationError('Image data could not be decoded.')
    })
  const mime: ImageMimeType | null =
    inspection.format === 'jpeg'
      ? 'image/jpeg'
      : inspection.format === 'png'
        ? 'image/png'
        : inspection.format === 'webp'
          ? 'image/webp'
          : null
  const matchesSignature =
    mime === 'image/jpeg'
      ? source.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
      : mime === 'image/png'
        ? source
            .subarray(0, 8)
            .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        : mime === 'image/webp' &&
          source.toString('ascii', 0, 4) === 'RIFF' &&
          source.toString('ascii', 8, 12) === 'WEBP'
  if (
    !mime ||
    !matchesSignature ||
    (inspection.pages ?? 1) > 1 ||
    !inspection.width ||
    !inspection.height ||
    inspection.width > 8192 ||
    inspection.height > 8192 ||
    inspection.width * inspection.height > maxPixels
  ) {
    throw new MediaValidationError(`${label} format or dimensions are not supported.`)
  }
  if (mime !== declaredMimeType) {
    throw new MediaValidationError(`${label} type does not match the upload intent.`)
  }

  // Content art is capped at 2048 px; handout maps keep 4096 px and VTT maps keep full size (Q17).
  const sourceLimit = profile === 'CAMPAIGN_HANDOUT_MAP' ? 4096 : 2048
  const pipeline = sharp(source, { limitInputPixels: maxPixels }).rotate()
  if (!isMap) pipeline.resize(sourceLimit, sourceLimit, { fit: 'inside', withoutEnlargement: true })
  const normalized = await pipeline
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true })
    .catch(() => {
      throw new MediaValidationError(`${label} data could not be normalized.`)
    })
  const { width, height } = normalized.info
  if (!width || !height) throw new MediaValidationError(`${label} dimensions are unavailable.`)

  const variants: ProcessedMedia['variants'] = []
  for (const [kind, limit] of [
    ['SOURCE', sourceLimit],
    ['DISPLAY', 1600],
    ['THUMBNAIL', 320]
  ] as const) {
    if (isMap && kind === 'SOURCE') continue
    const scale = Math.min(1, limit / Math.max(width, height))
    const size = {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale))
    }
    const output =
      kind === 'SOURCE'
        ? normalized
        : await sharp(normalized.data)
            .resize(size.width, size.height, {
              fit: 'inside',
              withoutEnlargement: true
            })
            .webp({ quality: 85 })
            .toBuffer({ resolveWithObject: true })
    variants.push({
      kind,
      bytes: output.data,
      mimeType: 'image/webp',
      width: output.info.width,
      height: output.info.height
    })
  }

  const tiles: ProcessedMedia['tiles'] = []
  if (isMap) {
    const rows = Math.ceil(height / 1024)
    const columns = Math.ceil(width / 1024)
    if (rows * columns > 64) {
      throw new MediaValidationError('Map requires too many renderer tiles.')
    }
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const tileWidth = Math.min(1024, width - column * 1024)
        const tileHeight = Math.min(1024, height - row * 1024)
        const body = await sharp(normalized.data)
          .extract({
            left: column * 1024,
            top: row * 1024,
            width: tileWidth,
            height: tileHeight
          })
          .webp({ quality: 85 })
          .toBuffer()
        tiles.push({
          row,
          column,
          bytes: body,
          mimeType: 'image/webp',
          width: tileWidth,
          height: tileHeight
        })
      }
    }
  }
  return {
    originalByteSize: source.byteLength,
    verifiedByteSize: source.byteLength,
    verifiedMimeType: mime,
    width,
    height,
    variants,
    tiles
  }
}
