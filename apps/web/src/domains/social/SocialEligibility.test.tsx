import { screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SocialEligibilityDto } from '@artificer-toolkit/schema/api/socialHub'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { SocialEligibility } from './SocialEligibility'

type EligibilityFixture = {
  data: Pick<SocialEligibilityDto, 'status' | 'eligible'> | undefined
  isPending: boolean
  isError: boolean
}

const mocks = vi.hoisted(() => ({
  eligibility: {
    data: { status: 'ACTIVE', eligible: true } as Pick<SocialEligibilityDto, 'status' | 'eligible'>,
    isPending: false,
    isError: false
  } as EligibilityFixture,
  initialize: vi.fn(),
  query: vi.fn()
}))

vi.mock('@convex-dev/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@convex-dev/react-query')>()),
  convexQuery: (...args: unknown[]) => {
    mocks.query(...args)
    return { queryKey: ['social-eligibility'] }
  }
}))
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: () => mocks.eligibility
}))
vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  useMutation: () => mocks.initialize
}))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  Outlet: () => <div>Social outlet</div>
}))

describe('SocialEligibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.eligibility = {
      data: { status: 'ACTIVE', eligible: true },
      isPending: false,
      isError: false
    }
    mocks.initialize.mockResolvedValue(mocks.eligibility.data)
  })

  it('renders the outlet for an active eligible profile', () => {
    renderWithAppProviders(<SocialEligibility />)
    expect(screen.getByText('Social outlet')).toBeVisible()
    expect(mocks.initialize).not.toHaveBeenCalled()
  })

  it('initializes once when the profile is absent', async () => {
    mocks.eligibility = {
      data: { status: null, eligible: false },
      isPending: false,
      isError: false
    }
    renderWithAppProviders(<SocialEligibility />)
    await waitFor(() => expect(mocks.initialize).toHaveBeenCalledTimes(1))
  })

  it('does not initialize or render the outlet for suspended profiles', () => {
    mocks.eligibility = {
      data: { status: 'SUSPENDED', eligible: false },
      isPending: false,
      isError: false
    }
    renderWithAppProviders(<SocialEligibility />)
    expect(screen.getByText('Social Hub unavailable')).toBeVisible()
    expect(screen.queryByText('Social outlet')).not.toBeInTheDocument()
    expect(mocks.initialize).not.toHaveBeenCalled()
  })

  it('keeps query failures unavailable', () => {
    mocks.eligibility = { data: undefined, isPending: false, isError: true }
    renderWithAppProviders(<SocialEligibility />)
    expect(
      screen.getByText('Social Hub is unavailable. Reload the page to try again.')
    ).toBeVisible()
  })

  it('keeps initialization failures unavailable', async () => {
    mocks.eligibility = {
      data: { status: null, eligible: false },
      isPending: false,
      isError: false
    }
    mocks.initialize.mockRejectedValue(new Error('Username required.'))
    renderWithAppProviders(<SocialEligibility />)
    expect(await screen.findByText('Username required.')).toBeVisible()
  })
})
