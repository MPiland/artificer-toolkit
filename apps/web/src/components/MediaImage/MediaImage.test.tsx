import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { MediaImageControl } from './MediaImageControl'
import { MediaImageDialog } from './MediaImageDialog'
import { MediaImageView } from './MediaImageView'

const mocks = vi.hoisted(() => ({
  attachImage: vi.fn(),
  createImageUpload: vi.fn(),
  finalizeImageUpload: vi.fn(),
  getImage: vi.fn(),
  removeImage: vi.fn(),
  uploadToSignedUrl: vi.fn()
}))

vi.mock('#app/lib/api', () => ({
  api: {
    media: {
      attachImage: mocks.attachImage,
      createImageUpload: mocks.createImageUpload,
      finalizeImageUpload: mocks.finalizeImageUpload,
      getImage: mocks.getImage,
      removeImage: mocks.removeImage
    }
  }
}))

vi.mock('#supabase/client', () => ({
  getSupabaseBrowserClient: () => ({
    storage: {
      from: () => ({ uploadToSignedUrl: mocks.uploadToSignedUrl })
    }
  })
}))

const artworkTarget = {
  lookup: {
    type: 'AUTHORED_IMAGE' as const,
    subjectKind: 'SPELL' as const,
    subjectId: '23a9776b-3d22-463f-a233-771c28244a83',
    scope: 'ACTIVE' as const
  },
  attach: {
    type: 'AUTHORED_IMAGE' as const,
    subjectKind: 'SPELL' as const,
    subjectId: '23a9776b-3d22-463f-a233-771c28244a83'
  }
}

describe('MediaImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders authored alt text from signed delivery metadata', async () => {
    mocks.getImage.mockResolvedValue({
      assetId: 'a2c914ed-8628-4a69-831c-766d7df1ef63',
      variantKind: 'DISPLAY',
      url: 'https://example.com/artwork.webp',
      expiresAt: '2026-08-05T18:00:00.000Z',
      width: 1200,
      height: 800,
      mimeType: 'image/webp',
      crop: null,
      altText: 'A wizard tracing a circle of flame.',
      isDecorative: false
    })

    renderWithAppProviders(<MediaImageView target={artworkTarget} />)

    expect(
      await screen.findByRole('img', { name: 'A wizard tracing a circle of flame.' })
    ).toBeInTheDocument()
  })

  it('caches display and thumbnail variants separately for the same target', async () => {
    mocks.getImage
      .mockResolvedValueOnce({
        assetId: 'a2c914ed-8628-4a69-831c-766d7df1ef63',
        variantKind: 'DISPLAY',
        url: 'https://example.com/artwork.webp',
        expiresAt: '2026-08-05T18:00:00.000Z',
        width: 1200,
        height: 800,
        mimeType: 'image/webp',
        crop: null,
        altText: 'A wizard tracing a circle of flame.',
        isDecorative: false
      })
      .mockResolvedValueOnce({
        assetId: 'a2c914ed-8628-4a69-831c-766d7df1ef63',
        variantKind: 'THUMBNAIL',
        url: 'https://example.com/thumbnail.webp',
        expiresAt: '2026-08-05T18:00:00.000Z',
        width: 320,
        height: 320,
        mimeType: 'image/webp',
        crop: { x: 0.125, y: 0, width: 0.75, height: 1 },
        altText: null,
        isDecorative: true
      })

    const view = renderWithAppProviders(<MediaImageView target={artworkTarget} />)
    expect(
      await screen.findByRole('img', { name: 'A wizard tracing a circle of flame.' })
    ).toHaveAttribute('src', 'https://example.com/artwork.webp')

    view.rerender(
      <>
        <MediaImageView target={artworkTarget} />
        <MediaImageControl
          label='Add an image'
          mode='decorative'
          profile='AUTHORED_IMAGE'
          target={artworkTarget}
        />
      </>
    )

    const control = await screen.findByRole('button', { name: 'Change image' })
    expect(control.querySelector('img')).toHaveAttribute(
      'src',
      'https://example.com/thumbnail.webp'
    )
    expect(mocks.getImage).toHaveBeenCalledWith({
      target: artworkTarget.lookup,
      variantKind: 'THUMBNAIL'
    })
  })

  it('keeps the portrait trigger compact and loads its thumbnail while disabled', async () => {
    mocks.getImage.mockResolvedValue(null)
    renderWithAppProviders(
      <MediaImageControl
        disabled
        label='Change portrait'
        mode='square'
        profile='CHARACTER_PORTRAIT'
        target={{
          lookup: {
            type: 'CHARACTER_PORTRAIT',
            characterId: 'ca608635-554d-4c53-a10a-17fe6aa6db45'
          },
          attach: {
            type: 'CHARACTER_PORTRAIT',
            characterId: 'ca608635-554d-4c53-a10a-17fe6aa6db45'
          }
        }}
        variant='portrait'
      />
    )

    expect(screen.getByRole('button', { name: 'Change portrait' })).toBeDisabled()
    await waitFor(() =>
      expect(mocks.getImage).toHaveBeenCalledWith({
        target: {
          type: 'CHARACTER_PORTRAIT',
          characterId: 'ca608635-554d-4c53-a10a-17fe6aa6db45'
        },
        variantKind: 'THUMBNAIL'
      })
    )
  })

  it('loads the selected thumbnail framing in the compact artwork control', async () => {
    mocks.getImage.mockResolvedValue(null)
    renderWithAppProviders(
      <MediaImageControl
        label='Add an image'
        mode='decorative'
        profile='AUTHORED_IMAGE'
        target={artworkTarget}
      />
    )

    await waitFor(() =>
      expect(mocks.getImage).toHaveBeenCalledWith({
        target: artworkTarget.lookup,
        variantKind: 'THUMBNAIL'
      })
    )
    expect(screen.getByRole('button', { name: 'Add an image' })).toBeInTheDocument()
  })

  it('shows the selected artwork in the same control', async () => {
    mocks.getImage.mockResolvedValue({
      assetId: 'a2c914ed-8628-4a69-831c-766d7df1ef63',
      variantKind: 'THUMBNAIL',
      url: 'https://example.com/thumbnail.webp',
      expiresAt: '2026-08-05T18:00:00.000Z',
      width: 320,
      height: 320,
      mimeType: 'image/webp',
      crop: { x: 0.125, y: 0, width: 0.75, height: 1 },
      altText: null,
      isDecorative: true
    })

    renderWithAppProviders(
      <MediaImageControl
        label='Add an image'
        mode='decorative'
        profile='AUTHORED_IMAGE'
        target={artworkTarget}
      />
    )

    expect(await screen.findByRole('button', { name: 'Change image' })).toContainElement(
      document.querySelector('img')
    )
  })

  it('uploads authored artwork as decorative based on the control intent', async () => {
    const user = userEvent.setup()
    const beforeChange = vi.fn()
    const onClose = vi.fn()
    mocks.createImageUpload.mockResolvedValue({
      assetId: 'a2c914ed-8628-4a69-831c-766d7df1ef63',
      bucket: 'media',
      objectKey: 'raw/user/asset',
      token: 'signed-upload-token',
      expiresAt: '2026-08-05T18:00:00.000Z'
    })
    mocks.uploadToSignedUrl.mockResolvedValue({ error: null })
    mocks.finalizeImageUpload.mockResolvedValue({
      assetId: 'a2c914ed-8628-4a69-831c-766d7df1ef63',
      status: 'READY',
      preview: null
    })
    mocks.attachImage.mockResolvedValue({ ok: true })

    renderWithAppProviders(
      <MediaImageDialog
        beforeChange={beforeChange}
        current={null}
        label='Artwork'
        mode='decorative'
        opened
        profile='AUTHORED_IMAGE'
        target={artworkTarget}
        onClose={onClose}
      />
    )
    expect(screen.getByRole('button', { name: 'Save image' })).toBeDisabled()
    expect(screen.queryByRole('textbox', { name: 'Image description' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Decorative image' })).not.toBeInTheDocument()
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')
    expect(fileInput).not.toBeNull()
    await user.upload(fileInput!, new File(['image'], 'spell.png', { type: 'image/png' }))
    expect(await screen.findByText('Thumbnail framing')).toBeInTheDocument()
    const preview = await waitFor(() => {
      const image = document.querySelector<HTMLImageElement>('.ReactCrop img')
      expect(image).not.toBeNull()
      return image!
    })
    Object.defineProperties(preview, {
      naturalWidth: { value: 800 },
      naturalHeight: { value: 600 }
    })
    fireEvent.load(preview)
    await user.click(screen.getByRole('button', { name: 'Save image' }))

    await waitFor(() =>
      expect(mocks.attachImage).toHaveBeenCalledWith({
        assetId: 'a2c914ed-8628-4a69-831c-766d7df1ef63',
        target: artworkTarget.attach,
        crop: { x: 0.125, y: 0, width: 0.75, height: 1 },
        isDecorative: true
      })
    )
    expect(mocks.uploadToSignedUrl).toHaveBeenCalled()
    expect(beforeChange).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalled()
  })
})
