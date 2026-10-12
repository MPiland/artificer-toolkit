import { screen } from '@testing-library/react'
import { getFunctionName } from 'convex/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@artificer-toolkit/apis/convex/api'
import {
  publicProfileDtoSchema,
  type PublicProfileDto
} from '@artificer-toolkit/schema/api/account'
import { signedImageDeliveryDtoSchema } from '@artificer-toolkit/schema/api/media'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { PublicProfilePage } from './PublicProfilePage'

const mocks = vi.hoisted(() => ({
  result: { data: undefined as unknown, isPending: false, isError: false },
  queries: vi.fn(),
  avatar: vi.fn()
}))

vi.mock('@convex-dev/react-query', async (original) => ({
  ...(await original<typeof import('@convex-dev/react-query')>()),
  convexQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
    mocks.queries(getFunctionName(reference), args)
    return { queryKey: ['native-profile', getFunctionName(reference), args] }
  }
}))
vi.mock('@tanstack/react-query', async (original) => ({
  ...(await original<typeof import('@tanstack/react-query')>()),
  useQuery: () => mocks.result
}))
vi.mock('#app/data/media', () => ({ useProfileAvatarImage: mocks.avatar }))

function publicProfile(overrides: Partial<PublicProfileDto> = {}) {
  return publicProfileDtoSchema.parse({
    username: 'RiverScout',
    bio: 'Ranger of the north.',
    avatarRevision: null,
    ...overrides
  })
}

describe('PublicProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.result = { data: publicProfile(), isPending: false, isError: false }
    mocks.avatar.mockReturnValue({ data: null })
  })

  it('shows the username, bio and avatar of a public profile', () => {
    mocks.result = { data: publicProfile({ avatarRevision: 3 }), isPending: false, isError: false }
    mocks.avatar.mockReturnValue({
      data: signedImageDeliveryDtoSchema.parse({
        assetId: crypto.randomUUID(),
        variantKind: 'THUMBNAIL',
        url: 'https://media.example.test/avatar.webp',
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
        width: 320,
        height: 320,
        mimeType: 'image/webp',
        crop: null,
        altText: null,
        isDecorative: false
      })
    })
    renderWithAppProviders(<PublicProfilePage username='RiverScout' />)

    expect(screen.getByRole('heading', { level: 1, name: 'RiverScout' })).toBeInTheDocument()
    expect(screen.getByText('Ranger of the north.')).toBeInTheDocument()
    expect(mocks.avatar).toHaveBeenCalledWith('RiverScout', 3)
    expect(mocks.queries).toHaveBeenCalledWith(getFunctionName(api.account.publicProfile), {
      username: 'RiverScout'
    })
  })

  it('shows one neutral state when the profile is private or does not exist', () => {
    mocks.result = { data: null, isPending: false, isError: false }
    renderWithAppProviders(<PublicProfilePage username='RiverScout' />)

    expect(screen.getByText("This profile is private or doesn't exist.")).toBeInTheDocument()
    expect(screen.queryByText('RiverScout')).not.toBeInTheDocument()
  })

  it('does not query for a malformed username and shows the same neutral state', () => {
    renderWithAppProviders(<PublicProfilePage username='not a username!' />)

    expect(screen.getByText("This profile is private or doesn't exist.")).toBeInTheDocument()
    expect(mocks.queries).toHaveBeenCalledWith(getFunctionName(api.account.publicProfile), 'skip')
  })

  it('shows a loading state while the profile loads and an alert when loading fails', () => {
    mocks.result = { data: undefined, isPending: true, isError: false }
    const view = renderWithAppProviders(<PublicProfilePage username='RiverScout' />)
    expect(screen.getByLabelText('Loading profile')).toBeInTheDocument()

    mocks.result = { data: undefined, isPending: false, isError: true }
    view.rerender(<PublicProfilePage username='RiverScout' />)
    expect(screen.getByRole('alert')).toHaveTextContent('could not be loaded')
  })
})
