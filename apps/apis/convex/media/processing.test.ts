// @vitest-environment node

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { cropMediaThumbnail, MediaValidationError, processMedia } from './processing'

function image(width = 40, height = 20) {
  return sharp({
    create: { width, height, channels: 3, background: '#ec8c06' }
  })
}

describe('media processing', () => {
  it('crops a square thumbnail and reports verified output dimensions', async () => {
    const pixels = Buffer.alloc(640 * 640 * 3)
    for (let y = 0; y < 640; y += 1) {
      for (let x = 0; x < 640; x += 1) {
        const offset = (y * 640 + x) * 3
        pixels[offset] = x < 320 ? 255 : 0
        pixels[offset + 1] = x < 320 ? 0 : 255
        pixels[offset + 2] = 0
      }
    }
    const source = await sharp(pixels, {
      raw: { width: 640, height: 640, channels: 3 }
    })
      .webp()
      .toBuffer()

    const result = await cropMediaThumbnail(source, {
      x: 0.5,
      y: 0,
      width: 0.5,
      height: 0.5
    })
    expect(result).toMatchObject({
      kind: 'THUMBNAIL',
      mimeType: 'image/webp',
      width: 320,
      height: 320
    })
    const { data, info } = await sharp(result.bytes).raw().toBuffer({ resolveWithObject: true })
    const center =
      (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels
    expect(data[center + 1]).toBeGreaterThan(180)
    expect(data[center]).toBeLessThan(80)
  })

  it('rejects invalid and nonsquare thumbnail crops', async () => {
    const source = await image(640, 640).webp().toBuffer()
    await expect(
      cropMediaThumbnail(source, { x: 0.8, y: 0, width: 0.5, height: 0.5 })
    ).rejects.toBeInstanceOf(MediaValidationError)
    await expect(
      cropMediaThumbnail(source, { x: 0, y: 0, width: 0.5, height: 0.25 })
    ).rejects.toThrow('Thumbnail crops must be square.')
  })

  it.each(['jpeg', 'png', 'webp'] as const)(
    'verifies %s and produces metadata-free WebP without enlarging',
    async (format) => {
      const source = await image().toFormat(format).toBuffer()
      const result = await processMedia(source, 'ACCOUNT_AVATAR', `image/${format}`)

      expect(result).toMatchObject({
        originalByteSize: source.byteLength,
        verifiedByteSize: source.byteLength,
        verifiedMimeType: `image/${format}`,
        width: 40,
        height: 20,
        tiles: []
      })
      expect(result.variants.map(({ kind }) => kind)).toEqual(['SOURCE', 'DISPLAY', 'THUMBNAIL'])
      for (const variant of result.variants) {
        const metadata = await sharp(variant.bytes).metadata()
        expect(metadata).toMatchObject({
          format: 'webp',
          width: 40,
          height: 20
        })
        expect(metadata.exif).toBeUndefined()
        expect(metadata.icc).toBeUndefined()
        expect(variant).toMatchObject({
          mimeType: 'image/webp',
          width: 40,
          height: 20
        })
      }
    }
  )

  it.each([
    ['ACCOUNT_AVATAR', 2048, 1024],
    ['CHARACTER_PORTRAIT', 2048, 1024],
    ['AUTHORED_IMAGE', 2048, 1024],
    ['CAMPAIGN_FILE', 2048, 1024],
    ['CAMPAIGN_HANDOUT_MAP', 4096, 2048]
  ] as const)('normalizes %s to a %ipx source and does not crop', async (profile, width, height) => {
    const source = await image(4200, 2100).png().toBuffer()
    const result = await processMedia(source, profile, 'image/png')
    expect([result.width, result.height]).toEqual([width, height])
    expect(
      result.variants.map(({ kind, width, height }) => ({
        kind,
        width,
        height
      }))
    ).toEqual([
      { kind: 'SOURCE', width, height },
      { kind: 'DISPLAY', width: 1600, height: 800 },
      { kind: 'THUMBNAIL', width: 320, height: 160 }
    ])
    for (const variant of result.variants) {
      expect(await sharp(variant.bytes).metadata()).toMatchObject({
        width: variant.width,
        height: variant.height
      })
    }
  })

  it('applies EXIF orientation and removes the source EXIF and ICC from every result', async () => {
    const source = await image()
      .jpeg()
      .withMetadata({ orientation: 6 })
      .withExifMerge({
        IFD0: {
          Artist: 'private creator',
          ImageDescription: 'private source metadata'
        }
      })
      .toBuffer()
    const inputMetadata = await sharp(source).metadata()
    expect(inputMetadata.orientation).toBe(6)
    expect(inputMetadata.exif).toBeDefined()
    expect(inputMetadata.icc).toBeDefined()

    const result = await processMedia(source, 'AUTHORED_IMAGE', 'image/jpeg')
    expect([result.width, result.height]).toEqual([20, 40])
    for (const variant of result.variants) {
      const metadata = await sharp(variant.bytes).metadata()
      expect(metadata).toMatchObject({ width: 20, height: 40, format: 'webp' })
      expect(metadata.orientation).toBeUndefined()
      expect(metadata.exif).toBeUndefined()
      expect(metadata.icc).toBeUndefined()
      expect(variant.bytes.includes(Buffer.from('private source metadata'))).toBe(false)
    }
  })

  it('rejects MIME mismatch and invalid or unsupported input', async () => {
    const source = await image().png().toBuffer()
    await expect(processMedia(source, 'AUTHORED_IMAGE', 'image/jpeg')).rejects.toThrow(
      'Image type does not match the upload intent.'
    )
    await expect(processMedia(source, 'VTT_MAP', 'image/webp')).rejects.toThrow(
      'Map type does not match the upload intent.'
    )
    await expect(
      processMedia(Buffer.from('not an image'), 'ACCOUNT_AVATAR', 'image/png')
    ).rejects.toThrow('Image data could not be decoded.')
    await expect(
      processMedia(
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'),
        'ACCOUNT_AVATAR',
        'image/png'
      )
    ).rejects.toThrow('Image format or dimensions are not supported.')
    await expect(
      processMedia(source.subarray(0, 24), 'ACCOUNT_AVATAR', 'image/png')
    ).rejects.toBeInstanceOf(MediaValidationError)
  })

  it('rejects animated WebP rather than silently keeping its first frame', async () => {
    const source = await sharp(Buffer.from([255, 0, 0, 0, 255, 0]), {
      raw: { width: 1, height: 2, channels: 3, pageHeight: 1 }
    })
      .webp({ loop: 0, delay: [100, 100] })
      .toBuffer()
    expect((await sharp(source, { animated: true }).metadata()).pages).toBe(2)
    await expect(processMedia(source, 'ACCOUNT_AVATAR', 'image/webp')).rejects.toThrow(
      'Image format or dimensions are not supported.'
    )
    await expect(processMedia(source, 'VTT_MAP', 'image/webp')).rejects.toThrow(
      'Map format or dimensions are not supported.'
    )
  })

  it('rejects empty input and the profile-specific byte limits before decoding', async () => {
    await expect(processMedia(Buffer.alloc(0), 'ACCOUNT_AVATAR', 'image/png')).rejects.toThrow(
      'Upload data is empty.'
    )
    await expect(processMedia(Buffer.alloc(0), 'CAMPAIGN_FILE', 'text/plain')).rejects.toThrow(
      'Upload data is empty.'
    )
    await expect(
      processMedia(Buffer.from('\uFEFF', 'utf8'), 'CAMPAIGN_FILE', 'text/plain')
    ).rejects.toThrow('Upload data is empty.')
    await expect(
      processMedia(Buffer.alloc(6 * 1024 * 1024 + 1), 'ACCOUNT_AVATAR', 'image/png')
    ).rejects.toThrow('Image exceeds the 6 MiB limit.')
    await expect(
      processMedia(Buffer.alloc(6 * 1024 * 1024 + 1), 'CAMPAIGN_FILE', 'text/plain')
    ).rejects.toThrow('File exceeds the 6 MiB limit.')
    await expect(
      processMedia(Buffer.alloc(25 * 1024 * 1024 + 1), 'VTT_MAP', 'image/png')
    ).rejects.toThrow('Map exceeds the 25 MiB limit.')
  })

  it.each([
    { profile: 'ACCOUNT_AVATAR', width: 8193, height: 1, label: 'Image' },
    { profile: 'ACCOUNT_AVATAR', width: 5001, height: 5000, label: 'Image' },
    { profile: 'VTT_MAP', width: 1, height: 8193, label: 'Map' },
    { profile: 'VTT_MAP', width: 8001, height: 8000, label: 'Map' }
  ] as const)(
    'rejects $profile dimensions $width × $height',
    async ({ profile, width, height, label }) => {
      const source = await image(width, height).png().toBuffer()
      await expect(processMedia(source, profile, 'image/png')).rejects.toThrow(
        `${label} format or dimensions are not supported.`
      )
    }
  )

  it('preserves full VTT dimensions and generates row-major tiles with exact edge sizes', async () => {
    const source = await image(1100, 4200).jpeg().withMetadata({ orientation: 6 }).toBuffer()
    const result = await processMedia(source, 'VTT_MAP', 'image/jpeg')
    expect([result.width, result.height]).toEqual([4200, 1100])
    expect(
      result.variants.map(({ kind, width, height }) => ({
        kind,
        width,
        height
      }))
    ).toEqual([
      { kind: 'DISPLAY', width: 1600, height: 419 },
      { kind: 'THUMBNAIL', width: 320, height: 84 }
    ])
    expect(
      result.tiles.map(({ row, column, width, height }) => ({
        row,
        column,
        width,
        height
      }))
    ).toEqual(
      [0, 1].flatMap((row) =>
        [0, 1, 2, 3, 4].map((column) => ({
          row,
          column,
          width: column === 4 ? 104 : 1024,
          height: row === 1 ? 76 : 1024
        }))
      )
    )
    expect(result.tiles.length).toBeLessThanOrEqual(64)
    for (const variant of result.variants) {
      const metadata = await sharp(variant.bytes).metadata()
      expect(metadata).toMatchObject({
        format: 'webp',
        width: variant.width,
        height: variant.height
      })
      expect(metadata.exif).toBeUndefined()
      expect(metadata.icc).toBeUndefined()
    }
    for (const tile of result.tiles) {
      const metadata = await sharp(tile.bytes).metadata()
      expect(metadata).toMatchObject({
        format: 'webp',
        width: tile.width,
        height: tile.height
      })
      expect(metadata.exif).toBeUndefined()
      expect(metadata.icc).toBeUndefined()
    }
  })

  it('normalizes UTF-8 campaign files without image dimensions and retains original byte size', async () => {
    const source = Buffer.from('\uFEFFNotes\r\n\tRésumé 🐉\n', 'utf8')
    const result = await processMedia(source, 'CAMPAIGN_FILE', 'text/plain')
    const normalized = Buffer.from('Notes\r\n\tRésumé 🐉\n', 'utf8')
    expect(result).toEqual({
      originalByteSize: source.byteLength,
      verifiedByteSize: normalized.byteLength,
      verifiedMimeType: 'text/plain',
      width: null,
      height: null,
      variants: [
        {
          kind: 'SOURCE',
          bytes: normalized,
          mimeType: 'text/plain',
          width: null,
          height: null
        }
      ],
      tiles: []
    })
  })

  it('rejects malformed UTF-8 and all forbidden C0/DEL text controls', async () => {
    await expect(
      processMedia(Buffer.from([0xc3, 0x28]), 'CAMPAIGN_FILE', 'text/plain')
    ).rejects.toThrow('Text files must use valid UTF-8.')
    for (const code of [...Array.from({ length: 32 }, (_, value) => value), 127]) {
      if (code === 9 || code === 10 || code === 13) continue
      await expect(
        processMedia(
          Buffer.from(`notes${String.fromCharCode(code)}`),
          'CAMPAIGN_FILE',
          'text/plain'
        )
      ).rejects.toThrow('Text files cannot contain control characters.')
    }
  })

  it.each([
    'ACCOUNT_AVATAR',
    'CHARACTER_PORTRAIT',
    'AUTHORED_IMAGE',
    'CAMPAIGN_HANDOUT_MAP',
    'VTT_MAP'
  ] as const)('does not accept text for %s', async (profile) => {
    await expect(processMedia(Buffer.from('notes'), profile, 'text/plain')).rejects.toBeInstanceOf(
      MediaValidationError
    )
  })
})
