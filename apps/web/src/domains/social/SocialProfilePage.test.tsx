import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getFunctionName } from 'convex/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { socialBlockStatusSchema } from '@artificer-toolkit/schema/api/socialBlockLists'
import {
  socialEligibilityDtoSchema,
  socialProfileDtoSchema,
  socialReportReceiptDtoSchema
} from '@artificer-toolkit/schema/api/socialHub'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { SocialProfilePage } from './SocialProfilePage'

const targetId = 'aaaaaaaa-1111-4111-8111-111111111111'
const actorId = '22222222-2222-4222-8222-222222222222'
const mocks = vi.hoisted(() => ({
  blocked: false,
  self: false,
  pending: false,
  statusError: false,
  profileError: false,
  queries: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
  report: vi.fn()
}))

vi.mock('@convex-dev/react-query', async (original) => ({
  ...(await original<typeof import('@convex-dev/react-query')>()),
  convexQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(reference)
    mocks.queries(name, args)
    return { queryKey: ['native-social', name, args] }
  }
}))
vi.mock('@tanstack/react-query', async (original) => ({
  ...(await original<typeof import('@tanstack/react-query')>()),
  useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => {
    const name = queryKey[1]
    if (name === 'social/profiles:getEligibility')
      return {
        data: socialEligibilityDtoSchema.parse({
          profilePublicId: mocks.self ? targetId : actorId,
          eligible: true,
          adultAttestedAt: null,
          contentPreference: 'STANDARD',
          status: 'ACTIVE'
        }),
        isPending: false,
        isError: false
      }
    if (name === 'social/blocks:getStatus')
      return {
        data: mocks.pending ? undefined : socialBlockStatusSchema.parse({ blocked: mocks.blocked }),
        isPending: mocks.pending,
        isError: mocks.statusError
      }
    if (name === 'social/discovery:getProfile')
      return {
        data: socialProfileDtoSchema.parse({ profilePublicId: targetId, username: 'TargetPlayer' }),
        isPending: queryKey[2] === 'skip',
        isError: mocks.profileError
      }
    throw new Error(`Unexpected query ${String(name)}`)
  }
}))
vi.mock('convex/react', async (original) => ({
  ...(await original<typeof import('convex/react')>()),
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference)
    if (name === 'social/blocks:create') return mocks.create
    if (name === 'social/blocks:remove') return mocks.remove
    if (name === 'social/reports:create') return mocks.report
    throw new Error(`Unexpected mutation ${name}`)
  }
}))

describe('native Social profile actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.blocked = false
    mocks.self = false
    mocks.pending = false
    mocks.statusError = false
    mocks.profileError = false
    mocks.create.mockImplementation(async () => {
      mocks.blocked = true
    })
    mocks.remove.mockImplementation(async () => {
      mocks.blocked = false
    })
    mocks.report.mockResolvedValue(
      socialReportReceiptDtoSchema.parse({
        reportPublicId: '33333333-3333-4333-8333-333333333333',
        status: 'SUBMITTED',
        createdAt: '2026-09-01T00:00:00.000Z'
      })
    )
  })

  it('blocks and unblocks through exact native status while skipping blocked profile discovery', async () => {
    const user = userEvent.setup()
    renderWithAppProviders(<SocialProfilePage profilePublicId={targetId.toUpperCase()} />)
    expect(screen.getByRole('heading', { name: '@TargetPlayer' })).toBeInTheDocument()
    expect(mocks.queries).toHaveBeenCalledWith('social/blocks:getStatus', {
      profilePublicId: targetId
    })
    await user.click(screen.getByRole('button', { name: 'Block' }))
    await screen.findByRole('heading', { name: 'Blocked profile' })
    expect(mocks.create).toHaveBeenCalledWith({ profilePublicId: targetId })
    expect(mocks.queries).toHaveBeenCalledWith('social/discovery:getProfile', 'skip')
    expect(screen.queryByText('@TargetPlayer')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Unblock' }))
    await screen.findByRole('heading', { name: '@TargetPlayer' })
    expect(mocks.remove).toHaveBeenCalledWith({ profilePublicId: targetId })
  })

  it('keeps blocked actions available without target discovery and reports through native evidence capture', async () => {
    mocks.blocked = true
    mocks.profileError = true
    const user = userEvent.setup()
    renderWithAppProviders(<SocialProfilePage profilePublicId={targetId} />)
    expect(screen.getByRole('button', { name: 'Unblock' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Report' }))
    await user.type(
      await screen.findByRole('textbox', { name: /What happened/ }),
      'Review this interaction.'
    )
    await user.click(screen.getByRole('button', { name: 'Submit report' }))
    await waitFor(() =>
      expect(mocks.report).toHaveBeenCalledWith({
        input: {
          targetKind: 'PROFILE',
          targetPublicId: targetId,
          reason: 'OTHER',
          details: 'Review this interaction.'
        }
      })
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows errors without changing the known state', async () => {
    mocks.blocked = true
    mocks.remove.mockRejectedValueOnce(new Error('Unblock failed'))
    const user = userEvent.setup()
    renderWithAppProviders(<SocialProfilePage profilePublicId={targetId} />)
    await user.click(screen.getByRole('button', { name: 'Unblock' }))
    expect(
      await screen.findByText('The block could not be removed. Try again.')
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Blocked profile' })).toBeInTheDocument()
  })

  it('withholds actions until status resolves and hides actions for self', () => {
    mocks.pending = true
    const rendered = renderWithAppProviders(<SocialProfilePage profilePublicId={targetId} />)
    expect(screen.getByLabelText('Loading Social profile')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Block' })).not.toBeInTheDocument()
    mocks.pending = false
    mocks.self = true
    rendered.rerender(<SocialProfilePage profilePublicId={targetId} />)
    expect(screen.getByRole('heading', { name: '@TargetPlayer' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Block' })).not.toBeInTheDocument()
  })
})
