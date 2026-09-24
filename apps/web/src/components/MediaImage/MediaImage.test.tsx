import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getFunctionName } from 'convex/server'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { MediaImageControl } from './MediaImageControl'
import { MediaImageDialog } from './MediaImageDialog'
import { MediaImageView } from './MediaImageView'

const mocks = vi.hoisted(() => ({
  getAvatarImage: vi.fn(),
  getPortraitImage: vi.fn(),
  createAvatarUpload: vi.fn(),
  createPortraitUpload: vi.fn(),
  removeAvatar: vi.fn(),
  removePortrait: vi.fn(),
  saveAvatar: vi.fn(),
  savePortrait: vi.fn(),
  getArtworkImage: vi.fn(),
  saveArtwork: vi.fn(),
  createArtworkUpload: vi.fn(),
  removeArtwork: vi.fn(),
  artworkBinding: { assetId: null, revision: 0 } as
    | { assetId: string | null; revision: number }
    | undefined,
  avatarBinding: { assetId: null, revision: 0 } as
    | { assetId: string | null; revision: number }
    | undefined,
  portraitBinding: { assetId: null, revision: 0 } as
    | { assetId: string | null; revision: number }
    | undefined,
  authenticated: true,
  convexQuery: vi.fn()
}))

vi.mock('@convex-dev/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convex-dev/react-query')>()),
  convexQuery: (_reference: unknown, args: unknown) => ({
    queryKey: ['avatar-binding', mocks.avatarBinding],
    queryFn: async () => mocks.avatarBinding,
    enabled: args !== 'skip'
  })
}))

vi.mock('convex/react', async (importOriginal) => {
  const original = await importOriginal<typeof import('convex/react')>()
  return {
    ...original,
    useAction: (reference: Parameters<typeof getFunctionName>[0]) =>
      getFunctionName(reference) === 'media/avatarActions:getAvatarImage'
        ? mocks.getAvatarImage
        : getFunctionName(reference) === 'media/characterPortraitActions:getImage'
          ? mocks.getPortraitImage
          : getFunctionName(reference) === 'media/authoredActions:getImage'
            ? mocks.getArtworkImage
            : getFunctionName(reference) === 'media/characterPortraitActions:save'
              ? mocks.savePortrait
              : getFunctionName(reference) === 'media/authoredActions:save'
                ? mocks.saveArtwork
                : mocks.saveAvatar,
    useConvexAuth: () => ({
      isAuthenticated: mocks.authenticated,
      isLoading: !mocks.authenticated
    }),
    useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
      getFunctionName(reference) === 'media/assets:createAvatarUpload'
        ? mocks.createAvatarUpload
        : getFunctionName(reference) === 'media/characterPortraitAssets:createUpload'
          ? mocks.createPortraitUpload
          : getFunctionName(reference) === 'media/authoredAssets:createUpload'
            ? mocks.createArtworkUpload
            : getFunctionName(reference) === 'media/authoredAssets:remove'
              ? mocks.removeArtwork
              : getFunctionName(reference) === 'media/characterPortraitAssets:remove'
                ? mocks.removePortrait
                : mocks.removeAvatar,
    useQuery: (reference: Parameters<typeof getFunctionName>[0], ...args: unknown[]) => {
      mocks.convexQuery(reference, ...args)
      return getFunctionName(reference) === 'media/authoredAssets:binding'
        ? mocks.artworkBinding
        : getFunctionName(reference) === 'media/characterPortraitAssets:bindingForCharacter'
          ? mocks.portraitBinding
          : mocks.avatarBinding
    }
  }
})

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

const portraitTarget = {
  lookup: {
    type: 'CHARACTER_PORTRAIT' as const,
    characterId: 'ca608635-554d-4c53-a10a-17fe6aa6db45'
  },
  attach: {
    type: 'CHARACTER_PORTRAIT' as const,
    characterId: 'ca608635-554d-4c53-a10a-17fe6aa6db45'
  }
}

describe('MediaImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authenticated = true
    mocks.avatarBinding = { assetId: null, revision: 0 }
    mocks.artworkBinding = { assetId: null, revision: 0 }
    mocks.portraitBinding = { assetId: null, revision: 0 }
  })

  it('renders authored alt text from signed delivery metadata', async () => {
    mocks.artworkBinding = {
      assetId: 'a2c914ed-8628-4a69-831c-766d7df1ef63',
      revision: 1
    }
    mocks.getArtworkImage.mockResolvedValue({
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
      await screen.findByRole('img', {
        name: 'A wizard tracing a circle of flame.'
      })
    ).toBeInTheDocument()
  })

  it('caches display and thumbnail variants separately for the same target', async () => {
    mocks.artworkBinding = {
      assetId: 'a2c914ed-8628-4a69-831c-766d7df1ef63',
      revision: 1
    }
    mocks.getArtworkImage
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
      await screen.findByRole('img', {
        name: 'A wizard tracing a circle of flame.'
      })
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
    expect(mocks.getArtworkImage).toHaveBeenCalledWith({
      target: artworkTarget.lookup,
      variantKind: 'THUMBNAIL'
    })
  })

  it('keeps the portrait trigger compact and loads its thumbnail while disabled', async () => {
    mocks.portraitBinding = {
      assetId: 'a2c914ed-8628-4a69-831c-766d7df1ef63',
      revision: 1
    }
    mocks.getPortraitImage.mockResolvedValue(null)
    renderWithAppProviders(
      <MediaImageControl
        disabled
        label='Change portrait'
        mode='square'
        profile='CHARACTER_PORTRAIT'
        target={portraitTarget}
        variant='portrait'
      />
    )

    expect(screen.getByRole('button', { name: 'Change portrait' })).toBeDisabled()
    await waitFor(() =>
      expect(mocks.getPortraitImage).toHaveBeenCalledWith({
        target: {
          type: 'CHARACTER_PORTRAIT',
          characterId: 'ca608635-554d-4c53-a10a-17fe6aa6db45'
        },
        variantKind: 'THUMBNAIL'
      })
    )
  })

  it('does not request artwork delivery without a bound asset', async () => {
    renderWithAppProviders(
      <MediaImageControl
        label='Add an image'
        mode='decorative'
        profile='AUTHORED_IMAGE'
        target={artworkTarget}
      />
    )

    expect(screen.getByRole('button', { name: 'Add an image' })).toBeInTheDocument()
    expect(mocks.getArtworkImage).not.toHaveBeenCalled()
  })

  it('shows the selected artwork in the same control', async () => {
    mocks.artworkBinding = {
      assetId: 'a2c914ed-8628-4a69-831c-766d7df1ef63',
      revision: 1
    }
    mocks.getArtworkImage.mockResolvedValue({
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
    mocks.createArtworkUpload.mockResolvedValue({
      assetId: 'a2c914ed-8628-4a69-831c-766d7df1ef63',
      method: 'PUT',
      url: 'https://example.com/upload',
      expiresAt: '2026-08-05T18:00:00.000Z'
    })
    mocks.saveArtwork.mockResolvedValue({
      assetId: 'a2c914ed-8628-4a69-831c-766d7df1ef63',
      revision: 1
    })
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }))

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
      expect(mocks.saveArtwork).toHaveBeenCalledWith({
        assetId: 'a2c914ed-8628-4a69-831c-766d7df1ef63',
        target: artworkTarget.attach,
        crop: { x: 0.125, y: 0, width: 0.75, height: 1 }
      })
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/upload',
      expect.objectContaining({ method: 'PUT' })
    )
    expect(beforeChange).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalled()
    fetchMock.mockRestore()
  })

  it('discards a selected replacement when the dialog closes', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(
      <MediaImageControl
        label='Add an image'
        mode='decorative'
        profile='AUTHORED_IMAGE'
        target={artworkTarget}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Add an image' }))
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!
    await user.upload(fileInput, new File(['image'], 'spell.png', { type: 'image/png' }))
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
    expect(screen.getByRole('button', { name: 'Save image' })).toBeEnabled()

    fireEvent.click(document.querySelector<HTMLButtonElement>('.mantine-Modal-close')!)
    await user.click(screen.getByRole('button', { name: 'Add an image' }))
    expect(screen.getByRole('button', { name: 'Save image' })).toBeDisabled()
  })

  it('retains a selected replacement after a failed save', async () => {
    const user = userEvent.setup()
    mocks.createArtworkUpload.mockRejectedValue(new Error('unavailable'))
    renderWithAppProviders(
      <MediaImageDialog
        current={null}
        label='Artwork'
        mode='decorative'
        opened
        profile='AUTHORED_IMAGE'
        target={artworkTarget}
        onClose={vi.fn()}
      />
    )
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!
    await user.upload(fileInput, new File(['image'], 'spell.png', { type: 'image/png' }))
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

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the image.')
    expect(screen.getByRole('button', { name: 'Save image' })).toBeEnabled()
  })

  it.each([
    { kind: 'avatar', profile: 'ACCOUNT_AVATAR' },
    { kind: 'portrait', profile: 'CHARACTER_PORTRAIT' },
    { kind: 'artwork', profile: 'AUTHORED_IMAGE', subjectKind: 'BACKGROUND' },
    { kind: 'artwork', profile: 'AUTHORED_IMAGE', subjectKind: 'VEHICLE' }
  ] as const)('uploads, recrops, and removes $profile through Convex', async (testCase) => {
    const { kind, profile } = testCase
    const user = userEvent.setup()
    const onClose = vi.fn()
    const target =
      testCase.kind === 'artwork'
        ? {
            lookup: {
              ...artworkTarget.lookup,
              subjectKind: testCase.subjectKind
            },
            attach: {
              ...artworkTarget.attach,
              subjectKind: testCase.subjectKind
            }
          }
        : kind === 'portrait'
          ? portraitTarget
          : {
              lookup: { type: 'ACCOUNT_AVATAR' as const },
              attach: { type: 'ACCOUNT_AVATAR' as const }
            }
    const save =
      kind === 'artwork'
        ? mocks.saveArtwork
        : kind === 'portrait'
          ? mocks.savePortrait
          : mocks.saveAvatar
    const createUpload =
      kind === 'artwork'
        ? mocks.createArtworkUpload
        : kind === 'portrait'
          ? mocks.createPortraitUpload
          : mocks.createAvatarUpload
    const remove =
      kind === 'artwork'
        ? mocks.removeArtwork
        : kind === 'portrait'
          ? mocks.removePortrait
          : mocks.removeAvatar
    const getImage =
      kind === 'artwork'
        ? mocks.getArtworkImage
        : kind === 'portrait'
          ? mocks.getPortraitImage
          : mocks.getAvatarImage
    mocks.avatarBinding = {
      assetId: 'a2c914ed-8628-4a69-831c-766d7df1ef63',
      revision: 2
    }
    mocks.artworkBinding = mocks.avatarBinding
    mocks.portraitBinding = mocks.avatarBinding
    getImage.mockResolvedValue({
      assetId: 'a2c914ed-8628-4a69-831c-766d7df1ef63',
      variantKind: 'SOURCE',
      url: 'https://example.com/avatar.webp',
      expiresAt: '2026-08-05T18:00:00.000Z',
      width: 800,
      height: 600,
      mimeType: 'image/webp',
      crop: { x: 0.125, y: 0, width: 0.75, height: 1 },
      altText: null,
      isDecorative: false
    })
    createUpload.mockResolvedValue({
      assetId: 'f188de90-d93a-47a5-9869-c7dc3347b5c8',
      method: 'PUT',
      url: 'https://example.com/upload',
      expiresAt: '2026-08-05T18:00:00.000Z'
    })
    save.mockResolvedValue({
      assetId: 'f188de90-d93a-47a5-9869-c7dc3347b5c8',
      revision: 3
    })
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }))

    renderWithAppProviders(
      <MediaImageDialog
        current={{
          assetId: 'a2c914ed-8628-4a69-831c-766d7df1ef63',
          variantKind: 'THUMBNAIL',
          url: 'https://example.com/thumbnail.webp',
          expiresAt: '2026-08-05T18:00:00.000Z',
          width: 320,
          height: 320,
          mimeType: 'image/webp',
          crop: { x: 0.125, y: 0, width: 0.75, height: 1 },
          altText: null,
          isDecorative: false
        }}
        label='Avatar'
        mode='square'
        opened
        profile={profile}
        target={target}
        onClose={onClose}
      />
    )

    await waitFor(() => expect(document.querySelector('.ReactCrop img')).not.toBeNull())
    await user.click(screen.getByRole('button', { name: 'Save image' }))
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        assetId: 'a2c914ed-8628-4a69-831c-766d7df1ef63',
        crop: { x: 0.125, y: 0, width: 0.75, height: 1 },
        ...(kind === 'avatar' ? {} : { target: target.attach })
      })
    )
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!
    await user.upload(fileInput, new File(['image'], 'avatar.png', { type: 'image/png' }))
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

    await waitFor(() => expect(createUpload).toHaveBeenCalledOnce())
    if (kind !== 'avatar')
      expect(createUpload).toHaveBeenCalledWith(expect.objectContaining({ target: target.attach }))
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/upload',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' }
      })
    )
    expect(save).toHaveBeenCalledWith({
      assetId: 'f188de90-d93a-47a5-9869-c7dc3347b5c8',
      crop: { x: 0.125, y: 0, width: 0.75, height: 1 },
      ...(kind === 'avatar' ? {} : { target: target.attach })
    })

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() =>
      expect(remove).toHaveBeenCalledWith(kind === 'avatar' ? {} : { target: target.attach })
    )
    fetchMock.mockRestore()
  })

  it.each(['BACKGROUND', 'CLASS', 'VEHICLE'] as const)(
    'reads %s bindings reactively without calling legacy media for missing or replaced artwork',
    async (subjectKind) => {
      const target = {
        lookup: { ...artworkTarget.lookup, subjectKind },
        attach: { ...artworkTarget.attach, subjectKind }
      }
      mocks.artworkBinding = undefined
      const view = renderWithAppProviders(<MediaImageView target={target} />)
      expect(mocks.getArtworkImage).not.toHaveBeenCalled()
      mocks.artworkBinding = { assetId: null, revision: 1 }
      view.rerender(<MediaImageView target={target} />)
      expect(mocks.getArtworkImage).not.toHaveBeenCalled()
      mocks.artworkBinding = {
        assetId: 'a2c914ed-8628-4a69-831c-766d7df1ef63',
        revision: 2
      }
      mocks.getArtworkImage.mockResolvedValue({
        assetId: mocks.artworkBinding.assetId,
        variantKind: 'DISPLAY',
        url: 'https://example.com/artwork.webp',
        expiresAt: '2026-09-04T18:00:00.000Z',
        width: 800,
        height: 600,
        mimeType: 'image/webp',
        crop: null,
        altText: null,
        isDecorative: true
      })
      view.rerender(<MediaImageView target={target} />)
      await waitFor(() =>
        expect(document.querySelector<HTMLImageElement>('img')?.src).toContain('artwork.webp')
      )
      expect(mocks.getArtworkImage).toHaveBeenCalledWith({
        target: target.lookup,
        variantKind: 'DISPLAY'
      })
      mocks.artworkBinding = { assetId: null, revision: 3 }
      view.rerender(<MediaImageView target={target} />)
      expect(document.querySelector('img')).toBeNull()
    }
  )

  it('gates avatar reads on authentication and does not reuse a prior binding revision', async () => {
    mocks.authenticated = false
    mocks.avatarBinding = {
      assetId: 'a2c914ed-8628-4a69-831c-766d7df1ef63',
      revision: 1
    }
    const target = {
      lookup: { type: 'ACCOUNT_AVATAR' as const },
      attach: { type: 'ACCOUNT_AVATAR' as const }
    }
    const view = renderWithAppProviders(<MediaImageView target={target} />)

    await waitFor(() =>
      expect(mocks.convexQuery).toHaveBeenLastCalledWith(expect.anything(), 'skip')
    )
    expect(mocks.getAvatarImage).not.toHaveBeenCalled()

    mocks.authenticated = true
    mocks.getAvatarImage
      .mockResolvedValueOnce({
        assetId: 'a2c914ed-8628-4a69-831c-766d7df1ef63',
        variantKind: 'DISPLAY',
        url: 'https://example.com/first-avatar.webp',
        expiresAt: '2026-08-05T18:00:00.000Z',
        width: 320,
        height: 320,
        mimeType: 'image/webp',
        crop: null,
        altText: null,
        isDecorative: false
      })
      .mockResolvedValueOnce({
        assetId: 'f188de90-d93a-47a5-9869-c7dc3347b5c8',
        variantKind: 'DISPLAY',
        url: 'https://example.com/second-avatar.webp',
        expiresAt: '2026-08-05T18:00:00.000Z',
        width: 320,
        height: 320,
        mimeType: 'image/webp',
        crop: null,
        altText: null,
        isDecorative: false
      })
    view.rerender(<MediaImageView target={target} />)
    await waitFor(() =>
      expect(document.querySelector<HTMLImageElement>('img')?.src).toContain('first-avatar.webp')
    )

    mocks.avatarBinding = {
      assetId: 'f188de90-d93a-47a5-9869-c7dc3347b5c8',
      revision: 2
    }
    view.rerender(<MediaImageView target={target} />)
    await waitFor(() =>
      expect(document.querySelector<HTMLImageElement>('img')?.src).toContain('second-avatar.webp')
    )
    expect(mocks.getAvatarImage).toHaveBeenCalledTimes(2)
  })
})
